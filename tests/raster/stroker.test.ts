import { describe, expect, test } from "bun:test";
import {
	strokePath,
	type LineCap,
	type LineJoin,
	type StrokerOptions,
} from "../../src/raster/stroker.ts";
import type { GlyphPath, PathCommand } from "../../src/render/path.ts";

describe("strokePath", () => {
	describe("basic line stroking", () => {
		test("strokes a simple horizontal line", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 0 },
			};

			const stroked = strokePath(path, { width: 10 });

			// Should have commands (path is open so gets caps)
			expect(stroked.commands.length).toBeGreaterThan(0);

			// Should have expanded bounds
			expect(stroked.bounds).not.toBeNull();
			if (stroked.bounds) {
				expect(stroked.bounds.yMin).toBe(-5);
				expect(stroked.bounds.yMax).toBe(5);
				expect(stroked.bounds.xMin).toBe(-5);
				expect(stroked.bounds.xMax).toBe(105);
			}
		});

		test("strokes a simple vertical line", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 50, y: 0 },
					{ type: "L", x: 50, y: 100 },
				],
				bounds: { xMin: 50, yMin: 0, xMax: 50, yMax: 100 },
			};

			const stroked = strokePath(path, { width: 20 });

			expect(stroked.bounds).not.toBeNull();
			if (stroked.bounds) {
				expect(stroked.bounds.xMin).toBe(40);
				expect(stroked.bounds.xMax).toBe(60);
			}
		});

		test("strokes a diagonal line", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 100 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
			};

			const stroked = strokePath(path, { width: 10 });

			expect(stroked.commands.length).toBeGreaterThan(0);
			// Should start with a move
			expect(stroked.commands[0]?.type).toBe("M");
			// Should end with close
			expect(stroked.commands[stroked.commands.length - 1]?.type).toBe("Z");
		});
	});

	describe("closed paths", () => {
		test("strokes a closed triangle", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 50, y: 0 },
					{ type: "L", x: 100, y: 100 },
					{ type: "L", x: 0, y: 100 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 100 },
			};

			const stroked = strokePath(path, { width: 10 });

			// Closed paths generate two contours (outer and inner)
			const moveCommands = stroked.commands.filter((c) => c.type === "M");
			expect(moveCommands.length).toBe(2);

			// Both should be closed
			const closeCommands = stroked.commands.filter((c) => c.type === "Z");
			expect(closeCommands.length).toBe(2);
		});

		test("strokes a closed rectangle", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
					{ type: "L", x: 100, y: 50 },
					{ type: "L", x: 0, y: 50 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 50 },
			};

			const stroked = strokePath(path, { width: 4 });

			expect(stroked.bounds).not.toBeNull();
			if (stroked.bounds) {
				expect(stroked.bounds.xMin).toBe(-2);
				expect(stroked.bounds.yMin).toBe(-2);
				expect(stroked.bounds.xMax).toBe(102);
				expect(stroked.bounds.yMax).toBe(52);
			}
		});
	});

	describe("line caps", () => {
		const basePath: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "L", x: 100, y: 0 },
			],
			bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 0 },
		};

		test("butt cap (default)", () => {
			const stroked = strokePath(basePath, { width: 10, lineCap: "butt" });

			// Butt cap should not extend beyond the endpoints
			// The bounds should extend by half width perpendicular only
			expect(stroked.commands.length).toBeGreaterThan(0);
		});

		test("round cap", () => {
			const stroked = strokePath(basePath, { width: 10, lineCap: "round" });

			// Round cap uses quadratic curves
			const quadCommands = stroked.commands.filter((c) => c.type === "Q");
			expect(quadCommands.length).toBeGreaterThan(0);
		});

		test("square cap", () => {
			const stroked = strokePath(basePath, { width: 10, lineCap: "square" });

			// Square cap extends by half width
			// Should have more line commands for the square corners
			expect(stroked.commands.length).toBeGreaterThan(0);
		});
	});

	describe("line joins", () => {
		const anglePath: GlyphPath = {
			commands: [
				{ type: "M", x: 0, y: 0 },
				{ type: "L", x: 50, y: 50 },
				{ type: "L", x: 100, y: 0 },
				{ type: "Z" },
			],
			bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 50 },
		};

		test("miter join (default)", () => {
			const stroked = strokePath(anglePath, {
				width: 10,
				lineJoin: "miter",
			});

			expect(stroked.commands.length).toBeGreaterThan(0);
		});

		test("round join", () => {
			const stroked = strokePath(anglePath, {
				width: 10,
				lineJoin: "round",
			});

			// Round join might use more segments
			expect(stroked.commands.length).toBeGreaterThan(0);
		});

		test("bevel join", () => {
			const stroked = strokePath(anglePath, {
				width: 10,
				lineJoin: "bevel",
			});

			expect(stroked.commands.length).toBeGreaterThan(0);
		});

		test("miter limit fallback to bevel", () => {
			// Very sharp angle should fall back to bevel when miter limit is low
			const sharpPath: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 50, y: 5 },
					{ type: "L", x: 100, y: 0 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 5 },
			};

			const stroked = strokePath(sharpPath, {
				width: 10,
				lineJoin: "miter",
				miterLimit: 1,
			});

			expect(stroked.commands.length).toBeGreaterThan(0);
		});
	});

	describe("curve stroking", () => {
		test("strokes quadratic bezier curve", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "Q", x1: 50, y1: 100, x: 100, y: 0 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 50 },
			};

			const stroked = strokePath(path, { width: 5 });

			// Curves are flattened to line segments
			const lineCommands = stroked.commands.filter((c) => c.type === "L");
			expect(lineCommands.length).toBeGreaterThan(4);
		});

		test("strokes cubic bezier curve", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "C", x1: 30, y1: 100, x2: 70, y2: 100, x: 100, y: 0 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 75 },
			};

			const stroked = strokePath(path, { width: 5 });

			// Cubics are flattened to more line segments
			const lineCommands = stroked.commands.filter((c) => c.type === "L");
			expect(lineCommands.length).toBeGreaterThan(8);
		});
	});

	describe("edge cases", () => {
		test("handles empty path", () => {
			const path: GlyphPath = {
				commands: [],
				bounds: null,
			};

			const stroked = strokePath(path, { width: 10 });

			expect(stroked.commands.length).toBe(0);
			expect(stroked.bounds).toBeNull();
		});

		test("handles single point path", () => {
			const path: GlyphPath = {
				commands: [{ type: "M", x: 50, y: 50 }],
				bounds: { xMin: 50, yMin: 50, xMax: 50, yMax: 50 },
			};

			const stroked = strokePath(path, { width: 10 });

			// Single point can't form a stroke
			expect(stroked.commands.length).toBe(0);
		});

		test("handles zero width stroke", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 0 },
			};

			const stroked = strokePath(path, { width: 0 });

			// Zero width stroke should still produce commands
			// but bounds should not expand
			expect(stroked.bounds).not.toBeNull();
			if (stroked.bounds) {
				expect(stroked.bounds.yMin).toBe(0);
				expect(stroked.bounds.yMax).toBe(0);
			}
		});

		test("handles very thin stroke", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 0 },
			};

			const stroked = strokePath(path, { width: 0.5 });

			expect(stroked.bounds).not.toBeNull();
			if (stroked.bounds) {
				expect(stroked.bounds.yMin).toBe(-0.25);
				expect(stroked.bounds.yMax).toBe(0.25);
			}
		});

		test("handles path with multiple contours", () => {
			const path: GlyphPath = {
				commands: [
					// First contour
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 50, y: 0 },
					{ type: "L", x: 50, y: 50 },
					{ type: "L", x: 0, y: 50 },
					{ type: "Z" },
					// Second contour
					{ type: "M", x: 100, y: 0 },
					{ type: "L", x: 150, y: 0 },
					{ type: "L", x: 150, y: 50 },
					{ type: "L", x: 100, y: 50 },
					{ type: "Z" },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 150, yMax: 50 },
			};

			const stroked = strokePath(path, { width: 4 });

			// Each closed contour produces 2 contours (inner + outer)
			// So we should have 4 M commands
			const moveCommands = stroked.commands.filter((c) => c.type === "M");
			expect(moveCommands.length).toBe(4);
		});

		test("handles collinear points", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 50, y: 0 },
					{ type: "L", x: 100, y: 0 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 0 },
			};

			// Should not crash on collinear points (nearly straight join)
			const stroked = strokePath(path, { width: 10 });
			expect(stroked.commands.length).toBeGreaterThan(0);
		});
	});

	describe("stroke width", () => {
		test("different stroke widths produce different bounds", () => {
			const path: GlyphPath = {
				commands: [
					{ type: "M", x: 0, y: 0 },
					{ type: "L", x: 100, y: 0 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 0 },
			};

			const thin = strokePath(path, { width: 2 });
			const thick = strokePath(path, { width: 20 });

			expect(thin.bounds).not.toBeNull();
			expect(thick.bounds).not.toBeNull();
			if (thin.bounds && thick.bounds) {
				expect(thick.bounds.yMin).toBeLessThan(thin.bounds.yMin);
				expect(thick.bounds.yMax).toBeGreaterThan(thin.bounds.yMax);
			}
		});
	});
});

describe("strokePath integration", () => {
	test("stroked path can be used for rasterization", async () => {
		// This tests that the output is valid for the rasterizer
		const { rasterizePath } = await import("../../src/raster/rasterize.ts");

		const path: GlyphPath = {
			commands: [
				{ type: "M", x: 10, y: 10 },
				{ type: "L", x: 90, y: 10 },
				{ type: "L", x: 90, y: 40 },
				{ type: "L", x: 10, y: 40 },
				{ type: "Z" },
			],
			bounds: { xMin: 10, yMin: 10, xMax: 90, yMax: 40 },
		};

		const stroked = strokePath(path, { width: 4 });

		// Rasterize the stroked path
		// Need to account for the stroked bounds when setting up rasterization
		const bounds = stroked.bounds;
		expect(bounds).not.toBeNull();
		if (!bounds) return;

		const width = Math.ceil(bounds.xMax - bounds.xMin) + 4;
		const height = Math.ceil(bounds.yMax - bounds.yMin) + 4;

		const bitmap = rasterizePath(stroked, {
			width,
			height,
			scale: 1,
			offsetX: -bounds.xMin + 2,
			offsetY: height - 2 + bounds.yMin, // Flip Y and offset
			flipY: true,
		});

		expect(bitmap.width).toBe(width);
		expect(bitmap.rows).toBe(height);

		// Should have some pixels filled
		let filledPixels = 0;
		for (const pixel of bitmap.buffer) {
			if (pixel > 0) filledPixels++;
		}
		expect(filledPixels).toBeGreaterThan(0);
	});
});
