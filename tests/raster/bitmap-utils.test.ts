import { describe, expect, test } from "bun:test";
import {
	emboldenBitmap,
	convertBitmap,
	blendBitmap,
	copyBitmap,
	resizeBitmap,
	resizeBitmapBilinear,
	addBitmaps,
	mulBitmaps,
	subBitmaps,
	compositeBitmaps,
	shiftBitmap,
	fixOutline,
	maxBitmaps,
	padBitmap,
	expandToFit,
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

	describe("emboldenBitmap - Mono mode", () => {
		test("emboldens Mono bitmap horizontally", () => {
			const bitmap = createBitmap(8, 3, PixelMode.Mono);
			const byteIdx = 1 * bitmap.pitch + 0;
			bitmap.buffer[byteIdx] = 0b00010000;

			const result = emboldenBitmap(bitmap, 1, 0);

			expect(result.pixelMode).toBe(PixelMode.Mono);
			expect(result.width).toBe(8);
			expect(result.rows).toBe(3);
		});

		test("emboldens Mono bitmap vertically", () => {
			const bitmap = createBitmap(8, 3, PixelMode.Mono);
			const byteIdx = 1 * bitmap.pitch + 0;
			bitmap.buffer[byteIdx] = 0b10000000;

			const result = emboldenBitmap(bitmap, 0, 1);

			expect(result.pixelMode).toBe(PixelMode.Mono);
			const resultByte0 = result.buffer[0 * result.pitch + 0];
			const resultByte1 = result.buffer[1 * result.pitch + 0];
			const resultByte2 = result.buffer[2 * result.pitch + 0];

			expect(resultByte0 | resultByte1 | resultByte2).toBeGreaterThan(0);
		});

		test("emboldens Mono bitmap diagonally", () => {
			const bitmap = createBitmap(8, 3, PixelMode.Mono);
			const byteIdx = 1 * bitmap.pitch + 0;
			bitmap.buffer[byteIdx] = 0b00100000;

			const result = emboldenBitmap(bitmap, 1, 1);

			expect(result.pixelMode).toBe(PixelMode.Mono);
		});
	});

	describe("emboldenBitmap - LCD mode", () => {
		test("emboldens LCD bitmap horizontally", () => {
			const bitmap = createBitmap(5, 5, PixelMode.LCD);
			const idx = 2 * bitmap.pitch + 2 * 3;
			bitmap.buffer[idx] = 255;
			bitmap.buffer[idx + 1] = 128;
			bitmap.buffer[idx + 2] = 64;

			const result = emboldenBitmap(bitmap, 1, 0);

			expect(result.pixelMode).toBe(PixelMode.LCD);
			expect(result.width).toBe(5);
			expect(result.rows).toBe(5);
		});

		test("emboldens LCD bitmap vertically", () => {
			const bitmap = createBitmap(5, 5, PixelMode.LCD);
			const idx = 2 * bitmap.pitch + 2 * 3;
			bitmap.buffer[idx] = 255;
			bitmap.buffer[idx + 1] = 200;
			bitmap.buffer[idx + 2] = 150;

			const result = emboldenBitmap(bitmap, 0, 1);

			expect(result.pixelMode).toBe(PixelMode.LCD);
			let hasNonZero = false;
			for (let i = 0; i < result.buffer.length; i++) {
				if (result.buffer[i] > 0) hasNonZero = true;
			}
			expect(hasNonZero).toBe(true);
		});

		test("emboldens LCD bitmap diagonally", () => {
			const bitmap = createBitmap(5, 5, PixelMode.LCD);
			const idx = 2 * bitmap.pitch + 2 * 3;
			bitmap.buffer[idx] = 100;
			bitmap.buffer[idx + 1] = 150;
			bitmap.buffer[idx + 2] = 200;

			const result = emboldenBitmap(bitmap, 1, 1);

			expect(result.pixelMode).toBe(PixelMode.LCD);
		});

		test("emboldens LCD_V bitmap", () => {
			const bitmap = createBitmap(5, 5, PixelMode.LCD_V);
			const idx = 2 * bitmap.pitch + 2 * 3;
			bitmap.buffer[idx] = 255;
			bitmap.buffer[idx + 1] = 128;
			bitmap.buffer[idx + 2] = 64;

			const result = emboldenBitmap(bitmap, 1, 1);

			expect(result.pixelMode).toBe(PixelMode.LCD_V);
		});
	});

	describe("convertBitmap - additional modes", () => {
		test("converts Gray to LCD_V", () => {
			const bitmap = createBitmap(2, 2, PixelMode.Gray);
			bitmap.buffer[0] = 255;
			bitmap.buffer[1] = 128;

			const result = convertBitmap(bitmap, PixelMode.LCD_V);

			expect(result.pixelMode).toBe(PixelMode.LCD_V);
			expect(result.buffer[0]).toBe(255);
			expect(result.buffer[1]).toBe(255);
			expect(result.buffer[2]).toBe(255);
			expect(result.buffer[3]).toBe(128);
			expect(result.buffer[4]).toBe(128);
			expect(result.buffer[5]).toBe(128);
		});

		test("converts LCD to Gray", () => {
			const bitmap = createBitmap(2, 2, PixelMode.LCD);
			const idx0 = 0;
			bitmap.buffer[idx0] = 255;
			bitmap.buffer[idx0 + 1] = 150;
			bitmap.buffer[idx0 + 2] = 90;

			const idx1 = 3;
			bitmap.buffer[idx1] = 60;
			bitmap.buffer[idx1 + 1] = 90;
			bitmap.buffer[idx1 + 2] = 120;

			const result = convertBitmap(bitmap, PixelMode.Gray);

			expect(result.pixelMode).toBe(PixelMode.Gray);
			expect(result.width).toBe(2);
			expect(result.rows).toBe(2);
			expect(result.buffer[0]).toBe(Math.floor((255 + 150 + 90) / 3));
			expect(result.buffer[1]).toBe(Math.floor((60 + 90 + 120) / 3));
		});
	});

	describe("blendBitmap - edge cases", () => {
		test("returns early if dst is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Mono);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(255);

			blendBitmap(dst, src, 0, 0, 1.0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("returns early if src is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Mono);

			blendBitmap(dst, src, 0, 0, 1.0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("clamps opacity above 1", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(100);

			blendBitmap(dst, src, 0, 0, 2.0);

			expect(dst.buffer[0]).toBe(100);
		});

		test("clamps opacity below 0", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(50);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(100);

			blendBitmap(dst, src, 0, 0, -0.5);

			expect(dst.buffer[0]).toBe(50);
		});

		test("clamps blended value to 255", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(200);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(200);

			blendBitmap(dst, src, 0, 0, 1.0);

			expect(dst.buffer[0]).toBe(255);
		});
	});

	describe("resizeBitmap - Mono mode", () => {
		test("resizes Mono bitmap with upscaling", () => {
			const bitmap = createBitmap(8, 2, PixelMode.Mono);
			bitmap.buffer[0] = 0b10000000;

			const result = resizeBitmap(bitmap, 16, 4);

			expect(result.pixelMode).toBe(PixelMode.Mono);
			expect(result.width).toBe(16);
			expect(result.rows).toBe(4);
		});

		test("resizes Mono bitmap with downscaling", () => {
			const bitmap = createBitmap(16, 4, PixelMode.Mono);
			bitmap.buffer[0] = 0b11000000;

			const result = resizeBitmap(bitmap, 8, 2);

			expect(result.pixelMode).toBe(PixelMode.Mono);
			expect(result.width).toBe(8);
			expect(result.rows).toBe(2);
		});
	});

	describe("resizeBitmap - LCD mode", () => {
		test("resizes LCD bitmap", () => {
			const bitmap = createBitmap(2, 2, PixelMode.LCD);
			const idx = 0;
			bitmap.buffer[idx] = 255;
			bitmap.buffer[idx + 1] = 128;
			bitmap.buffer[idx + 2] = 64;

			const result = resizeBitmap(bitmap, 4, 4);

			expect(result.pixelMode).toBe(PixelMode.LCD);
			expect(result.width).toBe(4);
			expect(result.rows).toBe(4);
		});

		test("resizes LCD_V bitmap", () => {
			const bitmap = createBitmap(3, 3, PixelMode.LCD_V);
			const result = resizeBitmap(bitmap, 6, 6);

			expect(result.pixelMode).toBe(PixelMode.LCD_V);
			expect(result.width).toBe(6);
			expect(result.rows).toBe(6);
		});
	});

	describe("resizeBitmapBilinear", () => {
		test("resizes Gray bitmap with bilinear interpolation", () => {
			const bitmap = createBitmap(2, 2, PixelMode.Gray);
			bitmap.buffer[0] = 0;
			bitmap.buffer[1] = 255;
			bitmap.buffer[2] = 255;
			bitmap.buffer[3] = 0;

			const result = resizeBitmapBilinear(bitmap, 4, 4);

			expect(result.width).toBe(4);
			expect(result.rows).toBe(4);
			expect(result.pixelMode).toBe(PixelMode.Gray);
		});

		test("resizes Gray bitmap downscaling", () => {
			const bitmap = createBitmap(4, 4, PixelMode.Gray);
			bitmap.buffer.fill(128);

			const result = resizeBitmapBilinear(bitmap, 2, 2);

			expect(result.width).toBe(2);
			expect(result.rows).toBe(2);
		});

		test("handles 1x1 to 1x1 resize", () => {
			const bitmap = createBitmap(1, 1, PixelMode.Gray);
			bitmap.buffer[0] = 200;

			const result = resizeBitmapBilinear(bitmap, 1, 1);

			expect(result.width).toBe(1);
			expect(result.rows).toBe(1);
		});

		test("falls back to nearest-neighbor for Mono bitmaps", () => {
			const bitmap = createBitmap(8, 2, PixelMode.Mono);
			bitmap.buffer[0] = 0b10000000;

			const result = resizeBitmapBilinear(bitmap, 16, 4);

			expect(result.pixelMode).toBe(PixelMode.Mono);
			expect(result.width).toBe(16);
			expect(result.rows).toBe(4);
		});

		test("resizes LCD bitmap with bilinear interpolation", () => {
			const bitmap = createBitmap(2, 2, PixelMode.LCD);
			const idx0 = 0;
			bitmap.buffer[idx0] = 255;
			bitmap.buffer[idx0 + 1] = 0;
			bitmap.buffer[idx0 + 2] = 0;

			const idx1 = 3;
			bitmap.buffer[idx1] = 0;
			bitmap.buffer[idx1 + 1] = 255;
			bitmap.buffer[idx1 + 2] = 0;

			const result = resizeBitmapBilinear(bitmap, 4, 4);

			expect(result.width).toBe(4);
			expect(result.rows).toBe(4);
			expect(result.pixelMode).toBe(PixelMode.LCD);
		});

		test("resizes LCD_V bitmap with bilinear interpolation", () => {
			const bitmap = createBitmap(2, 2, PixelMode.LCD_V);
			bitmap.buffer.fill(100);

			const result = resizeBitmapBilinear(bitmap, 3, 3);

			expect(result.width).toBe(3);
			expect(result.rows).toBe(3);
			expect(result.pixelMode).toBe(PixelMode.LCD_V);
		});
	});

	describe("addBitmaps", () => {
		test("adds two Gray bitmaps at origin", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(50);

			addBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(150);
			expect(dst.buffer[12]).toBe(150);
		});

		test("clamps sum to 255", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(200);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(100);

			addBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(255);
		});

		test("returns early if dst is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Mono);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(100);

			addBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("returns early if src is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.LCD);

			addBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("handles offset placement", () => {
			const dst = createBitmap(10, 10, PixelMode.Gray);
			dst.buffer.fill(50);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(50);

			addBitmaps(dst, src, 2, 2);

			expect(dst.buffer[2 * 10 + 2]).toBe(100);
			expect(dst.buffer[0]).toBe(50);
		});

		test("handles negative offset", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(50);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(50);

			addBitmaps(dst, src, -2, -2);

			expect(dst.buffer[0]).toBe(100);
		});

		test("clips to dst bounds", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(50);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(50);

			addBitmaps(dst, src, 3, 3);

			expect(dst.buffer[3 * 5 + 3]).toBe(100);
			expect(dst.buffer[4 * 5 + 4]).toBe(100);
		});
	});

	describe("mulBitmaps", () => {
		test("multiplies two Gray bitmaps", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(255);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(128);

			mulBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBeGreaterThan(0);
			expect(dst.buffer[0]).toBeLessThan(255);
		});

		test("multiplying by 0 gives 0", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(255);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(0);

			mulBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("returns early if dst is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.LCD);
			const src = createBitmap(3, 3, PixelMode.Gray);

			mulBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("returns early if src is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Mono);

			mulBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("handles offset placement", () => {
			const dst = createBitmap(10, 10, PixelMode.Gray);
			dst.buffer.fill(255);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(128);

			mulBitmaps(dst, src, 2, 2);

			expect(dst.buffer[2 * 10 + 2]).toBeLessThan(255);
			expect(dst.buffer[0]).toBe(255);
		});

		test("handles negative offset", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(200);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(100);

			mulBitmaps(dst, src, -1, -1);

			expect(dst.buffer[0]).toBeLessThan(200);
		});
	});

	describe("subBitmaps", () => {
		test("subtracts src from dst", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(200);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(50);

			subBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(150);
		});

		test("clamps result to 0", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(50);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(100);

			subBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("returns early if dst is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Mono);
			const src = createBitmap(3, 3, PixelMode.Gray);

			subBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("returns early if src is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.LCD);

			subBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("handles offset placement", () => {
			const dst = createBitmap(10, 10, PixelMode.Gray);
			dst.buffer.fill(200);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(50);

			subBitmaps(dst, src, 2, 2);

			expect(dst.buffer[2 * 10 + 2]).toBe(150);
			expect(dst.buffer[0]).toBe(200);
		});

		test("handles negative offset", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(30);

			subBitmaps(dst, src, -1, -1);

			expect(dst.buffer[0]).toBe(70);
		});
	});

	describe("compositeBitmaps", () => {
		test("composites src over dst", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(128);

			compositeBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBeGreaterThan(128);
		});

		test("full opacity src replaces dst", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(255);

			compositeBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(255);
		});

		test("zero opacity src leaves dst unchanged", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(0);

			compositeBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(100);
		});

		test("returns early if dst is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.LCD);
			const src = createBitmap(3, 3, PixelMode.Gray);

			compositeBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("returns early if src is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Mono);

			compositeBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("handles offset placement", () => {
			const dst = createBitmap(10, 10, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(128);

			compositeBitmaps(dst, src, 2, 2);

			expect(dst.buffer[2 * 10 + 2]).toBeGreaterThan(128);
			expect(dst.buffer[0]).toBe(100);
		});

		test("handles negative offset", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(128);

			compositeBitmaps(dst, src, -1, -1);

			expect(dst.buffer[0]).toBeGreaterThan(128);
		});

		test("clamps result to 255", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(200);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(255);

			compositeBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(255);
		});
	});

	describe("shiftBitmap", () => {
		test("shifts Gray bitmap right", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 1] = 255;

			const result = shiftBitmap(bitmap, 1, 0);

			expect(result.buffer[2 * 5 + 1]).toBe(0);
			expect(result.buffer[2 * 5 + 2]).toBe(255);
		});

		test("shifts Gray bitmap left", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const result = shiftBitmap(bitmap, -1, 0);

			expect(result.buffer[2 * 5 + 2]).toBe(0);
			expect(result.buffer[2 * 5 + 1]).toBe(255);
		});

		test("shifts Gray bitmap down", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[1 * 5 + 2] = 255;

			const result = shiftBitmap(bitmap, 0, 1);

			expect(result.buffer[1 * 5 + 2]).toBe(0);
			expect(result.buffer[2 * 5 + 2]).toBe(255);
		});

		test("shifts Gray bitmap up", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const result = shiftBitmap(bitmap, 0, -1);

			expect(result.buffer[2 * 5 + 2]).toBe(0);
			expect(result.buffer[1 * 5 + 2]).toBe(255);
		});

		test("shifts Mono bitmap", () => {
			const bitmap = createBitmap(8, 3, PixelMode.Mono);
			bitmap.buffer[1 * bitmap.pitch] = 0b10000000;

			const result = shiftBitmap(bitmap, 1, 0);

			expect(result.pixelMode).toBe(PixelMode.Mono);
			const resultByte = result.buffer[1 * result.pitch];
			expect((resultByte >> 6) & 1).toBe(1);
		});

		test("shifts Mono bitmap vertically", () => {
			const bitmap = createBitmap(8, 4, PixelMode.Mono);
			bitmap.buffer[1 * bitmap.pitch] = 0b10000000;

			const result = shiftBitmap(bitmap, 0, 1);

			expect(result.pixelMode).toBe(PixelMode.Mono);
		});

		test("shifts LCD bitmap", () => {
			const bitmap = createBitmap(5, 5, PixelMode.LCD);
			const idx = 2 * bitmap.pitch + 2 * 3;
			bitmap.buffer[idx] = 255;
			bitmap.buffer[idx + 1] = 128;
			bitmap.buffer[idx + 2] = 64;

			const result = shiftBitmap(bitmap, 1, 0);

			expect(result.pixelMode).toBe(PixelMode.LCD);
			const resultIdx = 2 * result.pitch + 3 * 3;
			expect(result.buffer[resultIdx]).toBe(255);
			expect(result.buffer[resultIdx + 1]).toBe(128);
			expect(result.buffer[resultIdx + 2]).toBe(64);
		});

		test("shifts LCD_V bitmap", () => {
			const bitmap = createBitmap(5, 5, PixelMode.LCD_V);
			const idx = 2 * bitmap.pitch + 2 * 3;
			bitmap.buffer[idx] = 100;
			bitmap.buffer[idx + 1] = 150;
			bitmap.buffer[idx + 2] = 200;

			const result = shiftBitmap(bitmap, 0, 1);

			expect(result.pixelMode).toBe(PixelMode.LCD_V);
		});

		test("handles shift out of bounds", () => {
			const bitmap = createBitmap(5, 5, PixelMode.Gray);
			bitmap.buffer[2 * 5 + 2] = 255;

			const result = shiftBitmap(bitmap, 10, 0);

			let hasNonZero = false;
			for (let i = 0; i < result.buffer.length; i++) {
				if (result.buffer[i] > 0) hasNonZero = true;
			}
			expect(hasNonZero).toBe(false);
		});
	});

	describe("fixOutline", () => {
		test("removes glyph interior from outline", () => {
			const outline = createBitmap(5, 5, PixelMode.Gray);
			outline.buffer.fill(128);
			const glyph = createBitmap(3, 3, PixelMode.Gray);
			glyph.buffer.fill(255);

			fixOutline(outline, glyph, 1, 1, 128);

			expect(outline.buffer[1 * 5 + 1]).toBe(0);
			expect(outline.buffer[2 * 5 + 2]).toBe(0);
			expect(outline.buffer[0]).toBe(128);
		});

		test("uses threshold to decide removal", () => {
			const outline = createBitmap(5, 5, PixelMode.Gray);
			outline.buffer.fill(100);
			const glyph = createBitmap(3, 3, PixelMode.Gray);
			glyph.buffer.fill(100);

			fixOutline(outline, glyph, 1, 1, 128);

			expect(outline.buffer[1 * 5 + 1]).toBe(100);
		});

		test("returns early if outline is not Gray", () => {
			const outline = createBitmap(5, 5, PixelMode.Mono);
			const glyph = createBitmap(3, 3, PixelMode.Gray);
			glyph.buffer.fill(255);

			fixOutline(outline, glyph, 0, 0, 128);

			expect(outline.buffer[0]).toBe(0);
		});

		test("returns early if glyph is not Gray", () => {
			const outline = createBitmap(5, 5, PixelMode.Gray);
			outline.buffer.fill(100);
			const glyph = createBitmap(3, 3, PixelMode.LCD);

			fixOutline(outline, glyph, 0, 0, 128);

			expect(outline.buffer[0]).toBe(100);
		});

		test("handles offset placement", () => {
			const outline = createBitmap(10, 10, PixelMode.Gray);
			outline.buffer.fill(128);
			const glyph = createBitmap(3, 3, PixelMode.Gray);
			glyph.buffer.fill(255);

			fixOutline(outline, glyph, 2, 2, 128);

			expect(outline.buffer[2 * 10 + 2]).toBe(0);
			expect(outline.buffer[0]).toBe(128);
		});

		test("handles negative offset", () => {
			const outline = createBitmap(5, 5, PixelMode.Gray);
			outline.buffer.fill(128);
			const glyph = createBitmap(5, 5, PixelMode.Gray);
			glyph.buffer.fill(255);

			fixOutline(outline, glyph, -1, -1, 128);

			expect(outline.buffer[0]).toBe(0);
		});
	});

	describe("maxBitmaps", () => {
		test("takes maximum of two bitmaps", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(150);

			maxBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(150);
		});

		test("preserves larger dst values", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(200);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(100);

			maxBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(200);
		});

		test("returns early if dst is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.LCD);
			const src = createBitmap(3, 3, PixelMode.Gray);

			maxBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("returns early if src is not Gray", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			const src = createBitmap(3, 3, PixelMode.Mono);

			maxBitmaps(dst, src, 0, 0);

			expect(dst.buffer[0]).toBe(0);
		});

		test("handles offset placement", () => {
			const dst = createBitmap(10, 10, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(150);

			maxBitmaps(dst, src, 2, 2);

			expect(dst.buffer[2 * 10 + 2]).toBe(150);
			expect(dst.buffer[0]).toBe(100);
		});

		test("handles negative offset", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(5, 5, PixelMode.Gray);
			src.buffer.fill(150);

			maxBitmaps(dst, src, -1, -1);

			expect(dst.buffer[0]).toBe(150);
		});
	});

	describe("padBitmap", () => {
		test("pads Gray bitmap on all sides", () => {
			const bitmap = createBitmap(3, 3, PixelMode.Gray);
			bitmap.buffer.fill(255);

			const result = padBitmap(bitmap, 1, 1, 1, 1);

			expect(result.width).toBe(5);
			expect(result.rows).toBe(5);
			expect(result.pixelMode).toBe(PixelMode.Gray);
			expect(result.buffer[1 * 5 + 1]).toBe(255);
			expect(result.buffer[0]).toBe(0);
		});

		test("pads with different amounts per side", () => {
			const bitmap = createBitmap(2, 2, PixelMode.Gray);
			bitmap.buffer.fill(128);

			const result = padBitmap(bitmap, 2, 1, 3, 2);

			expect(result.width).toBe(2 + 2 + 3);
			expect(result.rows).toBe(2 + 1 + 2);
			expect(result.buffer[(1) * result.pitch + 2]).toBe(128);
		});

		test("pads LCD bitmap", () => {
			const bitmap = createBitmap(2, 2, PixelMode.LCD);
			const idx = 0;
			bitmap.buffer[idx] = 255;
			bitmap.buffer[idx + 1] = 128;
			bitmap.buffer[idx + 2] = 64;

			const result = padBitmap(bitmap, 1, 1, 1, 1);

			expect(result.width).toBe(4);
			expect(result.rows).toBe(4);
			expect(result.pixelMode).toBe(PixelMode.LCD);
			const resultIdx = 1 * result.pitch + 1 * 3;
			expect(result.buffer[resultIdx]).toBe(255);
			expect(result.buffer[resultIdx + 1]).toBe(128);
			expect(result.buffer[resultIdx + 2]).toBe(64);
		});

		test("pads LCD_V bitmap", () => {
			const bitmap = createBitmap(2, 2, PixelMode.LCD_V);
			bitmap.buffer.fill(100);

			const result = padBitmap(bitmap, 1, 1, 1, 1);

			expect(result.width).toBe(4);
			expect(result.rows).toBe(4);
			expect(result.pixelMode).toBe(PixelMode.LCD_V);
		});

		test("handles zero padding", () => {
			const bitmap = createBitmap(3, 3, PixelMode.Gray);
			bitmap.buffer.fill(200);

			const result = padBitmap(bitmap, 0, 0, 0, 0);

			expect(result.width).toBe(3);
			expect(result.rows).toBe(3);
			expect(result.buffer[0]).toBe(200);
		});
	});

	describe("expandToFit", () => {
		test("expands to fit both bitmaps at origin", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(150);

			const result = expandToFit(dst, src, 0, 0);

			expect(result.expanded.width).toBe(5);
			expect(result.expanded.rows).toBe(5);
			expect(result.dstOffsetX).toBe(0);
			expect(result.dstOffsetY).toBe(0);
			expect(result.srcOffsetX).toBe(0);
			expect(result.srcOffsetY).toBe(0);
			expect(result.expanded.buffer[0]).toBe(100);
		});

		test("expands when src is offset positive", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(150);

			const result = expandToFit(dst, src, 4, 4);

			expect(result.expanded.width).toBe(7);
			expect(result.expanded.rows).toBe(7);
			expect(result.dstOffsetX).toBe(0);
			expect(result.dstOffsetY).toBe(0);
			expect(result.srcOffsetX).toBe(4);
			expect(result.srcOffsetY).toBe(4);
		});

		test("expands when src is offset negative", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(150);

			const result = expandToFit(dst, src, -2, -2);

			expect(result.expanded.width).toBe(7);
			expect(result.expanded.rows).toBe(7);
			expect(result.dstOffsetX).toBe(2);
			expect(result.dstOffsetY).toBe(2);
			expect(result.srcOffsetX).toBe(0);
			expect(result.srcOffsetY).toBe(0);
			expect(result.expanded.buffer[2 * result.expanded.pitch + 2]).toBe(100);
		});

		test("handles src completely outside dst", () => {
			const dst = createBitmap(5, 5, PixelMode.Gray);
			dst.buffer.fill(100);
			const src = createBitmap(3, 3, PixelMode.Gray);
			src.buffer.fill(150);

			const result = expandToFit(dst, src, 10, 10);

			expect(result.expanded.width).toBe(13);
			expect(result.expanded.rows).toBe(13);
			expect(result.dstOffsetX).toBe(0);
			expect(result.dstOffsetY).toBe(0);
			expect(result.srcOffsetX).toBe(10);
			expect(result.srcOffsetY).toBe(10);
		});

		test("copies dst content to expanded bitmap", () => {
			const dst = createBitmap(3, 3, PixelMode.Gray);
			dst.buffer[1 * 3 + 1] = 255;
			const src = createBitmap(2, 2, PixelMode.Gray);

			const result = expandToFit(dst, src, 0, 0);

			expect(result.expanded.buffer[1 * result.expanded.pitch + 1]).toBe(255);
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

		test("complex effect pipeline", () => {
			const base = createBitmap(10, 10, PixelMode.Gray);
			base.buffer[5 * 10 + 5] = 255;

			const shadow = copyBitmap(base);
			const shifted = shiftBitmap(shadow, 2, 2);

			const combined = copyBitmap(base);
			addBitmaps(combined, shifted, 0, 0);

			let hasContent = false;
			for (let i = 0; i < combined.buffer.length; i++) {
				if (combined.buffer[i] > 0) hasContent = true;
			}
			expect(hasContent).toBe(true);
		});
	});
});
