import { describe, expect, it } from "vitest";
import { BrightDataKeyPool, DEFAULT_FREE_TIER_CAP, parseBrightDataKeys, usageWindowStart } from "./brightdata-keys";

const MID_MONTH = Date.UTC(2026, 8, 15, 8, 0, 0);

function pool(
	keys: ReturnType<typeof parseBrightDataKeys>,
	opts: { usage?: Record<string, number | Error>; now?: () => number } = {},
) {
	const usage = opts.usage ?? {};
	const calls: string[] = [];
	const p = new BrightDataKeyPool(keys, {
		now: opts.now ?? (() => MID_MONTH),
		monthUsage: async (token) => {
			calls.push(token);
			const value = usage[token] ?? 0;
			if (value instanceof Error) throw value;
			return value;
		},
	});
	return { p, calls };
}

async function spend(p: BrightDataKeyPool, n: number): Promise<string[]> {
	const out: string[] = [];
	for (let i = 0; i < n; i++) out.push(await p.acquire());
	return out;
}

describe("parseBrightDataKeys", () => {
	it("spends free-tier keys first, in order, and the main key last with no cap", () => {
		expect(parseBrightDataKeys("free1@100, free2", "main")).toEqual([
			{ token: "free1", monthlyCap: 100 },
			{ token: "free2", monthlyCap: DEFAULT_FREE_TIER_CAP },
			{ token: "main", monthlyCap: null },
		]);
	});

	it("behaves exactly as a single token when no free-tier keys are set", () => {
		expect(parseBrightDataKeys(undefined, "main")).toEqual([{ token: "main", monthlyCap: null }]);
		expect(parseBrightDataKeys("  ", "main")).toEqual([{ token: "main", monthlyCap: null }]);
	});

	it("keeps the main key uncapped even if it is also listed as free-tier", () => {
		expect(parseBrightDataKeys("main@10, free", "main")).toEqual([
			{ token: "free", monthlyCap: DEFAULT_FREE_TIER_CAP },
			{ token: "main", monthlyCap: null },
		]);
	});

	it("rejects a malformed cap without echoing the token", () => {
		expect(() => parseBrightDataKeys("secret-token@lots", "main")).toThrow(/cap/);
		expect(() => parseBrightDataKeys("secret-token@lots", "main")).not.toThrow(/secret-token/);
	});
});

describe("BrightDataKeyPool", () => {
	it("uses a free-tier key up to its cap, then the next, then the main key", async () => {
		const { p } = pool(parseBrightDataKeys("a@2,b@1", "main"));
		expect(await spend(p, 5)).toEqual(["a", "a", "b", "main", "main"]);
	});

	it("counts what BrightData already recorded this month toward the cap", async () => {
		const { p } = pool(parseBrightDataKeys("a@100", "main"), { usage: { a: 98 } });
		expect(await spend(p, 3)).toEqual(["a", "a", "main"]);
	});

	it("skips a free-tier key whose usage it cannot confirm, rather than risk overrunning it", async () => {
		const { p } = pool(parseBrightDataKeys("a@100", "main"), { usage: { a: new Error("403") } });
		expect(await spend(p, 2)).toEqual(["main", "main"]);
	});

	it("never exceeds a cap under concurrent demand", async () => {
		const { p } = pool(parseBrightDataKeys("a@5", "main"));
		const tokens = await Promise.all(Array.from({ length: 12 }, () => p.acquire()));
		expect(tokens.filter((t) => t === "a")).toHaveLength(5);
		expect(tokens.filter((t) => t === "main")).toHaveLength(7);
	});

	it("reads usage once for a burst instead of once per run", async () => {
		const { p, calls } = pool(parseBrightDataKeys("a@100", "main"));
		await Promise.all(Array.from({ length: 20 }, () => p.acquire()));
		expect(calls).toEqual(["a"]);
	});

	it("routes around an inactive account and tries it again after the cooldown", async () => {
		let now = MID_MONTH;
		const { p } = pool(parseBrightDataKeys("a@100", "main"), { now: () => now });
		expect(await p.acquire()).toBe("a");
		p.markInactive("a");
		expect(await p.acquire()).toBe("main");
		now += 61 * 60 * 1000;
		expect(await p.acquire()).toBe("a");
	});

	it("fails without handing out a key when every key is capped or inactive", async () => {
		const { p } = pool(parseBrightDataKeys("a@1", undefined));
		expect(await p.acquire()).toBe("a");
		await expect(p.acquire()).rejects.toThrow(/monthly cap|unavailable/);
	});

	it("starts a free-tier key's allowance over in the next month", async () => {
		let now = MID_MONTH;
		const { p } = pool(parseBrightDataKeys("a@1", "main"), { now: () => now });
		expect(await spend(p, 2)).toEqual(["a", "main"]);
		now = Date.UTC(2026, 9, 1, 13, 0, 0);
		expect(await p.acquire()).toBe("a");
	});
});

describe("usageWindowStart", () => {
	it("opens the month at noon UTC on the 1st, so the provider's renewal has happened in any timezone", () => {
		expect(usageWindowStart(Date.UTC(2026, 9, 1, 13, 0)).toISOString()).toBe("2026-10-01T12:00:00.000Z");
		// Before noon on the 1st still belongs to the previous month's window.
		expect(usageWindowStart(Date.UTC(2026, 9, 1, 6, 0)).toISOString()).toBe("2026-09-01T12:00:00.000Z");
	});
});
