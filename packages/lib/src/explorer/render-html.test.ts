import { describe, expect, it } from "vitest";
import { renderExplorerHtml } from "./render-html";
import type { ExplorerData, Narrative, ReportMetrics } from "./types";

const data: ExplorerData = {
	records: [{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: true, pos: 1, d: "2026-08-10", p: "q", c: ["X"], x: "Visana wins" }],
	config: { brandTerms: ["visana"], models: [["chatgpt", "ChatGPT"]], prods: [["china-visa", "china-visa"]], funs: [["bofu", "BOFU"]], alts: { X: ["x"] }, untracked: [] },
};
const narrative: Narrative = {
	summary: "Sum & <ok>",
	byModelNote: "models note",
	byFunnelNote: "funnel note",
	whatLLMsSay: "llms say",
	weakNote: "weak note",
	recommendations: [{ title: "r1", body: "b1" }, { title: "r2", body: "b2" }, { title: "r3", body: "b3" }],
};
const reportMetrics: ReportMetrics = {
	brandName: "Visana",
	windowDays: 30,
	totalAnswers: 1,
	mentioned: 1,
	visibilityPct: 100,
	avgPosition: 1,
	promptsStrong: 1,
	promptsWeak: 0,
	modelCount: 1,
	promptCount: 1,
	productCount: 1,
	byModel: [{ model: "chatgpt", runs: 1, mentioned: 1, visibilityPct: 100, avgPosition: 1 }],
	byFunnel: [{ key: "bofu", runs: 1, visibilityPct: 100, avgPosition: 1 }],
	byProduct: [{ key: "china-visa", runs: 1, visibilityPct: 100, avgPosition: 1 }],
	competitorsTracked: ["X"],
	competitorsUntracked: [],
	weakPrompts: [],
	allPrompts: [{ prompt: "q", product: "china-visa", funnel: "bofu", runs: 1, visibilityPct: 100, avgPosition: 1 }],
};

describe("renderExplorerHtml", () => {
	it("injects data, brand label, narrative, and footer with no leftover placeholders", () => {
		const html = renderExplorerHtml({ data, narrative, brandName: "Visana", windowDays: 30, sampleNote: "note", reportMetrics });
		expect(html).not.toMatch(/__DATA__|__CONFIG__|__BRAND_LABEL__|__FOOTER_HTML__|__REPORT_HTML__/);
		expect(html).toContain('"china-visa"');
		expect(html).toContain("Visana");
		expect(html).toContain("r1");
		expect(html).toContain("Sum &amp; &lt;ok&gt;");
	});

	it("renders the report tab with metric cards, narrative prose, and recommendations", () => {
		const html = renderExplorerHtml({ data, narrative, brandName: "Visana", windowDays: 30, sampleNote: "note", reportMetrics });
		expect(html).toContain('id="pane-report"');
		expect(html).toContain('id="pane-explorer"');
		expect(html).toContain('data-tab="report"');
		expect(html).toContain("Báo cáo");
		expect(html).toContain("AI Visibility");
		expect(html).toContain("Sum &amp; &lt;ok&gt;");
		expect(html).toContain("r1");
	});

	it("escapes </script> in injected data so it cannot break out of the script tag (C1)", () => {
		const evil: ExplorerData = {
			records: [{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: true, pos: 1, d: "2026-08-10", p: "q", c: ["</script><script>alert(1)</script>"], x: "</script><img src=x onerror=alert(1)>" }],
			config: { brandTerms: ["visana"], models: [["chatgpt", "ChatGPT"]], prods: [["china-visa", "china-visa"]], funs: [["bofu", "BOFU"]], alts: { "</script>evil": ["x"] }, untracked: ["</script>evil"] },
		};
		const html = renderExplorerHtml({ data: evil, narrative: null, brandName: "Visana", windowDays: 30, sampleNote: "n", reportMetrics });
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
		const html = renderExplorerHtml({
			data: dollar,
			narrative: { summary: "cost $5 $& $' done", byModelNote: "", byFunnelNote: "", whatLLMsSay: "", weakNote: "", recommendations: [] },
			brandName: "Visana",
			windowDays: 30,
			sampleNote: "n",
			reportMetrics,
		});
		// The literal $-sequences survive verbatim (were not expanded by String.replace).
		expect(html).toContain("price $100, $& and $' and $` end");
		expect(html).not.toContain("__DATA__");
		expect(html).not.toContain("__REPORT_HTML__");
	});

	it("parameterizes the header brand name and leaves no template brand leak", () => {
		const aviaData: ExplorerData = {
			records: [{ m: "chatgpt", pr: "fast-track", fn: "bofu", v: true, pos: 1, d: "2026-08-10", p: "q", c: [], x: "avia is quick" }],
			config: { brandTerms: ["avia"], models: [["chatgpt", "ChatGPT"]], prods: [["fast-track", "fast-track"]], funs: [["bofu", "BOFU"]], alts: {}, untracked: [] },
		};
		const aviaMetrics: ReportMetrics = { ...reportMetrics, brandName: "avia" };
		const html = renderExplorerHtml({ data: aviaData, narrative: null, brandName: "avia", windowDays: 30, sampleNote: "n", reportMetrics: aviaMetrics });
		// Header shows the real brand, not the template's original hardcoded brand.
		expect(html).toContain("<title>avia — Khám phá câu trả lời AI</title>");
		expect(html).toContain("Các LLM nói gì về avia");
		expect(html).not.toContain("__BRAND_NAME__");
		expect(html).not.toContain("Visana");
	});
});
