import { describe, expect, it } from "vitest";
import { renderExplorerHtml } from "./render-html";
import type { ExplorerData, Narrative } from "./types";

const data: ExplorerData = {
	records: [{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: true, pos: 1, d: "2026-08-10", p: "q", c: ["X"], x: "Visana wins" }],
	config: { brandTerms: ["visana"], models: [["chatgpt", "ChatGPT"]], prods: [["china-visa", "china-visa"]], funs: [["bofu", "BOFU"]], alts: { X: ["x"] }, untracked: [] },
};
const narrative: Narrative = { executiveSummary: "Sum & <ok>", keyFindings: ["f1"], competitorGaps: "gap", recommendations: ["r1"] };

describe("renderExplorerHtml", () => {
	it("injects data, brand label, narrative, and footer with no leftover placeholders", () => {
		const html = renderExplorerHtml({ data, narrative, brandName: "Visana", windowDays: 30, sampleNote: "note" });
		expect(html).not.toMatch(/__DATA__|__CONFIG__|__BRAND_LABEL__|__FOOTER_HTML__|__NARRATIVE_HTML__/);
		expect(html).toContain('"china-visa"');
		expect(html).toContain("Visana");
		expect(html).toContain("f1");
		expect(html).toContain("Sum &amp; &lt;ok&gt;");
	});
});
