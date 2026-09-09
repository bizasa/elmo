// Server-only env getters for the Vilao narrative generator. Mirrors the
// getRunsPerPrompt() pattern in ../constants.ts: guard `process`, read env,
// fall back to a constant.
const DEFAULT_VILAO_MODEL = "occ/claude-sonnet-5";
const DEFAULT_VILAO_MODEL_CHAIN = [
	"occ/claude-sonnet-5",
	"krr/claude-sonnet-5",
	"occ/claude-opus-4-8",
	"occ/claude-fable-5",
	"gx/gpt-5.5",
	"cd/gpt-5.5",
	"cd/gpt-5.6-sol",
	"cd/gpt-5.6-terra",
];

function env(key: string): string | undefined {
	return typeof process !== "undefined" ? process.env[key] : undefined;
}

export function getVilaoApiKey(): string | undefined {
	return env("VILAO_API_KEY")?.trim();
}
export function getVilaoGatewayUrl(): string | undefined {
	return env("VILAO_GATEWAY_URL")?.trim();
}
export function getCfAigToken(): string | undefined {
	return env("CF_AIG_TOKEN")?.trim();
}
export function getVilaoModel(): string {
	const v = env("VILAO_MODEL")?.trim();
	return v || DEFAULT_VILAO_MODEL;
}
export function getVilaoModelChain(): string[] {
	const raw = env("VILAO_MODEL_CHAIN")?.trim();
	if (!raw) {
		// Head is whatever VILAO_MODEL resolves to; keep it first, then the default tail (deduped).
		const head = getVilaoModel();
		return [head, ...DEFAULT_VILAO_MODEL_CHAIN.filter((m) => m !== head)];
	}
	const models = raw
		.split(",")
		.map((m) => m.trim())
		.filter(Boolean);
	return models.length ? models : DEFAULT_VILAO_MODEL_CHAIN;
}

export function isVilaoConfigured(): boolean {
	return Boolean(getVilaoApiKey() && getVilaoGatewayUrl() && getCfAigToken());
}
