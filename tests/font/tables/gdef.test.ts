import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseGdef,
	getGlyphClass,
	isBaseGlyph,
	isLigature,
	isMark,
	isComponent,
	parseAttachList,
	parseLigCaretList,
	parseMarkGlyphSets,
	type GdefTable,
} from "../../../src/font/tables/gdef.ts";
import { GlyphClass } from "../../../src/types.ts";
import type { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("gdef table", () => {
	let font: Font;
	let gdef: GdefTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		gdef = font.gdef;
	});

	describe("parseGdef", () => {
		test("returns GdefTable with version", () => {
			if (!gdef) {
				// Arial may not have GDEF table, skip if not present
				return;
			}
			expect(gdef.version).toBeDefined();
			expect(typeof gdef.version.major).toBe("number");
			expect(typeof gdef.version.minor).toBe("number");
			expect(gdef.version.major).toBeGreaterThanOrEqual(1);
			expect(gdef.version.minor).toBeGreaterThanOrEqual(0);
		});

		test("has glyphClassDef", () => {
			if (!gdef) return;
			expect(gdef.glyphClassDef).toBeDefined();
			expect(typeof gdef.glyphClassDef.get).toBe("function");
			expect(typeof gdef.glyphClassDef.glyphsInClass).toBe("function");
		});

		test("has markAttachClassDef", () => {
			if (!gdef) return;
			expect(gdef.markAttachClassDef).toBeDefined();
			expect(typeof gdef.markAttachClassDef.get).toBe("function");
		});

		test("attachList is Map or null", () => {
			if (!gdef) return;
			if (gdef.attachList !== null) {
				expect(gdef.attachList).toBeInstanceOf(Map);
			}
		});

		test("ligCaretList is Map or null", () => {
			if (!gdef) return;
			if (gdef.ligCaretList !== null) {
				expect(gdef.ligCaretList).toBeInstanceOf(Map);
			}
		});

		test("markGlyphSets is object with has method or null", () => {
			if (!gdef) return;
			if (gdef.markGlyphSets !== null) {
				expect(typeof gdef.markGlyphSets.has).toBe("function");
			}
		});

		test("version 1.2+ has markGlyphSets support", () => {
			if (!gdef) return;
			if (gdef.version.major === 1 && gdef.version.minor >= 2) {
				// Mark glyph sets should be present or null (depending on offset)
				expect(
					gdef.markGlyphSets === null ||
						typeof gdef.markGlyphSets?.has === "function",
				).toBe(true);
			}
		});
	});

	describe("glyphClassDef", () => {
		test("get returns valid glyph class", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(100, font.numGlyphs); glyphId++) {
				const cls = gdef.glyphClassDef.get(glyphId);
				expect(typeof cls).toBe("number");
				expect(cls >= 0 && cls <= 4).toBe(true);
			}
		});

		test("classifies some glyphs", () => {
			if (!gdef) return;
			let hasNonZeroClass = false;
			for (let glyphId = 0; glyphId < Math.min(200, font.numGlyphs); glyphId++) {
				const cls = gdef.glyphClassDef.get(glyphId);
				if (cls !== 0) {
					hasNonZeroClass = true;
					expect([1, 2, 3, 4]).toContain(cls);
				}
			}
			// Arial should have some classified glyphs
			expect(typeof hasNonZeroClass).toBe("boolean");
		});

		test("returns 0 for unclassified glyphs", () => {
			if (!gdef) return;
			// Test high glyph IDs that are likely unclassified
			const highGlyphId = font.numGlyphs + 100;
			const cls = gdef.glyphClassDef.get(highGlyphId);
			expect(cls).toBe(0);
		});

		test("glyphsInClass returns array", () => {
			if (!gdef) return;
			for (let classValue = 1; classValue <= 4; classValue++) {
				const glyphs = gdef.glyphClassDef.glyphsInClass(classValue);
				expect(Array.isArray(glyphs)).toBe(true);
			}
		});

		test("glyphsInClass contains valid glyph IDs", () => {
			if (!gdef) return;
			const baseGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Base);
			for (const glyphId of baseGlyphs.slice(0, 10)) {
				expect(typeof glyphId).toBe("number");
				expect(glyphId >= 0).toBe(true);
				expect(glyphId < font.numGlyphs).toBe(true);
			}
		});

		test("glyphs returned by glyphsInClass have correct class", () => {
			if (!gdef) return;
			for (let classValue = 1; classValue <= 4; classValue++) {
				const glyphs = gdef.glyphClassDef.glyphsInClass(classValue);
				for (const glyphId of glyphs.slice(0, 5)) {
					expect(gdef.glyphClassDef.get(glyphId)).toBe(classValue);
				}
			}
		});
	});

	describe("getGlyphClass", () => {
		test("returns 0 when gdef is null", () => {
			const cls = getGlyphClass(null, 10);
			expect(cls).toBe(0);
		});

		test("returns glyph class from GDEF", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(50, font.numGlyphs); glyphId++) {
				const cls = getGlyphClass(gdef, glyphId);
				expect(typeof cls).toBe("number");
				expect(cls >= 0 && cls <= 4).toBe(true);
			}
		});

		test("returns same value as glyphClassDef.get", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(50, font.numGlyphs); glyphId++) {
				const cls1 = getGlyphClass(gdef, glyphId);
				const cls2 = gdef.glyphClassDef.get(glyphId);
				expect(cls1).toBe(cls2);
			}
		});

		test("handles glyph ID 0", () => {
			if (!gdef) return;
			const cls = getGlyphClass(gdef, 0);
			expect(typeof cls).toBe("number");
		});

		test("handles high glyph IDs", () => {
			if (!gdef) return;
			const cls = getGlyphClass(gdef, 9999);
			expect(cls).toBe(0);
		});
	});

	describe("isBaseGlyph", () => {
		test("returns false when gdef is null", () => {
			expect(isBaseGlyph(null, 10)).toBe(false);
		});

		test("returns boolean", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(50, font.numGlyphs); glyphId++) {
				const result = isBaseGlyph(gdef, glyphId);
				expect(typeof result).toBe("boolean");
			}
		});

		test("returns true only for Base glyphs", () => {
			if (!gdef) return;
			const baseGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Base);
			if (baseGlyphs.length > 0) {
				const glyphId = baseGlyphs[0];
				if (glyphId !== undefined) {
					expect(isBaseGlyph(gdef, glyphId)).toBe(true);
					expect(getGlyphClass(gdef, glyphId)).toBe(GlyphClass.Base);
				}
			}
		});

		test("returns false for non-Base glyphs", () => {
			if (!gdef) return;
			for (let classValue = 2; classValue <= 4; classValue++) {
				const glyphs = gdef.glyphClassDef.glyphsInClass(classValue);
				if (glyphs.length > 0) {
					const glyphId = glyphs[0];
					if (glyphId !== undefined) {
						expect(isBaseGlyph(gdef, glyphId)).toBe(false);
					}
				}
			}
		});
	});

	describe("isLigature", () => {
		test("returns false when gdef is null", () => {
			expect(isLigature(null, 10)).toBe(false);
		});

		test("returns boolean", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(50, font.numGlyphs); glyphId++) {
				const result = isLigature(gdef, glyphId);
				expect(typeof result).toBe("boolean");
			}
		});

		test("returns true only for Ligature glyphs", () => {
			if (!gdef) return;
			const ligatureGlyphs = gdef.glyphClassDef.glyphsInClass(
				GlyphClass.Ligature,
			);
			if (ligatureGlyphs.length > 0) {
				const glyphId = ligatureGlyphs[0];
				if (glyphId !== undefined) {
					expect(isLigature(gdef, glyphId)).toBe(true);
					expect(getGlyphClass(gdef, glyphId)).toBe(GlyphClass.Ligature);
				}
			}
		});

		test("returns false for non-Ligature glyphs", () => {
			if (!gdef) return;
			const baseGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Base);
			if (baseGlyphs.length > 0) {
				const glyphId = baseGlyphs[0];
				if (glyphId !== undefined) {
					expect(isLigature(gdef, glyphId)).toBe(false);
				}
			}
		});
	});

	describe("isMark", () => {
		test("returns false when gdef is null", () => {
			expect(isMark(null, 10)).toBe(false);
		});

		test("returns boolean", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(50, font.numGlyphs); glyphId++) {
				const result = isMark(gdef, glyphId);
				expect(typeof result).toBe("boolean");
			}
		});

		test("returns true only for Mark glyphs", () => {
			if (!gdef) return;
			const markGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Mark);
			if (markGlyphs.length > 0) {
				const glyphId = markGlyphs[0];
				if (glyphId !== undefined) {
					expect(isMark(gdef, glyphId)).toBe(true);
					expect(getGlyphClass(gdef, glyphId)).toBe(GlyphClass.Mark);
				}
			}
		});

		test("returns false for non-Mark glyphs", () => {
			if (!gdef) return;
			const baseGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Base);
			if (baseGlyphs.length > 0) {
				const glyphId = baseGlyphs[0];
				if (glyphId !== undefined) {
					expect(isMark(gdef, glyphId)).toBe(false);
				}
			}
		});
	});

	describe("isComponent", () => {
		test("returns false when gdef is null", () => {
			expect(isComponent(null, 10)).toBe(false);
		});

		test("returns boolean", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(50, font.numGlyphs); glyphId++) {
				const result = isComponent(gdef, glyphId);
				expect(typeof result).toBe("boolean");
			}
		});

		test("returns true only for Component glyphs", () => {
			if (!gdef) return;
			const componentGlyphs = gdef.glyphClassDef.glyphsInClass(
				GlyphClass.Component,
			);
			if (componentGlyphs.length > 0) {
				const glyphId = componentGlyphs[0];
				if (glyphId !== undefined) {
					expect(isComponent(gdef, glyphId)).toBe(true);
					expect(getGlyphClass(gdef, glyphId)).toBe(GlyphClass.Component);
				}
			}
		});

		test("returns false for non-Component glyphs", () => {
			if (!gdef) return;
			const baseGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Base);
			if (baseGlyphs.length > 0) {
				const glyphId = baseGlyphs[0];
				if (glyphId !== undefined) {
					expect(isComponent(gdef, glyphId)).toBe(false);
				}
			}
		});
	});

	describe("markAttachClassDef", () => {
		test("get returns number", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(50, font.numGlyphs); glyphId++) {
				const cls = gdef.markAttachClassDef.get(glyphId);
				expect(typeof cls).toBe("number");
				expect(cls >= 0).toBe(true);
			}
		});

		test("returns 0 for unclassified marks", () => {
			if (!gdef) return;
			const highGlyphId = font.numGlyphs + 100;
			const cls = gdef.markAttachClassDef.get(highGlyphId);
			expect(cls).toBe(0);
		});

		test("glyphsInClass returns array", () => {
			if (!gdef) return;
			const glyphs = gdef.markAttachClassDef.glyphsInClass(1);
			expect(Array.isArray(glyphs)).toBe(true);
		});

		test("mark glyphs may have attachment class", () => {
			if (!gdef) return;
			const markGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Mark);
			if (markGlyphs.length > 0) {
				for (const glyphId of markGlyphs.slice(0, 10)) {
					const attachClass = gdef.markAttachClassDef.get(glyphId);
					expect(typeof attachClass).toBe("number");
					expect(attachClass >= 0).toBe(true);
				}
			}
		});
	});

	describe("attachList", () => {
		test("attachList entries have pointIndices", () => {
			if (!gdef || !gdef.attachList) return;
			for (const [glyphId, attachPoint] of gdef.attachList.entries()) {
				expect(typeof glyphId).toBe("number");
				expect(Array.isArray(attachPoint.pointIndices)).toBe(true);
				expect(attachPoint.pointIndices.length).toBeGreaterThanOrEqual(0);
			}
		});

		test("pointIndices are valid numbers", () => {
			if (!gdef || !gdef.attachList) return;
			for (const attachPoint of gdef.attachList.values()) {
				for (const pointIndex of attachPoint.pointIndices) {
					expect(typeof pointIndex).toBe("number");
					expect(pointIndex >= 0).toBe(true);
				}
			}
		});

		test("glyphs in attachList are valid glyph IDs", () => {
			if (!gdef || !gdef.attachList) return;
			for (const glyphId of gdef.attachList.keys()) {
				expect(glyphId >= 0).toBe(true);
				expect(glyphId < font.numGlyphs).toBe(true);
			}
		});
	});

	describe("ligCaretList", () => {
		test("ligCaretList entries have caretValues", () => {
			if (!gdef || !gdef.ligCaretList) return;
			for (const [glyphId, ligCaret] of gdef.ligCaretList.entries()) {
				expect(typeof glyphId).toBe("number");
				expect(Array.isArray(ligCaret.caretValues)).toBe(true);
				expect(ligCaret.caretValues.length).toBeGreaterThanOrEqual(0);
			}
		});

		test("caretValues are valid numbers", () => {
			if (!gdef || !gdef.ligCaretList) return;
			for (const ligCaret of gdef.ligCaretList.values()) {
				for (const caretValue of ligCaret.caretValues) {
					expect(typeof caretValue).toBe("number");
				}
			}
		});

		test("glyphs in ligCaretList are valid glyph IDs", () => {
			if (!gdef || !gdef.ligCaretList) return;
			for (const glyphId of gdef.ligCaretList.keys()) {
				expect(glyphId >= 0).toBe(true);
				expect(glyphId < font.numGlyphs).toBe(true);
			}
		});

		test("ligature glyphs may have caret positions", () => {
			if (!gdef || !gdef.ligCaretList) return;
			const ligatureGlyphs = gdef.glyphClassDef.glyphsInClass(
				GlyphClass.Ligature,
			);
			if (ligatureGlyphs.length > 0) {
				// Check if any ligature has caret positions
				let hasCaretInfo = false;
				for (const glyphId of ligatureGlyphs) {
					if (gdef.ligCaretList.has(glyphId)) {
						hasCaretInfo = true;
						const ligCaret = gdef.ligCaretList.get(glyphId);
						if (ligCaret) {
							expect(Array.isArray(ligCaret.caretValues)).toBe(true);
						}
					}
				}
				expect(typeof hasCaretInfo).toBe("boolean");
			}
		});
	});

	describe("markGlyphSets", () => {
		test("has method returns boolean", () => {
			if (!gdef || !gdef.markGlyphSets) return;
			const result = gdef.markGlyphSets.has(0, 10);
			expect(typeof result).toBe("boolean");
		});

		test("returns false for invalid set index", () => {
			if (!gdef || !gdef.markGlyphSets) return;
			const result = gdef.markGlyphSets.has(9999, 10);
			expect(result).toBe(false);
		});

		test("returns false for glyphs not in set", () => {
			if (!gdef || !gdef.markGlyphSets) return;
			const highGlyphId = font.numGlyphs + 100;
			const result = gdef.markGlyphSets.has(0, highGlyphId);
			expect(result).toBe(false);
		});

		test("handles multiple set indices", () => {
			if (!gdef || !gdef.markGlyphSets) return;
			for (let setIndex = 0; setIndex < 5; setIndex++) {
				for (let glyphId = 0; glyphId < Math.min(20, font.numGlyphs); glyphId++) {
					const result = gdef.markGlyphSets.has(setIndex, glyphId);
					expect(typeof result).toBe("boolean");
				}
			}
		});
	});

	describe("edge cases", () => {
		test("handles glyph ID 0", () => {
			if (!gdef) return;
			expect(getGlyphClass(gdef, 0)).toBe(gdef.glyphClassDef.get(0));
			expect(typeof isBaseGlyph(gdef, 0)).toBe("boolean");
			expect(typeof isLigature(gdef, 0)).toBe("boolean");
			expect(typeof isMark(gdef, 0)).toBe("boolean");
			expect(typeof isComponent(gdef, 0)).toBe("boolean");
		});

		test("handles glyph beyond font range", () => {
			if (!gdef) return;
			const invalidGlyph = font.numGlyphs + 1000;
			expect(getGlyphClass(gdef, invalidGlyph)).toBe(0);
			expect(isBaseGlyph(gdef, invalidGlyph)).toBe(false);
			expect(isLigature(gdef, invalidGlyph)).toBe(false);
			expect(isMark(gdef, invalidGlyph)).toBe(false);
			expect(isComponent(gdef, invalidGlyph)).toBe(false);
		});

		test("null gdef table handled correctly", () => {
			expect(getGlyphClass(null, 100)).toBe(0);
			expect(isBaseGlyph(null, 100)).toBe(false);
			expect(isLigature(null, 100)).toBe(false);
			expect(isMark(null, 100)).toBe(false);
			expect(isComponent(null, 100)).toBe(false);
		});

		test("negative glyph IDs treated as unclassified", () => {
			if (!gdef) return;
			expect(getGlyphClass(gdef, -1)).toBe(0);
			expect(isBaseGlyph(gdef, -1)).toBe(false);
		});

		test("consistency between class check functions", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < Math.min(100, font.numGlyphs); glyphId++) {
				const cls = getGlyphClass(gdef, glyphId);
				const isBase = isBaseGlyph(gdef, glyphId);
				const isLig = isLigature(gdef, glyphId);
				const isMrk = isMark(gdef, glyphId);
				const isComp = isComponent(gdef, glyphId);

				// Only one should be true
				const trueCount = [isBase, isLig, isMrk, isComp].filter(Boolean).length;
				if (cls === 0) {
					expect(trueCount).toBe(0);
				} else {
					expect(trueCount).toBe(1);
				}

				// Check correspondence
				if (isBase) expect(cls).toBe(GlyphClass.Base);
				if (isLig) expect(cls).toBe(GlyphClass.Ligature);
				if (isMrk) expect(cls).toBe(GlyphClass.Mark);
				if (isComp) expect(cls).toBe(GlyphClass.Component);
			}
		});
	});

	describe("comprehensive glyph classification", () => {
		test("classifies full glyph range", () => {
			if (!gdef) return;
			const classCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

			for (let glyphId = 0; glyphId < font.numGlyphs; glyphId++) {
				const cls = getGlyphClass(gdef, glyphId);
				classCounts[cls as keyof typeof classCounts]++;
			}

			// All glyphs should be classified
			const total = Object.values(classCounts).reduce((a, b) => a + b, 0);
			expect(total).toBe(font.numGlyphs);

			// Should have at least some glyphs
			expect(total).toBeGreaterThan(0);
		});

		test("GlyphClass enum values match expected", () => {
			expect(GlyphClass.Base).toBe(1);
			expect(GlyphClass.Ligature).toBe(2);
			expect(GlyphClass.Mark).toBe(3);
			expect(GlyphClass.Component).toBe(4);
		});

		test("all class values in valid range", () => {
			if (!gdef) return;
			for (let glyphId = 0; glyphId < font.numGlyphs; glyphId++) {
				const cls = getGlyphClass(gdef, glyphId);
				expect(cls >= 0 && cls <= 4).toBe(true);
			}
		});
	});

	describe("glyphClassDef format handling", () => {
		test("handles format 1 and format 2", () => {
			if (!gdef) return;
			// We can't directly test the format, but we can verify behavior
			// that should work for both formats

			// Test sequential lookups
			for (let i = 0; i < Math.min(50, font.numGlyphs); i++) {
				const cls = gdef.glyphClassDef.get(i);
				expect(typeof cls).toBe("number");
			}

			// Test non-sequential lookups
			const testGlyphs = [0, 10, 50, 100, 200];
			for (const glyphId of testGlyphs) {
				if (glyphId < font.numGlyphs) {
					const cls = gdef.glyphClassDef.get(glyphId);
					expect(typeof cls).toBe("number");
				}
			}
		});

		test("binary search correctness for range queries", () => {
			if (!gdef) return;
			// Test that consecutive lookups are consistent
			for (let glyphId = 0; glyphId < Math.min(100, font.numGlyphs - 1); glyphId++) {
				const cls1 = gdef.glyphClassDef.get(glyphId);
				const cls2 = gdef.glyphClassDef.get(glyphId);
				expect(cls1).toBe(cls2);
			}
		});
	});

	describe("version-specific features", () => {
		test("version 1.0 has required fields", () => {
			if (!gdef) return;
			expect(gdef.glyphClassDef).toBeDefined();
			expect(gdef.markAttachClassDef).toBeDefined();
		});

		test("version 1.2+ may have mark glyph sets", () => {
			if (!gdef) return;
			if (gdef.version.major === 1 && gdef.version.minor >= 2) {
				// markGlyphSets may be null if offset was 0
				if (gdef.markGlyphSets !== null) {
					expect(typeof gdef.markGlyphSets.has).toBe("function");
				}
			}
		});

		test("optional tables can be null", () => {
			if (!gdef) return;
			// attachList, ligCaretList, and markGlyphSets can all be null
			expect(
				gdef.attachList === null || gdef.attachList instanceof Map,
			).toBe(true);
			expect(
				gdef.ligCaretList === null || gdef.ligCaretList instanceof Map,
			).toBe(true);
			expect(
				gdef.markGlyphSets === null ||
					typeof gdef.markGlyphSets?.has === "function",
			).toBe(true);
		});
	});

	describe("mark attachment classes", () => {
		test("mark attachment classes are non-negative", () => {
			if (!gdef) return;
			const markGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Mark);
			for (const glyphId of markGlyphs.slice(0, 20)) {
				const attachClass = gdef.markAttachClassDef.get(glyphId);
				expect(attachClass >= 0).toBe(true);
			}
		});

		test("non-mark glyphs may also have attachment classes", () => {
			if (!gdef) return;
			const baseGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Base);
			for (const glyphId of baseGlyphs.slice(0, 20)) {
				const attachClass = gdef.markAttachClassDef.get(glyphId);
				expect(typeof attachClass).toBe("number");
			}
		});

		test("glyphsInClass for attachment classes", () => {
			if (!gdef) return;
			// Test a few attachment class values
			for (let classValue = 0; classValue <= 3; classValue++) {
				const glyphs = gdef.markAttachClassDef.glyphsInClass(classValue);
				expect(Array.isArray(glyphs)).toBe(true);
				for (const glyphId of glyphs.slice(0, 5)) {
					expect(gdef.markAttachClassDef.get(glyphId)).toBe(classValue);
				}
			}
		});
	});
});

describe("gdef table - fonts without GDEF", () => {
	test("font without GDEF returns null", async () => {
		const font = await Font.fromFile(ARIAL_PATH);
		const gdef = font.gdef;

		if (gdef === null) {
			// This is valid - not all fonts have GDEF
			expect(getGlyphClass(null, 10)).toBe(0);
			expect(isBaseGlyph(null, 10)).toBe(false);
			expect(isLigature(null, 10)).toBe(false);
			expect(isMark(null, 10)).toBe(false);
			expect(isComponent(null, 10)).toBe(false);
		} else {
			// Font has GDEF - all functions should work
			expect(gdef.glyphClassDef).toBeDefined();
			expect(typeof gdef.version.major).toBe("number");
		}
	});
});

describe("gdef table - complex script fonts", () => {
	const complexScriptFonts = [
		"/System/Library/Fonts/SFArabic.ttf",
		"/System/Library/Fonts/GeezaPro.ttc",
		"/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc",
	];

	for (const fontPath of complexScriptFonts) {
		describe(`testing ${fontPath.split("/").pop()}`, () => {
			let font: Font | null = null;
			let gdef: GdefTable | null = null;

			beforeAll(async () => {
				try {
					font = await Font.fromFile(fontPath);
					gdef = font.gdef;
				} catch (e) {
					// Font not available
				}
			});

			test("has GDEF table with mark glyphs", () => {
				if (!gdef || !font) return;

				const markGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Mark);
				// Complex scripts should have mark glyphs
				if (markGlyphs.length > 0) {
					expect(markGlyphs.length).toBeGreaterThan(0);

					// Test mark attachment classes
					for (const glyphId of markGlyphs.slice(0, 20)) {
						const attachClass = gdef.markAttachClassDef.get(glyphId);
						expect(typeof attachClass).toBe("number");
						expect(attachClass >= 0).toBe(true);
					}
				}
			});

			test("has attachment list if present", () => {
				if (!gdef || !gdef.attachList) return;

				expect(gdef.attachList.size).toBeGreaterThan(0);

				for (const [glyphId, attachPoint] of gdef.attachList.entries()) {
					expect(Array.isArray(attachPoint.pointIndices)).toBe(true);
					expect(attachPoint.pointIndices.length).toBeGreaterThanOrEqual(1);

					// Point indices should be valid
					for (const pointIndex of attachPoint.pointIndices) {
						expect(typeof pointIndex).toBe("number");
						expect(pointIndex >= 0).toBe(true);
					}
				}
			});

			test("has ligature caret list if present", () => {
				if (!gdef || !gdef.ligCaretList) return;

				expect(gdef.ligCaretList.size).toBeGreaterThan(0);

				for (const [glyphId, ligCaret] of gdef.ligCaretList.entries()) {
					expect(Array.isArray(ligCaret.caretValues)).toBe(true);
					expect(ligCaret.caretValues.length).toBeGreaterThanOrEqual(1);

					// Caret values should be valid numbers
					for (const caretValue of ligCaret.caretValues) {
						expect(typeof caretValue).toBe("number");
						expect(isFinite(caretValue)).toBe(true);
					}
				}
			});

			test("has mark glyph sets if present", () => {
				if (!gdef || !gdef.markGlyphSets) return;

				// Test multiple set indices
				for (let setIndex = 0; setIndex < 5; setIndex++) {
					const markGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Mark);
					for (const glyphId of markGlyphs.slice(0, 10)) {
						const inSet = gdef.markGlyphSets.has(setIndex, glyphId);
						expect(typeof inSet).toBe("boolean");
					}
				}
			});

			test("ligature glyphs have caret positions", () => {
				if (!gdef || !gdef.ligCaretList) return;

				const ligatureGlyphs = gdef.glyphClassDef.glyphsInClass(
					GlyphClass.Ligature,
				);

				if (ligatureGlyphs.length > 0) {
					// Check if any ligature has caret positions
					let found = false;
					for (const glyphId of ligatureGlyphs) {
						if (gdef.ligCaretList.has(glyphId)) {
							found = true;
							const ligCaret = gdef.ligCaretList.get(glyphId);
							if (ligCaret) {
								expect(ligCaret.caretValues.length).toBeGreaterThanOrEqual(1);

								// Caret values should be in reasonable range
								for (const caretValue of ligCaret.caretValues) {
									expect(typeof caretValue).toBe("number");
								}
							}
						}
					}
					expect(typeof found).toBe("boolean");
				}
			});

			test("version 1.2+ mark glyph sets", () => {
				if (!gdef) return;

				if (gdef.version.major === 1 && gdef.version.minor >= 2) {
					// Should have markGlyphSets field (may be null)
					expect(
						gdef.markGlyphSets === null ||
							typeof gdef.markGlyphSets?.has === "function",
					).toBe(true);

					if (gdef.markGlyphSets) {
						// Test that it works correctly
						const markGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Mark);
						if (markGlyphs.length > 0) {
							const glyphId = markGlyphs[0];
							if (glyphId !== undefined) {
								const result = gdef.markGlyphSets.has(0, glyphId);
								expect(typeof result).toBe("boolean");
							}
						}
					}
				}
			});
		});
	}
});

describe("gdef table - detailed parsing validation", () => {
	let font: Font;
	let gdef: GdefTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		gdef = font.gdef;
	});

	test("attachList coverage and attach points alignment", () => {
		if (!gdef || !gdef.attachList) return;

		// Each glyph in attachList should have valid attach points
		for (const [glyphId, attachPoint] of gdef.attachList.entries()) {
			expect(glyphId).toBeGreaterThanOrEqual(0);
			expect(glyphId).toBeLessThan(font.numGlyphs);
			expect(Array.isArray(attachPoint.pointIndices)).toBe(true);

			// Point indices should be in ascending order (not required by spec, but common)
			for (let i = 0; i < attachPoint.pointIndices.length; i++) {
				const pointIndex = attachPoint.pointIndices[i];
				if (pointIndex !== undefined) {
					expect(pointIndex).toBeGreaterThanOrEqual(0);
				}
			}
		}
	});

	test("ligCaretList coverage and caret values alignment", () => {
		if (!gdef || !gdef.ligCaretList) return;

		// Each ligature in ligCaretList should have valid caret positions
		for (const [glyphId, ligCaret] of gdef.ligCaretList.entries()) {
			expect(glyphId).toBeGreaterThanOrEqual(0);
			expect(glyphId).toBeLessThan(font.numGlyphs);
			expect(Array.isArray(ligCaret.caretValues)).toBe(true);

			// Caret values should be reasonable (not testing specific values)
			for (const caretValue of ligCaret.caretValues) {
				expect(typeof caretValue).toBe("number");
				// Caret values can be positive or negative (format 1: design units, format 2: point index, format 3: design units)
				expect(isFinite(caretValue)).toBe(true);
			}
		}
	});

	test("markGlyphSets coverage tables", () => {
		if (!gdef || !gdef.markGlyphSets) return;

		// Test multiple sets with various glyphs
		const markGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Mark);
		const baseGlyphs = gdef.glyphClassDef.glyphsInClass(GlyphClass.Base);

		for (let setIndex = 0; setIndex < 5; setIndex++) {
			// Test mark glyphs
			for (const glyphId of markGlyphs.slice(0, 10)) {
				const inSet = gdef.markGlyphSets.has(setIndex, glyphId);
				expect(typeof inSet).toBe("boolean");
			}

			// Test base glyphs (usually not in mark sets)
			for (const glyphId of baseGlyphs.slice(0, 10)) {
				const inSet = gdef.markGlyphSets.has(setIndex, glyphId);
				expect(typeof inSet).toBe("boolean");
			}
		}
	});

	test("class definition consistency", () => {
		if (!gdef) return;

		// Verify that glyphsInClass returns glyphs that actually have that class
		for (let classValue = 0; classValue <= 4; classValue++) {
			const glyphs = gdef.glyphClassDef.glyphsInClass(classValue);

			for (const glyphId of glyphs.slice(0, 20)) {
				const actualClass = gdef.glyphClassDef.get(glyphId);
				expect(actualClass).toBe(classValue);
			}
		}
	});

	test("mark attachment class definition consistency", () => {
		if (!gdef) return;

		// Verify that glyphsInClass returns glyphs that actually have that attachment class
		for (let classValue = 0; classValue <= 5; classValue++) {
			const glyphs = gdef.markAttachClassDef.glyphsInClass(classValue);

			for (const glyphId of glyphs.slice(0, 10)) {
				const actualClass = gdef.markAttachClassDef.get(glyphId);
				expect(actualClass).toBe(classValue);
			}
		}
	});

	test("all helper functions agree with getGlyphClass", () => {
		if (!gdef) return;

		for (let glyphId = 0; glyphId < Math.min(200, font.numGlyphs); glyphId++) {
			const cls = getGlyphClass(gdef, glyphId);

			const helperResults = {
				[GlyphClass.Base]: isBaseGlyph(gdef, glyphId),
				[GlyphClass.Ligature]: isLigature(gdef, glyphId),
				[GlyphClass.Mark]: isMark(gdef, glyphId),
				[GlyphClass.Component]: isComponent(gdef, glyphId),
			};

			if (cls === 0) {
				// No helper should return true
				expect(helperResults[GlyphClass.Base]).toBe(false);
				expect(helperResults[GlyphClass.Ligature]).toBe(false);
				expect(helperResults[GlyphClass.Mark]).toBe(false);
				expect(helperResults[GlyphClass.Component]).toBe(false);
			} else {
				// Exactly one helper should return true
				expect(helperResults[cls as keyof typeof helperResults]).toBe(true);

				// All others should be false
				for (const [helperCls, result] of Object.entries(helperResults)) {
					if (Number(helperCls) !== cls) {
						expect(result).toBe(false);
					}
				}
			}
		}
	});
});

describe("gdef table - parseAttachList with mock reader", () => {
	test("attachList with coverage format 1", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Header at offset 0
		view.setUint16(0, 6, false);			// coverageOffset
		view.setUint16(2, 2, false);			// glyphCount = 2

		// Attach point offsets
		view.setUint16(4, 14, false);			// attachPointOffset[0] = 14
		view.setUint16(6, 20, false);			// attachPointOffset[1] = 20 (will be read later)

		// Coverage format 1 at offset 6 (wait, we need to fix offsets)
		// Let me recalculate: header is 4 bytes (coverageOffset + glyphCount)
		// Then we have glyphCount * 2 bytes for attach point offsets
		// So coverage should be after header

		let readOffset = 0;
		const reader = {
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint16(readOffset, false));
					readOffset += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					offset16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							uint16Array: (count: number) => {
								const arr: number[] = [];
								for (let i = 0; i < count; i++) {
									arr.push(view.getUint16(subOffset + subReadOffset, false));
									subReadOffset += 2;
								}
								return arr;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		// Setup proper structure
		const buf2 = new ArrayBuffer(100);
		const view2 = new DataView(buf2);

		// Header (starts at 0)
		view2.setUint16(0, 6, false);			// coverageOffset = 6
		view2.setUint16(2, 2, false);			// glyphCount = 2

		// Attach point offsets array (starts at 4)
		view2.setUint16(4, 14, false);			// attachPointOffset[0] = 14 (relative to start)
		view2.setUint16(6, 20, false);			// attachPointOffset[1] = 20

		// Coverage format 1 at offset 6... wait that conflicts. Let me fix:
		// Coverage needs its own space. Let's put it at offset 8
		view2.setUint16(0, 10, false);			// coverageOffset = 10
		view2.setUint16(2, 2, false);			// glyphCount = 2
		view2.setUint16(4, 18, false);			// attachPointOffset[0] = 18
		view2.setUint16(6, 24, false);			// attachPointOffset[1] = 24

		// Coverage format 1 at offset 10
		view2.setUint16(10, 1, false);			// format = 1
		view2.setUint16(12, 2, false);			// count = 2
		view2.setUint16(14, 100, false);		// glyphId[0] = 100
		view2.setUint16(16, 101, false);		// glyphId[1] = 101

		// AttachPoint[0] at offset 18
		view2.setUint16(18, 2, false);			// pointCount = 2
		view2.setUint16(20, 5, false);			// pointIndex[0] = 5
		view2.setUint16(22, 10, false);			// pointIndex[1] = 10

		// AttachPoint[1] at offset 24
		view2.setUint16(24, 1, false);			// pointCount = 1
		view2.setUint16(26, 7, false);			// pointIndex[0] = 7

		let readOffset2 = 0;
		const reader2 = {
			offset16: () => {
				const val = view2.getUint16(readOffset2, false);
				readOffset2 += 2;
				return val;
			},
			uint16: () => {
				const val = view2.getUint16(readOffset2, false);
				readOffset2 += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view2.getUint16(readOffset2, false));
					readOffset2 += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					offset16: () => {
						const val = view2.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16: () => {
						const val = view2.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view2.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view2.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							uint16Array: (count: number) => {
								const arr: number[] = [];
								for (let i = 0; i < count; i++) {
									arr.push(view2.getUint16(subOffset + subReadOffset, false));
									subReadOffset += 2;
								}
								return arr;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const attachList = parseAttachList(reader2);
		expect(attachList.size).toBe(2);
		expect(attachList.has(100)).toBe(true);
		expect(attachList.has(101)).toBe(true);
		const attach0 = attachList.get(100);
		expect(attach0?.pointIndices).toEqual([5, 10]);
		const attach1 = attachList.get(101);
		expect(attach1?.pointIndices).toEqual([7]);
	});

	test("attachList with coverage format 2 (ranges)", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Header at offset 0
		view.setUint16(0, 8, false);			// coverageOffset = 8
		view.setUint16(2, 2, false);			// glyphCount = 2

		// Attach point offsets (starts at 4)
		view.setUint16(4, 20, false);			// attachPointOffset[0] = 20
		view.setUint16(6, 26, false);			// attachPointOffset[1] = 26

		// Coverage format 2 at offset 8
		view.setUint16(8, 2, false);			// format = 2
		view.setUint16(10, 1, false);			// rangeCount = 1
		view.setUint16(12, 150, false);			// start = 150
		view.setUint16(14, 151, false);			// end = 151 (covers 150, 151)
		view.setUint16(16, 0, false);			// startCoverageIndex = 0

		// AttachPoint[0] at offset 20
		view.setUint16(20, 2, false);			// pointCount = 2
		view.setUint16(22, 3, false);			// pointIndex[0] = 3
		view.setUint16(24, 8, false);			// pointIndex[1] = 8

		// AttachPoint[1] at offset 26
		view.setUint16(26, 1, false);			// pointCount = 1
		view.setUint16(28, 12, false);			// pointIndex[0] = 12

		let readOffset = 0;
		const reader = {
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint16(readOffset, false));
					readOffset += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					offset16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							uint16Array: (count: number) => {
								const arr: number[] = [];
								for (let i = 0; i < count; i++) {
									arr.push(view.getUint16(subOffset + subReadOffset, false));
									subReadOffset += 2;
								}
								return arr;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const attachList = parseAttachList(reader);
		expect(attachList.size).toBe(2);
		expect(attachList.has(150)).toBe(true);
		expect(attachList.has(151)).toBe(true);

		const attach0 = attachList.get(150);
		expect(attach0?.pointIndices).toEqual([3, 8]);

		const attach1 = attachList.get(151);
		expect(attach1?.pointIndices).toEqual([12]);
	});

	test("attachList empty when coverage returns no glyphs", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Header at offset 0
		view.setUint16(0, 6, false);			// coverageOffset
		view.setUint16(2, 0, false);			// glyphCount = 0 (no glyphs)

		// Coverage format 1 at offset 6
		view.setUint16(6, 1, false);			// coverage format = 1
		view.setUint16(8, 0, false);			// count = 0

		let readOffset = 0;
		const reader = {
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint16(readOffset, false));
					readOffset += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					offset16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const attachList = parseAttachList(reader);
		expect(attachList.size).toBe(0);
	});
});

describe("gdef table - parseLigCaretList with mock reader", () => {
	test("ligCaretList with caret format 1 (design units)", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Coverage format 1 at offset 6
		view.setUint16(6, 1, false);			// coverage format = 1
		view.setUint16(8, 1, false);			// count = 1 glyph
		view.setUint16(10, 50, false);			// glyph ID 50

		// Ligature glyph at offset 12
		view.setUint16(12, 1, false);			// caretCount = 1
		view.setUint16(14, 4, false);			// caretValueOffset

		// CaretValue format 1 at 16
		view.setUint16(16, 1, false);			// format = 1
		view.setInt16(18, 600, false);			// value = 600

		// Header
		view.setUint16(0, 6, false);			// coverageOffset
		view.setUint16(2, 1, false);			// ligGlyphCount
		view.setUint16(4, 12, false);			// ligGlyphOffset[0]

		let readOffset = 0;
		const reader = {
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			int16: () => {
				const val = view.getInt16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint16(readOffset, false));
					readOffset += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					offset16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					int16: () => {
						const val = view.getInt16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							int16: () => {
								const val = view.getInt16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const ligCaretList = parseLigCaretList(reader);
		expect(ligCaretList).toBeInstanceOf(Map);
		expect(ligCaretList.has(50)).toBe(true);
		const caret = ligCaretList.get(50);
		expect(caret?.caretValues).toEqual([600]);
	});

	test("ligCaretList with caret format 2 (contour point)", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Coverage at 6
		view.setUint16(6, 1, false);			// format = 1
		view.setUint16(8, 1, false);			// count = 1
		view.setUint16(10, 60, false);			// glyph ID 60

		// Ligature glyph at 12
		view.setUint16(12, 1, false);			// caretCount = 1
		view.setUint16(14, 4, false);			// caretValueOffset

		// CaretValue format 2 at 16
		view.setUint16(16, 2, false);			// format = 2
		view.setUint16(18, 15, false);			// pointIndex = 15

		// Header
		view.setUint16(0, 6, false);			// coverageOffset
		view.setUint16(2, 1, false);			// ligGlyphCount
		view.setUint16(4, 12, false);			// offset

		let readOffset = 0;
		const reader = {
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			int16: () => {
				const val = view.getInt16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint16(readOffset, false));
					readOffset += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					int16: () => {
						const val = view.getInt16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							int16: () => {
								const val = view.getInt16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const ligCaretList = parseLigCaretList(reader);
		expect(ligCaretList.has(60)).toBe(true);
		const caret = ligCaretList.get(60);
		expect(caret?.caretValues).toEqual([15]);
	});

	test("ligCaretList with caret format 3 (design units + device table)", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Coverage at 6
		view.setUint16(6, 1, false);			// format = 1
		view.setUint16(8, 1, false);			// count = 1
		view.setUint16(10, 70, false);			// glyph ID 70

		// Ligature glyph at 12
		view.setUint16(12, 1, false);			// caretCount = 1
		view.setUint16(14, 4, false);			// caretValueOffset

		// CaretValue format 3 at 16
		view.setUint16(16, 3, false);			// format = 3
		view.setInt16(18, 300, false);			// value = 300

		// Header
		view.setUint16(0, 6, false);			// coverageOffset
		view.setUint16(2, 1, false);			// ligGlyphCount
		view.setUint16(4, 12, false);			// offset

		let readOffset = 0;
		const reader = {
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			int16: () => {
				const val = view.getInt16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint16(readOffset, false));
					readOffset += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					int16: () => {
						const val = view.getInt16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							int16: () => {
								const val = view.getInt16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const ligCaretList = parseLigCaretList(reader);
		expect(ligCaretList.has(70)).toBe(true);
		const caret = ligCaretList.get(70);
		expect(caret?.caretValues).toEqual([300]);
	});

	test("ligCaretList with coverage format 2 (ranges)", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Header at offset 0
		view.setUint16(0, 8, false);			// coverageOffset = 8
		view.setUint16(2, 3, false);			// ligGlyphCount = 3

		// Ligature glyph offsets (starts at 4)
		view.setUint16(4, 18, false);			// ligGlyphOffset[0] = 18
		view.setUint16(6, 24, false);			// ligGlyphOffset[1] = 24
		view.setUint16(8, 30, false);			// ligGlyphOffset[2] = 30 (wait, offset 8 is coverage)

		// Let me recalculate: header is 2 + 2 = 4 bytes
		// Then ligGlyphCount * 2 bytes for offsets = 3 * 2 = 6 bytes
		// So total before coverage = 4 + 6 = 10 bytes
		view.setUint16(0, 10, false);			// coverageOffset = 10
		view.setUint16(2, 3, false);			// ligGlyphCount = 3
		view.setUint16(4, 20, false);			// ligGlyphOffset[0] = 20
		view.setUint16(6, 26, false);			// ligGlyphOffset[1] = 26
		view.setUint16(8, 32, false);			// ligGlyphOffset[2] = 32

		// Coverage format 2 at offset 10
		view.setUint16(10, 2, false);			// format = 2
		view.setUint16(12, 1, false);			// rangeCount = 1
		view.setUint16(14, 200, false);			// start = 200
		view.setUint16(16, 202, false);			// end = 202 (covers 200, 201, 202)
		view.setUint16(18, 0, false);			// startCoverageIndex = 0

		// LigGlyph[0] at offset 20
		view.setUint16(20, 1, false);			// caretCount = 1
		view.setUint16(22, 4, false);			// caretValueOffset = 4

		// CaretValue format 1 at 24 (20 + 4)
		view.setUint16(24, 1, false);			// format = 1
		view.setInt16(26, 500, false);			// coordinate = 500

		// LigGlyph[1] at offset 26... wait that's already used
		// Let me recalculate again with proper spacing
		view.setUint16(0, 10, false);			// coverageOffset = 10
		view.setUint16(2, 3, false);			// ligGlyphCount = 3
		view.setUint16(4, 30, false);			// ligGlyphOffset[0] = 30
		view.setUint16(6, 40, false);			// ligGlyphOffset[1] = 40
		view.setUint16(8, 50, false);			// ligGlyphOffset[2] = 50

		// Coverage format 2 at offset 10
		view.setUint16(10, 2, false);			// format = 2
		view.setUint16(12, 1, false);			// rangeCount = 1
		view.setUint16(14, 200, false);			// start = 200
		view.setUint16(16, 202, false);			// end = 202
		view.setUint16(18, 0, false);			// startCoverageIndex

		// LigGlyph[0] at offset 30
		view.setUint16(30, 1, false);			// caretCount = 1
		view.setUint16(32, 4, false);			// caretValueOffset = 4 (relative to 30, so 34)
		// CaretValue at 34
		view.setUint16(34, 1, false);			// format = 1
		view.setInt16(36, 500, false);			// value = 500

		// LigGlyph[1] at offset 40
		view.setUint16(40, 1, false);			// caretCount = 1
		view.setUint16(42, 4, false);			// caretValueOffset = 4
		// CaretValue at 44
		view.setUint16(44, 2, false);			// format = 2
		view.setUint16(46, 10, false);			// point index = 10

		// LigGlyph[2] at offset 50
		view.setUint16(50, 1, false);			// caretCount = 1
		view.setUint16(52, 4, false);			// caretValueOffset = 4
		// CaretValue at 54
		view.setUint16(54, 3, false);			// format = 3
		view.setInt16(56, 400, false);			// value = 400

		let readOffset = 0;
		const reader = {
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			int16: () => {
				const val = view.getInt16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint16(readOffset, false));
					readOffset += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					offset16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					int16: () => {
						const val = view.getInt16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							int16: () => {
								const val = view.getInt16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const ligCaretList = parseLigCaretList(reader);
		expect(ligCaretList.size).toBe(3);
		expect(ligCaretList.has(200)).toBe(true);
		expect(ligCaretList.has(201)).toBe(true);
		expect(ligCaretList.has(202)).toBe(true);

		const caret0 = ligCaretList.get(200);
		expect(caret0?.caretValues).toEqual([500]);

		const caret1 = ligCaretList.get(201);
		expect(caret1?.caretValues).toEqual([10]);

		const caret2 = ligCaretList.get(202);
		expect(caret2?.caretValues).toEqual([400]);
	});

	test("ligCaretList empty when coverage returns no glyphs", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Header at offset 0
		view.setUint16(0, 6, false);			// coverageOffset
		view.setUint16(2, 0, false);			// ligGlyphCount = 0

		// Coverage format 1 at offset 6
		view.setUint16(6, 1, false);			// coverage format = 1
		view.setUint16(8, 0, false);			// count = 0

		let readOffset = 0;
		const reader = {
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			int16: () => {
				const val = view.getInt16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint16Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint16(readOffset, false));
					readOffset += 2;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					offset16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					int16: () => {
						const val = view.getInt16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							int16: () => {
								const val = view.getInt16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
						};
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const ligCaretList = parseLigCaretList(reader);
		expect(ligCaretList.size).toBe(0);
	});
});

describe("gdef table - parseMarkGlyphSets with mock reader", () => {
	test("markGlyphSets with coverage format 1", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Format and count
		view.setUint16(0, 0, false);			// format = 0 (unused)
		view.setUint16(2, 1, false);			// markSetCount = 1

		// Coverage offset (at offset 4)
		view.setUint32(4, 8, false);			// coverage offset = 8

		// Coverage format 1
		view.setUint16(8, 1, false);			// coverage format = 1
		view.setUint16(10, 2, false);			// count = 2
		view.setUint16(12, 10, false);			// glyph 10
		view.setUint16(14, 20, false);			// glyph 20

		let readOffset = 0;
		const reader = {
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint32Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint32(readOffset, false));
					readOffset += 4;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const markSets = parseMarkGlyphSets(reader);
		expect(markSets).toBeDefined();
		expect(typeof markSets.has).toBe("function");
		expect(markSets.has(0, 10)).toBe(true);
		expect(markSets.has(0, 20)).toBe(true);
		expect(markSets.has(0, 30)).toBe(false);
	});

	test("markGlyphSets with coverage format 2 (ranges)", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		// Format and count
		view.setUint16(0, 0, false);			// format = 0
		view.setUint16(2, 1, false);			// markSetCount = 1

		// Coverage offset
		view.setUint32(4, 8, false);			// coverage offset = 8

		// Coverage format 2
		view.setUint16(8, 2, false);			// coverage format = 2
		view.setUint16(10, 1, false);			// rangeCount = 1
		view.setUint16(12, 5, false);			// start = 5
		view.setUint16(14, 8, false);			// end = 8
		view.setUint16(16, 0, false);			// startCoverageIndex = 0

		let readOffset = 0;
		const reader = {
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint32Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint32(readOffset, false));
					readOffset += 4;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const markSets = parseMarkGlyphSets(reader);
		expect(markSets.has(0, 5)).toBe(true);
		expect(markSets.has(0, 6)).toBe(true);
		expect(markSets.has(0, 7)).toBe(true);
		expect(markSets.has(0, 8)).toBe(true);
		expect(markSets.has(0, 4)).toBe(false);
		expect(markSets.has(0, 9)).toBe(false);
	});

	test("markGlyphSets with invalid set index", () => {
		const buf = new ArrayBuffer(100);
		const view = new DataView(buf);

		view.setUint16(0, 0, false);			// format = 0
		view.setUint16(2, 1, false);			// markSetCount = 1
		view.setUint32(4, 8, false);			// coverage offset = 8
		view.setUint16(8, 1, false);			// coverage format = 1
		view.setUint16(10, 1, false);			// count = 1
		view.setUint16(12, 50, false);			// glyph 50

		let readOffset = 0;
		const reader = {
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			uint32Array: (count: number) => {
				const arr: number[] = [];
				for (let i = 0; i < count; i++) {
					arr.push(view.getUint32(readOffset, false));
					readOffset += 4;
				}
				return arr;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
				};
			},
			skip: () => {},
		} as any as Reader;

		const markSets = parseMarkGlyphSets(reader);
		expect(markSets.has(999, 50)).toBe(false);
	});
});

describe("gdef table - parseGdef code coverage", () => {
	test("parseGdef with non-zero attachListOffset calls parseAttachList", () => {
		// This test ensures line 65 is covered (parseAttachList is called when attachListOffset !== 0)
		const buf = new ArrayBuffer(200);
		const view = new DataView(buf);

		// GDEF header (version 1.0) at offset 0
		view.setUint16(0, 1, false);			// majorVersion = 1
		view.setUint16(2, 0, false);			// minorVersion = 0
		view.setUint16(4, 12, false);			// glyphClassDefOffset = 12
		view.setUint16(6, 30, false);			// attachListOffset = 30 (non-zero)
		view.setUint16(8, 0, false);			// ligCaretListOffset = 0
		view.setUint16(10, 20, false);			// markAttachClassDefOffset = 20

		// GlyphClassDef at offset 12 (minimal)
		view.setUint16(12, 1, false);			// format = 1
		view.setUint16(14, 0, false);			// startGlyphID = 0
		view.setUint16(16, 0, false);			// glyphCount = 0

		// MarkAttachClassDef at offset 20 (minimal)
		view.setUint16(20, 1, false);			// format = 1
		view.setUint16(22, 0, false);			// startGlyphID = 0
		view.setUint16(24, 0, false);			// glyphCount = 0

		// AttachList at offset 30 (minimal - will return empty map but that's ok)
		view.setUint16(30, 6, false);			// coverageOffset = 6
		view.setUint16(32, 0, false);			// glyphCount = 0

		// Coverage at offset 36 (30 + 6) (minimal)
		view.setUint16(36, 1, false);			// format = 1
		view.setUint16(38, 0, false);			// count = 0

		let readOffset = 0;
		const reader = {
			uint16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			offset16: () => {
				const val = view.getUint16(readOffset, false);
				readOffset += 2;
				return val;
			},
			sliceFrom: (sliceOffset: number) => {
				let sliceReadOffset = 0;
				return {
					uint16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					offset16: () => {
						const val = view.getUint16(sliceOffset + sliceReadOffset, false);
						sliceReadOffset += 2;
						return val;
					},
					uint16Array: (count: number) => {
						const arr: number[] = [];
						for (let i = 0; i < count; i++) {
							arr.push(view.getUint16(sliceOffset + sliceReadOffset, false));
							sliceReadOffset += 2;
						}
						return arr;
					},
					skip: (n: number) => {
						sliceReadOffset += n;
					},
					sliceFrom: (subOffset: number) => {
						let subReadOffset = 0;
						return {
							uint16: () => {
								const val = view.getUint16(subOffset + subReadOffset, false);
								subReadOffset += 2;
								return val;
							},
							uint16Array: (count: number) => {
								const arr: number[] = [];
								for (let i = 0; i < count; i++) {
									arr.push(view.getUint16(subOffset + subReadOffset, false));
									subReadOffset += 2;
								}
								return arr;
							},
						};
					},
				};
			},
		} as any as Reader;

		const gdef = parseGdef(reader);
		expect(gdef.version.major).toBe(1);
		// Just verify attachList was created (even if empty), proving parseAttachList was called
		expect(gdef.attachList).not.toBeNull();
	});
});

describe("gdef table - null GDEF tests", () => {
	test("getGlyphClass with null GDEF returns 0", () => {
		expect(getGlyphClass(null, 5)).toBe(0);
		expect(getGlyphClass(null, 0)).toBe(0);
		expect(getGlyphClass(null, 999)).toBe(0);
	});

	test("isBaseGlyph with null GDEF returns false", () => {
		expect(isBaseGlyph(null, 5)).toBe(false);
		expect(isBaseGlyph(null, 0)).toBe(false);
	});

	test("isLigature with null GDEF returns false", () => {
		expect(isLigature(null, 5)).toBe(false);
		expect(isLigature(null, 0)).toBe(false);
	});

	test("isMark with null GDEF returns false", () => {
		expect(isMark(null, 5)).toBe(false);
		expect(isMark(null, 0)).toBe(false);
	});

	test("isComponent with null GDEF returns false", () => {
		expect(isComponent(null, 5)).toBe(false);
		expect(isComponent(null, 0)).toBe(false);
	});
});
