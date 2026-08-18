import { describe, expect, it } from "vitest";
import { assembleExplorerData, type RunInput, type PromptInput, type CompetitorInput } from "./build-data";

const prompts: PromptInput[] = [
	{ id: "p1", value: "best china visa service", tags: ["china-visa", "bofu"] },
];
const competitors: CompetitorInput[] = [{ name: "Visa Global", aliases: ["visaglobal"] }];

function run(over: Partial<RunInput>): RunInput {
	return {
		promptId: "p1",
		model: "chatgpt",
		provider: "brightdata",
		brandMentioned: true,
		brandPosition: 1,
		competitorsMentioned: ["Visa Global"],
		createdAt: new Date("2026-08-10T00:00:00Z"),
		rawOutput: { answer_text: "Visana is the top pick, ahead of Visa Global." },
		...over,
	};
}

describe("assembleExplorerData", () => {
	it("builds one record per run with derived product/funnel tags and excerpt", () => {
		const data = assembleExplorerData({
			brand: { name: "Visana", aliases: [], website: "https://visana.vn" },
			prompts,
			competitors,
			runs: [run({})],
			perPromptModelLimit: 4,
		});
		expect(data.records).toHaveLength(1);
		const r = data.records[0];
		expect(r.m).toBe("chatgpt");
		expect(r.pr).toBe("china-visa");
		expect(r.fn).toBe("bofu");
		expect(r.v).toBe(true);
		expect(r.pos).toBe(1);
		expect(r.d).toBe("2026-08-10");
		expect(r.c).toEqual(["Visa Global"]);
		expect(r.x).toContain("Visana");
		expect(data.config.brandTerms).toContain("visana");
	});

	it("keeps only the N most recent runs per prompt+model", () => {
		const runs = [
			run({ createdAt: new Date("2026-08-01T00:00:00Z") }),
			run({ createdAt: new Date("2026-08-02T00:00:00Z") }),
			run({ createdAt: new Date("2026-08-03T00:00:00Z") }),
		];
		const data = assembleExplorerData({
			brand: { name: "Visana", aliases: [], website: "https://visana.vn" },
			prompts,
			competitors,
			runs,
			perPromptModelLimit: 2,
		});
		expect(data.records).toHaveLength(2);
		expect(data.records.map((r) => r.d)).toEqual(["2026-08-03", "2026-08-02"]);
	});

	it("marks competitors present in data but not tracked as untracked", () => {
		const data = assembleExplorerData({
			brand: { name: "Visana", aliases: [], website: "https://visana.vn" },
			prompts,
			competitors,
			runs: [run({ competitorsMentioned: ["Visa Global", "RandomCo"] })],
			perPromptModelLimit: 4,
		});
		expect(data.config.untracked).toContain("RandomCo");
		expect(data.config.untracked).not.toContain("Visa Global");
	});
});
