import { renderReportBody } from "./report-html";
import { EXPLORER_TEMPLATE } from "./template";
import type { ExplorerData, Narrative, ReportMetrics } from "./types";

function esc(s: string): string {
	return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** JSON safe to embed inside an inline <script>: escapes the chars that could
 * break out of the tag (`<`, needed to neutralize `</script>`) or break the
 * script's JS parsing (`>` for defense-in-depth; U+2028/U+2029, which
 * JSON.stringify emits raw but which are illegal unescaped inside a JS string
 * literal). `&` is intentionally left alone — it needs no escaping here (this
 * is script text, not an HTML entity context) and escaping it would corrupt
 * literal `$&`-style content. */
function scriptJson(value: unknown): string {
	return JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(new RegExp(LINE_SEPARATOR, "g"), "\\u2028")
		.replace(new RegExp(PARAGRAPH_SEPARATOR, "g"), "\\u2029");
}

export interface RenderArgs {
	data: ExplorerData;
	narrative: Narrative | null;
	brandName: string;
	windowDays: number;
	sampleNote: string;
	reportMetrics: ReportMetrics;
}

/** Inject the deterministic data + narrative into the explorer template.
 * All placeholders use FUNCTION replacers so `$`-sequences in the content are
 * inserted literally (String.replace treats $-patterns specially only for
 * string replacements). */
export function renderExplorerHtml(args: RenderArgs): string {
	const { data, narrative, brandName, windowDays, sampleNote, reportMetrics } = args;
	const footer = esc(`Nguồn: Elmo · brand ${brandName} · ${windowDays} ngày gần nhất. ${sampleNote}`);
	return EXPLORER_TEMPLATE.replace("__DATA__", () => scriptJson(data.records))
		.replace("__CONFIG__", () => scriptJson(data.config))
		.replace("__BRAND_LABEL__", () => scriptJson(brandName))
		.replace("__FOOTER_HTML__", () => scriptJson(footer))
		.replace("__REPORT_HTML__", () => renderReportBody(reportMetrics, narrative, { brandName, windowDays }))
		// Header/legend brand name appears in several spots; escape once, replace all.
		.replace(/__BRAND_NAME__/g, () => esc(brandName));
}
