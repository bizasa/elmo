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

	it("escapes </script> in injected data so it cannot break out of the script tag (C1)", () => {
		const evil: ExplorerData = {
			records: [{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: true, pos: 1, d: "2026-08-10", p: "q", c: ["</script><script>alert(1)</script>"], x: "</script><img src=x onerror=alert(1)>" }],
			config: { brandTerms: ["visana"], models: [["chatgpt", "ChatGPT"]], prods: [["china-visa", "china-visa"]], funs: [["bofu", "BOFU"]], alts: { "</script>evil": ["x"] }, untracked: ["</script>evil"] },
		};
		const html = renderExplorerHtml({ data: evil, narrative: null, brandName: "Visana", windowDays: 30, sampleNote: "n" });
		// No raw closing script tag from the injected data — only the template's own legitimate </script> tags remain.
		expect(html).not.toContain("</script><script>alert(1)");
		expect(html).not.toContain("</script><img");
		// The dangerous sequence is neutralized via unicode escaping.
		expect(html).toContain("\\u003c/script");
	});

	it("does not corrupt data containing $ replacement patterns (I1)", () => {
		const dollar: ExplorerData = {
			records: [{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: true, pos: 1, d: "2026-08-10", p: "q", c: [], x: "price $100, $& and $' and $` end" }],
			config: { brandTerms: ["visana"], models: [["chatgpt", "ChatGPT"]], prods: [["china-visa", "china-visa"]], funs: [["bofu", "BOFU"]], alts: {}, untracked: [] },
		};
		const html = renderExplorerHtml({ data: dollar, narrative: { executiveSummary: "cost $5 $& $' done", keyFindings: [], competitorGaps: "", recommendations: [] }, brandName: "Visana", windowDays: 30, sampleNote: "n" });
		// The literal $-sequences survive verbatim (were not expanded by String.replace).
		expect(html).toContain("price $100, $& and $' and $` end");
		expect(html).not.toContain("__DATA__");
		expect(html).not.toContain("__NARRATIVE_HTML__");
	});
});
