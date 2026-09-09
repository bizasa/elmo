import { extractTextContent } from "../text-extraction";
import { buildExcerpt } from "./excerpt";
import type { ExplorerData, ExplorerRecord } from "./types";

const FUNNEL_TAGS = new Set(["tofu", "mofu", "bofu"]);

export interface RunInput {
	promptId: string;
	model: string;
	provider: string | null;
	brandMentioned: boolean;
	brandPosition: number | null;
	competitorsMentioned: string[];
	createdAt: Date;
	rawOutput: unknown;
}
export interface PromptInput {
	id: string;
	value: string;
	tags: string[];
}
export interface CompetitorInput {
	name: string;
	aliases: string[];
}
export interface BrandInput {
	name: string;
	aliases: string[];
	website: string;
}

export interface AssembleArgs {
	brand: BrandInput;
	prompts: PromptInput[];
	competitors: CompetitorInput[];
	runs: RunInput[];
	perPromptModelLimit: number;
}

function fmtDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function domainStem(website: string): string {
	try {
		const u = new URL(website.startsWith("http") ? website : `https://${website}`);
		return u.hostname.replace(/^www\./, "").split(".")[0].toLowerCase();
	} catch {
		return "";
	}
}

function splitTags(tags: string[]): { product: string; funnel: string } {
	let product = "";
	let funnel = "";
	for (const t of tags) {
		if (FUNNEL_TAGS.has(t)) {
			if (!funnel) funnel = t;
		} else if (!product) {
			product = t;
		}
	}
	return { product, funnel };
}

export function assembleExplorerData(args: AssembleArgs): ExplorerData {
	const { brand, prompts, competitors, runs, perPromptModelLimit } = args;
	const promptById = new Map(prompts.map((p) => [p.id, p]));

	const brandTerms = [brand.name, ...brand.aliases, domainStem(brand.website)]
		.map((t) => t.trim().toLowerCase())
		.filter(Boolean);

	// Group runs by prompt+model, keep the N newest.
	const groups = new Map<string, RunInput[]>();
	for (const r of runs) {
		const key = `${r.promptId}::${r.model}`;
		const arr = groups.get(key) ?? [];
		arr.push(r);
		groups.set(key, arr);
	}

	const records: ExplorerRecord[] = [];
	for (const arr of groups.values()) {
		arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		for (const r of arr.slice(0, perPromptModelLimit)) {
			const prompt = promptById.get(r.promptId);
			if (!prompt) continue;
			const { product, funnel } = splitTags(prompt.tags);
			const text = extractTextContent(r.rawOutput, r.provider ?? r.model);
			records.push({
				m: r.model,
				pr: product,
				fn: funnel,
				v: r.brandMentioned,
				pos: r.brandPosition,
				d: fmtDate(r.createdAt),
				p: prompt.value,
				c: r.competitorsMentioned,
				x: buildExcerpt(text, brandTerms),
			});
		}
	}
	// Newest first overall (stable, human-friendly default order).
	records.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));

	// Config facets derived from data.
	const modelSet = new Set(records.map((r) => r.m));
	const prodSet = new Set(records.map((r) => r.pr).filter(Boolean));
	const funSet = new Set(records.map((r) => r.fn).filter(Boolean));

	const trackedNames = new Set(competitors.map((c) => c.name));
	const alts: Record<string, string[]> = {};
	for (const c of competitors) {
		alts[c.name] = [c.name.toLowerCase(), ...c.aliases.map((a) => a.toLowerCase())];
	}
	const untracked = new Set<string>();
	for (const r of records) for (const c of r.c) if (!trackedNames.has(c)) untracked.add(c);

	return {
		records,
		config: {
			brandTerms,
			models: [...modelSet].map((m) => [m, m] as [string, string]),
			prods: [...prodSet].map((p) => [p, p] as [string, string]),
			funs: [...funSet].map((f) => [f, f.toUpperCase()] as [string, string]),
			alts,
			untracked: [...untracked],
		},
	};
}
