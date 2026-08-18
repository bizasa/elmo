import { describe, expect, it } from "vitest";
import { buildExcerpt, cleanText } from "./excerpt";

describe("cleanText", () => {
	it("strips markdown images, links, and bare URLs", () => {
		const out = cleanText("See ![alt](http://x/y.png) and [Visana](https://visana.vn) at https://foo.bar now");
		expect(out).not.toContain("http");
		expect(out).not.toContain("![");
		expect(out).toContain("Visana");
	});
});

describe("buildExcerpt", () => {
	it("centers the window on the first brand term", () => {
		const text = `${"A".repeat(2000)} Visana is great ${"B".repeat(2000)}`;
		const out = buildExcerpt(text, ["visana"], 800);
		expect(out).toContain("Visana");
		expect(out.length).toBeLessThanOrEqual(1700);
	});

	it("falls back to the head when no brand term is present", () => {
		const text = "no mention here ".repeat(300);
		const out = buildExcerpt(text, ["visana"], 800);
		expect(out.length).toBeLessThanOrEqual(1700);
		expect(out.startsWith("no mention")).toBe(true);
	});
});
