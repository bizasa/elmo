import { describe, expect, it, vi } from "vitest";
import type { ReportMetrics } from "../explorer/types";
import { generateNarrativeWith } from "./generate-narrative";

const metrics: ReportMetrics = {
	brandName: "Visana",
	windowDays: 30,
	totalAnswers: 100,
	mentioned: 44,
	visibilityPct: 44,
	avgPosition: 2,
	promptsStrong: 3,
	promptsWeak: 2,
	modelCount: 2,
	promptCount: 10,
	productCount: 2,
	byModel: [],
	byFunnel: [],
	byProduct: [],
	competitorsTracked: [],
	competitorsUntracked: [],
	weakPrompts: [],
	allPrompts: [],
};

const sampleExcerpts = ["Visana is often cited alongside its rivals as a reliable visa service excerpt."];

const validJson = JSON.stringify({
	summary: "ok",
	byModelNote: "models note",
	byFunnelNote: "funnel note",
	whatLLMsSay: "llms say",
	weakNote: "weak note",
	recommendations: [
		{ title: "t1", body: "b1" },
		{ title: "t2", body: "b2" },
		{ title: "t3", body: "b3" },
	],
});

describe("generateNarrativeWith", () => {
	it("advances past a failing model and records the model that succeeded", async () => {
		const vilao = vi.fn().mockRejectedValueOnce(new Error("model A down")).mockResolvedValueOnce(validJson);
		const openrouter = vi.fn();

		const result = await generateNarrativeWith(metrics, sampleExcerpts, "en", ["A", "B"], vilao, openrouter);

		expect(vilao).toHaveBeenCalledTimes(2);
		expect(openrouter).not.toHaveBeenCalled();
		expect(result.model).toBe("B");
		expect(result.narrative.summary).toBe("ok");
		expect(result.narrative.recommendations[0].title).toBe("t1");
	});

	it("falls back to OpenRouter when the whole Vilao chain fails", async () => {
		const vilao = vi.fn().mockRejectedValue(new Error("all down"));
		const openrouter = vi.fn().mockResolvedValue({
			summary: "or",
			byModelNote: "models note",
			byFunnelNote: "funnel note",
			whatLLMsSay: "llms say",
			weakNote: "weak note",
			recommendations: [
				{ title: "t1", body: "b1" },
				{ title: "t2", body: "b2" },
				{ title: "t3", body: "b3" },
			],
		});

		const result = await generateNarrativeWith(metrics, sampleExcerpts, "en", ["A", "B"], vilao, openrouter);

		expect(vilao).toHaveBeenCalledTimes(2);
		expect(openrouter).toHaveBeenCalledTimes(1);
		expect(result.model).toBe("openrouter");
		expect(result.narrative.summary).toBe("or");
		expect(result.narrative.recommendations[0].title).toBe("t1");
	});
});
