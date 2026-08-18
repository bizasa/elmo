import { describe, expect, it, vi } from "vitest";
import type { NarrativeMetrics } from "../explorer/types";
import { generateNarrativeWith } from "./generate-narrative";

const metrics: NarrativeMetrics = {
	brandName: "Visana",
	windowDays: 30,
	totalAnswers: 100,
	visibilityPct: 44,
	byModel: [],
	byProduct: [],
	byFunnel: [],
	topCompetitors: [],
	weakPrompts: [],
};

const validJson = JSON.stringify({
	executiveSummary: "ok",
	keyFindings: ["a"],
	competitorGaps: "b",
	recommendations: ["c"],
});

describe("generateNarrativeWith", () => {
	it("advances past a failing model and records the model that succeeded", async () => {
		const vilao = vi.fn().mockRejectedValueOnce(new Error("model A down")).mockResolvedValueOnce(validJson);
		const openrouter = vi.fn();

		const result = await generateNarrativeWith(metrics, "en", ["A", "B"], vilao, openrouter);

		expect(vilao).toHaveBeenCalledTimes(2);
		expect(openrouter).not.toHaveBeenCalled();
		expect(result.model).toBe("B");
		expect(result.narrative.executiveSummary).toBe("ok");
	});

	it("falls back to OpenRouter when the whole Vilao chain fails", async () => {
		const vilao = vi.fn().mockRejectedValue(new Error("all down"));
		const openrouter = vi.fn().mockResolvedValue({
			executiveSummary: "or",
			keyFindings: ["a"],
			competitorGaps: "b",
			recommendations: ["c"],
		});

		const result = await generateNarrativeWith(metrics, "en", ["A", "B"], vilao, openrouter);

		expect(vilao).toHaveBeenCalledTimes(2);
		expect(openrouter).toHaveBeenCalledTimes(1);
		expect(result.model).toBe("openrouter");
		expect(result.narrative.executiveSummary).toBe("or");
	});
});
