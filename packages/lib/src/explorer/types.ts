import { z } from "zod";

/** One AI answer, shaped for the explorer template's `DATA` array. */
export interface ExplorerRecord {
	m: string; // model (e.g. "chatgpt")
	pr: string; // product tag (or "")
	fn: string; // funnel tag: tofu|mofu|bofu (or "")
	v: boolean; // brand mentioned
	pos: number | null; // brand position among named entities
	d: string; // date, YYYY-MM-DD
	p: string; // prompt text
	c: string[]; // competitors named in this answer
	x: string; // excerpt centered on the first brand mention
}

export interface ExplorerConfig {
	brandTerms: string[]; // lowercased highlight terms for the brand
	models: [string, string][]; // [value, label]
	prods: [string, string][]; // [value, label]
	funs: [string, string][]; // [value, label]
	alts: Record<string, string[]>; // competitor name -> lowercased alias list
	untracked: string[]; // competitor names present in data but not tracked
}

export interface ExplorerData {
	records: ExplorerRecord[];
	config: ExplorerConfig;
}

export const narrativeSchema = z.object({
	summary: z.string(),
	byModelNote: z.string(),
	byFunnelNote: z.string(),
	whatLLMsSay: z.string(),
	weakNote: z.string(),
	recommendations: z.array(z.object({ title: z.string(), body: z.string() })).min(3).max(6),
});

export type Narrative = z.infer<typeof narrativeSchema>;

/** Deterministic metrics handed to the LLM. It must only use these numbers. */
export interface NarrativeMetrics {
	brandName: string;
	windowDays: number;
	totalAnswers: number;
	visibilityPct: number;
	byModel: { model: string; answers: number; visibilityPct: number }[];
	byProduct: { product: string; answers: number; visibilityPct: number }[];
	byFunnel: { funnel: string; answers: number; visibilityPct: number }[];
	topCompetitors: { name: string; mentions: number }[];
	weakPrompts: { prompt: string; visibilityPct: number }[];
}

/** Report-tab aggregates, all derivable from ExplorerData.records. */
export interface ReportMetrics {
	brandName: string;
	windowDays: number;
	totalAnswers: number;
	mentioned: number;
	visibilityPct: number;
	avgPosition: number | null;
	promptsStrong: number;
	promptsWeak: number;
	modelCount: number;
	promptCount: number;
	productCount: number;
	byModel: { model: string; runs: number; mentioned: number; visibilityPct: number; avgPosition: number | null }[];
	byFunnel: { key: string; runs: number; visibilityPct: number; avgPosition: number | null }[];
	byProduct: { key: string; runs: number; visibilityPct: number; avgPosition: number | null }[];
	competitorsTracked: string[];
	competitorsUntracked: string[];
	weakPrompts: { prompt: string; product: string; funnel: string; mentioned: number; runs: number; visibilityPct: number }[];
	allPrompts: { prompt: string; product: string; funnel: string; runs: number; visibilityPct: number; avgPosition: number | null }[];
}
