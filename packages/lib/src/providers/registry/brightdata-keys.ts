/**
 * Several BrightData accounts behind one provider.
 *
 * Every BrightData account carries its own monthly free-credit allowance, drawn
 * before any deposited balance. Free-tier keys are spent first, each up to a
 * monthly cap, and the main key (BRIGHTDATA_API_TOKEN) takes whatever is left
 * with no cap — its own free credits still apply before it bills.
 *
 * The cap on a free-tier key is a hard stop, not a preference: an account with
 * no balance that runs past its allowance is suspended mid-cycle, and every run
 * routed to it fails from then on. So a free-tier key is only handed out while
 * its usage is known to be under the cap.
 */

/** A little under BrightData's 5,000 monthly credits, so a count that lags slightly can't overrun it. */
export const DEFAULT_FREE_TIER_CAP = 4500;

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const FAILED_SYNC_RETRY_MS = 60 * 1000;
const INACTIVE_COOLDOWN_MS = 60 * 60 * 1000;

export interface BrightDataKey {
	token: string;
	/** Most records per usage window this key may be used for; null = no cap. */
	monthlyCap: number | null;
}

/** Free-tier entries are `token` or `token@cap`, separated by commas or whitespace. */
export function parseBrightDataKeys(
	freeTierTokens: string | undefined,
	mainToken: string | undefined,
): BrightDataKey[] {
	const keys: BrightDataKey[] = [];
	for (const entry of (freeTierTokens ?? "").split(/[\s,]+/).filter(Boolean)) {
		const at = entry.lastIndexOf("@");
		const token = at === -1 ? entry : entry.slice(0, at);
		const rawCap = at === -1 ? null : entry.slice(at + 1);
		const monthlyCap = rawCap === null ? DEFAULT_FREE_TIER_CAP : Number(rawCap);
		if (!Number.isInteger(monthlyCap) || monthlyCap <= 0) {
			throw new Error(
				`BRIGHTDATA_FREE_TIER_TOKENS: entry ${keys.length + 1} has an invalid cap (want token@<positive integer>)`,
			);
		}
		if (token === mainToken || keys.some((k) => k.token === token)) continue;
		keys.push({ token, monthlyCap });
	}
	if (mainToken) keys.push({ token: mainToken, monthlyCap: null });
	return keys;
}

/**
 * Start of the usage window containing `now`: noon UTC on the 1st. BrightData
 * renews free credits "on the first of the month" without saying in which
 * timezone; by noon UTC the 1st has begun everywhere, so a key's allowance is
 * never treated as fresh while BrightData still counts it as spent.
 */
export function usageWindowStart(now: number): Date {
	const d = new Date(now);
	let start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12);
	if (now < start) start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1, 12);
	return new Date(start);
}

interface KeyState {
	key: BrightDataKey;
	windowStart: number;
	/** Usage BrightData reported at the last sync; null until one succeeds this window. */
	reported: number | null;
	/** Keys handed out since that sync began, not yet visible in `reported`. */
	sinceSync: number;
	lastSyncAt: number;
	lastSyncAttemptAt: number;
	sync: Promise<void> | null;
	inactiveUntil: number;
}

export class BrightDataKeyPool {
	private readonly states: KeyState[];
	private readonly now: () => number;
	private readonly monthUsage: (token: string, windowStart: Date) => Promise<number>;

	constructor(
		keys: BrightDataKey[],
		deps: { monthUsage: (token: string, windowStart: Date) => Promise<number>; now?: () => number },
	) {
		this.now = deps.now ?? Date.now;
		this.monthUsage = deps.monthUsage;
		this.states = keys.map((key) => ({
			key,
			windowStart: 0,
			reported: null,
			sinceSync: 0,
			lastSyncAt: 0,
			lastSyncAttemptAt: 0,
			sync: null,
			inactiveUntil: 0,
		}));
	}

	get size(): number {
		return this.states.length;
	}

	/** A token for one record, counted against its key's cap. */
	async acquire(): Promise<string> {
		const now = this.now();
		const capped = this.states.filter((s) => s.key.monthlyCap !== null);
		for (const s of capped) this.rollWindow(s, now);
		await Promise.all(capped.filter((s) => this.needsSync(s, now)).map((s) => this.syncUsage(s)));

		// No await between the checks and the increment, so concurrent callers
		// can't both take a key's last slot.
		const at = this.now();
		for (const s of this.states) {
			if (s.inactiveUntil > at) continue;
			if (s.key.monthlyCap !== null) {
				if (s.reported === null || s.reported + s.sinceSync >= s.key.monthlyCap) continue;
			}
			s.sinceSync++;
			return s.key.token;
		}
		throw new Error("BrightData: every key is at its monthly cap or unavailable");
	}

	/** Stop routing to an account BrightData refuses, until the cooldown passes. */
	markInactive(token: string): void {
		const until = this.now() + INACTIVE_COOLDOWN_MS;
		for (const s of this.states) if (s.key.token === token) s.inactiveUntil = until;
	}

	private rollWindow(s: KeyState, now: number): void {
		const start = usageWindowStart(now).getTime();
		if (s.windowStart === start) return;
		s.windowStart = start;
		s.reported = null;
		s.sinceSync = 0;
		s.lastSyncAt = 0;
		s.lastSyncAttemptAt = 0;
	}

	private needsSync(s: KeyState, now: number): boolean {
		if (s.sync) return true;
		if (s.reported === null) return now - s.lastSyncAttemptAt >= FAILED_SYNC_RETRY_MS || s.lastSyncAttemptAt === 0;
		return now - s.lastSyncAt >= SYNC_INTERVAL_MS;
	}

	private syncUsage(s: KeyState): Promise<void> {
		if (s.sync) return s.sync;
		const windowStart = s.windowStart;
		const handedOutBefore = s.sinceSync;
		s.lastSyncAttemptAt = this.now();
		s.sync = this.monthUsage(s.key.token, new Date(windowStart))
			.then((reported) => {
				if (s.windowStart !== windowStart) return;
				s.reported = reported;
				// Hand-outs made while the request was in flight may or may not be
				// in `reported`; keeping them errs toward stopping early.
				s.sinceSync -= handedOutBefore;
				s.lastSyncAt = this.now();
			})
			.catch((error: unknown) => {
				console.warn(
					`BrightData: could not read this month's usage for a free-tier key — skipping it until that succeeds (${error instanceof Error ? error.message : String(error)})`,
				);
			})
			.finally(() => {
				s.sync = null;
			});
		return s.sync;
	}
}
