/**
 * Backfill `prompt_runs.brand_position` for the runs of currently-enabled
 * prompts.
 *
 * `brand_position` is captured at write time for new runs. Historical runs
 * predate the column, so this re-derives it from the stored `raw_output`: it
 * re-extracts the answer text with the same per-provider extractors the UI
 * uses, then runs the shared mention analysis — the exact logic the worker
 * applies live. Only runs of enabled prompts are touched (disabled/archived
 * prompts are intentionally skipped), and only rows where `brand_position` is
 * still NULL, so the script is safe to re-run.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm -C packages/lib exec tsx scripts/backfill-brand-position.ts [--dry-run]
 *   (add ALLOW_REMOTE_DB=1 to point at a non-local database)
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../src/db/db";
import { brands, competitors, promptRuns, prompts } from "../src/db/schema";
import { analyzeMentions } from "../src/mention-analysis";
import { extractTextContent } from "../src/text-extraction";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is required");
	process.exit(2);
}
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL) && process.env.ALLOW_REMOTE_DB !== "1") {
	console.error("Refusing to run against a non-local database (set ALLOW_REMOTE_DB=1 to override)");
	process.exit(2);
}

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
	const enabledPrompts = await db
		.select({ id: prompts.id, brandId: prompts.brandId })
		.from(prompts)
		.where(eq(prompts.enabled, true));

	const brandIds = [...new Set(enabledPrompts.map((p) => p.brandId))];
	if (brandIds.length === 0) {
		console.log("No enabled prompts found. Nothing to backfill.");
		return;
	}

	const brandRows = await db.select().from(brands).where(inArray(brands.id, brandIds));
	const competitorRows = await db.select().from(competitors).where(inArray(competitors.brandId, brandIds));

	const brandById = new Map(brandRows.map((b) => [b.id, b]));
	const competitorsByBrand = new Map<string, typeof competitorRows>();
	for (const c of competitorRows) {
		const list = competitorsByBrand.get(c.brandId) ?? [];
		list.push(c);
		competitorsByBrand.set(c.brandId, list);
	}

	let scanned = 0;
	let mentioned = 0;
	let updated = 0;

	for (const prompt of enabledPrompts) {
		const brand = brandById.get(prompt.brandId);
		if (!brand) continue;
		const competitorsList = competitorsByBrand.get(prompt.brandId) ?? [];

		// Only rows still missing a position — keeps the run idempotent.
		const runs = await db
			.select({
				id: promptRuns.id,
				provider: promptRuns.provider,
				model: promptRuns.model,
				rawOutput: promptRuns.rawOutput,
			})
			.from(promptRuns)
			.where(and(eq(promptRuns.promptId, prompt.id), isNull(promptRuns.brandPosition)));

		for (const run of runs) {
			scanned++;
			const text = extractTextContent(run.rawOutput, run.provider ?? run.model);
			const { brandMentioned, brandPosition } = analyzeMentions(text, brand, competitorsList);
			if (!brandMentioned || brandPosition === null) continue;
			mentioned++;
			if (!DRY_RUN) {
				await db.update(promptRuns).set({ brandPosition }).where(eq(promptRuns.id, run.id));
			}
			updated++;
			if (updated % 500 === 0) console.log(`  ...${updated} rows updated so far`);
		}
	}

	console.log(
		`${DRY_RUN ? "[dry-run] " : ""}Done. Scanned ${scanned} NULL-position runs across ${enabledPrompts.length} enabled prompts; ` +
			`${mentioned} mention the brand${DRY_RUN ? " (would update)" : ` and were updated (${updated})`}.`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
