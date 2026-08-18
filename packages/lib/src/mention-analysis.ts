/**
 * Brand and competitor mention detection over an AI answer's text.
 *
 * A single source of truth shared by the worker (which analyzes each run at
 * write time) and the backfill script (which re-derives the same values from
 * stored rawOutput). Matching is naive lowercased substring, matching how
 * visibility and share-of-voice have always been counted.
 */

export interface BrandMentionInput {
	name: string;
	aliases?: string[] | null;
	website: string;
	additionalDomains?: string[] | null;
}

export interface CompetitorMentionInput {
	name: string;
	aliases?: string[] | null;
	domains?: string[] | null;
}

export interface MentionAnalysis {
	brandMentioned: boolean;
	competitorsMentioned: string[];
	/**
	 * 1-based rank of the brand among every mentioned entity (the brand and the
	 * competitors it appears alongside), ordered by where each first appears in
	 * the answer. 1 means the brand is named before any competitor. `null` when
	 * the brand isn't mentioned at all.
	 */
	brandPosition: number | null;
}

function extractDomainFromUrl(urlOrDomain: string): string {
	try {
		const url = new URL(urlOrDomain.startsWith("http") ? urlOrDomain : `https://${urlOrDomain}`);
		return url.hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		return urlOrDomain.replace(/^www\./, "").toLowerCase();
	}
}

/** Earliest index at which any needle occurs, or -1 if none do. */
function firstIndexOfAny(haystackLower: string, needles: string[]): number {
	let best = -1;
	for (const needle of needles) {
		if (!needle) continue;
		const idx = haystackLower.indexOf(needle);
		if (idx !== -1 && (best === -1 || idx < best)) best = idx;
	}
	return best;
}

export function analyzeMentions(
	content: string,
	brand: BrandMentionInput,
	competitorsList: CompetitorMentionInput[],
): MentionAnalysis {
	const contentLower = content.toLowerCase();

	const brandNeedles = [
		...[brand.name, ...(brand.aliases || [])].map((n) => n.toLowerCase()),
		extractDomainFromUrl(brand.website),
		...(brand.additionalDomains || []).map(extractDomainFromUrl),
	];
	const brandIndex = firstIndexOfAny(contentLower, brandNeedles);
	const brandMentioned = brandIndex !== -1;

	const mentionedCompetitors: { name: string; index: number }[] = [];
	for (const competitor of competitorsList) {
		const needles = [
			...[competitor.name, ...(competitor.aliases || [])].map((n) => n.toLowerCase()),
			...(competitor.domains || []).map(extractDomainFromUrl),
		];
		const idx = firstIndexOfAny(contentLower, needles);
		if (idx !== -1) mentionedCompetitors.push({ name: competitor.name, index: idx });
	}

	const brandPosition = brandMentioned
		? mentionedCompetitors.filter((c) => c.index < brandIndex).length + 1
		: null;

	return {
		brandMentioned,
		competitorsMentioned: mentionedCompetitors.map((c) => c.name),
		brandPosition,
	};
}
