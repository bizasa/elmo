import type { ExplorerData, NarrativeMetrics } from "./types";

function pct(m: number, n: number): number {
	return n === 0 ? 0 : Math.round((100 * m) / n);
}

function groupVis(records: ExplorerData["records"], key: (r: ExplorerData["records"][number]) => string) {
	const acc = new Map<string, { answers: number; mentioned: number }>();
	for (const r of records) {
		const k = key(r);
		if (!k) continue;
		const cur = acc.get(k) ?? { answers: 0, mentioned: 0 };
		cur.answers++;
		if (r.v) cur.mentioned++;
		acc.set(k, cur);
	}
	return [...acc.entries()]
		.map(([name, v]) => ({ name, answers: v.answers, visibilityPct: pct(v.mentioned, v.answers) }))
		.sort((a, b) => b.answers - a.answers);
}

export function buildNarrativeMetrics(data: ExplorerData, brandName: string, windowDays: number): NarrativeMetrics {
	const records = data.records;
	const totalAnswers = records.length;
	const mentioned = records.filter((r) => r.v).length;

	const byModel = groupVis(records, (r) => r.m).map((g) => ({ model: g.name, answers: g.answers, visibilityPct: g.visibilityPct }));
	const byProduct = groupVis(records, (r) => r.pr).map((g) => ({ product: g.name, answers: g.answers, visibilityPct: g.visibilityPct }));
	const byFunnel = groupVis(records, (r) => r.fn).map((g) => ({ funnel: g.name, answers: g.answers, visibilityPct: g.visibilityPct }));

	const compTally = new Map<string, number>();
	for (const r of records) for (const c of r.c) compTally.set(c, (compTally.get(c) ?? 0) + 1);
	const topCompetitors = [...compTally.entries()]
		.map(([name, mentions]) => ({ name, mentions }))
		.sort((a, b) => b.mentions - a.mentions)
		.slice(0, 15);

	const perPrompt = groupVis(records, (r) => r.p);
	const weakPrompts = perPrompt
		.filter((p) => p.visibilityPct < 15)
		.map((p) => ({ prompt: p.name, visibilityPct: p.visibilityPct }))
		.slice(0, 20);

	return {
		brandName,
		windowDays,
		totalAnswers,
		visibilityPct: pct(mentioned, totalAnswers),
		byModel,
		byProduct,
		byFunnel,
		topCompetitors,
		weakPrompts,
	};
}
