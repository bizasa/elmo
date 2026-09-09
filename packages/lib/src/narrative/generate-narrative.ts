import { narrativeSchema, type Narrative, type ReportMetrics } from "../explorer/types";
import { getProvider } from "../providers";
import { getVilaoModelChain } from "./config";
import { callVilaoChat } from "./vilao-client";

export interface NarrativeResult {
	narrative: Narrative;
	model: string;
}

const MAX_EXCERPT_CHARS = 500;
const MAX_EXCERPTS = 8;

function buildSystemPrompt(language: string): string {
	const lang = language === "vi" ? "Vietnamese" : "English";
	return (
		`You are an AEO analyst. Write a concise, factual report narrative in ${lang}. ` +
		`Use ONLY the numbers provided in the user's metrics JSON — never invent figures. ` +
		`Use the sample answer excerpts only to describe how AI assistants talk about the brand (tone, claims, which rivals appear alongside it) — never invent excerpts. ` +
		`Respond with a single JSON object with exactly these keys: ` +
		`summary (2-4 sentences overview), ` +
		`byModelNote (1-2 sentences on the per-model distribution), ` +
		`byFunnelNote (1-2 sentences on the funnel/product spread), ` +
		`whatLLMsSay (2-4 sentences on how the assistants describe the brand, drawn from the sample excerpts — tone, claims, alongside which rivals), ` +
		`weakNote (1-2 sentences on the weak/absent prompts and who fills the gap), ` +
		`recommendations (an array of 3 to 6 objects, each with a "title" string and a "body" string).`
	);
}

function buildUserPrompt(metrics: ReportMetrics, sampleExcerpts: string[]): string {
	const excerpts = sampleExcerpts
		.slice(0, MAX_EXCERPTS)
		.map((e) => e.slice(0, MAX_EXCERPT_CHARS))
		.join("\n---\n");
	return `Metrics:\n${JSON.stringify(metrics, null, 2)}\n\nSample answer excerpts:\n${excerpts}`;
}

/** Testable core: dependencies injected. */
export async function generateNarrativeWith(
	metrics: ReportMetrics,
	sampleExcerpts: string[],
	language: string,
	chain: string[],
	vilaoCall: (model: string, system: string, user: string) => Promise<string>,
	openrouterCall: (system: string, user: string) => Promise<unknown>,
): Promise<NarrativeResult> {
	const system = buildSystemPrompt(language);
	const user = buildUserPrompt(metrics, sampleExcerpts);

	for (const model of chain) {
		try {
			const text = await vilaoCall(model, system, user);
			const parsed = narrativeSchema.parse(JSON.parse(text));
			return { narrative: parsed, model };
		} catch {
			// try next model
		}
	}

	// Final fallback: OpenRouter structured research.
	const obj = await openrouterCall(system, user);
	return { narrative: narrativeSchema.parse(obj), model: "openrouter" };
}

/** Production entry point: wires real Vilao + OpenRouter callers. */
export async function generateNarrative(metrics: ReportMetrics, sampleExcerpts: string[], language: string): Promise<NarrativeResult> {
	return generateNarrativeWith(metrics, sampleExcerpts, language, getVilaoModelChain(), callVilaoChat, async (system, user) => {
		const provider = getProvider("openrouter");
		if (!provider.runStructuredResearch) throw new Error("OpenRouter structured research unavailable");
		const { object } = await provider.runStructuredResearch({
			prompt: `${system}\n\n${user}`,
			schema: narrativeSchema,
			webSearch: false,
		});
		return object;
	});
}
