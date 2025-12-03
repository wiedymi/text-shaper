import { describe, expect, test } from "bun:test";
import { Tags, tag, tagToString } from "../src/types.ts";

describe("types", () => {
	describe("tag creation", () => {
		test("creates tag from 4-character string", () => {
			expect(tag("head")).toBe(0x68656164);
			expect(tag("GSUB")).toBe(0x47535542);
			expect(tag("GPOS")).toBe(0x47504f53);
			expect(tag("cmap")).toBe(0x636d6170);
		});

		test("throws for non-4-character strings", () => {
			expect(() => tag("abc")).toThrow();
			expect(() => tag("abcde")).toThrow();
			expect(() => tag("")).toThrow();
		});
	});

	describe("tag to string", () => {
		test("converts tag to string", () => {
			expect(tagToString(Tags.head)).toBe("head");
			expect(tagToString(Tags.GSUB)).toBe("GSUB");
			expect(tagToString(Tags.GPOS)).toBe("GPOS");
			expect(tagToString(Tags.cmap)).toBe("cmap");
		});

		test("round-trips correctly", () => {
			const tags = ["head", "maxp", "hhea", "hmtx", "OS/2", "CFF ", "kern"];
			for (const t of tags) {
				expect(tagToString(tag(t))).toBe(t);
			}
		});
	});

	describe("common tags", () => {
		test("required tables", () => {
			expect(Tags.head).toBe(tag("head"));
			expect(Tags.maxp).toBe(tag("maxp"));
			expect(Tags.hhea).toBe(tag("hhea"));
			expect(Tags.hmtx).toBe(tag("hmtx"));
			expect(Tags.cmap).toBe(tag("cmap"));
		});

		test("layout tables", () => {
			expect(Tags.GDEF).toBe(tag("GDEF"));
			expect(Tags.GSUB).toBe(tag("GSUB"));
			expect(Tags.GPOS).toBe(tag("GPOS"));
		});

		test("variable font tables", () => {
			expect(Tags.fvar).toBe(tag("fvar"));
			expect(Tags.gvar).toBe(tag("gvar"));
			expect(Tags.avar).toBe(tag("avar"));
		});
	});
});
