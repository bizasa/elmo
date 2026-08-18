/**
 * /api/explorer/:reportId - Raw HTML view of a generated explorer report.
 *
 * Serves the stored self-contained HTML as a standalone page (for opening in
 * a new tab), rather than JSON. Outside `_authed`, so auth is enforced here.
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@workspace/lib/db/db";
import { explorerReports } from "@workspace/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuthSession, hasReportAccess } from "@/lib/auth/helpers";

export const Route = createFileRoute("/api/explorer/$reportId")({
	server: {
		handlers: {
			GET: async ({ params }: { params: { reportId: string } }) => {
				const session = await requireAuthSession();
				if (!hasReportAccess(session)) return new Response("Forbidden", { status: 403 });

				const rows = await db
					.select({ html: explorerReports.html, status: explorerReports.status })
					.from(explorerReports)
					.where(eq(explorerReports.id, params.reportId))
					.limit(1);

				const row = rows[0];
				if (!row) return new Response("Not found", { status: 404 });

				if (row.status !== "completed" || !row.html) {
					return new Response(
						`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px">Report status: ${row.status}. Refresh when completed.</body>`,
						{
							status: 200,
							headers: { "content-type": "text/html; charset=utf-8" },
						},
					);
				}

				return new Response(row.html, {
					headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow" },
				});
			},
		},
	},
});
