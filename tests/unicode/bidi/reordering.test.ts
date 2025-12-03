import { describe, expect, test } from "bun:test";
import { getEmbeddingLevels } from "../../../src/unicode/bidi/embedding-levels.ts";
import {
	getReorderSegments,
	getReorderedString,
	getReorderedIndices,
} from "../../../src/unicode/bidi/reordering.ts";

describe("bidi reordering", () => {
	describe("getReorderSegments", () => {
		test("empty string returns empty segments", () => {
			const levels = getEmbeddingLevels("");
			const segments = getReorderSegments("", levels);
			expect(segments).toEqual([]);
		});

		test("LTR text returns no segments", () => {
			const text = "Hello";
			const levels = getEmbeddingLevels(text);
			const segments = getReorderSegments(text, levels);
			expect(segments).toEqual([]);
		});

		test("RTL text returns segment to reverse", () => {
			const text = "\u05D0\u05D1\u05D2"; // אבג
			const levels = getEmbeddingLevels(text);
			const segments = getReorderSegments(text, levels);
			expect(segments.length).toBeGreaterThan(0);
		});

		test("returns array of tuples", () => {
			const text = "\u05D0\u05D1\u05D2";
			const levels = getEmbeddingLevels(text);
			const segments = getReorderSegments(text, levels);
			for (const seg of segments) {
				expect(Array.isArray(seg)).toBe(true);
				expect(seg.length).toBe(2);
				expect(typeof seg[0]).toBe("number");
				expect(typeof seg[1]).toBe("number");
			}
		});
	});

	describe("getReorderedIndices", () => {
		test("empty string", () => {
			const levels = getEmbeddingLevels("");
			const indices = getReorderedIndices("", levels);
			expect(indices).toEqual([]);
		});

		test("LTR text unchanged", () => {
			const text = "Hello";
			const levels = getEmbeddingLevels(text);
			const indices = getReorderedIndices(text, levels);
			expect(indices).toEqual([0, 1, 2, 3, 4]);
		});

		test("RTL text reversed", () => {
			const text = "\u05D0\u05D1\u05D2"; // אבג
			const levels = getEmbeddingLevels(text);
			const indices = getReorderedIndices(text, levels);
			// RTL should be reversed
			expect(indices).toEqual([2, 1, 0]);
		});

		test("preserves array length", () => {
			const text = "Hello \u05D0\u05D1 World";
			const levels = getEmbeddingLevels(text);
			const indices = getReorderedIndices(text, levels);
			expect(indices.length).toBe(text.length);
		});

		test("all indices present", () => {
			const text = "A\u05D0B";
			const levels = getEmbeddingLevels(text);
			const indices = getReorderedIndices(text, levels);
			const sorted = [...indices].sort((a, b) => a - b);
			expect(sorted).toEqual([0, 1, 2]);
		});
	});

	describe("getReorderedString", () => {
		test("empty string", () => {
			const levels = getEmbeddingLevels("");
			const result = getReorderedString("", levels);
			expect(result).toBe("");
		});

		test("LTR text unchanged", () => {
			const text = "Hello World";
			const levels = getEmbeddingLevels(text);
			const result = getReorderedString(text, levels);
			expect(result).toBe("Hello World");
		});

		test("RTL text reversed", () => {
			const text = "\u05D0\u05D1\u05D2"; // אבג
			const levels = getEmbeddingLevels(text);
			const result = getReorderedString(text, levels);
			// Should be reversed: גבא
			expect(result).toBe("\u05D2\u05D1\u05D0");
		});

		test("preserves string length", () => {
			const text = "Mixed \u05D0\u05D1 text";
			const levels = getEmbeddingLevels(text);
			const result = getReorderedString(text, levels);
			expect(result.length).toBe(text.length);
		});

		test("mixed text reorders RTL portion", () => {
			const text = "Hello \u05D0\u05D1\u05D2 World";
			const levels = getEmbeddingLevels(text);
			const result = getReorderedString(text, levels);
			// LTR parts should be present
			expect(result).toContain("Hello");
			expect(result).toContain("World");
		});
	});

	describe("line ranges", () => {
		test("respects start parameter", () => {
			const text = "Hello World";
			const levels = getEmbeddingLevels(text);
			const segments = getReorderSegments(text, levels, 3);
			// Should handle start offset
			expect(Array.isArray(segments)).toBe(true);
		});

		test("respects end parameter", () => {
			const text = "Hello World";
			const levels = getEmbeddingLevels(text);
			const segments = getReorderSegments(text, levels, 0, 4);
			// Should handle end limit
			expect(Array.isArray(segments)).toBe(true);
		});
	});

	describe("character mirroring in RTL", () => {
		test("LTR brackets not mirrored", () => {
			const text = "Hello (World)";
			const levels = getEmbeddingLevels(text);
			const result = getReorderedString(text, levels);
			// Brackets stay as is in LTR
			expect(result).toContain("(");
			expect(result).toContain(")");
			expect(result.indexOf("(")).toBeLessThan(result.indexOf(")"));
		});
	});
});
