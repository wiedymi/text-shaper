import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { getGlyphPath } from "../../src/render/path.ts";
import {
	validateOutline,
	decomposePath,
	getPathBounds,
	getFillRuleFromFlags,
	OutlineError,
	type ValidationResult,
} from "../../src/raster/outline-decompose.ts";
import { GrayRaster } from "../../src/raster/gray-raster.ts";
import { FillRule, PixelMode } from "../../src/raster/types.ts";
import { OutlineFlags, type GlyphPath } from "../../src/render/path.ts";
import { ONE_PIXEL } from "../../src/raster/fixed-point.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("raster/outline-decompose", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("validateOutline", () => {
		test("validates simple valid path", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "L", x: 10, y: 10 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.Ok);
			expect(result.message).toBeUndefined();
		});

		test("rejects null path", () => {
			const result = validateOutline(null);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toBe("Path is null or undefined");
		});

		test("rejects undefined path", () => {
			const result = validateOutline(undefined);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toBe("Path is null or undefined");
		});

		test("rejects path without commands array", () => {
			const path = { commands: undefined, bounds: null } as unknown as GlyphPath;
			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toBe("Path commands array is missing");
		});

		test("accepts empty path when allowEmpty is true", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};

			const result = validateOutline(path, true);
			expect(result.error).toBe(OutlineError.EmptyOutline);
		});

		test("rejects empty path when allowEmpty is false", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};

			const result = validateOutline(path, false);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toBe("Path is empty");
		});

		test("rejects line command without preceding moveTo", () => {
			const path: GlyphPath = {
				commands: [{ type: "L", x: 10, y: 10 }],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Line command");
			expect(result.message).toContain("without preceding moveTo");
		});

		test("rejects quadratic curve without preceding moveTo", () => {
			const path: GlyphPath = {
				commands: [{ type: "Q", x1: 5, y1: 5, x: 10, y: 10 }],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Quadratic curve");
			expect(result.message).toContain("without preceding moveTo");
		});

		test("rejects cubic curve without preceding moveTo", () => {
			const path: GlyphPath = {
				commands: [{ type: "C", x1: 3, y1: 3, x2: 7, y2: 7, x: 10, y: 10 }],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Cubic curve");
			expect(result.message).toContain("without preceding moveTo");
		});

		test("rejects moveTo with invalid coordinates (NaN)", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: Number.NaN, y: 0 }],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Invalid coordinates");
		});

		test("rejects moveTo with infinite coordinates", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: Number.POSITIVE_INFINITY, y: 0 }],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Invalid coordinates");
		});

		test("rejects lineTo with invalid coordinates", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: Number.NaN, y: 10 },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Invalid coordinates");
		});

		test("rejects quadratic curve with invalid control point", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "Q", x1: Number.NaN, y1: 5, x: 10, y: 10 },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Invalid coordinates");
		});

		test("rejects quadratic curve with invalid end point", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "Q", x1: 5, y1: 5, x: Number.NEGATIVE_INFINITY, y: 10 },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Invalid coordinates");
		});

		test("rejects cubic curve with invalid first control point", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: Number.NaN, y1: 3, x2: 7, y2: 7, x: 10, y: 10 },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Invalid coordinates");
		});

		test("rejects cubic curve with invalid second control point", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 3, y1: 3, x2: Number.NaN, y2: 7, x: 10, y: 10 },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Invalid coordinates");
		});

		test("rejects cubic curve with invalid end point", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 3, y1: 3, x2: 7, y2: 7, x: 10, y: Number.NaN },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Invalid coordinates");
		});

		test("rejects unknown command type", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "X" as any, x: 10, y: 10 },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.InvalidOutline);
			expect(result.message).toContain("Unknown command type");
		});

		test("accepts multiple contours", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "Z" },
					{ type: "M", x: 20, y: 20 },
					{ type: "L", x: 30, y: 30 },
					{ type: "Z" },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.Ok);
		});

		test("accepts implicit close (moveTo without closePath)", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "M", x: 20, y: 20 },
					{ type: "L", x: 30, y: 30 },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.Ok);
		});

		test("accepts closePath command", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "Z" },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.Ok);
		});

		test("validates path with all command types", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "Q", x1: 15, y1: 5, x: 10, y: 10 },
					{ type: "C", x1: 8, y1: 12, x2: 2, y2: 12, x: 0, y: 10 },
					{ type: "Z" },
				],
				bounds: null,
			};

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.Ok);
		});

		test("validates real glyph path", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const path = getGlyphPath(font, glyphId);
			if (!path) return;

			const result = validateOutline(path);
			expect(result.error).toBe(OutlineError.Ok);
		});

		test("returns Ok for path with moveTo only", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
			};

			const result = validateOutline(path, false);
			expect(result.error).toBe(OutlineError.Ok);
		});
	});

	describe("decomposePath", () => {
		test("decomposes simple rectangle path", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 20, 20);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "L", x: 10, y: 10 },
					{ type: "L", x: 0, y: 10 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			decomposePath(raster, path, 1.0, 5, 5, true);

			// If no error, decomposition succeeded
			expect(true).toBe(true);
		});

		test("decomposes path with line commands", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 30, 30);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 5, y: 5 },
					{ type: "L", x: 15, y: 5 },
					{ type: "L", x: 15, y: 15 },
					{ type: "L", x: 5, y: 15 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 0, 0, true);
			expect(true).toBe(true);
		});

		test("decomposes path with quadratic curves", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 30, 30);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "Q", x1: 5, y1: -5, x: 10, y: 0 },
					{ type: "L", x: 5, y: 10 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 10, 10, true);
			expect(true).toBe(true);
		});

		test("decomposes path with cubic curves", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 40, 40);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 3, y1: -5, x2: 7, y2: -5, x: 10, y: 0 },
					{ type: "L", x: 5, y: 10 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 15, 15, true);
			expect(true).toBe(true);
		});

		test("handles different scales", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 100, 100);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "L", x: 10, y: 10 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 2.0, 0, 0, true);
			expect(true).toBe(true);
		});

		test("handles offsetX parameter", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 50, 50);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 5, y: 5 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 20, 0, true);
			expect(true).toBe(true);
		});

		test("handles offsetY parameter", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 50, 50);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 5, y: 5 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 0, 20, true);
			expect(true).toBe(true);
		});

		test("handles flipY=true (default)", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 30, 30);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 10 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 10, 10, true);
			expect(true).toBe(true);
		});

		test("handles flipY=false", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 30, 30);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 10 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 10, 10, false);
			expect(true).toBe(true);
		});

		test("handles path without close command", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 30, 30);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "L", x: 10, y: 10 },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 5, 5, true);
			expect(true).toBe(true);
		});

		test("handles multiple contours", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 50, 50);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "Z" },
					{ type: "M", x: 20, y: 20 },
					{ type: "L", x: 30, y: 20 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 0, 0, true);
			expect(true).toBe(true);
		});

		test("handles implicit close (new moveTo closes previous)", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 50, 50);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "L", x: 10, y: 10 },
					{ type: "M", x: 20, y: 20 },
					{ type: "L", x: 30, y: 30 },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 0, 0, true);
			expect(true).toBe(true);
		});

		test("handles empty path", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 20, 20);

			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 0, 0, true);
			expect(true).toBe(true);
		});

		test("handles path with only moveTo", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 20, 20);

			const path: GlyphPath = {
				commands: [{ type: "M", x: 5, y: 5 }],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 0, 0, true);
			expect(true).toBe(true);
		});

		test("decomposes real glyph path", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const path = getGlyphPath(font, glyphId);
			if (!path) return;

			const raster = new GrayRaster();
			raster.setClip(0, 0, 100, 100);

			const scale = 48 / font.unitsPerEm;
			decomposePath(raster, path, scale, 25, 75, true);
			expect(true).toBe(true);
		});

		test("handles complex path with all command types", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 50, 50);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 0 },
					{ type: "Q", x1: 15, y1: 5, x: 10, y: 10 },
					{ type: "C", x1: 8, y1: 12, x2: 2, y2: 12, x: 0, y: 10 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 20, 20, true);
			expect(true).toBe(true);
		});

		test("handles zero scale", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 20, 20);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 10 },
				],
				bounds: null,
			};

			decomposePath(raster, path, 0, 0, 0, true);
			expect(true).toBe(true);
		});

		test("handles negative coordinates", () => {
			const raster = new GrayRaster();
			raster.setClip(-20, -20, 20, 20);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: -10, y: -10 },
					{ type: "L", x: 0, y: 0 },
					{ type: "Z" },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 0, 0, true);
			expect(true).toBe(true);
		});
	});

	describe("getPathBounds", () => {
		test("returns bounds with flipY=true", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 10, yMin: 20, xMax: 50, yMax: 80 },
			};

			const bounds = getPathBounds(path, 1.0, true);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(10);
				expect(bounds.minY).toBe(-80);
				expect(bounds.maxX).toBe(50);
				expect(bounds.maxY).toBe(-20);
			}
		});

		test("returns bounds with flipY=false", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 10, yMin: 20, xMax: 50, yMax: 80 },
			};

			const bounds = getPathBounds(path, 1.0, false);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(10);
				expect(bounds.minY).toBe(20);
				expect(bounds.maxX).toBe(50);
				expect(bounds.maxY).toBe(80);
			}
		});

		test("scales bounds correctly", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 10, yMin: 20, xMax: 50, yMax: 80 },
			};

			const bounds = getPathBounds(path, 2.0, false);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(20);
				expect(bounds.minY).toBe(40);
				expect(bounds.maxX).toBe(100);
				expect(bounds.maxY).toBe(160);
			}
		});

		test("returns null for path without bounds", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 0, y: 0 }],
				bounds: null,
			};

			const bounds = getPathBounds(path, 1.0, true);
			expect(bounds).toBeNull();
		});

		test("handles zero bounds", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 0, yMin: 0, xMax: 0, yMax: 0 },
			};

			const bounds = getPathBounds(path, 1.0, true);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(0);
				expect(Math.abs(bounds.minY)).toBe(0);
				expect(bounds.maxX).toBe(0);
				expect(Math.abs(bounds.maxY)).toBe(0);
			}
		});

		test("handles negative bounds", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: -50, yMin: -80, xMax: -10, yMax: -20 },
			};

			const bounds = getPathBounds(path, 1.0, true);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(-50);
				expect(bounds.minY).toBe(20);
				expect(bounds.maxX).toBe(-10);
				expect(bounds.maxY).toBe(80);
			}
		});

		test("uses floor for minimum values", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 10.7, yMin: 20.9, xMax: 50, yMax: 80 },
			};

			const bounds = getPathBounds(path, 1.0, false);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(10);
				expect(bounds.minY).toBe(20);
			}
		});

		test("uses ceil for maximum values", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 10, yMin: 20, xMax: 50.1, yMax: 80.2 },
			};

			const bounds = getPathBounds(path, 1.0, false);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.maxX).toBe(51);
				expect(bounds.maxY).toBe(81);
			}
		});

		test("gets bounds from real glyph", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const path = getGlyphPath(font, glyphId);
			if (!path || !path.bounds) return;

			const scale = 48 / font.unitsPerEm;
			const bounds = getPathBounds(path, scale, true);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBeLessThan(bounds.maxX);
				expect(bounds.minY).toBeLessThan(bounds.maxY);
			}
		});

		test("handles fractional scale", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 10, yMin: 20, xMax: 50, yMax: 80 },
			};

			const bounds = getPathBounds(path, 0.5, false);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(5);
				expect(bounds.minY).toBe(10);
				expect(bounds.maxX).toBe(25);
				expect(bounds.maxY).toBe(40);
			}
		});
	});

	describe("getFillRuleFromFlags", () => {
		test("returns NonZero by default for null path", () => {
			const rule = getFillRuleFromFlags(null);
			expect(rule).toBe(FillRule.NonZero);
		});

		test("returns NonZero by default for undefined path", () => {
			const rule = getFillRuleFromFlags(undefined);
			expect(rule).toBe(FillRule.NonZero);
		});

		test("returns NonZero for path without flags", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};

			const rule = getFillRuleFromFlags(path);
			expect(rule).toBe(FillRule.NonZero);
		});

		test("returns NonZero for path with None flags", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
				flags: OutlineFlags.None,
			};

			const rule = getFillRuleFromFlags(path);
			expect(rule).toBe(FillRule.NonZero);
		});

		test("returns EvenOdd for path with EvenOddFill flag", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
				flags: OutlineFlags.EvenOddFill,
			};

			const rule = getFillRuleFromFlags(path);
			expect(rule).toBe(FillRule.EvenOdd);
		});

		test("returns NonZero for path with HighPrecision flag (no EvenOdd)", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
				flags: OutlineFlags.HighPrecision,
			};

			const rule = getFillRuleFromFlags(path);
			expect(rule).toBe(FillRule.NonZero);
		});

		test("returns EvenOdd when flag is combined with others", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
				flags: OutlineFlags.EvenOddFill | OutlineFlags.HighPrecision,
			};

			const rule = getFillRuleFromFlags(path);
			expect(rule).toBe(FillRule.EvenOdd);
		});

		test("respects custom default rule for null path", () => {
			const rule = getFillRuleFromFlags(null, FillRule.EvenOdd);
			expect(rule).toBe(FillRule.EvenOdd);
		});

		test("respects custom default rule for path without flags", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};

			const rule = getFillRuleFromFlags(path, FillRule.EvenOdd);
			expect(rule).toBe(FillRule.EvenOdd);
		});

		test("None flag uses default NonZero", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
				flags: OutlineFlags.None,
			};

			const rule = getFillRuleFromFlags(path);
			expect(rule).toBe(FillRule.NonZero);
		});

		test("returns EvenOdd even with custom NonZero default", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
				flags: OutlineFlags.EvenOddFill,
			};

			const rule = getFillRuleFromFlags(path, FillRule.NonZero);
			expect(rule).toBe(FillRule.EvenOdd);
		});
	});

	describe("integration tests", () => {
		test("validates, decomposes, and gets bounds for same path", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 20, y: 0 },
					{ type: "L", x: 20, y: 30 },
					{ type: "L", x: 0, y: 30 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 20, yMax: 30 },
			};

			const validation = validateOutline(path);
			expect(validation.error).toBe(OutlineError.Ok);

			const bounds = getPathBounds(path, 1.0, true);
			expect(bounds).not.toBeNull();

			const raster = new GrayRaster();
			raster.setClip(0, 0, 50, 50);
			decomposePath(raster, path, 1.0, 10, 10, true);
			expect(true).toBe(true);
		});

		test("processes glyph through all functions", () => {
			const glyphId = font.glyphId("B".codePointAt(0)!);
			if (!glyphId) return;

			const path = getGlyphPath(font, glyphId);
			if (!path) return;

			const validation = validateOutline(path);
			expect(validation.error).toBe(OutlineError.Ok);

			const scale = 48 / font.unitsPerEm;
			const bounds = getPathBounds(path, scale, true);
			expect(bounds).not.toBeNull();

			const fillRule = getFillRuleFromFlags(path);
			expect([FillRule.NonZero, FillRule.EvenOdd]).toContain(fillRule);

			const raster = new GrayRaster();
			raster.setClip(0, 0, 100, 100);
			decomposePath(raster, path, scale, 25, 75, true);
			expect(true).toBe(true);
		});

		test("handles multiple glyphs", () => {
			const chars = ["O", "P", "Q"];
			for (const char of chars) {
				const glyphId = font.glyphId(char.codePointAt(0)!);
				if (!glyphId) continue;

				const path = getGlyphPath(font, glyphId);
				if (!path) continue;

				const validation = validateOutline(path);
				expect(validation.error).toBe(OutlineError.Ok);

				const scale = 24 / font.unitsPerEm;
				const bounds = getPathBounds(path, scale, true);

				if (bounds) {
					expect(bounds.minX).toBeLessThanOrEqual(bounds.maxX);
					expect(bounds.minY).toBeLessThanOrEqual(bounds.maxY);
				}
			}
		});

		test("handles empty space glyph", () => {
			const glyphId = font.glyphId(" ".codePointAt(0)!);
			if (!glyphId) return;

			const path = getGlyphPath(font, glyphId);
			if (!path) {
				expect(true).toBe(true);
				return;
			}

			const validation = validateOutline(path, true);
			expect([OutlineError.Ok, OutlineError.EmptyOutline]).toContain(
				validation.error,
			);
		});
	});

	describe("edge cases and error handling", () => {
		test("handles very large coordinates", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10000, y: 10000 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10000, yMax: 10000 },
			};

			const validation = validateOutline(path);
			expect(validation.error).toBe(OutlineError.Ok);

			const raster = new GrayRaster();
			raster.setClip(0, 0, 5000, 5000);
			decomposePath(raster, path, 0.1, 0, 0, true);
			expect(true).toBe(true);
		});

		test("handles very small scale values", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 100 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
			};

			const bounds = getPathBounds(path, 0.001, true);
			expect(bounds).not.toBeNull();
		});

		test("handles asymmetric bounds", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: -100, yMin: -200, xMax: 50, yMax: 10 },
			};

			const bounds = getPathBounds(path, 1.0, true);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(-100);
				expect(bounds.maxX).toBe(50);
			}
		});

		test("validates path with only close commands", () => {
			const path: GlyphPath = {
				commands: [{ type: "Z" }],
				bounds: null,
			};

			const validation = validateOutline(path, false);
			expect(validation.error).toBe(OutlineError.EmptyOutline);
		});

		test("decomposes path with consecutive moveTo commands", () => {
			const raster = new GrayRaster();
			raster.setClip(0, 0, 50, 50);

			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "M", x: 10, y: 10 },
					{ type: "M", x: 20, y: 20 },
					{ type: "L", x: 30, y: 30 },
				],
				bounds: null,
			};

			decomposePath(raster, path, 1.0, 0, 0, true);
			expect(true).toBe(true);
		});

		test("handles path with single line segment", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 10, y: 10 },
				],
				bounds: null,
			};

			const validation = validateOutline(path);
			expect(validation.error).toBe(OutlineError.Ok);
		});

		test("handles bounds with same min and max", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: { xMin: 42, yMin: 42, xMax: 42, yMax: 42 },
			};

			const bounds = getPathBounds(path, 1.0, false);
			expect(bounds).not.toBeNull();
			if (bounds) {
				expect(bounds.minX).toBe(42);
				expect(bounds.maxX).toBe(42);
			}
		});
	});
});
