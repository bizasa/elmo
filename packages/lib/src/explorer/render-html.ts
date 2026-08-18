import { EXPLORER_TEMPLATE } from "./template";
import type { ExplorerData, Narrative } from "./types";

function esc(s: string): string {
	return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function narrativeHtml(n: Narrative): string {
	const findings = n.keyFindings.map((f) => `<li>${esc(f)}</li>`).join("");
	const recs = n.recommendations.map((r) => `<li>${esc(r)}</li>`).join("");
	return (
		`<h2>${esc("Tóm tắt")}</h2><p>${esc(n.executiveSummary)}</p>` +
		`<h3>Findings</h3><ul>${findings}</ul>` +
		`<h3>Competitor gaps</h3><p>${esc(n.competitorGaps)}</p>` +
		`<h3>Recommendations</h3><ul>${recs}</ul>`
	);
}

export interface RenderArgs {
	data: ExplorerData;
	narrative: Narrative | null;
	brandName: string;
	windowDays: number;
	sampleNote: string;
}

/** Inject the deterministic data + narrative into the explorer template. */
export function renderExplorerHtml(args: RenderArgs): string {
	const { data, narrative, brandName, windowDays, sampleNote } = args;
	const footer = esc(`Nguồn: Elmo · brand ${brandName} · ${windowDays} ngày gần nhất. ${sampleNote}`);
	return EXPLORER_TEMPLATE.replace("__DATA__", JSON.stringify(data.records))
		.replace("__CONFIG__", JSON.stringify(data.config))
		.replace("__BRAND_LABEL__", JSON.stringify(brandName))
		.replace("__FOOTER_HTML__", JSON.stringify(footer))
		.replace("__NARRATIVE_HTML__", narrative ? narrativeHtml(narrative) : "");
}
