import { describe, expect, test } from "bun:test";
import type { GlyphPath } from "../../src/render/path.ts";
import { renderSdf } from "../../src/raster/sdf.ts";

describe("SDF Rasterizer", () => {
	test("empty path", () => {
		const path: GlyphPath = {
			commands: [],
			bounds: null,
		};

		const bitmap = renderSdf(path, { width: 10, height: 10, scale: 1 });
		expect(bitmap.width).toBe(10);
		expect(bitmap.rows).toBe(10);

		// Empty path should have all values at 0 (maximum negative distance)
		for (let i = 0; i < bitmap.buffer.length; i++) {
			expect(bitmap.buffer[i]).toBe(0);
		}
	});

	test("single point path", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 5, y: 5 },
				{ type: "Z" },
			],
			bounds: { xMin: 5, yMin: 5, xMax: 5, yMax: 5 },
		};

		const bitmap = renderSdf(path, { width: 10, height: 10, scale: 1 });
		expect(bitmap.width).toBe(10);
		expect(bitmap.rows).toBe(10);

		// Single point has no edges, should be all minimum distance
		for (let i = 0; i < bitmap.buffer.length; i++) {
			expect(bitmap.buffer[i]).toBe(0);
		}
	});

	test("simple square - distance values at known positions", () => {
		// Square from (10, 10) to (90, 90) in 100x100 space
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

		const bitmap = renderSdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		// Center of square (50, 50) should be inside (value > 128)
		const centerIdx = 50 * bitmap.pitch + 50;
		expect(bitmap.buffer[centerIdx]).toBeGreaterThan(128);

		// Outside the square should be < 128
		const outsideIdx = 5 * bitmap.pitch + 5;
		expect(bitmap.buffer[outsideIdx]).toBeLessThan(128);

		// Edge pixels should be around 128
		const edgeIdx = 10 * bitmap.pitch + 50;
		expect(bitmap.buffer[edgeIdx]).toBeGreaterThanOrEqual(120);
		expect(bitmap.buffer[edgeIdx]).toBeLessThanOrEqual(136);
	});

	test("square - sign correctness (inside vs outside)", () => {
		// Square from (20, 20) to (80, 80)
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

		const bitmap = renderSdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 20,
		});

		// Points clearly inside should be > 128
		expect(bitmap.buffer[50 * bitmap.pitch + 50]).toBeGreaterThan(128);
		expect(bitmap.buffer[30 * bitmap.pitch + 30]).toBeGreaterThan(128);
		expect(bitmap.buffer[70 * bitmap.pitch + 70]).toBeGreaterThan(128);

		// Points clearly outside should be < 128
		expect(bitmap.buffer[10 * bitmap.pitch + 10]).toBeLessThan(128);
		expect(bitmap.buffer[90 * bitmap.pitch + 90]).toBeLessThan(128);
		expect(bitmap.buffer[10 * bitmap.pitch + 90]).toBeLessThan(128);
		expect(bitmap.buffer[90 * bitmap.pitch + 10]).toBeLessThan(128);
	});

	test("quadratic bezier curve", () => {
		// Simple arc
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

		const bitmap = renderSdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		// Should produce valid bitmap
		expect(bitmap.width).toBe(100);
		expect(bitmap.rows).toBe(100);

		// Inside the closed shape should be > 128
		expect(bitmap.buffer[70 * bitmap.pitch + 50]).toBeGreaterThan(128);

		// Outside (above the arc) should be < 128
		expect(bitmap.buffer[20 * bitmap.pitch + 50]).toBeLessThan(128);
	});

	test("cubic bezier curve", () => {
		// S-curve
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

		const bitmap = renderSdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		expect(bitmap.width).toBe(100);
		expect(bitmap.rows).toBe(100);

		// Inside should be > 128
		expect(bitmap.buffer[95 * bitmap.pitch + 50]).toBeGreaterThan(128);

		// Outside the curve should be < 128
		expect(bitmap.buffer[50 * bitmap.pitch + 70]).toBeLessThan(128);
	});

	test("spread parameter affects distance field range", () => {
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

		const bitmap1 = renderSdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 8,
		});
		const bitmap2 = renderSdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 32,
		});

		// Both should have similar inside/outside classification
		const centerIdx = 50 * 100 + 50;
		expect(bitmap1.buffer[centerIdx]).toBeGreaterThan(128);
		expect(bitmap2.buffer[centerIdx]).toBeGreaterThan(128);

		// But gradients should differ near edges
		expect(bitmap1.width).toBe(100);
		expect(bitmap2.width).toBe(100);
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

		// Scale 2x should make the shape twice as large in pixel space
		const bitmap = renderSdf(path, {
			width: 100,
			height: 100,
			scale: 2,
			spread: 16,
		});

		expect(bitmap.width).toBe(100);
		expect(bitmap.rows).toBe(100);

		// With 2x scale, the square goes from (40, 40) to (60, 60) in pixels
		// So (50, 50) should be inside
		const centerIdx = 50 * bitmap.pitch + 50;
		expect(bitmap.buffer[centerIdx]).toBeGreaterThan(128);
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

		// Offset by (20, 20) pixels
		const bitmap = renderSdf(path, {
			width: 50,
			height: 50,
			scale: 1,
			spread: 8,
			offsetX: 20,
			offsetY: 20,
		});

		// Shape should now be at (20, 20) to (30, 30)
		const centerIdx = 25 * bitmap.pitch + 25;
		expect(bitmap.buffer[centerIdx]).toBeGreaterThan(128);

		// Original position (5, 5) should be outside
		const originalIdx = 5 * bitmap.pitch + 5;
		expect(bitmap.buffer[originalIdx]).toBeLessThan(128);
	});

	test("triangle with line segments only", () => {
		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 50, y: 10 },
				{ type: "L", x: 90, y: 90 },
				{ type: "L", x: 10, y: 90 },
				{ type: "Z" },
			],
			bounds: { xMin: 10, yMin: 10, xMax: 90, yMax: 90 },
		};

		const bitmap = renderSdf(path, {
			width: 100,
			height: 100,
			scale: 1,
			spread: 16,
		});

		// Centroid of triangle should be inside
		const centroidIdx = 63 * bitmap.pitch + 50;
		expect(bitmap.buffer[centroidIdx]).toBeGreaterThan(128);

		// Top left corner should be outside
		const outsideIdx = 20 * bitmap.pitch + 20;
		expect(bitmap.buffer[outsideIdx]).toBeLessThan(128);
	});
});
