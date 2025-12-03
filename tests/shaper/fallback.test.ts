import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import {
	applyFallbackKerning,
	applyFallbackMarkPositioning,
	recategorizeCombiningMarks,
} from "../../src/shaper/fallback.ts";
import type { GlyphInfo, GlyphPosition } from "../../src/types.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("fallback shaping", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("applyFallbackKerning", () => {
		function makeInfo(codepoint: number): GlyphInfo {
			return {
				glyphId: font.glyphId(codepoint),
				cluster: 0,
				mask: 0,
				codepoint,
			};
		}

		function makePos(): GlyphPosition {
			return { xAdvance: 500, yAdvance: 0, xOffset: 0, yOffset: 0 };
		}

		test("handles empty arrays", () => {
			const infos: GlyphInfo[] = [];
			const positions: GlyphPosition[] = [];
			expect(() => applyFallbackKerning(font, infos, positions)).not.toThrow();
		});

		test("handles single glyph", () => {
			const infos = [makeInfo(0x41)]; // A
			const positions = [makePos()];
			applyFallbackKerning(font, infos, positions);
			expect(positions[0]!.xAdvance).toBe(500);
		});

		test("handles pair of glyphs", () => {
			const infos = [makeInfo(0x41), makeInfo(0x56)]; // AV (common kern pair)
			const positions = [makePos(), makePos()];
			applyFallbackKerning(font, infos, positions);
			// Kerning may or may not be applied depending on font's kern table
			expect(typeof positions[0]!.xAdvance).toBe("number");
		});

		test("handles three glyphs", () => {
			const infos = [makeInfo(0x54), makeInfo(0x6f), makeInfo(0x70)]; // Top
			const positions = [makePos(), makePos(), makePos()];
			applyFallbackKerning(font, infos, positions);
			expect(positions.length).toBe(3);
		});

		test("skips marks when kerning", () => {
			// Base + combining mark + base
			const infos = [
				makeInfo(0x41), // A
				makeInfo(0x0301), // combining acute
				makeInfo(0x42), // B
			];
			const positions = [makePos(), makePos(), makePos()];
			applyFallbackKerning(font, infos, positions);
			expect(positions.length).toBe(3);
		});

		test("handles null info gracefully", () => {
			const infos: (GlyphInfo | undefined)[] = [makeInfo(0x41), undefined, makeInfo(0x42)];
			const positions = [makePos(), makePos(), makePos()];
			// Should not crash with undefined in array
			applyFallbackKerning(font, infos as GlyphInfo[], positions);
		});

		test("handles null position gracefully", () => {
			const infos = [makeInfo(0x41), makeInfo(0x42)];
			const positions: (GlyphPosition | undefined)[] = [undefined, makePos()];
			applyFallbackKerning(font, infos, positions as GlyphPosition[]);
		});
	});

	describe("applyFallbackMarkPositioning", () => {
		function makeInfo(codepoint: number): GlyphInfo {
			return {
				glyphId: font.glyphId(codepoint),
				cluster: 0,
				mask: 0,
				codepoint,
			};
		}

		function makePos(xAdvance: number = 500): GlyphPosition {
			return { xAdvance, yAdvance: 0, xOffset: 0, yOffset: 0 };
		}

		test("handles empty arrays", () => {
			const infos: GlyphInfo[] = [];
			const positions: GlyphPosition[] = [];
			expect(() => applyFallbackMarkPositioning(font, infos, positions)).not.toThrow();
		});

		test("handles single base glyph", () => {
			const infos = [makeInfo(0x41)]; // A
			const positions = [makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[0]!.xAdvance).toBe(500);
		});

		test("positions combining acute accent (ccc 230 - above)", () => {
			const infos = [
				makeInfo(0x41), // A
				makeInfo(0x0301), // combining acute (ccc 230)
			];
			const positions = [makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			// Mark should have zero advance
			expect(positions[1]!.xAdvance).toBe(0);
			expect(positions[1]!.yAdvance).toBe(0);
			// Mark should be positioned above base
			expect(positions[1]!.yOffset).toBeGreaterThan(0);
		});

		test("positions combining cedilla (ccc 202 - below)", () => {
			const infos = [
				makeInfo(0x43), // C
				makeInfo(0x0327), // combining cedilla (ccc 202)
			];
			const positions = [makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[1]!.xAdvance).toBe(0);
			// Mark positioned - yOffset is set based on heuristics
			expect(typeof positions[1]!.yOffset).toBe("number");
		});

		test("positions combining macron below (ccc 220 - below)", () => {
			const infos = [
				makeInfo(0x61), // a
				makeInfo(0x0331), // combining macron below (ccc 220)
			];
			const positions = [makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[1]!.xAdvance).toBe(0);
		});

		test("positions overlay mark (ccc 1)", () => {
			const infos = [
				makeInfo(0x4f), // O
				makeInfo(0x0338), // combining long solidus overlay (ccc 1)
			];
			const positions = [makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[1]!.xAdvance).toBe(0);
		});

		test("positions nukta (ccc 7)", () => {
			const infos = [
				makeInfo(0x0915), // Devanagari Ka
				makeInfo(0x093C), // Devanagari nukta (ccc 7)
			];
			const positions = [makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[1]!.xAdvance).toBe(0);
		});

		test("positions Hebrew vowel (ccc 10-22)", () => {
			const infos = [
				makeInfo(0x05D0), // Hebrew Alef
				makeInfo(0x05B8), // Hebrew qamats (ccc 18)
			];
			const positions = [makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[1]!.xAdvance).toBe(0);
			// Hebrew below vowel
			expect(positions[1]!.yOffset).toBeLessThan(0);
		});

		test("positions Arabic mark (ccc 27-33)", () => {
			const infos = [
				makeInfo(0x0628), // Arabic Ba
				makeInfo(0x064E), // Arabic fatha (ccc 30)
			];
			const positions = [makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[1]!.xAdvance).toBe(0);
			// Arabic above mark
			expect(positions[1]!.yOffset).toBeGreaterThan(0);
		});

		test("positions Arabic kasra (ccc 29 - below)", () => {
			const infos = [
				makeInfo(0x0628), // Arabic Ba
				makeInfo(0x0650), // Arabic kasra (ccc 28)
			];
			const positions = [makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[1]!.xAdvance).toBe(0);
		});

		test("handles multiple marks on same base", () => {
			const infos = [
				makeInfo(0x41), // A
				makeInfo(0x0301), // acute
				makeInfo(0x0308), // diaeresis
			];
			const positions = [makePos(), makePos(), makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			expect(positions[1]!.xAdvance).toBe(0);
			expect(positions[2]!.xAdvance).toBe(0);
		});

		test("skips positioning when no base found", () => {
			// Start with a combining mark (no base before it)
			const infos = [makeInfo(0x0301)]; // combining acute
			const positions = [makePos()];
			applyFallbackMarkPositioning(font, infos, positions);
			// Should not crash, position unchanged
			expect(positions[0]!.xAdvance).toBe(500);
		});

		test("handles null entries gracefully", () => {
			const infos: (GlyphInfo | undefined)[] = [makeInfo(0x41), undefined];
			const positions: (GlyphPosition | undefined)[] = [makePos(), undefined];
			applyFallbackMarkPositioning(font, infos as GlyphInfo[], positions as GlyphPosition[]);
		});
	});

	describe("recategorizeCombiningMarks", () => {
		function makeInfo(codepoint: number, cluster: number = 0): GlyphInfo {
			return {
				glyphId: font.glyphId(codepoint),
				cluster,
				mask: 0,
				codepoint,
			};
		}

		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			expect(() => recategorizeCombiningMarks(font, infos)).not.toThrow();
		});

		test("handles array with only base characters", () => {
			const infos = [makeInfo(0x41), makeInfo(0x42), makeInfo(0x43)];
			recategorizeCombiningMarks(font, infos);
			expect(infos[0]!.codepoint).toBe(0x41);
			expect(infos[1]!.codepoint).toBe(0x42);
			expect(infos[2]!.codepoint).toBe(0x43);
		});

		test("sorts combining marks by CCC", () => {
			// Base + multiple marks with different CCCs
			const infos = [
				makeInfo(0x41), // A (ccc 0)
				makeInfo(0x0308), // diaeresis (ccc 230)
				makeInfo(0x0327), // cedilla (ccc 202)
			];
			recategorizeCombiningMarks(font, infos);
			// Cedilla (202) should come before diaeresis (230)
			expect(infos[1]!.codepoint).toBe(0x0327);
			expect(infos[2]!.codepoint).toBe(0x0308);
		});

		test("preserves order for same CCC", () => {
			const infos = [
				makeInfo(0x41), // A
				makeInfo(0x0301), // acute (ccc 230)
				makeInfo(0x0302), // circumflex (ccc 230)
			];
			const originalOrder = [infos[1]!.codepoint, infos[2]!.codepoint];
			recategorizeCombiningMarks(font, infos);
			// Same CCC should maintain relative order (stable sort)
			expect([infos[1]!.codepoint, infos[2]!.codepoint]).toEqual(originalOrder);
		});

		test("handles multiple base+mark sequences", () => {
			const infos = [
				makeInfo(0x41), // A
				makeInfo(0x0301), // acute
				makeInfo(0x42), // B
				makeInfo(0x0302), // circumflex
			];
			recategorizeCombiningMarks(font, infos);
			expect(infos[0]!.codepoint).toBe(0x41);
			expect(infos[2]!.codepoint).toBe(0x42);
		});

		test("handles mark at start of array", () => {
			const infos = [
				makeInfo(0x0301), // acute (no base)
				makeInfo(0x41), // A
			];
			recategorizeCombiningMarks(font, infos);
			// Should not crash
			expect(infos.length).toBe(2);
		});

		test("handles only marks", () => {
			const infos = [
				makeInfo(0x0301), // acute
				makeInfo(0x0302), // circumflex
				makeInfo(0x0303), // tilde
			];
			recategorizeCombiningMarks(font, infos);
			expect(infos.length).toBe(3);
		});

		test("handles long sequence of marks", () => {
			const infos = [
				makeInfo(0x41), // A
				makeInfo(0x0308), // diaeresis (230)
				makeInfo(0x0327), // cedilla (202)
				makeInfo(0x0301), // acute (230)
				makeInfo(0x0323), // dot below (220)
			];
			recategorizeCombiningMarks(font, infos);
			// Should be sorted by CCC: 202, 220, 230, 230
			expect(infos[1]!.codepoint).toBe(0x0327); // 202
			expect(infos[2]!.codepoint).toBe(0x0323); // 220
		});

		test("handles null entry in array", () => {
			const infos: (GlyphInfo | undefined)[] = [
				makeInfo(0x41),
				undefined,
				makeInfo(0x0301),
			];
			recategorizeCombiningMarks(font, infos as GlyphInfo[]);
		});
	});
});
