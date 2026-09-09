import { describe, expect, it } from "vitest";
import { buildReportMetrics } from "./report-metrics";
import type { ExplorerData } from "./types";

const data: ExplorerData = {
	records: [
		{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: true, pos: 1, d: "2026-08-10", p: "q1", c: ["Rival"], x: "" },
		{ m: "chatgpt", pr: "china-visa", fn: "bofu", v: false, pos: null, d: "2026-08-09", p: "q2", c: ["Rival", "NewCo"], x: "" },
		{ m: "gemini", pr: "korea-visa", fn: "tofu", v: true, pos: 3, d: "2026-08-08", p: "q3", c: ["NewCo"], x: "" },
		{ m: "gemini", pr: "korea-visa", fn: "tofu", v: true, pos: 2, d: "2026-08-07", p: "q1", c: [], x: "" },
	],
	config: {
		brandTerms: ["visana"],
		models: [
			["chatgpt", "ChatGPT"],
			["gemini", "Gemini"],
		],
		prods: [
			["china-visa", "china-visa"],
			["korea-visa", "korea-visa"],
		],
		funs: [
			["bofu", "BOFU"],
			["tofu", "TOFU"],
		],
		alts: { Rival: ["rival"] },
		untracked: ["NewCo"],
	},
};

describe("buildReportMetrics", () => {
	const m = buildReportMetrics(data, "Visana", 30);

	it("computes overall visibility and average position", () => {
		expect(m.totalAnswers).toBe(4);
		expect(m.mentioned).toBe(3);
		expect(m.visibilityPct).toBe(75);
		// mentioned pos values: 1, 3, 2 -> avg 2
		expect(m.avgPosition).toBe(2);
	});

	it("computes counts of distinct models/prompts/products", () => {
		expect(m.modelCount).toBe(2);
		expect(m.promptCount).toBe(3); // q1, q2, q3
		expect(m.productCount).toBe(2);
	});

	it("groups by model with runs/mentioned/visibilityPct/avgPosition", () => {
		const chatgpt = m.byModel.find((g) => g.model === "chatgpt");
		expect(chatgpt).toEqual({ model: "chatgpt", runs: 2, mentioned: 1, visibilityPct: 50, avgPosition: 1 });
		const gemini = m.byModel.find((g) => g.model === "gemini");
		expect(gemini).toEqual({ model: "gemini", runs: 2, mentioned: 2, visibilityPct: 100, avgPosition: 2.5 });
	});

	it("splits competitors into tracked vs untracked, most-mentioned first", () => {
		expect(m.competitorsTracked).toEqual(["Rival"]);
		expect(m.competitorsUntracked).toEqual(["NewCo"]);
	});

	it("aggregates prompts: q1 across both records merges into one prompt entry, sorted by visibility desc", () => {
		// q1 appears twice (chatgpt v=true pos=1, gemini v=true pos=2) -> runs 2, mentioned 2, vis 100
		const q1 = m.allPrompts.find((p) => p.prompt === "q1");
		expect(q1).toMatchObject({ prompt: "q1", runs: 2, visibilityPct: 100 });
		// allPrompts sorted desc by visibilityPct
		for (let i = 1; i < m.allPrompts.length; i++) {
			expect(m.allPrompts[i - 1].visibilityPct).toBeGreaterThanOrEqual(m.allPrompts[i].visibilityPct);
		}
	});

	it("computes promptsStrong/promptsWeak and weakPrompts filter (<15%)", () => {
		// q2: runs 1, mentioned 0, vis 0 -> weak
		expect(m.promptsWeak).toBeGreaterThanOrEqual(1);
		expect(m.weakPrompts.some((w) => w.prompt === "q2")).toBe(true);
		expect(m.weakPrompts.every((w) => w.visibilityPct < 15)).toBe(true);
		expect(m.promptsStrong).toBeGreaterThanOrEqual(1); // q1 (100%) and q3 (100%) are strong
	});
});
