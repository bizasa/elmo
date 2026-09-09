import { describe, expect, it } from "vitest";
import { analyzeMentions, type BrandMentionInput, type CompetitorMentionInput } from "./mention-analysis";

const brand: BrandMentionInput = {
	name: "Cozyhome",
	aliases: ["Cozy Home"],
	website: "https://cozyhome.com.vn",
	additionalDomains: [],
};

const competitors: CompetitorMentionInput[] = [
	{ name: "Booking", aliases: [], domains: ["booking.com"] },
	{ name: "Agoda", aliases: [], domains: ["agoda.com"] },
];

describe("analyzeMentions", () => {
	it("flags the brand and returns null position when it isn't mentioned", () => {
		const result = analyzeMentions("Agoda and Booking are popular choices.", brand, competitors);
		expect(result.brandMentioned).toBe(false);
		expect(result.brandPosition).toBeNull();
		expect(result.competitorsMentioned).toEqual(["Booking", "Agoda"]);
	});

	it("ranks the brand #1 when it appears before every competitor", () => {
		const result = analyzeMentions("Cozyhome is great, better than Booking or Agoda.", brand, competitors);
		expect(result.brandMentioned).toBe(true);
		expect(result.brandPosition).toBe(1);
	});

	it("ranks the brand by order of first appearance among mentioned entities", () => {
		// Booking (0) < Agoda (10) < Cozyhome (later) => brand is #3
		const result = analyzeMentions("Booking, Agoda, and finally Cozyhome round out the list.", brand, competitors);
		expect(result.brandPosition).toBe(3);
	});

	it("only counts competitors that are actually mentioned", () => {
		// Only Booking appears before the brand; Agoda is absent entirely.
		const result = analyzeMentions("Booking first, then Cozyhome.", brand, competitors);
		expect(result.competitorsMentioned).toEqual(["Booking"]);
		expect(result.brandPosition).toBe(2);
	});

	it("matches the brand by domain when the name is absent", () => {
		const result = analyzeMentions("Check cozyhome.com.vn for listings; Booking too.", brand, competitors);
		expect(result.brandMentioned).toBe(true);
		expect(result.brandPosition).toBe(1);
	});

	it("uses the earliest of name or alias for the brand's position", () => {
		// "Cozy Home" alias appears before Booking even though "Cozyhome" would be later.
		const result = analyzeMentions("Cozy Home leads, then Booking, then the Cozyhome app.", brand, competitors);
		expect(result.brandPosition).toBe(1);
	});

	it("is case-insensitive", () => {
		const result = analyzeMentions("BOOKING, then COZYHOME.", brand, competitors);
		expect(result.brandMentioned).toBe(true);
		expect(result.brandPosition).toBe(2);
	});
});
