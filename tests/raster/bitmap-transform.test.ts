import { describe, expect, test } from "bun:test";
import {
	emboldenBitmapWithBearing,
	expandRasterMetrics,
	measureRasterGlyph,
	shearBitmapX,
	shearBitmapY,
	transformBitmap2D,
	transformBitmap3D,
} from "../../src/raster/bitmap-utils.ts";
import { createBitmap, PixelMode } from "../../src/raster/types.ts";

describe("raster/bitmap-transform", () => {
	test("transformBitmap2D identity preserves bitmap and bearing", () => {
		const bitmap = createBitmap(3, 3, PixelMode.Gray);
		bitmap.buffer[0] = 10;
		bitmap.buffer[4] = 200;
		bitmap.buffer[8] = 50;

		const result = transformBitmap2D(bitmap, [1, 0, 0, 1, 0, 0], {
			bearingX: 2,
			bearingY: 5,
		});

		expect(result.bearingX).toBe(2);
		expect(result.bearingY).toBe(5);
		expect(result.bitmap.width).toBe(3);
		expect(result.bitmap.rows).toBe(3);
		expect(Array.from(result.bitmap.buffer)).toEqual(Array.from(bitmap.buffer));
	});

	test("transformBitmap2D subpixel translation preserves coverage", () => {
		const bitmap = createBitmap(1, 1, PixelMode.Gray);
		bitmap.buffer[0] = 255;

		const result = transformBitmap2D(bitmap, [1, 0, 0, 1, 0, 0], {
			bearingX: 0,
			bearingY: 1,
			offsetX26: 32, // 0.5px
			offsetY26: 32,
		});

		expect(result.bitmap.width).toBeGreaterThanOrEqual(1);
		expect(result.bitmap.rows).toBeGreaterThanOrEqual(1);

		let sum = 0;
		for (const v of result.bitmap.buffer) sum += v;
		expect(sum).toBeGreaterThan(200);
		expect(sum).toBeLessThan(320);
	});

	test("transformBitmap3D identity preserves bitmap and bearing", () => {
		const bitmap = createBitmap(2, 2, PixelMode.Gray);
		bitmap.buffer[0] = 255;
		bitmap.buffer[3] = 128;

		const result = transformBitmap3D(
			bitmap,
			[
				[1, 0, 0],
				[0, 1, 0],
				[0, 0, 1],
			],
			{ bearingX: 1, bearingY: 2 },
		);

		expect(result.bearingX).toBe(1);
		expect(result.bearingY).toBe(2);
		expect(result.bitmap.width).toBe(2);
		expect(result.bitmap.rows).toBe(2);
		expect(Array.from(result.bitmap.buffer)).toEqual(Array.from(bitmap.buffer));
	});

	test("shearBitmapX/Y with zero amount preserves bitmap", () => {
		const bitmap = createBitmap(2, 2, PixelMode.Gray);
		bitmap.buffer[0] = 255;
		bitmap.buffer[3] = 128;

		const shearX = shearBitmapX(bitmap, 0, { bearingX: 0, bearingY: 2 });
		const shearY = shearBitmapY(bitmap, 0, { bearingX: 0, bearingY: 2 });

		expect(shearX.bitmap.width).toBe(2);
		expect(shearX.bitmap.rows).toBe(2);
		expect(Array.from(shearX.bitmap.buffer)).toEqual(Array.from(bitmap.buffer));

		expect(shearY.bitmap.width).toBe(2);
		expect(shearY.bitmap.rows).toBe(2);
		expect(Array.from(shearY.bitmap.buffer)).toEqual(Array.from(bitmap.buffer));
	});

	test("measureRasterGlyph returns ascent/descent from non-empty rows", () => {
		const bitmap = createBitmap(4, 4, PixelMode.Gray);
		bitmap.buffer[1 * bitmap.pitch + 1] = 255; // row 1
		bitmap.buffer[3 * bitmap.pitch + 2] = 255; // row 3

		const metrics = measureRasterGlyph(bitmap, 2, 3);
		expect(metrics.ascent).toBe(2); // 3 - 1
		expect(metrics.descent).toBe(1); // (3 + 1) - 3
	});

	test("expandRasterMetrics pads metrics for blur/border/shadow", () => {
		const expanded = expandRasterMetrics(
			{
				width: 10,
				height: 8,
				bearingX: -1,
				bearingY: 6,
				ascent: 6,
				descent: 2,
			},
			{ blur: 2, border: 1, shadowX: 3, shadowY: -2 },
		);

		expect(expanded.width).toBe(19);
		expect(expanded.height).toBe(16);
		expect(expanded.bearingX).toBe(-4);
		expect(expanded.bearingY).toBe(11);
		expect(expanded.ascent).toBe(11);
		expect(expanded.descent).toBe(5);
	});

	test("emboldenBitmapWithBearing pads and updates bearing", () => {
		const bitmap = createBitmap(3, 3, PixelMode.Gray);
		const result = emboldenBitmapWithBearing(bitmap, 1, 2, 1, 2);

		expect(result.bitmap.width).toBe(5);
		expect(result.bitmap.rows).toBe(7);
		expect(result.bearingX).toBe(0);
		expect(result.bearingY).toBe(4);
	});
});
