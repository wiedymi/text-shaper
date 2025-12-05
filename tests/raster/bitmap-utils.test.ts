import { describe, expect, test } from "bun:test";
import {
	emboldenBitmap,
	convertBitmap,
	blendBitmap,
	copyBitmap,
	resizeBitmap,
} from "../../src/raster/bitmap-utils.ts";
import { createBitmap, PixelMode, type Bitmap } from "../../src/raster/types.ts";

describe("raster/bitmap-utils", () => {
	describe("emboldenBitmap", () => {
		test("increases coverage area horizontally", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const result = emboldenBitmap(bitmap, 1, 0);

			let coverageCount = 0;
			for (let i = 0; i < result.buffer.length; i++) {
				if (result.buffer[i] > 0) coverageCount++;
			}

			expect(coverageCount).toBeGreaterThan(1);
		});

		test("increases coverage area vertically", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const result = emboldenBitmap(bitmap, 0, 1);

			let coverageCount = 0;
			for (let i = 0; i < result.buffer.length; i++) {
				if (result.buffer[i] > 0) coverageCount++;
			}

			expect(coverageCount).toBeGreaterThan(1);
		});

		test("increases coverage area diagonally", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const result = emboldenBitmap(bitmap, 1, 1);

			let coverageCount = 0;
			for (let i = 0; i < result.buffer.length; i++) {
				if (result.buffer[i] > 0) coverageCount++;
			}

			expect(coverageCount).toBeGreaterThan(1);
		});

		test("handles zero strength", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const result = emboldenBitmap(bitmap, 0, 0);

			expect(result.buffer[2 * 5 + 2]).toBe(255);
		});

		test("preserves bitmap dimensions", () => {
			const bitmap = createBitmap(10, 8, PixelMode.Gray);
			const result = emboldenBitmap(bitmap, 2, 1);

			expect(result.width).toBe(10);
			expect(result.rows).toBe(8);
			expect(result.pixelMode).toBe(PixelMode.Gray);
		});

		test("handles edge pixels correctly", () => {
			const bitmap = createBitmap(3, 3, PixelMode.Gray);
			bitmap.buffer[0] = 255;
			bitmap.buffer[2] = 255;
			bitmap.buffer[6] = 255;
			bitmap.buffer[8] = 255;

			const result = emboldenBitmap(bitmap, 1, 1);

			expect(result.width).toBe(3);
			expect(result.rows).toBe(3);
		});

		test("applies maximum of overlapping pixels", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 1] = 100;
			bitmap.buffer[2 * 5 + 2] = 200;

			const result = emboldenBitmap(bitmap, 1, 0);

			expect(result.buffer[2 * 5 + 1]).toBe(200);
			expect(result.buffer[2 * 5 + 2]).toBe(200);
		});

		test("handles full bitmap", () => {
			const bitmap = createBitmap(4, 4, PixelMode.Gray);
			bitmap.buffer.fill(128);

			const result = emboldenBitmap(bitmap, 1, 1);

			expect(result.width).toBe(4);
			expect(result.rows).toBe(4);
		});
	});

	describe("convertBitmap", () => {
		test("converts Gray to Mono with threshold", () => {
			const bitmap = createBitmap(8, 1, PixelMode.Gray);
			bitmap.buffer[0] = 255;
			bitmap.buffer[1] = 200;
			bitmap.buffer[2] = 127;
			bitmap.buffer[3] = 128;
			bitmap.buffer[4] = 64;
			bitmap.buffer[5] = 0;

			const result = convertBitmap(bitmap, PixelMode.Mono);

			expect(result.pixelMode).toBe(PixelMode.Mono);
			expect(result.width).toBe(8);
			expect(result.rows).toBe(1);

			const byte = result.buffer[0];
			expect((byte >> 7) & 1).toBe(1);
			expect((byte >> 6) & 1).toBe(1);
			expect((byte >> 5) & 1).toBe(0);
			expect((byte >> 4) & 1).toBe(1);
			expect((byte >> 3) & 1).toBe(0);
			expect((byte >> 2) & 1).toBe(0);
		});

		test("converts Mono to Gray", () => {
			const bitmap = createBitmap(8, 1, PixelMode.Mono);
			bitmap.buffer[0] = 0b10100000;

			const result = convertBitmap(bitmap, PixelMode.Gray);

			expect(result.pixelMode).toBe(PixelMode.Gray);
			expect(result.width).toBe(8);
			expect(result.rows).toBe(1);
			expect(result.buffer[0]).toBe(255);
			expect(result.buffer[1]).toBe(0);
			expect(result.buffer[2]).toBe(255);
			expect(result.buffer[3]).toBe(0);
		});

		test("converts Gray to LCD", () => {
			const bitmap = createBitmap(2, 2, PixelMode.Gray);
			bitmap.buffer[0] = 255;
			bitmap.buffer[1] = 128;
			bitmap.buffer[2] = 64;
			bitmap.buffer[3] = 0;

			const result = convertBitmap(bitmap, PixelMode.LCD);

			expect(result.pixelMode).toBe(PixelMode.LCD);
			expect(result.width).toBe(2);
			expect(result.rows).toBe(2);
			expect(result.pitch).toBe(2 * 3);

			expect(result.buffer[0]).toBe(255);
			expect(result.buffer[1]).toBe(255);
			expect(result.buffer[2]).toBe(255);

			expect(result.buffer[3]).toBe(128);
			expect(result.buffer[4]).toBe(128);
			expect(result.buffer[5]).toBe(128);
		});

		test("returns same bitmap if already target mode", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[0] = 128;

			const result = convertBitmap(bitmap, PixelMode.Gray);

			expect(result).toBe(bitmap);
		});

		test("preserves dimensions after conversion", () => {
			const bitmap = createBitmap(10, 8, PixelMode.Gray);
			const result = convertBitmap(bitmap, PixelMode.Mono);

			expect(result.width).toBe(10);
			expect(result.rows).toBe(8);
		});

		test("handles empty bitmap", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);

			const result = convertBitmap(bitmap, PixelMode.Mono);

			expect(result.width).toBe(5);
			expect(result.rows).toBe(5);
		});

		test("converts Mono to LCD", () => {
			const bitmap = createBitmap(8, 1, PixelMode.Mono);
			bitmap.buffer[0] = 0b10000000;

			const result = convertBitmap(bitmap, PixelMode.LCD);

			expect(result.pixelMode).toBe(PixelMode.LCD);
			expect(result.buffer[0]).toBe(255);
			expect(result.buffer[1]).toBe(255);
			expect(result.buffer[2]).toBe(255);
		});
	});

	describe("blendBitmap", () => {
		test("blends src onto dst at origin", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(255);

			blendBitmap(dst, src, 0, 0, 1.0);

			expect(dst.buffer[0]).toBe(255);
			expect(dst.buffer[1]).toBe(255);
			expect(dst.buffer[2]).toBe(255);
		});

		test("blends src onto dst at offset", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(2, 2, PixelMode.Gray);
			src.buffer.fill(255);

			blendBitmap(dst, src, 2, 2, 1.0);

			expect(dst.buffer[2 * 5 + 2]).toBe(255);
			expect(dst.buffer[2 * 5 + 3]).toBe(255);
			expect(dst.buffer[3 * 5 + 2]).toBe(255);
			expect(dst.buffer[3 * 5 + 3]).toBe(255);
		});

		test("respects opacity", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(255);

			blendBitmap(dst, src, 0, 0, 0.5);

			expect(dst.buffer[0]).toBeCloseTo(127, 1);
		});

		test("clips src to dst bounds", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(255);

			blendBitmap(dst, src, 4, 4, 1.0);

			expect(dst.buffer[4 * 5 + 4]).toBe(255);
		});

		test("handles negative offset", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(255);

			blendBitmap(dst, src, -1, -1, 1.0);

			expect(dst.buffer[0]).toBe(255);
			expect(dst.buffer[1]).toBe(255);
		});

		test("blends over existing content", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);

			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(100);

			blendBitmap(dst, src, 0, 0, 1.0);

			expect(dst.buffer[0]).toBeGreaterThan(100);
		});

		test("handles zero opacity", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(255);

			blendBitmap(dst, src, 0, 0, 0.0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("handles full opacity", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(50);

			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(200);

			blendBitmap(dst, src, 0, 0, 1.0);

			expect(dst.buffer[0]).toBeGreaterThan(50);
		});

		test("does nothing when src is outside dst", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(2, 2, PixelMode.Gray);
			src.buffer.fill(255);

			blendBitmap(dst, src, 10, 10, 1.0);

			for (let i = 0; i < dst.buffer.length; i++) {
				expect(dst.buffer[i]).toBe(0);
			}
		});
	});

	describe("copyBitmap", () => {
		test("creates independent copy", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[0] = 128;

			const copy = copyBitmap(bitmap);

			expect(copy.width).toBe(bitmap.width);
			expect(copy.rows).toBe(bitmap.rows);
			expect(copy.pixelMode).toBe(bitmap.pixelMode);
			expect(copy.buffer[0]).toBe(128);

			bitmap.buffer[0] = 255;
			expect(copy.buffer[0]).toBe(128);
		});

		test("copies all pixel modes", () => {
			const gray = createBitmap(5, 5, PixelMode.Gray);
			const mono = createBitmap(5, 5, PixelMode.Mono);
			const lcd = createBitmap(5, 5, PixelMode.LCD);

			const grayC = copyBitmap(gray);
			const monoC = copyBitmap(mono);
			const lcdC = copyBitmap(lcd);

			expect(grayC.pixelMode).toBe(PixelMode.Gray);
			expect(monoC.pixelMode).toBe(PixelMode.Mono);
			expect(lcdC.pixelMode).toBe(PixelMode.LCD);
		});

		test("copies buffer data", () => {
			const bitmap = createBitmap(3, 3, PixelMode.Gray);
			for (let i = 0; i < bitmap.buffer.length; i++) {
				bitmap.buffer[i] = i;
			}

			const copy = copyBitmap(bitmap);

			for (let i = 0; i < bitmap.buffer.length; i++) {
				expect(copy.buffer[i]).toBe(i);
			}
		});

		test("preserves pitch", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			const copy = copyBitmap(bitmap);

			expect(copy.pitch).toBe(bitmap.pitch);
		});

		test("preserves numGrays", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Mono);
			const copy = copyBitmap(bitmap);

			expect(copy.numGrays).toBe(2);
		});
	});

	describe("resizeBitmap", () => {
		test("changes dimensions correctly", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			const result = resizeBitmap(bitmap, 10, 10);

			expect(result.width).toBe(10);
			expect(result.rows).toBe(10);
		});

		test("downscales bitmap", () => {
			const bitmap = createBitmap(10, 10, PixelMode.Gray);
			bitmap.buffer.fill(255);

			const result = resizeBitmap(bitmap, 5, 5);

			expect(result.width).toBe(5);
			expect(result.rows).toBe(5);
		});

		test("upscales bitmap", () => {
			const bitmap = createBitmap(2, 2, PixelMode.Gray);
			bitmap.buffer[0] = 255;
			bitmap.buffer[1] = 128;
			bitmap.buffer[2] = 64;
			bitmap.buffer[3] = 0;

			const result = resizeBitmap(bitmap, 4, 4);

			expect(result.width).toBe(4);
			expect(result.rows).toBe(4);
			expect(result.buffer[0]).toBe(255);
		});

		test("preserves pixel mode", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			const result = resizeBitmap(bitmap, 10, 10);

			expect(result.pixelMode).toBe(PixelMode.Gray);
		});

		test("handles 1x1 resize", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const result = resizeBitmap(bitmap, 1, 1);

			expect(result.width).toBe(1);
			expect(result.rows).toBe(1);
		});

		test("handles same size", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer.fill(128);

			const result = resizeBitmap(bitmap, 5, 5);

			expect(result.width).toBe(5);
			expect(result.rows).toBe(5);
		});

		test("works with Mono bitmaps", () => {
			const bitmap = createBitmap(4, 4, PixelMode.Mono);
			const result = resizeBitmap(bitmap, 8, 8);

			expect(result.width).toBe(8);
			expect(result.rows).toBe(8);
			expect(result.pixelMode).toBe(PixelMode.Mono);
		});

		test("works with LCD bitmaps", () => {
			const bitmap = createBitmap(5, 5, PixelMode.LCD);
			const result = resizeBitmap(bitmap, 10, 10);

			expect(result.width).toBe(10);
			expect(result.rows).toBe(10);
			expect(result.pixelMode).toBe(PixelMode.LCD);
		});
	});

	describe("integration tests", () => {
		test("embolden and convert", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const bold = emboldenBitmap(bitmap, 1, 1);
			const mono = convertBitmap(bold, PixelMode.Mono);

			expect(mono.pixelMode).toBe(PixelMode.Mono);
		});

		test("copy and blend", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer.fill(100);

			const copy1 = copyBitmap(bitmap);
			const copy2 = copyBitmap(bitmap);

			blendBitmap(copy1, copy2, 0, 0, 0.5);

			expect(copy1.buffer[0]).toBeGreaterThan(100);
			expect(copy2.buffer[0]).toBe(100);
		});

		test("resize and embolden", () => {
			const bitmap = createBitmap(3, 3, PixelMode.Gray);
			bitmap.buffer[1 * 3 + 1] = 255;

			const resized = resizeBitmap(bitmap, 6, 6);
			const bold = emboldenBitmap(resized, 1, 1);

			expect(bold.width).toBe(6);
			expect(bold.rows).toBe(6);
		});

		test("full pipeline: copy, embolden, convert, resize", () => {
			const bitmap = createBitmap(4, 4, PixelMode.Gray);
			bitmap.buffer[1 * 4 + 1] = 200;
			bitmap.buffer[2 * 4 + 2] = 200;

			const copy = copyBitmap(bitmap);
			const bold = emboldenBitmap(copy, 1, 1);
			const lcd = convertBitmap(bold, PixelMode.LCD);
			const resized = resizeBitmap(lcd, 8, 8);

			expect(resized.width).toBe(8);
			expect(resized.rows).toBe(8);
			expect(resized.pixelMode).toBe(PixelMode.LCD);
		});
	});
});
