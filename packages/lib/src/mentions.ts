/**
 * Detection is deliberately blunt — case-insensitive substring matching over a
 * subject's names and bare domains — because an answer engine writes prose, not
 * markup, and any narrower rule (word boundaries, link parsing) misses the
 * "acme.com is the pick here" and "Acme's" shapes that are the whole signal.
 */

export interface MentionSubject {
	name: string;
	aliases?: string[] | null;
	domains?: (string | null | undefined)[] | null;
}

/** Malformed input falls back to the raw value: a stored typo shouldn't fail a run. */
export function normalizeDomain(urlOrDomain: string): string {
	try {
		const url = new URL(urlOrDomain.startsWith("http") ? urlOrDomain : `https://${urlOrDomain}`);
		return url.hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		return urlOrDomain.replace(/^www\./, "").toLowerCase();
	}
}

export function mentionsSubject(contentLower: string, subject: MentionSubject): boolean {
	const names = [subject.name, ...(subject.aliases ?? [])];
	if (names.some((name) => name && contentLower.includes(name.toLowerCase()))) return true;
	return (subject.domains ?? []).some((domain) => domain && contentLower.includes(normalizeDomain(domain)));
}

/** Earliest index at which the subject is first named (by any name or bare domain), or -1. */
export function firstMentionIndex(contentLower: string, subject: MentionSubject): number {
	const needles = [
		...[subject.name, ...(subject.aliases ?? [])].filter((n): n is string => !!n).map((n) => n.toLowerCase()),
		...(subject.domains ?? []).filter((d): d is string => !!d).map((d) => normalizeDomain(d)),
	];
	let best = -1;
	for (const needle of needles) {
		if (!needle) continue;
		const idx = contentLower.indexOf(needle);
		if (idx !== -1 && (best === -1 || idx < best)) best = idx;
	}
	return best;
}

export function analyzeMentions(
	content: string,
	brand: MentionSubject,
	competitors: readonly MentionSubject[],
): { brandMentioned: boolean; competitorsMentioned: string[]; brandPosition: number | null } {
	const contentLower = content.toLowerCase();
	const brandIndex = firstMentionIndex(contentLower, brand);
	const brandMentioned = brandIndex !== -1;

	const mentioned: { name: string; index: number }[] = [];
	for (const competitor of competitors) {
		const idx = firstMentionIndex(contentLower, competitor);
		if (idx !== -1) mentioned.push({ name: competitor.name, index: idx });
	}

	// 1-based rank of the brand among every mentioned entity, by order of first
	// appearance. 1 = named before any competitor. Null when unmentioned.
	const brandPosition = brandMentioned ? mentioned.filter((c) => c.index < brandIndex).length + 1 : null;

	return {
		brandMentioned,
		competitorsMentioned: mentioned.map((c) => c.name),
		brandPosition,
	};
}
