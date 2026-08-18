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
	executiveSummary: z.string(),
	keyFindings: z.array(z.string()),
	competitorGaps: z.string(),
	recommendations: z.array(z.string()),
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
