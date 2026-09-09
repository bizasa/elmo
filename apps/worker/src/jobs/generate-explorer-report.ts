import type { Job } from "pg-boss";
import { db } from "@workspace/lib/db/db";
import { explorerReports } from "@workspace/lib/db/schema";
import { eq } from "drizzle-orm";
import { processExplorerReportJob, type ExplorerReportJobData } from "../explorer-report-worker";

export async function generateExplorerReportJob(jobs: Job<ExplorerReportJobData>[]): Promise<void> {
	for (const job of jobs) {
		const { reportId } = job.data;
		const log = (m: string) => console.log(`[ExplorerReport ${reportId}] ${m}`);
		const updateProgress = async (progress: number) => {
			try {
				await db
					.update(explorerReports)
					.set({ progress: Math.round(progress) })
					.where(eq(explorerReports.id, reportId));
			} catch (err) {
				console.error(`[ExplorerReport ${reportId}] progress persist failed:`, err);
			}
		};
		await processExplorerReportJob({ data: job.data, log, updateProgress });
	}
}
