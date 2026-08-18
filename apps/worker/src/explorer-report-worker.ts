import { db } from "@workspace/lib/db/db";
import { brands, competitors, explorerReports, promptRuns, prompts } from "@workspace/lib/db/schema";
import { assembleExplorerData, type RunInput } from "@workspace/lib/explorer/build-data";
import { buildNarrativeMetrics } from "@workspace/lib/explorer/metrics";
import { renderExplorerHtml } from "@workspace/lib/explorer/render-html";
import { generateNarrative } from "@workspace/lib/narrative/generate-narrative";
import { and, eq, gte } from "drizzle-orm";

export interface ExplorerReportJobData {
	reportId: string;
	brandId: string;
	windowDays: number;
	language: string;
}

export interface ExplorerReportJobContext {
	data: ExplorerReportJobData;
	log: (m: string) => void;
	updateProgress: (p: number) => void | Promise<void>;
}

const PER_PROMPT_MODEL_LIMIT = 4;

export async function processExplorerReportJob(ctx: ExplorerReportJobContext): Promise<void> {
	const { reportId, brandId, windowDays, language } = ctx.data;
	ctx.log(`Processing explorer report ${reportId} for brand ${brandId}`);

	try {
		await db
			.update(explorerReports)
			.set({ status: "processing", updatedAt: new Date() })
			.where(eq(explorerReports.id, reportId));
		await ctx.updateProgress(5);

		const brand = await db.query.brands.findFirst({ where: eq(brands.id, brandId) });
		if (!brand) throw new Error(`Brand ${brandId} not found`);

		const brandPrompts = await db.query.prompts.findMany({ where: eq(prompts.brandId, brandId) });
		const brandCompetitors = await db.query.competitors.findMany({ where: eq(competitors.brandId, brandId) });

		const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
		const runRows = await db
			.select({
				promptId: promptRuns.promptId,
				model: promptRuns.model,
				provider: promptRuns.provider,
				brandMentioned: promptRuns.brandMentioned,
				brandPosition: promptRuns.brandPosition,
				competitorsMentioned: promptRuns.competitorsMentioned,
				createdAt: promptRuns.createdAt,
				rawOutput: promptRuns.rawOutput,
			})
			.from(promptRuns)
			.where(and(eq(promptRuns.brandId, brandId), gte(promptRuns.createdAt, windowStart)));
		await ctx.updateProgress(35);

		const runs: RunInput[] = runRows.map((r) => ({ ...r }));
		const data = assembleExplorerData({
			brand: { name: brand.name, aliases: brand.aliases, website: brand.website },
			prompts: brandPrompts.map((p) => ({ id: p.id, value: p.value, tags: p.tags })),
			competitors: brandCompetitors.map((c) => ({ name: c.name, aliases: c.aliases })),
			runs,
			perPromptModelLimit: PER_PROMPT_MODEL_LIMIT,
		});
		ctx.log(`Assembled ${data.records.length} answer records`);
		await ctx.updateProgress(55);

		const metrics = buildNarrativeMetrics(data, brand.name, windowDays);

		let narrative = null;
		let model: string | null = null;
		try {
			const result = await generateNarrative(metrics, language);
			narrative = result.narrative;
			model = result.model;
			ctx.log(`Narrative written by ${model}`);
		} catch (err) {
			ctx.log(`Narrative generation failed: ${err instanceof Error ? err.message : String(err)}`);
		}
		await ctx.updateProgress(85);

		const sampleNote = `Mẫu: tối đa ${PER_PROMPT_MODEL_LIMIT} câu trả lời mới nhất / (prompt × model) = ${data.records.length} lượt.`;
		const html = renderExplorerHtml({ data, narrative, brandName: brand.name, windowDays, sampleNote });

		await db
			.update(explorerReports)
			.set({ status: "completed", completedAt: new Date(), updatedAt: new Date(), html, narrative, model })
			.where(eq(explorerReports.id, reportId));
		await ctx.updateProgress(100);
		ctx.log(`Explorer report ${reportId} completed`);
	} catch (error) {
		ctx.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
		await db
			.update(explorerReports)
			.set({ status: "failed", updatedAt: new Date() })
			.where(eq(explorerReports.id, reportId));
		throw error;
	}
}
