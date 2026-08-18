import { describe, expect, it } from "vitest";
import { buildNarrativeMetrics } from "./metrics";
import type { ExplorerData } from "./types";

const data: ExplorerData = {
	records: [
		{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: true, pos: 1, d: "2026-08-10", p: "q1", c: ["X"], x: "" },
		{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: false, pos: null, d: "2026-08-09", p: "q2", c: ["X", "Y"], x: "" },
	],
	config: { brandTerms: ["visana"], models: [["chatgpt", "ChatGPT"]], prods: [["china-visa", "china-visa"]], funs: [["bofu", "BOFU"]], alts: {}, untracked: [] },
};

describe("buildNarrativeMetrics", () => {
	it("computes overall and per-facet visibility and competitor tallies", () => {
		const m = buildNarrativeMetrics(data, "Visana", 30);
		expect(m.totalAnswers).toBe(2);
		expect(m.visibilityPct).toBe(50);
		expect(m.byModel[0]).toEqual({ model: "chatgpt", answers: 2, visibilityPct: 50 });
		expect(m.byProduct[0].product).toBe("china-visa");
		expect(m.topCompetitors[0]).toEqual({ name: "X", mentions: 2 });
		expect(m.weakPrompts.some((w) => w.prompt === "q2")).toBe(true);
	});
});
