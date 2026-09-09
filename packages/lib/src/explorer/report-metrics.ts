import type { ExplorerData, ReportMetrics } from "./types";

type Record_ = ExplorerData["records"][number];

function pct(m: number, n: number): number {
	return n === 0 ? 0 : Math.round((100 * m) / n);
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

function avgPos(records: Record_[]): number | null {
	const mentionedWithPos = records.filter((r) => r.v && r.pos != null);
	if (mentionedWithPos.length === 0) return null;
	const sum = mentionedWithPos.reduce((acc, r) => acc + (r.pos as number), 0);
	return round2(sum / mentionedWithPos.length);
}

function groupBy(records: Record_[], key: (r: Record_) => string): Map<string, Record_[]> {
	const acc = new Map<string, Record_[]>();
	for (const r of records) {
		const k = key(r);
		if (!k) continue;
		const cur = acc.get(k) ?? [];
		cur.push(r);
		acc.set(k, cur);
	}
	return acc;
}

export function buildReportMetrics(data: ExplorerData, brandName: string, windowDays: number): ReportMetrics {
	const records = data.records;
	const totalAnswers = records.length;
	const mentioned = records.filter((r) => r.v).length;

	const byModelGroups = groupBy(records, (r) => r.m);
	const byModel = [...byModelGroups.entries()]
		.map(([model, rs]) => {
			const mentionedCount = rs.filter((r) => r.v).length;
			return {
				model,
				runs: rs.length,
				mentioned: mentionedCount,
				visibilityPct: pct(mentionedCount, rs.length),
				avgPosition: avgPos(rs),
			};
		})
		.sort((a, b) => b.runs - a.runs);

	const byFunnelGroups = groupBy(records, (r) => r.fn);
	const byFunnel = [...byFunnelGroups.entries()]
		.map(([key, rs]) => {
			const mentionedCount = rs.filter((r) => r.v).length;
			return { key, runs: rs.length, visibilityPct: pct(mentionedCount, rs.length), avgPosition: avgPos(rs) };
		})
		.sort((a, b) => b.runs - a.runs);

	const byProductGroups = groupBy(records, (r) => r.pr);
	const byProduct = [...byProductGroups.entries()]
		.map(([key, rs]) => {
			const mentionedCount = rs.filter((r) => r.v).length;
			return { key, runs: rs.length, visibilityPct: pct(mentionedCount, rs.length), avgPosition: avgPos(rs) };
		})
		.sort((a, b) => b.runs - a.runs);

	const byPromptGroups = groupBy(records, (r) => r.p);
	const allPrompts = [...byPromptGroups.entries()]
		.map(([prompt, rs]) => {
			const mentionedCount = rs.filter((r) => r.v).length;
			return {
				prompt,
				product: rs[0].pr,
				funnel: rs[0].fn,
				runs: rs.length,
				visibilityPct: pct(mentionedCount, rs.length),
				avgPosition: avgPos(rs),
			};
		})
		.sort((a, b) => b.visibilityPct - a.visibilityPct);

	const promptsStrong = allPrompts.filter((p) => p.visibilityPct >= 50).length;
	const promptsWeak = allPrompts.filter((p) => p.visibilityPct < 15).length;
	const weakPrompts = allPrompts
		.filter((p) => p.visibilityPct < 15)
		.map((p) => {
			const rs = byPromptGroups.get(p.prompt) ?? [];
			const mentionedCount = rs.filter((r) => r.v).length;
			return { prompt: p.prompt, product: p.product, funnel: p.funnel, mentioned: mentionedCount, runs: p.runs, visibilityPct: p.visibilityPct };
		})
		.sort((a, b) => a.visibilityPct - b.visibilityPct);

	const trackedNames = new Set(Object.keys(data.config.alts));
	const compTally = new Map<string, number>();
	for (const r of records) for (const c of r.c) compTally.set(c, (compTally.get(c) ?? 0) + 1);
	const sortedComp = [...compTally.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
	const competitorsTracked = sortedComp.filter((name) => trackedNames.has(name));
	const competitorsUntracked = sortedComp.filter((name) => !trackedNames.has(name));

	return {
		brandName,
		windowDays,
		totalAnswers,
		mentioned,
		visibilityPct: pct(mentioned, totalAnswers),
		avgPosition: avgPos(records),
		promptsStrong,
		promptsWeak,
		modelCount: byModelGroups.size,
		promptCount: byPromptGroups.size,
		productCount: byProductGroups.size,
		byModel,
		byFunnel,
		byProduct,
		competitorsTracked,
		competitorsUntracked,
		weakPrompts,
		allPrompts,
	};
}
