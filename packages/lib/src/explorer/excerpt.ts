/** Strip markdown images/links, bare URLs, and collapse whitespace. */
export function cleanText(input: string): string {
	return input
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // markdown images
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links -> label
		.replace(/https?:\/\/\S+/g, " ") // bare URLs
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Return a ~2*radius window of cleaned text centered on the first occurrence of
 * any brand term (case-insensitive). Falls back to the head of the text when no
 * term is found.
 */
export function buildExcerpt(rawText: string, brandTerms: string[], radius = 800): string {
	const text = cleanText(rawText);
	const lower = text.toLowerCase();
	let hit = -1;
	for (const term of brandTerms) {
		const i = lower.indexOf(term.toLowerCase());
		if (i !== -1 && (hit === -1 || i < hit)) hit = i;
	}
	if (hit === -1) return text.slice(0, radius * 2);
	const start = Math.max(0, hit - radius);
	const end = Math.min(text.length, hit + radius);
	let out = text.slice(start, end);
	if (start > 0) out = `…${out}`;
	if (end < text.length) out = `${out}…`;
	return out;
}
