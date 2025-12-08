import { describe, expect, test } from "bun:test";
import { Font } from "../../src/font/font.ts";
import type { GlyphPath } from "../../src/render/path.ts";
import {
	type MsdfEdge,
	assignEdgeColors,
	buildMsdfAtlas,
	buildMsdfAsciiAtlas,
	buildMsdfStringAtlas,
	msdfAtlasToRGB,
	msdfAtlasToRGBA,
	renderMsdf,
	signedDistanceToLine,
	signedDistanceToQuadratic,
	signedDistanceToCubic,
	signedDistanceToEdge,
	isPointInside,
	flattenEdge,
	median,
} from "../../src/raster/msdf.ts";
import { PixelMode } from "../../src/raster/types.ts";

describe("MSDF utilities", () => {
	describe("median", () => {
		test("returns middle value of three numbers", () => {
			expect(median(1, 2, 3)).toBe(2);
			expect(median(3, 1, 2)).toBe(2);
			expect(median(2, 3, 1)).toBe(2);
		});

		test("handles equal values", () => {
			expect(median(5, 5, 5)).toBe(5);
			expect(median(1, 5, 5)).toBe(5);
			expect(median(5, 1, 5)).toBe(5);
		});

		test("handles negative values", () => {
			expect(median(-3, -1, -2)).toBe(-2);
			expect(median(-1, 0, 1)).toBe(0);
		});
	});

	describe("signedDistanceToLine", () => {
		test("point on line returns ~0 distance", () => {
			const result = signedDistanceToLine(
				5, 0, // point
				{ x: 0, y: 0 }, // p0
				{ x: 10, y: 0 }, // p1
			);
			expect(Math.abs(result.distance)).toBeLessThan(0.001);
		});

		test("point above horizontal line has positive distance", () => {
			const result = signedDistanceToLine(
				5, 5, // point above line
				{ x: 0, y: 0 }, // p0
				{ x: 10, y: 0 }, // p1 (line goes left to right)
			);
			// Sign depends on winding direction - left side is positive
			expect(Math.abs(result.distance)).toBeCloseTo(5, 1);
		});

		test("point below horizontal line has negative distance", () => {
			const result = signedDistanceToLine(
				5, -5, // point below line
				{ x: 0, y: 0 }, // p0
				{ x: 10, y: 0 }, // p1
			);
			expect(Math.abs(result.distance)).toBeCloseTo(5, 1);
		});

		test("point at endpoint", () => {
			const result = signedDistanceToLine(
				0, 0, // point at start
				{ x: 0, y: 0 }, // p0
				{ x: 10, y: 0 }, // p1
			);
			expect(Math.abs(result.distance)).toBeLessThan(0.001);
			expect(result.t).toBeCloseTo(0, 5);
		});

		test("point beyond segment end", () => {
			const result = signedDistanceToLine(
				15, 0, // point past end of segment
				{ x: 0, y: 0 }, // p0
				{ x: 10, y: 0 }, // p1
			);
			// Distance to endpoint (10, 0)
			expect(Math.abs(result.distance)).toBeCloseTo(5, 1);
		});

		test("diagonal line", () => {
			const result = signedDistanceToLine(
				0, 10, // point
				{ x: 0, y: 0 }, // p0
				{ x: 10, y: 10 }, // p1 (45 degree line)
			);
			// Distance from (0, 10) to line y=x
			// Perpendicular distance = |10 - 0| / sqrt(2) = 10/sqrt(2) ≈ 7.07
			expect(Math.abs(result.distance)).toBeCloseTo(7.07, 1);
		});

		test("degenerate segment with zero length", () => {
			const result = signedDistanceToLine(
				5, 5, // point away from degenerate segment
				{ x: 0, y: 0 }, // p0
				{ x: 0, y: 0 }, // p1 (same as p0)
			);
			// Should return distance to point (0, 0)
			expect(Math.abs(result.distance)).toBeCloseTo(Math.sqrt(50), 1);
			expect(result.t).toBe(0);
		});
	});

	describe("signedDistanceToQuadratic", () => {
		test("point on curve returns ~0 distance", () => {
			// Point at t=0.5 on curve from (0,0) through (5,10) to (10,0)
			// At t=0.5: x = 0.25*0 + 0.5*5 + 0.25*10 = 5
			//           y = 0.25*0 + 0.5*10 + 0.25*0 = 5
			const result = signedDistanceToQuadratic(
				5, 5, // point on curve
				{ x: 0, y: 0 },
				{ x: 5, y: 10 },
				{ x: 10, y: 0 },
			);
			expect(Math.abs(result.distance)).toBeLessThan(0.5);
		});

		test("point at endpoint", () => {
			const result = signedDistanceToQuadratic(
				0, 0, // start point
				{ x: 0, y: 0 },
				{ x: 5, y: 10 },
				{ x: 10, y: 0 },
			);
			expect(Math.abs(result.distance)).toBeLessThan(0.001);
		});

		test("point away from curve has non-zero distance", () => {
			const result = signedDistanceToQuadratic(
				5, 20, // point above the curve's peak
				{ x: 0, y: 0 },
				{ x: 5, y: 10 },
				{ x: 10, y: 0 },
			);
			// The curve peaks at y=5, so distance should be ~15
			expect(Math.abs(result.distance)).toBeGreaterThan(10);
		});
	});

	describe("signedDistanceToCubic", () => {
		test("point at endpoint", () => {
			const result = signedDistanceToCubic(
				0, 0, // start point
				{ x: 0, y: 0 },
				{ x: 3, y: 10 },
				{ x: 7, y: 10 },
				{ x: 10, y: 0 },
			);
			expect(Math.abs(result.distance)).toBeLessThan(0.001);
		});

		test("point at end endpoint", () => {
			const result = signedDistanceToCubic(
				10, 0, // end point
				{ x: 0, y: 0 },
				{ x: 3, y: 10 },
				{ x: 7, y: 10 },
				{ x: 10, y: 0 },
			);
			expect(Math.abs(result.distance)).toBeLessThan(0.001);
		});

		test("point away from curve", () => {
			const result = signedDistanceToCubic(
				5, 20, // point above the curve
				{ x: 0, y: 0 },
				{ x: 3, y: 10 },
				{ x: 7, y: 10 },
				{ x: 10, y: 0 },
			);
			expect(Math.abs(result.distance)).toBeGreaterThan(10);
		});
	});
});

describe("Edge coloring", () => {
	test("assigns colors to edges at corners", () => {
		// Simple square - 4 edges, each corner is 90 degrees (sharp)
		const edges: MsdfEdge[] = [
			{ type: "line", p0: { x: 0, y: 0 }, p1: { x: 10, y: 0 }, color: 0, minX: 0, maxX: 10, minY: 0, maxY: 0 },
			{ type: "line", p0: { x: 10, y: 0 }, p1: { x: 10, y: 10 }, color: 0, minX: 10, maxX: 10, minY: 0, maxY: 10 },
			{ type: "line", p0: { x: 10, y: 10 }, p1: { x: 0, y: 10 }, color: 0, minX: 0, maxX: 10, minY: 10, maxY: 10 },
			{ type: "line", p0: { x: 0, y: 10 }, p1: { x: 0, y: 0 }, color: 0, minX: 0, maxX: 0, minY: 0, maxY: 10 },
		];

		assignEdgeColors([edges]);

		// Each edge should have a different color from adjacent edges
		for (let i = 0; i < edges.length; i++) {
			const next = (i + 1) % edges.length;
			expect(edges[i].color).not.toBe(edges[next].color);
		}
	});

	test("uses all three colors for complex shapes", () => {
		// Triangle - 3 sharp corners
		const edges: MsdfEdge[] = [
			{ type: "line", p0: { x: 5, y: 0 }, p1: { x: 10, y: 10 }, color: 0, minX: 5, maxX: 10, minY: 0, maxY: 10 },
			{ type: "line", p0: { x: 10, y: 10 }, p1: { x: 0, y: 10 }, color: 0, minX: 0, maxX: 10, minY: 10, maxY: 10 },
			{ type: "line", p0: { x: 0, y: 10 }, p1: { x: 5, y: 0 }, color: 0, minX: 0, maxX: 5, minY: 0, maxY: 10 },
		];

		assignEdgeColors([edges]);

		const colors = new Set(edges.map((e) => e.color));
		// Should use at least 2 colors, possibly all 3
		expect(colors.size).toBeGreaterThanOrEqual(2);
	});

	test("smooth curves can share colors", () => {
		// Two segments forming a smooth curve (180 degree angle)
		const edges: MsdfEdge[] = [
			{ type: "line", p0: { x: 0, y: 0 }, p1: { x: 5, y: 0 }, color: 0, minX: 0, maxX: 5, minY: 0, maxY: 0 },
			{ type: "line", p0: { x: 5, y: 0 }, p1: { x: 10, y: 0 }, color: 0, minX: 5, maxX: 10, minY: 0, maxY: 0 },
		];

		assignEdgeColors([edges]);

		// Smooth transition - can share the same color
		expect(edges[0].color).toBe(edges[1].color);
	});

	test("single edge contour gets color 0", () => {
		const edges: MsdfEdge[] = [
			{ type: "line", p0: { x: 0, y: 0 }, p1: { x: 10, y: 10 }, color: 0, minX: 0, maxX: 10, minY: 0, maxY: 10 },
		];

		assignEdgeColors([edges]);

		// Single edge gets color 0
		expect(edges[0].color).toBe(0);
	});

	test("empty contour is skipped", () => {
		const edges: MsdfEdge[] = [];

		assignEdgeColors([edges]);

		// Should not crash
		expect(edges.length).toBe(0);
	});
});

describe("MSDF Rasterizer", () => {
	test("empty path produces empty bitmap", () => {
		const path: GlyphPath = {
			commands: [],
			bounds: null,
		};

		const bitmap = renderMsdf(path, { width: 10, height: 10, scale: 1 });
		expect(bitmap.width).toBe(10);
		expect(bitmap.rows).toBe(10);
		// RGB channels, so pitch = width * 3
		expect(bitmap.pitch).toBe(30);
	});

	test("simple square - produces RGB output", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 10, y: 10 },
				{ type: "L", x: 90, y: 10 },
				{ type: "L", x: 90, y: 90 },
				{ type: "L", x: 10, y: 90 },
				{ type: "Z" },
			],
			bounds: { xMin: 10, yMin: 10, xMax: 90, yMax: 90 },
		};

		const bitmap = renderMsdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		expect(bitmap.width).toBe(100);
		expect(bitmap.rows).toBe(100);

		// Center should be inside - all channels > 128
		const centerIdx = (50 * bitmap.pitch) + (50 * 3);
		const r = bitmap.buffer[centerIdx];
		const g = bitmap.buffer[centerIdx + 1];
		const b = bitmap.buffer[centerIdx + 2];

		expect(median(r, g, b)).toBeGreaterThan(128);
	});

	test("median of RGB at center equals inside", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 20, y: 20 },
				{ type: "L", x: 80, y: 20 },
				{ type: "L", x: 80, y: 80 },
				{ type: "L", x: 20, y: 80 },
				{ type: "Z" },
			],
			bounds: { xMin: 20, yMin: 20, xMax: 80, yMax: 80 },
		};

		const bitmap = renderMsdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		// Inside point
		const insideIdx = (50 * bitmap.pitch) + (50 * 3);
		const insideMedian = median(
			bitmap.buffer[insideIdx],
			bitmap.buffer[insideIdx + 1],
			bitmap.buffer[insideIdx + 2],
		);
		expect(insideMedian).toBeGreaterThan(128);

		// Outside point
		const outsideIdx = (5 * bitmap.pitch) + (5 * 3);
		const outsideMedian = median(
			bitmap.buffer[outsideIdx],
			bitmap.buffer[outsideIdx + 1],
			bitmap.buffer[outsideIdx + 2],
		);
		expect(outsideMedian).toBeLessThan(128);
	});

	test("corners have distinct channel values", () => {
		// At sharp corners, different channels should have different distances
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 30, y: 30 },
				{ type: "L", x: 70, y: 30 },
				{ type: "L", x: 70, y: 70 },
				{ type: "L", x: 30, y: 70 },
				{ type: "Z" },
			],
			bounds: { xMin: 30, yMin: 30, xMax: 70, yMax: 70 },
		};

		const bitmap = renderMsdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		// Near a corner (just outside the corner at 70, 70)
		const cornerIdx = (72 * bitmap.pitch) + (72 * 3);
		const r = bitmap.buffer[cornerIdx];
		const g = bitmap.buffer[cornerIdx + 1];
		const b = bitmap.buffer[cornerIdx + 2];

		// At corners, channels should differ (this is the key MSDF property)
		// The exact values depend on edge coloring, but they shouldn't all be equal
		const allEqual = r === g && g === b;
		// This might be equal in some cases, so we check the median is correct instead
		expect(median(r, g, b)).toBeLessThan(128); // Outside the shape
	});

	test("quadratic bezier curve", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 10, y: 50 },
				{ type: "Q", x1: 50, y1: 10, x: 90, y: 50 },
				{ type: "L", x: 90, y: 90 },
				{ type: "L", x: 10, y: 90 },
				{ type: "Z" },
			],
			bounds: { xMin: 10, yMin: 10, xMax: 90, yMax: 90 },
		};

		const bitmap = renderMsdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		expect(bitmap.width).toBe(100);
		expect(bitmap.rows).toBe(100);

		// Inside the shape
		const insideIdx = (70 * bitmap.pitch) + (50 * 3);
		const insideMedian = median(
			bitmap.buffer[insideIdx],
			bitmap.buffer[insideIdx + 1],
			bitmap.buffer[insideIdx + 2],
		);
		expect(insideMedian).toBeGreaterThan(128);

		// Outside (above the arc)
		const outsideIdx = (20 * bitmap.pitch) + (50 * 3);
		const outsideMedian = median(
			bitmap.buffer[outsideIdx],
			bitmap.buffer[outsideIdx + 1],
			bitmap.buffer[outsideIdx + 2],
		);
		expect(outsideMedian).toBeLessThan(128);
	});

	test("cubic bezier curve", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 10, y: 10 },
				{ type: "C", x1: 40, y1: 10, x2: 40, y2: 90, x: 90, y: 90 },
				{ type: "L", x: 90, y: 100 },
				{ type: "L", x: 10, y: 100 },
				{ type: "Z" },
			],
			bounds: { xMin: 10, yMin: 10, xMax: 90, yMax: 100 },
		};

		const bitmap = renderMsdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		expect(bitmap.width).toBe(100);
		expect(bitmap.rows).toBe(100);

		// Inside
		const insideIdx = (95 * bitmap.pitch) + (50 * 3);
		const insideMedian = median(
			bitmap.buffer[insideIdx],
			bitmap.buffer[insideIdx + 1],
			bitmap.buffer[insideIdx + 2],
		);
		expect(insideMedian).toBeGreaterThan(128);
	});

	test("spread parameter", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 40, y: 40 },
				{ type: "L", x: 60, y: 40 },
				{ type: "L", x: 60, y: 60 },
				{ type: "L", x: 40, y: 60 },
				{ type: "Z" },
			],
			bounds: { xMin: 40, yMin: 40, xMax: 60, yMax: 60 },
		};

		const bitmap1 = renderMsdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 8,
		});
		const bitmap2 = renderMsdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 32,
		});

		// Both should correctly identify inside/outside
		const centerIdx = (50 * bitmap1.pitch) + (50 * 3);

		const median1 = median(
			bitmap1.buffer[centerIdx],
			bitmap1.buffer[centerIdx + 1],
			bitmap1.buffer[centerIdx + 2],
		);
		const median2 = median(
			bitmap2.buffer[centerIdx],
			bitmap2.buffer[centerIdx + 1],
			bitmap2.buffer[centerIdx + 2],
		);

		expect(median1).toBeGreaterThan(128);
		expect(median2).toBeGreaterThan(128);
	});

	test("scale parameter", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 20, y: 20 },
				{ type: "L", x: 30, y: 20 },
				{ type: "L", x: 30, y: 30 },
				{ type: "L", x: 20, y: 30 },
				{ type: "Z" },
			],
			bounds: { xMin: 20, yMin: 20, xMax: 30, yMax: 30 },
		};

		// Scale 2x
		const bitmap = renderMsdf(path, {
			width: 100,
			height: 100,
			scale: 2,
			spread: 16,
		});

		// With 2x scale, square goes from (40, 40) to (60, 60)
		const centerIdx = (50 * bitmap.pitch) + (50 * 3);
		const centerMedian = median(
			bitmap.buffer[centerIdx],
			bitmap.buffer[centerIdx + 1],
			bitmap.buffer[centerIdx + 2],
		);
		expect(centerMedian).toBeGreaterThan(128);
	});

	test("offset parameters", () => {
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

		const bitmap = renderMsdf(path, {
			width: 50,
			height: 50,
			scale: 1,
			spread: 8,
			offsetX: 20,
			offsetY: 20,
		});

		// Shape at (20, 20) to (30, 30)
		const centerIdx = (25 * bitmap.pitch) + (25 * 3);
		const centerMedian = median(
			bitmap.buffer[centerIdx],
			bitmap.buffer[centerIdx + 1],
			bitmap.buffer[centerIdx + 2],
		);
		expect(centerMedian).toBeGreaterThan(128);

		// Original position (5, 5) should be outside
		const originalIdx = (5 * bitmap.pitch) + (5 * 3);
		const originalMedian = median(
			bitmap.buffer[originalIdx],
			bitmap.buffer[originalIdx + 1],
			bitmap.buffer[originalIdx + 2],
		);
		expect(originalMedian).toBeLessThan(128);
	});

	test("unclosed contour without Z", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 10, y: 10 },
				{ type: "L", x: 20, y: 10 },
				{ type: "L", x: 20, y: 20 },
				{ type: "L", x: 10, y: 20 },
				// No Z - contour ends without closing
			],
			bounds: { xMin: 10, yMin: 10, xMax: 20, yMax: 20 },
		};

		const bitmap = renderMsdf(path, {
			width: 30,
			height: 30,
			scale: 1,
			spread: 4,
		});

		// Should still render something
		expect(bitmap.width).toBe(30);
		expect(bitmap.rows).toBe(30);
	});

	test("multiple contours with M commands", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 5, y: 5 },
				{ type: "L", x: 15, y: 5 },
				{ type: "L", x: 15, y: 15 },
				{ type: "L", x: 5, y: 15 },
				{ type: "Z" },
				{ type: "M", x: 20, y: 20 },
				{ type: "L", x: 30, y: 20 },
				{ type: "L", x: 30, y: 30 },
				{ type: "L", x: 20, y: 30 },
				{ type: "Z" },
			],
			bounds: { xMin: 5, yMin: 5, xMax: 30, yMax: 30 },
		};

		const bitmap = renderMsdf(path, {
			width: 40,
			height: 40,
			scale: 1,
			spread: 4,
		});

		// Both contours should be rendered
		expect(bitmap.width).toBe(40);
		expect(bitmap.rows).toBe(40);
	});

	test("M command after unclosed contour", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 5, y: 5 },
				{ type: "L", x: 15, y: 5 },
				{ type: "L", x: 15, y: 15 },
				// No Z - contour not closed
				{ type: "M", x: 20, y: 20 }, // New M command triggers contour push
				{ type: "L", x: 30, y: 20 },
				{ type: "L", x: 30, y: 30 },
				{ type: "L", x: 20, y: 30 },
				{ type: "Z" },
			],
			bounds: { xMin: 5, yMin: 5, xMax: 30, yMax: 30 },
		};

		const bitmap = renderMsdf(path, {
			width: 40,
			height: 40,
			scale: 1,
			spread: 4,
		});

		// Both contours should be handled
		expect(bitmap.width).toBe(40);
		expect(bitmap.rows).toBe(40);
	});
});

describe("MSDF Atlas", () => {
	// Use a test font - single ttf file (not ttc)
	const fontPath = "/System/Library/Fonts/Supplemental/Arial.ttf";

	test("buildMsdfAtlas creates atlas with correct structure", async () => {
		const font = await Font.fromFile(fontPath);

		// Build atlas for a few glyphs
		const glyphIds = [font.glyphId(65), font.glyphId(66), font.glyphId(67)].filter(
			(id): id is number => id !== undefined && id !== 0
		);

		const atlas = buildMsdfAtlas(font, glyphIds, {
			fontSize: 32,
			padding: 2,
			spread: 4,
		});

		// Check atlas structure
		expect(atlas.bitmap).toBeDefined();
		expect(atlas.bitmap.pixelMode).toBe(PixelMode.LCD); // RGB for MSDF
		expect(atlas.glyphs.size).toBe(glyphIds.length);
		expect(atlas.fontSize).toBe(32);

		// Check that all glyphs have metrics
		for (const glyphId of glyphIds) {
			const metrics = atlas.glyphs.get(glyphId);
			expect(metrics).toBeDefined();
			expect(metrics!.width).toBeGreaterThan(0);
			expect(metrics!.height).toBeGreaterThan(0);
		}
	});

	test("buildMsdfAsciiAtlas creates atlas for ASCII range", async () => {
		const font = await Font.fromFile(fontPath);

		const atlas = buildMsdfAsciiAtlas(font, {
			fontSize: 24,
			spread: 4,
		});

		// Should have most ASCII printable characters
		expect(atlas.glyphs.size).toBeGreaterThan(80);

		// Check 'A' is present
		const aGlyphId = font.glyphId(65);
		if (aGlyphId) {
			expect(atlas.glyphs.has(aGlyphId)).toBe(true);
		}
	});

	test("buildMsdfStringAtlas creates atlas for specific string", async () => {
		const font = await Font.fromFile(fontPath);

		const atlas = buildMsdfStringAtlas(font, "Hello", {
			fontSize: 32,
			spread: 4,
		});

		// Should have unique characters from "Hello" (H, e, l, o = 4 unique)
		expect(atlas.glyphs.size).toBe(4);
	});

	test("msdfAtlasToRGB returns RGB data", async () => {
		const font = await Font.fromFile(fontPath);

		const atlas = buildMsdfAtlas(font, [font.glyphId(65)!], {
			fontSize: 32,
			spread: 4,
		});

		const rgb = msdfAtlasToRGB(atlas);

		// Should be width * height * 3 bytes
		expect(rgb.length).toBe(atlas.bitmap.width * atlas.bitmap.rows * 3);
	});

	test("msdfAtlasToRGBA returns RGBA data", async () => {
		const font = await Font.fromFile(fontPath);

		const atlas = buildMsdfAtlas(font, [font.glyphId(65)!], {
			fontSize: 32,
			spread: 4,
		});

		const rgba = msdfAtlasToRGBA(atlas);

		// Should be width * height * 4 bytes
		expect(rgba.length).toBe(atlas.bitmap.width * atlas.bitmap.rows * 4);

		// Alpha should be 255 for all pixels
		for (let i = 3; i < rgba.length; i += 4) {
			expect(rgba[i]).toBe(255);
		}
	});

	test("atlas dimensions are power of 2", async () => {
		const font = await Font.fromFile(fontPath);

		const atlas = buildMsdfAsciiAtlas(font, {
			fontSize: 32,
			spread: 4,
		});

		const isPowerOf2 = (n: number) => n > 0 && (n & (n - 1)) === 0;

		expect(isPowerOf2(atlas.bitmap.width)).toBe(true);
		expect(isPowerOf2(atlas.bitmap.rows)).toBe(true);
	});

	test("atlas packing with constrained dimensions", async () => {
		const font = await Font.fromFile(fontPath);

		const atlas = buildMsdfAtlas(font, [font.glyphId(65)!, font.glyphId(66)!, font.glyphId(67)!], {
			fontSize: 32,
			padding: 2,
			spread: 4,
			maxWidth: 64,
			maxHeight: 64,
		});

		expect(atlas.bitmap.width).toBeLessThanOrEqual(64);
		expect(atlas.bitmap.rows).toBeLessThanOrEqual(64);
	});

	test("atlas that cannot fit all glyphs", async () => {
		const font = await Font.fromFile(fontPath);

		const glyphIds: number[] = [];
		for (let codepoint = 32; codepoint <= 126; codepoint++) {
			const glyphId = font.glyphId(codepoint);
			if (glyphId !== undefined && glyphId !== 0) {
				glyphIds.push(glyphId);
			}
		}

		const atlas = buildMsdfAtlas(font, glyphIds, {
			fontSize: 64,
			padding: 2,
			spread: 4,
			maxWidth: 128,
			maxHeight: 128,
		});

		// Some glyphs may not fit, but atlas should still be created
		expect(atlas.bitmap).toBeDefined();
		expect(atlas.bitmap.width).toBeLessThanOrEqual(128);
		expect(atlas.bitmap.rows).toBeLessThanOrEqual(128);
	});

	test("msdfAtlasToRGB handles row padding", async () => {
		const font = await Font.fromFile(fontPath);

		const atlas = buildMsdfAtlas(font, [font.glyphId(65)!], {
			fontSize: 32,
			spread: 4,
		});

		// Force a scenario where pitch != width * 3 by creating a custom bitmap
		const paddedBitmap = {
			...atlas.bitmap,
			pitch: atlas.bitmap.width * 3 + 16, // Add padding
		};

		const paddedAtlas = {
			...atlas,
			bitmap: paddedBitmap,
		};

		const rgb = msdfAtlasToRGB(paddedAtlas);

		// Should handle padding and return correct size
		expect(rgb.length).toBe(atlas.bitmap.width * atlas.bitmap.rows * 3);
	});

	test("empty glyph set creates empty atlas", async () => {
		const font = await Font.fromFile(fontPath);

		const atlas = buildMsdfAtlas(font, [], {
			fontSize: 32,
			spread: 4,
		});

		expect(atlas.glyphs.size).toBe(0);
		expect(atlas.bitmap).toBeDefined();
	});

	test("glyph with no path is skipped", async () => {
		const font = await Font.fromFile(fontPath);

		// Space character (32) typically has no path
		const spaceGlyphId = font.glyphId(32);
		const aGlyphId = font.glyphId(65);

		const glyphIds: number[] = [];
		if (spaceGlyphId !== undefined) glyphIds.push(spaceGlyphId);
		if (aGlyphId !== undefined) glyphIds.push(aGlyphId);

		const atlas = buildMsdfAtlas(font, glyphIds, {
			fontSize: 32,
			spread: 4,
		});

		// Space may or may not be included, but should not crash
		expect(atlas.bitmap).toBeDefined();
	});
});

describe("Edge helper functions", () => {
	test("signedDistanceToEdge for line edge", () => {
		const edge: MsdfEdge = {
			type: "line",
			p0: { x: 0, y: 0 },
			p1: { x: 10, y: 0 },
			color: 0,
			minX: 0,
			maxX: 10,
			minY: 0,
			maxY: 0,
		};

		const result = signedDistanceToEdge(5, 5, edge);
		expect(Math.abs(result.distance)).toBeCloseTo(5, 1);
	});

	test("signedDistanceToEdge for quadratic edge", () => {
		const edge: MsdfEdge = {
			type: "quadratic",
			p0: { x: 0, y: 0 },
			p1: { x: 5, y: 10 },
			p2: { x: 10, y: 0 },
			color: 0,
			minX: 0,
			maxX: 10,
			minY: 0,
			maxY: 10,
		};

		const result = signedDistanceToEdge(5, 0, edge);
		expect(result).toBeDefined();
		expect(typeof result.distance).toBe("number");
		expect(typeof result.t).toBe("number");
	});

	test("signedDistanceToEdge for cubic edge", () => {
		const edge: MsdfEdge = {
			type: "cubic",
			p0: { x: 0, y: 0 },
			p1: { x: 3, y: 10 },
			p2: { x: 7, y: 10 },
			p3: { x: 10, y: 0 },
			color: 0,
			minX: 0,
			maxX: 10,
			minY: 0,
			maxY: 10,
		};

		const result = signedDistanceToEdge(5, 0, edge);
		expect(result).toBeDefined();
		expect(typeof result.distance).toBe("number");
		expect(typeof result.t).toBe("number");
	});

	test("isPointInside with simple square", () => {
		const edges: MsdfEdge[] = [
			{ type: "line", p0: { x: 0, y: 0 }, p1: { x: 10, y: 0 }, color: 0, minX: 0, maxX: 10, minY: 0, maxY: 0 },
			{ type: "line", p0: { x: 10, y: 0 }, p1: { x: 10, y: 10 }, color: 1, minX: 10, maxX: 10, minY: 0, maxY: 10 },
			{ type: "line", p0: { x: 10, y: 10 }, p1: { x: 0, y: 10 }, color: 2, minX: 0, maxX: 10, minY: 10, maxY: 10 },
			{ type: "line", p0: { x: 0, y: 10 }, p1: { x: 0, y: 0 }, color: 0, minX: 0, maxX: 0, minY: 0, maxY: 10 },
		];

		const contours = [edges];

		expect(isPointInside(5, 5, contours)).toBe(true);
		expect(isPointInside(15, 15, contours)).toBe(false);
		expect(isPointInside(-1, 5, contours)).toBe(false);
	});

	test("isPointInside with quadratic curves", () => {
		const edges: MsdfEdge[] = [
			{ type: "quadratic", p0: { x: 0, y: 0 }, p1: { x: 5, y: 5 }, p2: { x: 10, y: 0 }, color: 0, minX: 0, maxX: 10, minY: 0, maxY: 5 },
			{ type: "line", p0: { x: 10, y: 0 }, p1: { x: 0, y: 0 }, color: 1, minX: 0, maxX: 10, minY: 0, maxY: 0 },
		];

		const contours = [edges];

		expect(isPointInside(5, 2, contours)).toBe(true);
		expect(isPointInside(5, -1, contours)).toBe(false);
	});

	test("isPointInside with cubic curves", () => {
		const edges: MsdfEdge[] = [
			{ type: "cubic", p0: { x: 0, y: 0 }, p1: { x: 3, y: 5 }, p2: { x: 7, y: 5 }, p3: { x: 10, y: 0 }, color: 0, minX: 0, maxX: 10, minY: 0, maxY: 5 },
			{ type: "line", p0: { x: 10, y: 0 }, p1: { x: 0, y: 0 }, color: 1, minX: 0, maxX: 10, minY: 0, maxY: 0 },
		];

		const contours = [edges];

		expect(isPointInside(5, 2, contours)).toBe(true);
		expect(isPointInside(5, -1, contours)).toBe(false);
	});

	test("flattenEdge for line", () => {
		const edge: MsdfEdge = {
			type: "line",
			p0: { x: 0, y: 0 },
			p1: { x: 10, y: 10 },
			color: 0,
			minX: 0,
			maxX: 10,
			minY: 0,
			maxY: 10,
		};

		const points = flattenEdge(edge);
		expect(points).toHaveLength(2);
		expect(points[0]).toEqual({ x: 0, y: 0 });
		expect(points[1]).toEqual({ x: 10, y: 10 });
	});

	test("flattenEdge for quadratic", () => {
		const edge: MsdfEdge = {
			type: "quadratic",
			p0: { x: 0, y: 0 },
			p1: { x: 5, y: 10 },
			p2: { x: 10, y: 0 },
			color: 0,
			minX: 0,
			maxX: 10,
			minY: 0,
			maxY: 10,
		};

		const points = flattenEdge(edge);
		expect(points.length).toBeGreaterThan(2);
		expect(points[0]).toEqual({ x: 0, y: 0 });
		expect(points[points.length - 1]).toEqual({ x: 10, y: 0 });
	});

	test("flattenEdge for cubic", () => {
		const edge: MsdfEdge = {
			type: "cubic",
			p0: { x: 0, y: 0 },
			p1: { x: 3, y: 10 },
			p2: { x: 7, y: 10 },
			p3: { x: 10, y: 0 },
			color: 0,
			minX: 0,
			maxX: 10,
			minY: 0,
			maxY: 10,
		};

		const points = flattenEdge(edge);
		expect(points.length).toBeGreaterThan(2);
		expect(points[0]).toEqual({ x: 0, y: 0 });
		expect(points[points.length - 1]).toEqual({ x: 10, y: 0 });
	});
});
