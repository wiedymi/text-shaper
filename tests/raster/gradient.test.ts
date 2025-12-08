import { describe, expect, test } from "bun:test";
import {
	interpolateGradient,
	createGradientBitmap,
	rasterizePathWithGradient,
	type LinearGradient,
	type RadialGradient,
	type ColorStop,
} from "../../src/raster/gradient.ts";
import { PixelMode } from "../../src/raster/types.ts";
import type { GlyphPath } from "../../src/render/path.ts";

describe("raster/gradient", () => {
	describe("interpolateGradient", () => {
		test("linear gradient - horizontal", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 100,
				y1: 0,
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 1, color: [0, 0, 255, 255] },
				],
			};

			const start = interpolateGradient(gradient, 0, 0);
			expect(start).toEqual([255, 0, 0, 255]);

			const end = interpolateGradient(gradient, 100, 0);
			expect(end).toEqual([0, 0, 255, 255]);

			const mid = interpolateGradient(gradient, 50, 0);
			expect(mid[0]).toBeCloseTo(128, 1);
			expect(mid[1]).toBe(0);
			expect(mid[2]).toBeCloseTo(128, 1);
			expect(mid[3]).toBe(255);
		});

		test("linear gradient - vertical", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 0,
				y1: 100,
				stops: [
					{ offset: 0, color: [255, 255, 255, 255] },
					{ offset: 1, color: [0, 0, 0, 255] },
				],
			};

			const start = interpolateGradient(gradient, 0, 0);
			expect(start).toEqual([255, 255, 255, 255]);

			const end = interpolateGradient(gradient, 0, 100);
			expect(end).toEqual([0, 0, 0, 255]);

			const mid = interpolateGradient(gradient, 0, 50);
			expect(mid[0]).toBeCloseTo(128, 1);
			expect(mid[1]).toBeCloseTo(128, 1);
			expect(mid[2]).toBeCloseTo(128, 1);
		});

		test("linear gradient - diagonal", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 100,
				y1: 100,
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 1, color: [0, 255, 0, 255] },
				],
			};

			const start = interpolateGradient(gradient, 0, 0);
			expect(start).toEqual([255, 0, 0, 255]);

			const end = interpolateGradient(gradient, 100, 100);
			expect(end).toEqual([0, 255, 0, 255]);
		});

		test("radial gradient - from center", () => {
			const gradient: RadialGradient = {
				type: "radial",
				cx: 50,
				cy: 50,
				radius: 50,
				stops: [
					{ offset: 0, color: [255, 255, 255, 255] },
					{ offset: 1, color: [0, 0, 0, 255] },
				],
			};

			const center = interpolateGradient(gradient, 50, 50);
			expect(center).toEqual([255, 255, 255, 255]);

			const edge = interpolateGradient(gradient, 100, 50);
			expect(edge).toEqual([0, 0, 0, 255]);

			const mid = interpolateGradient(gradient, 75, 50);
			expect(mid[0]).toBeCloseTo(128, 1);
			expect(mid[1]).toBeCloseTo(128, 1);
			expect(mid[2]).toBeCloseTo(128, 1);
		});

		test("multiple color stops", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 100,
				y1: 0,
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 0.5, color: [0, 255, 0, 255] },
					{ offset: 1, color: [0, 0, 255, 255] },
				],
			};

			const start = interpolateGradient(gradient, 0, 0);
			expect(start).toEqual([255, 0, 0, 255]);

			const middle = interpolateGradient(gradient, 50, 0);
			expect(middle).toEqual([0, 255, 0, 255]);

			const end = interpolateGradient(gradient, 100, 0);
			expect(end).toEqual([0, 0, 255, 255]);

			const quarter = interpolateGradient(gradient, 25, 0);
			expect(quarter[0]).toBeCloseTo(128, 1);
			expect(quarter[1]).toBeCloseTo(128, 1);
			expect(quarter[2]).toBe(0);
		});

		test("single color stop", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 100,
				y1: 0,
				stops: [{ offset: 0.5, color: [128, 128, 128, 255] }],
			};

			const anyPoint = interpolateGradient(gradient, 42, 17);
			expect(anyPoint).toEqual([128, 128, 128, 255]);
		});

		test("empty stops returns transparent", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 100,
				y1: 0,
				stops: [],
			};

			const color = interpolateGradient(gradient, 50, 50);
			expect(color).toEqual([0, 0, 0, 0]);
		});

		test("zero length gradient returns first stop", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 50,
				y0: 50,
				x1: 50,
				y1: 50, // Same point - zero length
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 1, color: [0, 0, 255, 255] },
				],
			};

			const color = interpolateGradient(gradient, 50, 50);
			expect(color).toEqual([255, 0, 0, 255]);
		});

		test("zero radius radial gradient returns first stop color", () => {
			const gradient: RadialGradient = {
				type: "radial",
				cx: 50,
				cy: 50,
				radius: 0, // Zero radius
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 1, color: [0, 0, 255, 255] },
				],
			};

			// With radius=0, t should be 0, returning first stop
			const color = interpolateGradient(gradient, 100, 50);
			expect(color).toEqual([255, 0, 0, 255]);
		});

		test("stops at same position", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 100,
				y1: 0,
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 0.5, color: [0, 255, 0, 255] },
					{ offset: 0.5, color: [0, 0, 255, 255] },
					{ offset: 1, color: [255, 255, 255, 255] },
				],
			};

			const beforeTransition = interpolateGradient(gradient, 49, 0);
			const atTransition = interpolateGradient(gradient, 50, 0);
			const afterTransition = interpolateGradient(gradient, 51, 0);

			expect(beforeTransition[1]).toBeGreaterThan(0);
			expect(afterTransition[2]).toBeGreaterThan(0);
			expect(afterTransition).not.toEqual([0, 255, 0, 255]);
		});

		test("duplicate stops at same offset - earlier range matches first", () => {
			// When duplicate stops exist at offset X, and there's a stop at offset Y < X,
			// t=X falls into range [Y, X] first, not [X, X]
			// At t=X, localT = 1.0, so it returns the first duplicate stop's color
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 100,
				y1: 0,
				stops: [
					{ offset: 0, color: [0, 255, 0, 255] }, // t=0 will hit this
					{ offset: 0.5, color: [255, 0, 0, 255] }, // first at 0.5 (red)
					{ offset: 0.5, color: [0, 0, 255, 255] }, // second at 0.5 (blue)
					{ offset: 1, color: [255, 255, 255, 255] },
				],
			};

			// When t=0.5, it falls into [0, 0.5] range, localT = 1.0, returns red (first 0.5 stop)
			const color = interpolateGradient(gradient, 50, 0);
			expect(color).toEqual([255, 0, 0, 255]); // Pure red, not blue
		});

		test("gradient clamping beyond bounds", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 100,
				y1: 0,
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 1, color: [0, 0, 255, 255] },
				],
			};

			const before = interpolateGradient(gradient, -50, 0);
			expect(before).toEqual([255, 0, 0, 255]);

			const after = interpolateGradient(gradient, 150, 0);
			expect(after).toEqual([0, 0, 255, 255]);
		});
	});

	describe("createGradientBitmap", () => {
		test("creates linear gradient bitmap", () => {
			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 10,
				y1: 0,
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 1, color: [0, 0, 255, 255] },
				],
			};

			const bitmap = createGradientBitmap(10, 10, gradient);

			expect(bitmap.width).toBe(10);
			expect(bitmap.rows).toBe(10);
			expect(bitmap.pixelMode).toBe(PixelMode.RGBA);
			expect(bitmap.buffer.length).toBe(10 * 10 * 4);

			const firstPixelR = bitmap.buffer[0];
			expect(firstPixelR).toBe(255);

			const lastRowFirstPixelIdx = (9 * 10 + 9) * 4;
			const lastPixelB = bitmap.buffer[lastRowFirstPixelIdx + 2];
			expect(lastPixelB).toBeGreaterThan(200);
		});

		test("creates radial gradient bitmap", () => {
			const gradient: RadialGradient = {
				type: "radial",
				cx: 5,
				cy: 5,
				radius: 5,
				stops: [
					{ offset: 0, color: [255, 255, 255, 255] },
					{ offset: 1, color: [0, 0, 0, 255] },
				],
			};

			const bitmap = createGradientBitmap(10, 10, gradient);

			expect(bitmap.width).toBe(10);
			expect(bitmap.rows).toBe(10);

			const centerIdx = (5 * 10 + 5) * 4;
			const centerR = bitmap.buffer[centerIdx];
			expect(centerR).toBe(255);

			const edgeIdx = (5 * 10 + 0) * 4;
			const edgeR = bitmap.buffer[edgeIdx];
			expect(edgeR).toBeLessThan(128);
		});
	});

	describe("rasterizePathWithGradient", () => {
		test("rasterizes rectangle with linear gradient", () => {
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

			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 20,
				y1: 0,
				stops: [
					{ offset: 0, color: [255, 0, 0, 255] },
					{ offset: 1, color: [0, 0, 255, 255] },
				],
			};

			const bitmap = rasterizePathWithGradient(path, gradient, {
				width: 20,
				height: 20,
				scale: 1.0,
				offsetX: 5,
				offsetY: 5,
			});

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
			expect(bitmap.pixelMode).toBe(PixelMode.RGBA);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("rasterizes circle with radial gradient", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 10, y: 5 },
					{ type: "Q", x1: 10, y1: 7.761, x: 7.761, y: 10 },
					{ type: "Q", x1: 5, y1: 10, x: 2.239, y: 10 },
					{ type: "Q", x1: 0, y1: 7.761, x: 0, y: 5 },
					{ type: "Q", x1: 0, y1: 2.239, x: 2.239, y: 0 },
					{ type: "Q", x1: 5, y1: 0, x: 7.761, y: 0 },
					{ type: "Q", x1: 10, y1: 2.239, x: 10, y: 5 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			const gradient: RadialGradient = {
				type: "radial",
				cx: 10,
				cy: 10,
				radius: 10,
				stops: [
					{ offset: 0, color: [255, 255, 0, 255] },
					{ offset: 1, color: [255, 0, 0, 255] },
				],
			};

			const bitmap = rasterizePathWithGradient(path, gradient, {
				width: 20,
				height: 20,
				scale: 1.0,
				offsetX: 5,
				offsetY: 5,
			});

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
		});

		test("applies coverage as alpha", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 2, y: 2 },
					{ type: "L", x: 8, y: 2 },
					{ type: "L", x: 8, y: 8 },
					{ type: "L", x: 2, y: 8 },
					{ type: "Z" },
				],
				bounds: { xMin: 2, yMin: 2, xMax: 8, yMax: 8 },
			};

			const gradient: LinearGradient = {
				type: "linear",
				x0: 0,
				y0: 0,
				x1: 10,
				y1: 0,
				stops: [
					{ offset: 0, color: [255, 255, 255, 255] },
					{ offset: 1, color: [255, 255, 255, 255] },
				],
			};

			const bitmap = rasterizePathWithGradient(path, gradient, {
				width: 10,
				height: 10,
				scale: 1.0,
			});

			let totalAlpha = 0;
			for (let y = 0; y < 10; y++) {
				for (let x = 0; x < 10; x++) {
					const idx = (y * 10 + x) * 4 + 3;
					totalAlpha += bitmap.buffer[idx];
				}
			}
			expect(totalAlpha).toBeGreaterThan(0);

			const outsideIdx = (0 * 10 + 0) * 4 + 3;
			const outsideAlpha = bitmap.buffer[outsideIdx];
			expect(outsideAlpha).toBe(0);
		});
	});
});
