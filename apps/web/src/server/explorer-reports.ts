/**
 * Server functions for explorer report operations.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthSession, hasReportAccess } from "@/lib/auth/helpers";
import { db } from "@workspace/lib/db/db";
import { brands, explorerReports, type NewExplorerReport } from "@workspace/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { sendExplorerReportJob } from "@/lib/job-scheduler";

async function requireReportAccess() {
	const session = await requireAuthSession();
	if (!hasReportAccess(session)) throw new Error("Access denied. Report generator access required.");
}

/**
 * Get all explorer reports
 */
export const getExplorerReportsFn = createServerFn({ method: "GET" }).handler(async () => {
	await requireReportAccess();

	return db
		.select({
			id: explorerReports.id,
			brandId: explorerReports.brandId,
			brandName: explorerReports.brandName,
			windowDays: explorerReports.windowDays,
			language: explorerReports.language,
			model: explorerReports.model,
			status: explorerReports.status,
			progress: explorerReports.progress,
			createdAt: explorerReports.createdAt,
			completedAt: explorerReports.completedAt,
		})
		.from(explorerReports)
		.orderBy(desc(explorerReports.createdAt));
});

/**
 * Get a single explorer report by ID
 */
export const getExplorerReportByIdFn = createServerFn({ method: "GET" })
	.validator(z.object({ reportId: z.string() }))
	.handler(async ({ data }) => {
		await requireReportAccess();

		const rows = await db.select().from(explorerReports).where(eq(explorerReports.id, data.reportId)).limit(1);
		if (rows.length === 0) throw new Error("Report not found");
		const report = rows[0];
		return { ...report, narrative: report.narrative as {} | null };
	});

/**
 * Create a new explorer report and queue generation job
 */
export const createExplorerReportFn = createServerFn({ method: "POST" })
	.validator(
		z.object({
			brandId: z.string().min(1),
			windowDays: z.number().int().min(1).max(365),
			language: z.enum(["vi", "en"]),
		}),
	)
	.handler(async ({ data }) => {
		await requireReportAccess();

		const brand = await db.query.brands.findFirst({ where: eq(brands.id, data.brandId) });
		if (!brand) throw new Error("Brand not found");

		const newExplorerReport: NewExplorerReport = {
			brandId: brand.id,
			brandName: brand.name,
			windowDays: data.windowDays,
			language: data.language,
			status: "pending",
		};

		const result = await db.insert(explorerReports).values(newExplorerReport).returning();
		const createdReport = result[0];
		if (!createdReport) throw new Error("Failed to create explorer report");

		try {
			const success = await sendExplorerReportJob(
				createdReport.id,
				createdReport.brandId,
				createdReport.windowDays,
				createdReport.language,
			);
			if (!success) throw new Error("Failed to send explorer report job");
		} catch (error) {
			await db
				.update(explorerReports)
				.set({ status: "failed", updatedAt: new Date() })
				.where(eq(explorerReports.id, createdReport.id));
			throw new Error("Failed to queue explorer report generation");
		}

		return { ...createdReport, narrative: createdReport.narrative as {} | null };
	});
