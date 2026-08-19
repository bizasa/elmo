import { db } from "@workspace/lib/db/db";
import { brands, competitors, explorerReports, promptRuns, prompts } from "@workspace/lib/db/schema";
import { assembleExplorerData, type RunInput } from "@workspace/lib/explorer/build-data";
import { buildNarrativeMetrics } from "@workspace/lib/explorer/metrics";
import { renderExplorerHtml } from "@workspace/lib/explorer/render-html";
import { generateNarrative } from "@workspace/lib/narrative/generate-narrative";
import { and, eq, gte, inArray } from "drizzle-orm";

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
		// Pull run metadata WITHOUT raw_output first. Loading every run's raw_output
		// at once OOMs large brands (hundreds of MB of stored answers), and we only
		// render the newest few per (prompt, model) anyway.
		const meta = await db
			.select({
				id: promptRuns.id,
				promptId: promptRuns.promptId,
				model: promptRuns.model,
				provider: promptRuns.provider,
				brandMentioned: promptRuns.brandMentioned,
				brandPosition: promptRuns.brandPosition,
				competitorsMentioned: promptRuns.competitorsMentioned,
				createdAt: promptRuns.createdAt,
			})
			.from(promptRuns)
			.where(and(eq(promptRuns.brandId, brandId), gte(promptRuns.createdAt, windowStart)));

		// Sample the newest N runs per (prompt, model) — the same set the report renders.
		const groups = new Map<string, typeof meta>();
		for (const r of meta) {
			const key = `${r.promptId}::${r.model}`;
			const arr = groups.get(key) ?? [];
			arr.push(r);
			groups.set(key, arr);
		}
		const selected: typeof meta = [];
		for (const arr of groups.values()) {
			arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
			selected.push(...arr.slice(0, PER_PROMPT_MODEL_LIMIT));
		}

		// Fetch raw_output only for the sampled runs, batched to keep the IN list sane.
		const rawById = new Map<string, unknown>();
		for (let i = 0; i < selected.length; i += 500) {
			const batchIds = selected.slice(i, i + 500).map((s) => s.id);
			const rows = await db
				.select({ id: promptRuns.id, rawOutput: promptRuns.rawOutput })
				.from(promptRuns)
				.where(inArray(promptRuns.id, batchIds));
			for (const row of rows) rawById.set(row.id, row.rawOutput);
		}
		ctx.log(`Sampled ${selected.length} of ${meta.length} runs in window`);
		await ctx.updateProgress(35);

		const runs: RunInput[] = selected.map((r) => ({
			promptId: r.promptId,
			model: r.model,
			provider: r.provider,
			brandMentioned: r.brandMentioned,
			brandPosition: r.brandPosition,
			competitorsMentioned: r.competitorsMentioned,
			createdAt: r.createdAt,
			rawOutput: rawById.get(r.id),
		}));
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
