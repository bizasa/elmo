import { getCfAigToken, getVilaoApiKey, getVilaoGatewayUrl } from "./config";

export class VilaoError extends Error {}

/**
 * Call one Vilao model via the Cloudflare AI Gateway (OpenAI-compatible) and
 * return the raw assistant text. Throws VilaoError on transport/HTTP/empty
 * failures so the caller can advance to the next model in the chain.
 */
export async function callVilaoChat(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
	const url = getVilaoGatewayUrl();
	const apiKey = getVilaoApiKey();
	const cfToken = getCfAigToken();
	if (!url || !apiKey || !cfToken) throw new VilaoError("Vilao is not configured");

	let res: Response;
	try {
		res = await fetch(url, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				// Browser-like UA avoids Cloudflare's 1010 block on non-browser callers.
				"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
				authorization: `Bearer ${apiKey}`,
				"cf-aig-authorization": cfToken,
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
				response_format: { type: "json_object" },
				temperature: 0.4,
			}),
		});
	} catch (err) {
		throw new VilaoError(`Vilao request failed for ${model}: ${err instanceof Error ? err.message : String(err)}`);
	}

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new VilaoError(`Vilao ${model} returned HTTP ${res.status}: ${body.slice(0, 300)}`);
	}

	const data: any = await res.json().catch(() => null);
	const text: string | undefined = data?.choices?.[0]?.message?.content;
	if (!text || !text.trim()) throw new VilaoError(`Vilao ${model} returned empty content`);
	return text;
}
