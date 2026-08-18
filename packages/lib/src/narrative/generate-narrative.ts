import { narrativeSchema, type Narrative, type NarrativeMetrics } from "../explorer/types";
import { getProvider } from "../providers";
import { getVilaoModelChain } from "./config";
import { callVilaoChat } from "./vilao-client";

export interface NarrativeResult {
	narrative: Narrative;
	model: string;
}

function buildSystemPrompt(language: string): string {
	const lang = language === "vi" ? "Vietnamese" : "English";
	return (
		`You are an AEO analyst. Write a concise, factual report narrative in ${lang}. ` +
		`Use ONLY the numbers provided in the user's JSON — never invent figures. ` +
		`Respond with a single JSON object with exactly these keys: ` +
		`executiveSummary (string), keyFindings (string array), competitorGaps (string), recommendations (string array).`
	);
}

function buildUserPrompt(metrics: NarrativeMetrics): string {
	return `Metrics:\n${JSON.stringify(metrics, null, 2)}`;
}

/** Testable core: dependencies injected. */
export async function generateNarrativeWith(
	metrics: NarrativeMetrics,
	language: string,
	chain: string[],
	vilaoCall: (model: string, system: string, user: string) => Promise<string>,
	openrouterCall: (system: string, user: string) => Promise<unknown>,
): Promise<NarrativeResult> {
	const system = buildSystemPrompt(language);
	const user = buildUserPrompt(metrics);

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
export async function generateNarrative(metrics: NarrativeMetrics, language: string): Promise<NarrativeResult> {
	return generateNarrativeWith(metrics, language, getVilaoModelChain(), callVilaoChat, async (system, user) => {
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
