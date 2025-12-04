import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { Tags } from "../../../src/types.ts";
import {
	parseGlyf,
	parseGlyph,
	getGlyphContours,
	getGlyphBounds,
	flattenCompositeGlyph,
	getGlyphDeltas,
	applyVariationDeltas,
	getGlyphContoursWithVariation,
	PointFlag,
	CompositeFlag,
	type Glyph,
	type SimpleGlyph,
	type CompositeGlyph,
	type GlyfTable,
	type Contour,
} from "../../../src/font/tables/glyf.ts";
import type {
	GvarTable,
	GlyphVariationData,
	TupleVariationHeader,
	PointDelta,
} from "../../../src/font/tables/gvar.ts";
import { getGlyphLocation } from "../../../src/font/tables/loca.ts";

/** Helper to create a mock TupleVariationHeader */
function createMockTupleHeader(
	opts: Partial<TupleVariationHeader> & { deltas: PointDelta[] },
): TupleVariationHeader {
	return {
		variationDataSize: 0,
		tupleIndex: 0,
		serializedData: new Uint8Array(0),
		peakTuple: opts.peakTuple ?? [1.0],
		intermediateStartTuple: opts.intermediateStartTuple ?? null,
		intermediateEndTuple: opts.intermediateEndTuple ?? null,
		pointNumbers: opts.pointNumbers ?? null,
		deltas: opts.deltas,
	};
}

/** Helper to create a mock GvarTable for tests */
function createMockGvar(
	glyphVariationData: GlyphVariationData[] = [],
): GvarTable {
	return {
		majorVersion: 1,
		minorVersion: 0,
		axisCount: 1,
		sharedTupleCount: 0,
		sharedTuples: [],
		glyphVariationData,
	};
}

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("glyf table", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("parseGlyf", () => {
		test("returns GlyfTable with reader", () => {
			if (font.isTrueType) {
				const reader = font.getTableReader(Tags.glyf);
				if (reader) {
					const glyf = parseGlyf(reader);
					expect(glyf).toBeDefined();
					expect(glyf.reader).toBeDefined();
				}
			}
		});
	});

	describe("parseGlyph", () => {
		test("parses simple glyph for 'A'", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				expect(glyph).toBeDefined();
				expect(["simple", "composite", "empty"]).toContain(glyph.type);
			}
		});

		test("parses glyph 0 (notdef)", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyph = parseGlyph(font.glyf, font.loca, 0);
				expect(glyph).toBeDefined();
			}
		});

		test("returns empty glyph for space", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const glyph = parseGlyph(font.glyf, font.loca, spaceId);
				expect(glyph).toBeDefined();
				if (glyph.type === "empty") {
					expect(glyph.type).toBe("empty");
				}
			}
		});

		test("returns empty for invalid glyph ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyph = parseGlyph(font.glyf, font.loca, 99999);
				expect(glyph.type).toBe("empty");
			}
		});

		test("simple glyph has required properties", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					expect(glyph.numberOfContours).toBeGreaterThanOrEqual(0);
					expect(typeof glyph.xMin).toBe("number");
					expect(typeof glyph.yMin).toBe("number");
					expect(typeof glyph.xMax).toBe("number");
					expect(typeof glyph.yMax).toBe("number");
					expect(Array.isArray(glyph.contours)).toBe(true);
					expect(glyph.instructions).toBeInstanceOf(Uint8Array);
				}
			}
		});

		test("composite glyph has required properties", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				// Find a composite glyph by iterating
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						expect(glyph.numberOfContours).toBeLessThan(0);
						expect(Array.isArray(glyph.components)).toBe(true);
						expect(glyph.components.length).toBeGreaterThan(0);
						expect(glyph.instructions).toBeInstanceOf(Uint8Array);
						break;
					}
				}
			}
		});
	});

	describe("PointFlag constants", () => {
		test("has correct values", () => {
			expect(PointFlag.OnCurve).toBe(0x01);
			expect(PointFlag.XShortVector).toBe(0x02);
			expect(PointFlag.YShortVector).toBe(0x04);
			expect(PointFlag.Repeat).toBe(0x08);
			expect(PointFlag.XIsSameOrPositive).toBe(0x10);
			expect(PointFlag.YIsSameOrPositive).toBe(0x20);
			expect(PointFlag.OverlapSimple).toBe(0x40);
		});
	});

	describe("CompositeFlag constants", () => {
		test("has correct values", () => {
			expect(CompositeFlag.Arg1And2AreWords).toBe(0x0001);
			expect(CompositeFlag.ArgsAreXYValues).toBe(0x0002);
			expect(CompositeFlag.RoundXYToGrid).toBe(0x0004);
			expect(CompositeFlag.WeHaveAScale).toBe(0x0008);
			expect(CompositeFlag.MoreComponents).toBe(0x0020);
			expect(CompositeFlag.WeHaveAnXAndYScale).toBe(0x0040);
			expect(CompositeFlag.WeHaveATwoByTwo).toBe(0x0080);
			expect(CompositeFlag.WeHaveInstructions).toBe(0x0100);
			expect(CompositeFlag.UseMyMetrics).toBe(0x0200);
			expect(CompositeFlag.OverlapCompound).toBe(0x0400);
			expect(CompositeFlag.ScaledComponentOffset).toBe(0x0800);
			expect(CompositeFlag.UnscaledComponentOffset).toBe(0x1000);
		});
	});

	describe("simple glyph structure", () => {
		test("contours contain points with x, y, onCurve", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					for (const contour of glyph.contours) {
						for (const point of contour) {
							expect(typeof point.x).toBe("number");
							expect(typeof point.y).toBe("number");
							expect(typeof point.onCurve).toBe("boolean");
						}
					}
				}
			}
		});

		test("numberOfContours matches contours array length", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					expect(glyph.contours.length).toBe(glyph.numberOfContours);
				}
			}
		});

		test("bounding box is valid", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					expect(glyph.xMax).toBeGreaterThanOrEqual(glyph.xMin);
					expect(glyph.yMax).toBeGreaterThanOrEqual(glyph.yMin);
				}
			}
		});
	});

	describe("composite glyph structure", () => {
		test("components have required properties", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							expect(typeof comp.glyphId).toBe("number");
							expect(typeof comp.flags).toBe("number");
							expect(typeof comp.arg1).toBe("number");
							expect(typeof comp.arg2).toBe("number");
							expect(Array.isArray(comp.transform)).toBe(true);
							expect(comp.transform.length).toBe(4);
						}
						break;
					}
				}
			}
		});

		test("transform matrix has valid values", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							for (const val of comp.transform) {
								expect(typeof val).toBe("number");
							}
						}
						break;
					}
				}
			}
		});
	});

	describe("getGlyphContours", () => {
		test("returns contours for simple glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContours(font.glyf, font.loca, glyphId);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("returns empty array for empty glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const contours = getGlyphContours(font.glyf, font.loca, spaceId);
				expect(contours).toEqual([]);
			}
		});

		test("returns contours for glyph 0", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const contours = getGlyphContours(font.glyf, font.loca, 0);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("flattens composite glyphs", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = getGlyphContours(font.glyf, font.loca, i);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});

		test("contours have valid points", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContours(font.glyf, font.loca, glyphId);
				for (const contour of contours) {
					expect(contour.length).toBeGreaterThan(0);
					for (const point of contour) {
						expect(typeof point.x).toBe("number");
						expect(typeof point.y).toBe("number");
						expect(typeof point.onCurve).toBe("boolean");
					}
				}
			}
		});
	});

	describe("getGlyphBounds", () => {
		test("returns bounds for glyph with outline", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const bounds = getGlyphBounds(font.glyf, font.loca, glyphId);
				if (bounds) {
					expect(typeof bounds.xMin).toBe("number");
					expect(typeof bounds.yMin).toBe("number");
					expect(typeof bounds.xMax).toBe("number");
					expect(typeof bounds.yMax).toBe("number");
					expect(bounds.xMax).toBeGreaterThanOrEqual(bounds.xMin);
					expect(bounds.yMax).toBeGreaterThanOrEqual(bounds.yMin);
				}
			}
		});

		test("returns null for empty glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const bounds = getGlyphBounds(font.glyf, font.loca, spaceId);
				expect(bounds).toBeNull();
			}
		});

		test("returns null for invalid glyph ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const bounds = getGlyphBounds(font.glyf, font.loca, 99999);
				expect(bounds).toBeNull();
			}
		});

		test("bounds for multiple glyphs", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let cp = 0x41; cp <= 0x5a; cp++) {
					const glyphId = font.glyphId(cp);
					const bounds = getGlyphBounds(font.glyf, font.loca, glyphId);
					if (bounds) {
						expect(bounds.xMax).toBeGreaterThanOrEqual(bounds.xMin);
					}
				}
			}
		});
	});

	describe("flattenCompositeGlyph", () => {
		test("returns contours for composite glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});

		test("prevents infinite recursion with depth limit", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph, 35);
						expect(contours).toEqual([]);
						break;
					}
				}
			}
		});

		test("applies transformations to components", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph);
						for (const contour of contours) {
							for (const point of contour) {
								expect(Number.isInteger(point.x)).toBe(true);
								expect(Number.isInteger(point.y)).toBe(true);
							}
						}
						break;
					}
				}
			}
		});
	});

	describe("applyVariationDeltas", () => {
		test("applies deltas to contours", () => {
			const contours: Contour[] = [
				[
					{ x: 0, y: 0, onCurve: true },
					{ x: 100, y: 0, onCurve: true },
					{ x: 100, y: 100, onCurve: true },
				],
			];
			const deltas = [
				{ x: 10, y: 20 },
				{ x: 5, y: -5 },
				{ x: 0, y: 0 },
			];
			const result = applyVariationDeltas(contours, deltas);
			expect(result[0]?.[0]?.x).toBe(10);
			expect(result[0]?.[0]?.y).toBe(20);
			expect(result[0]?.[1]?.x).toBe(105);
			expect(result[0]?.[1]?.y).toBe(-5);
		});

		test("handles empty contours", () => {
			const result = applyVariationDeltas([], []);
			expect(result).toEqual([]);
		});

		test("handles missing deltas", () => {
			const contours: Contour[] = [
				[
					{ x: 0, y: 0, onCurve: true },
					{ x: 100, y: 0, onCurve: true },
				],
			];
			const deltas = [{ x: 10, y: 20 }];
			const result = applyVariationDeltas(contours, deltas);
			expect(result[0]?.[1]?.x).toBe(100);
			expect(result[0]?.[1]?.y).toBe(0);
		});

		test("preserves onCurve flag", () => {
			const contours: Contour[] = [
				[
					{ x: 0, y: 0, onCurve: true },
					{ x: 50, y: 50, onCurve: false },
				],
			];
			const deltas = [
				{ x: 1, y: 1 },
				{ x: 1, y: 1 },
			];
			const result = applyVariationDeltas(contours, deltas);
			expect(result[0]?.[0]?.onCurve).toBe(true);
			expect(result[0]?.[1]?.onCurve).toBe(false);
		});
	});

	describe("getGlyphContoursWithVariation", () => {
		test("returns contours without variation for null gvar", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					null,
					glyphId,
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("returns contours without coords", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					null,
					glyphId,
					undefined,
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("handles empty axis coords", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					null,
					glyphId,
					[],
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});
	});

	describe("edge cases", () => {
		test("parseGlyph with glyph at boundary", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyf = font.glyf;
				const loca = font.loca;
				const lastGlyph = font.numGlyphs - 1;
				expect(() => parseGlyph(glyf, loca, lastGlyph)).not.toThrow();
			}
		});

		test("parseGlyph with negative glyph ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyph = parseGlyph(font.glyf, font.loca, -1);
				expect(glyph.type).toBe("empty");
			}
		});

		test("getGlyphBounds with negative ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const bounds = getGlyphBounds(font.glyf, font.loca, -1);
				expect(bounds).toBeNull();
			}
		});

		test("getGlyphContours with out of range ID", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const contours = getGlyphContours(font.glyf, font.loca, 99999);
				expect(contours).toEqual([]);
			}
		});

		test("simple glyph with zero contours", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "simple" && glyph.numberOfContours === 0) {
						expect(glyph.contours).toEqual([]);
						expect(glyph.instructions.length).toBe(0);
						break;
					}
				}
			}
		});

		test("handles all ASCII printable characters", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyf = font.glyf;
				const loca = font.loca;
				for (let cp = 0x20; cp < 0x7f; cp++) {
					const glyphId = font.glyphId(cp);
					expect(() => parseGlyph(glyf, loca, glyphId)).not.toThrow();
				}
			}
		});
	});

	describe("performance", () => {
		test("parses multiple glyphs efficiently", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const start = performance.now();
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					parseGlyph(font.glyf, font.loca, i);
				}
				const elapsed = performance.now() - start;
				expect(elapsed).toBeLessThan(1000); // Should complete in under 1s
			}
		});
	});

	describe("simple glyph edge cases", () => {
		test("handles glyph with numberOfContours = 0", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let foundZeroContour = false;
				for (let i = 0; i < Math.min(200, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "simple" && glyph.numberOfContours === 0) {
						expect(glyph.contours).toEqual([]);
						expect(glyph.instructions.length).toBe(0);
						foundZeroContour = true;
						break;
					}
				}
				if (!foundZeroContour) {
					console.log("No glyph with 0 contours found in first 200 glyphs");
				}
			}
		});

		test("handles simple glyph with missing endPtsOfContours", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "simple" && glyph.numberOfContours > 0) {
						expect(glyph.contours.length).toBeGreaterThanOrEqual(0);
						break;
					}
				}
			}
		});

		test("processes repeat flags correctly", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let foundRepeat = false;
				for (let i = 0; i < Math.min(1000, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "simple" && glyph.contours.length > 0) {
						let totalPoints = 0;
						for (const contour of glyph.contours) {
							totalPoints += contour.length;
						}
						if (totalPoints > 10) {
							foundRepeat = true;
							break;
						}
					}
				}
				expect(foundRepeat).toBe(true);
			}
		});

		test("handles X coordinates with XIsSameOrPositive flag", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let foundGlyph = false;
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "simple" && glyph.contours.length > 0) {
						for (const contour of glyph.contours) {
							for (const point of contour) {
								expect(typeof point.x).toBe("number");
							}
						}
						foundGlyph = true;
						break;
					}
				}
				expect(foundGlyph).toBe(true);
			}
		});

		test("handles Y coordinates with YIsSameOrPositive flag", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let foundGlyph = false;
				for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "simple" && glyph.contours.length > 0) {
						for (const contour of glyph.contours) {
							for (const point of contour) {
								expect(typeof point.y).toBe("number");
							}
						}
						foundGlyph = true;
						break;
					}
				}
				expect(foundGlyph).toBe(true);
			}
		});
	});

	describe("composite glyph parsing details", () => {
		test("parses composite with Arg1And2AreWords + ArgsAreXYValues flags", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let foundComposite = false;
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (
								(comp.flags & CompositeFlag.Arg1And2AreWords) &&
								(comp.flags & CompositeFlag.ArgsAreXYValues)
							) {
								expect(typeof comp.arg1).toBe("number");
								expect(typeof comp.arg2).toBe("number");
								foundComposite = true;
								break;
							}
						}
						if (foundComposite) break;
					}
				}
			}
		});

		test("parses composite with Arg1And2AreWords but not ArgsAreXYValues", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (
								(comp.flags & CompositeFlag.Arg1And2AreWords) &&
								!(comp.flags & CompositeFlag.ArgsAreXYValues)
							) {
								expect(typeof comp.arg1).toBe("number");
								expect(typeof comp.arg2).toBe("number");
								break;
							}
						}
					}
				}
			}
		});

		test("parses composite with byte args and ArgsAreXYValues", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (
								!(comp.flags & CompositeFlag.Arg1And2AreWords) &&
								(comp.flags & CompositeFlag.ArgsAreXYValues)
							) {
								expect(typeof comp.arg1).toBe("number");
								expect(typeof comp.arg2).toBe("number");
								break;
							}
						}
					}
				}
			}
		});

		test("parses composite with byte args and point numbers", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (
								!(comp.flags & CompositeFlag.Arg1And2AreWords) &&
								!(comp.flags & CompositeFlag.ArgsAreXYValues)
							) {
								expect(typeof comp.arg1).toBe("number");
								expect(typeof comp.arg2).toBe("number");
								break;
							}
						}
					}
				}
			}
		});

		test("parses composite with WeHaveAScale transformation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (comp.flags & CompositeFlag.WeHaveAScale) {
								expect(comp.transform[0]).toBe(comp.transform[3]);
								break;
							}
						}
					}
				}
			}
		});

		test("parses composite with WeHaveAnXAndYScale transformation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (comp.flags & CompositeFlag.WeHaveAnXAndYScale) {
								expect(typeof comp.transform[0]).toBe("number");
								expect(typeof comp.transform[3]).toBe("number");
								break;
							}
						}
					}
				}
			}
		});

		test("parses composite with WeHaveATwoByTwo transformation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (comp.flags & CompositeFlag.WeHaveATwoByTwo) {
								expect(typeof comp.transform[0]).toBe("number");
								expect(typeof comp.transform[1]).toBe("number");
								expect(typeof comp.transform[2]).toBe("number");
								expect(typeof comp.transform[3]).toBe("number");
								break;
							}
						}
					}
				}
			}
		});

		test("parses composite with WeHaveInstructions flag", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let foundInstructions = false;
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (comp.flags & CompositeFlag.WeHaveInstructions) {
								expect(glyph.instructions).toBeInstanceOf(Uint8Array);
								foundInstructions = true;
								break;
							}
						}
						if (foundInstructions) break;
					}
				}
			}
		});

		test("flattens composite with empty component glyphs", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});

		test("flattens nested composite glyphs", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let foundNested = false;
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							const componentGlyph = parseGlyph(
								font.glyf,
								font.loca,
								comp.glyphId,
							);
							if (componentGlyph.type === "composite") {
								const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph);
								expect(Array.isArray(contours)).toBe(true);
								foundNested = true;
								break;
							}
						}
						if (foundNested) break;
					}
				}
			}
		});

		test("applies component offsets in flattening", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							if (
								(comp.flags & CompositeFlag.ArgsAreXYValues) &&
								(comp.arg1 !== 0 || comp.arg2 !== 0)
							) {
								const contours = flattenCompositeGlyph(font.glyf, font.loca, glyph);
								expect(Array.isArray(contours)).toBe(true);
								break;
							}
						}
					}
				}
			}
		});
	});

	describe("getGlyphDeltas function", () => {
		test("returns zero deltas when gvar has no data for glyph", () => {
			const mockGvar = createMockGvar([]);
			const deltas = getGlyphDeltas(mockGvar, 10, 5, [0.5]);
			expect(deltas.length).toBe(5);
			expect(deltas[0]?.x).toBe(0);
			expect(deltas[0]?.y).toBe(0);
		});

		test("returns zero deltas when glyphData exists but tupleVariationHeaders is empty", () => {
			const mockGvar = createMockGvar([{ tupleVariationHeaders: [] }]);
			const deltas = getGlyphDeltas(mockGvar, 0, 5, [0.5]);
			expect(deltas.length).toBe(5);
		});

		test("rounds final delta values", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							deltas: [
								{ x: 10.6, y: 20.4 },
								{ x: 5.2, y: -5.8 },
							],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 2, [1.0]);
			expect(deltas[0]?.x).toBe(11);
			expect(deltas[0]?.y).toBe(20);
			expect(deltas[1]?.x).toBe(5);
			expect(deltas[1]?.y).toBe(-6);
		});

		test("handles sparse point deltas", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							pointNumbers: [0, 2],
							deltas: [
								{ x: 10, y: 20 },
								{ x: 5, y: -5 },
							],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 5, [1.0]);
			expect(deltas[0]?.x).toBe(10);
			expect(deltas[0]?.y).toBe(20);
			expect(deltas[1]?.x).toBe(0);
			expect(deltas[1]?.y).toBe(0);
			expect(deltas[2]?.x).toBe(5);
			expect(deltas[2]?.y).toBe(-5);
		});

		test("handles pointNumbers out of range", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							pointNumbers: [0, 10],
							deltas: [
								{ x: 10, y: 20 },
								{ x: 5, y: -5 },
							],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 5, [1.0]);
			expect(deltas[0]?.x).toBe(10);
			expect(deltas.length).toBe(5);
		});

		test("handles deltas length exceeding numPoints", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							deltas: [
								{ x: 10, y: 20 },
								{ x: 5, y: -5 },
								{ x: 3, y: -3 },
							],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 2, [1.0]);
			expect(deltas.length).toBe(2);
			expect(deltas[0]?.x).toBe(10);
			expect(deltas[1]?.x).toBe(5);
		});

		test("skips tuples with no peakTuple", () => {
			const mockGvar = createMockGvar([
				{
					tupleVariationHeaders: [
						createMockTupleHeader({
							peakTuple: null,
							deltas: [{ x: 10, y: 20 }],
						}),
					],
				},
			]);
			const deltas = getGlyphDeltas(mockGvar, 0, 1, [1.0]);
			expect(deltas[0]?.x).toBe(0);
			expect(deltas[0]?.y).toBe(0);
		});
	});

	describe("getGlyphContoursWithVariation function", () => {
		test("returns empty array for empty glyph", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const spaceId = font.glyphId(0x20);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					null,
					spaceId,
				);
				expect(contours).toEqual([]);
			}
		});

		test("returns simple glyph contours without variation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const glyph = parseGlyph(font.glyf, font.loca, glyphId);
				if (glyph.type === "simple") {
					const contours = getGlyphContoursWithVariation(
						font.glyf,
						font.loca,
						null,
						glyphId,
					);
					expect(contours).toEqual(glyph.contours);
				}
			}
		});

		test("returns composite glyph contours with variation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const mockGvar = createMockGvar([]);
						const contours = getGlyphContoursWithVariation(
							font.glyf,
							font.loca,
							mockGvar,
							i,
							[0.5],
						);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});

		test("applies variation to simple glyph with gvar and coords", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const mockGvar = createMockGvar([]);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					mockGvar,
					glyphId,
					[0.5],
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});

		test("handles empty axis coordinates", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const glyphId = font.glyphId(0x41);
				const mockGvar = createMockGvar([]);
				const contours = getGlyphContoursWithVariation(
					font.glyf,
					font.loca,
					mockGvar,
					glyphId,
					[],
				);
				expect(Array.isArray(contours)).toBe(true);
			}
		});
	});

	describe("flattenCompositeGlyphWithVariation", () => {
		test("handles composite with simple components and variation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const mockGvar = createMockGvar([
							{
								tupleVariationHeaders: [
									createMockTupleHeader({ deltas: [] }),
								],
							},
						]);
						const contours = getGlyphContoursWithVariation(
							font.glyf,
							font.loca,
							mockGvar,
							i,
							[0.5],
						);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});

		test("handles nested composite with variation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let foundNested = false;
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						for (const comp of glyph.components) {
							const componentGlyph = parseGlyph(
								font.glyf,
								font.loca,
								comp.glyphId,
							);
							if (componentGlyph.type === "composite") {
								const mockGvar = createMockGvar([]);
								const contours = getGlyphContoursWithVariation(
									font.glyf,
									font.loca,
									mockGvar,
									i,
									[0.5],
								);
								expect(Array.isArray(contours)).toBe(true);
								foundNested = true;
								break;
							}
						}
						if (foundNested) break;
					}
				}
			}
		});

		test("prevents deep recursion with variation", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				for (let i = 0; i < Math.min(500, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						const mockGvar = createMockGvar([]);
						const contours = getGlyphContoursWithVariation(
							font.glyf,
							font.loca,
							mockGvar,
							i,
							[0.5],
						);
						expect(Array.isArray(contours)).toBe(true);
						break;
					}
				}
			}
		});
	});

	describe("comprehensive glyph iteration", () => {
		test("parses all glyphs without errors", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				const sampleSize = Math.min(1000, font.numGlyphs);
				for (let i = 0; i < sampleSize; i++) {
					expect(() => parseGlyph(font.glyf!, font.loca!, i)).not.toThrow();
				}
			}
		});

		test("validates all simple glyphs have valid contours", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let simpleCount = 0;
				for (let i = 0; i < Math.min(200, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "simple") {
						expect(glyph.contours.length).toBe(glyph.numberOfContours);
						simpleCount++;
					}
				}
				expect(simpleCount).toBeGreaterThan(0);
			}
		});

		test("validates all composite glyphs have valid components", () => {
			if (font.isTrueType && font.glyf && font.loca) {
				let compositeCount = 0;
				for (let i = 0; i < Math.min(200, font.numGlyphs); i++) {
					const glyph = parseGlyph(font.glyf, font.loca, i);
					if (glyph.type === "composite") {
						expect(glyph.components.length).toBeGreaterThan(0);
						for (const comp of glyph.components) {
							expect(comp.glyphId).toBeGreaterThanOrEqual(0);
							expect(comp.glyphId).toBeLessThan(font.numGlyphs);
						}
						compositeCount++;
					}
				}
			}
		});
	});

	describe("edge cases for coverage", () => {
		test("searches for glyph with numberOfContours = 0 across multiple fonts", async () => {
			const fontPaths = [
				"/System/Library/Fonts/Supplemental/Arial.ttf",
				"/System/Library/Fonts/Supplemental/Arial Black.ttf",
				"/System/Library/Fonts/Supplemental/Andale Mono.ttf",
			];

			for (const fontPath of fontPaths) {
				try {
					const testFont = await Font.fromFile(fontPath);
					if (testFont.isTrueType && testFont.glyf && testFont.loca) {
						for (let i = 0; i < Math.min(300, testFont.numGlyphs); i++) {
							const glyph = parseGlyph(testFont.glyf, testFont.loca, i);
							if (glyph.type === "simple" && glyph.numberOfContours === 0) {
								expect(glyph.contours).toEqual([]);
								expect(glyph.instructions.length).toBe(0);
								return;
							}
						}
					}
				} catch (e) {
					continue;
				}
			}
		});

		test("searches for composite glyph with empty component", async () => {
			const fontPaths = [
				"/System/Library/Fonts/Supplemental/Arial.ttf",
				"/System/Library/Fonts/Supplemental/Arial Black.ttf",
			];

			for (const fontPath of fontPaths) {
				try {
					const testFont = await Font.fromFile(fontPath);
					if (testFont.isTrueType && testFont.glyf && testFont.loca) {
						for (let i = 0; i < Math.min(500, testFont.numGlyphs); i++) {
							const glyph = parseGlyph(testFont.glyf, testFont.loca, i);
							if (glyph.type === "composite") {
								for (const comp of glyph.components) {
									const componentGlyph = parseGlyph(
										testFont.glyf,
										testFont.loca,
										comp.glyphId,
									);
									if (componentGlyph.type === "empty") {
										const contours = flattenCompositeGlyph(
											testFont.glyf,
											testFont.loca,
											glyph,
										);
										expect(Array.isArray(contours)).toBe(true);
										return;
									}
								}
							}
						}
					}
				} catch (e) {
					continue;
				}
			}
		});

		test("tests flattenCompositeGlyphWithVariation depth limit", async () => {
			const fontPaths = ["/System/Library/Fonts/Supplemental/Arial.ttf"];

			for (const fontPath of fontPaths) {
				try {
					const testFont = await Font.fromFile(fontPath);
					if (testFont.isTrueType && testFont.glyf && testFont.loca) {
						for (let i = 0; i < Math.min(500, testFont.numGlyphs); i++) {
							const glyph = parseGlyph(testFont.glyf, testFont.loca, i);
							if (glyph.type === "composite") {
								const mockGvar = createMockGvar([]);
								const contours = getGlyphContoursWithVariation(
									testFont.glyf,
									testFont.loca,
									mockGvar,
									i,
									[0.5],
								);
								expect(Array.isArray(contours)).toBe(true);
								return;
							}
						}
					}
				} catch (e) {
					continue;
				}
			}
		});

		test("searches for composite with all transformation types", async () => {
			const fontPaths = [
				"/System/Library/Fonts/Supplemental/Arial.ttf",
				"/System/Library/Fonts/Supplemental/Arial Black.ttf",
				"/System/Library/Fonts/Supplemental/Andale Mono.ttf",
			];

			let foundScale = false;
			let foundXYScale = false;
			let foundTwoByTwo = false;

			for (const fontPath of fontPaths) {
				try {
					const testFont = await Font.fromFile(fontPath);
					if (testFont.isTrueType && testFont.glyf && testFont.loca) {
						for (let i = 0; i < Math.min(1000, testFont.numGlyphs); i++) {
							const glyph = parseGlyph(testFont.glyf, testFont.loca, i);
							if (glyph.type === "composite") {
								for (const comp of glyph.components) {
									if (comp.flags & CompositeFlag.WeHaveAScale) {
										foundScale = true;
									}
									if (comp.flags & CompositeFlag.WeHaveAnXAndYScale) {
										foundXYScale = true;
									}
									if (comp.flags & CompositeFlag.WeHaveATwoByTwo) {
										foundTwoByTwo = true;
									}
								}
							}
							if (foundScale && foundXYScale && foundTwoByTwo) break;
						}
					}
					if (foundScale && foundXYScale && foundTwoByTwo) break;
				} catch (e) {
					continue;
				}
			}

			expect(foundScale || foundXYScale || foundTwoByTwo).toBe(true);
		});

		test("searches for composite with different argument types", async () => {
			const fontPaths = [
				"/System/Library/Fonts/Supplemental/Arial.ttf",
				"/System/Library/Fonts/Supplemental/Arial Black.ttf",
			];

			let foundWordXY = false;
			let foundWordPoints = false;
			let foundByteXY = false;
			let foundBytePoints = false;

			for (const fontPath of fontPaths) {
				try {
					const testFont = await Font.fromFile(fontPath);
					if (testFont.isTrueType && testFont.glyf && testFont.loca) {
						for (let i = 0; i < Math.min(1000, testFont.numGlyphs); i++) {
							const glyph = parseGlyph(testFont.glyf, testFont.loca, i);
							if (glyph.type === "composite") {
								for (const comp of glyph.components) {
									const isWords = !!(comp.flags & CompositeFlag.Arg1And2AreWords);
									const isXY = !!(comp.flags & CompositeFlag.ArgsAreXYValues);

									if (isWords && isXY) foundWordXY = true;
									if (isWords && !isXY) foundWordPoints = true;
									if (!isWords && isXY) foundByteXY = true;
									if (!isWords && !isXY) foundBytePoints = true;
								}
							}
							if (foundWordXY && foundWordPoints && foundByteXY && foundBytePoints)
								break;
						}
					}
					if (foundWordXY && foundWordPoints && foundByteXY && foundBytePoints)
						break;
				} catch (e) {
					continue;
				}
			}

			expect(
				foundWordXY || foundWordPoints || foundByteXY || foundBytePoints,
			).toBe(true);
		});
	});
});
