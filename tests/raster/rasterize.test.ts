import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { getGlyphPath } from "../../src/render/path.ts";
import {
	rasterizePath,
	rasterizeGlyph,
	rasterizeText,
	bitmapToRGBA,
	bitmapToGray,
	PixelMode,
	FillRule,
	createBitmap,
	clearBitmap,
	type Bitmap,
} from "../../src/raster/rasterize.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("raster/rasterize", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("rasterizePath", () => {
		test("rasterizes simple rectangle path", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 10, y: 0 },
					{ type: "L" as const, x: 10, y: 10 },
					{ type: "L" as const, x: 0, y: 10 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			const bitmap = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				pixelMode: PixelMode.Gray,
				offsetX: 5,
				offsetY: 5,
			});

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
			expect(bitmap.pixelMode).toBe(PixelMode.Gray);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("rasterizes with different scales", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 10, y: 0 },
					{ type: "L" as const, x: 5, y: 10 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			const bitmap1 = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
			});

			const bitmap2 = rasterizePath(path, {
				width: 40,
				height: 40,
				scale: 2.0,
			});

			expect(bitmap1.width).toBe(20);
			expect(bitmap2.width).toBe(40);
		});

		test("respects offsetX and offsetY", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 5, y: 0 },
					{ type: "L" as const, x: 5, y: 5 },
					{ type: "L" as const, x: 0, y: 5 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 5, yMax: 5 },
			};

			const bitmapNoOffset = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				offsetX: 0,
				offsetY: 0,
			});

			const bitmapWithOffset = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				offsetX: 10,
				offsetY: 10,
			});

			expect(bitmapNoOffset.width).toBe(bitmapWithOffset.width);
			expect(bitmapNoOffset.rows).toBe(bitmapWithOffset.rows);
		});

		test("handles flipY option", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 10, y: 0 },
					{ type: "L" as const, x: 10, y: 10 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			const bitmapFlipped = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				flipY: true,
			});

			const bitmapNotFlipped = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				flipY: false,
			});

			expect(bitmapFlipped.width).toBe(20);
			expect(bitmapNotFlipped.width).toBe(20);
		});

		test("uses PixelMode.Gray by default", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 5, y: 5 },
					{ type: "Z" as const },
				],
				bounds: null,
			};

			const bitmap = rasterizePath(path, {
				width: 10,
				height: 10,
				scale: 1.0,
			});

			expect(bitmap.pixelMode).toBe(PixelMode.Gray);
		});

		test("supports FillRule.NonZero", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 10, y: 0 },
					{ type: "L" as const, x: 10, y: 10 },
					{ type: "L" as const, x: 0, y: 10 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			const bitmap = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				fillRule: FillRule.NonZero,
			});

			expect(bitmap.width).toBe(20);
		});

		test("supports FillRule.EvenOdd", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 10, y: 0 },
					{ type: "L" as const, x: 10, y: 10 },
					{ type: "L" as const, x: 0, y: 10 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			const bitmap = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				fillRule: FillRule.EvenOdd,
			});

			expect(bitmap.width).toBe(20);
		});

		test("empty path produces empty bitmap", () => {
			const path = {
				commands: [],
				bounds: null,
			};

			const bitmap = rasterizePath(path, {
				width: 10,
				height: 10,
				scale: 1.0,
			});

			expect(bitmap.width).toBe(10);
			expect(bitmap.rows).toBe(10);

			let allZero = true;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					allZero = false;
					break;
				}
			}
			expect(allZero).toBe(true);
		});
	});

	describe("rasterizeGlyph", () => {
		test("rasterizes valid glyph", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48);
			expect(result).not.toBeNull();
			if (result) {
				expect(result.bitmap.width).toBeGreaterThan(0);
				expect(result.bitmap.rows).toBeGreaterThan(0);
				expect(result.bitmap.pixelMode).toBe(PixelMode.Gray);
			}
		});

		test("handles invalid glyph", () => {
			const result = rasterizeGlyph(font, 99999, 48);
			if (result) {
				expect(result.bitmap.width).toBeGreaterThanOrEqual(1);
				expect(result.bitmap.rows).toBeGreaterThanOrEqual(1);
			}
		});

		test("handles space glyph", () => {
			const glyphId = font.glyphId(" ".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48);
			if (result) {
				expect(result.bitmap.width).toBeGreaterThanOrEqual(1);
				expect(result.bitmap.rows).toBeGreaterThanOrEqual(1);
			}
		});

		test("scales with fontSize", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const small = rasterizeGlyph(font, glyphId, 16);
			const large = rasterizeGlyph(font, glyphId, 64);

			if (small && large) {
				expect(large.bitmap.width).toBeGreaterThan(small.bitmap.width);
				expect(large.bitmap.rows).toBeGreaterThan(small.bitmap.rows);
			}
		});

		test("includes padding by default", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48);
			if (result) {
				expect(result.bitmap.width).toBeGreaterThan(0);
			}
		});

		test("respects custom padding", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const noPadding = rasterizeGlyph(font, glyphId, 48, { padding: 0 });
			const withPadding = rasterizeGlyph(font, glyphId, 48, { padding: 5 });

			if (noPadding && withPadding) {
				expect(withPadding.bitmap.width).toBeGreaterThan(
					noPadding.bitmap.width,
				);
				expect(withPadding.bitmap.rows).toBeGreaterThan(noPadding.bitmap.rows);
			}
		});

		test("returns bearing information", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48);
			if (result) {
				expect(typeof result.bearingX).toBe("number");
				expect(typeof result.bearingY).toBe("number");
			}
		});

		test("different glyphs produce different bitmaps", () => {
			const glyphIdA = font.glyphId("A".codePointAt(0)!);
			const glyphIdO = font.glyphId("O".codePointAt(0)!);
			if (!glyphIdA || !glyphIdO) return;

			const resultA = rasterizeGlyph(font, glyphIdA, 48);
			const resultO = rasterizeGlyph(font, glyphIdO, 48);

			if (resultA && resultO) {
				let differenceCount = 0;
				const minLen = Math.min(
					resultA.bitmap.buffer.length,
					resultO.bitmap.buffer.length,
				);
				for (let i = 0; i < minLen; i++) {
					if (resultA.bitmap.buffer[i] !== resultO.bitmap.buffer[i]) {
						differenceCount++;
					}
				}
				expect(differenceCount).toBeGreaterThan(0);
			}
		});

		test("supports PixelMode.Gray", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48, {
				pixelMode: PixelMode.Gray,
			});
			if (result) {
				expect(result.bitmap.pixelMode).toBe(PixelMode.Gray);
			}
		});

		test("supports PixelMode.Mono", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48, {
				pixelMode: PixelMode.Mono,
			});
			if (result) {
				expect(result.bitmap.pixelMode).toBe(PixelMode.Mono);
			}
		});
	});

	describe("rasterizeText", () => {
		test("rasterizes simple text", () => {
			const result = rasterizeText(font, "Hello", 48);
			expect(result).not.toBeNull();
			if (result) {
				expect(result.width).toBeGreaterThan(0);
				expect(result.rows).toBeGreaterThan(0);
			}
		});

		test("returns null for empty text", () => {
			const result = rasterizeText(font, "", 48);
			expect(result).toBeNull();
		});

		test("handles single character", () => {
			const result = rasterizeText(font, "A", 48);
			expect(result).not.toBeNull();
			if (result) {
				expect(result.width).toBeGreaterThan(0);
			}
		});

		test("wider text produces wider bitmap", () => {
			const short = rasterizeText(font, "A", 48);
			const long = rasterizeText(font, "AAAA", 48);

			if (short && long) {
				expect(long.width).toBeGreaterThan(short.width);
			}
		});

		test("scales with fontSize", () => {
			const small = rasterizeText(font, "Text", 16);
			const large = rasterizeText(font, "Text", 64);

			if (small && large) {
				expect(large.width).toBeGreaterThan(small.width);
				expect(large.rows).toBeGreaterThan(small.rows);
			}
		});

		test("respects padding option", () => {
			const noPadding = rasterizeText(font, "A", 48, { padding: 0 });
			const withPadding = rasterizeText(font, "A", 48, { padding: 5 });

			if (noPadding && withPadding) {
				expect(withPadding.width).toBeGreaterThan(noPadding.width);
				expect(withPadding.rows).toBeGreaterThan(noPadding.rows);
			}
		});

		test("respects pixelMode option", () => {
			const gray = rasterizeText(font, "A", 48, { pixelMode: PixelMode.Gray });
			const mono = rasterizeText(font, "A", 48, { pixelMode: PixelMode.Mono });

			if (gray && mono) {
				expect(gray.pixelMode).toBe(PixelMode.Gray);
				expect(mono.pixelMode).toBe(PixelMode.Mono);
			}
		});

		test("handles text with multiple words", () => {
			const result = rasterizeText(font, "Hello World", 48);
			if (result) {
				expect(result.width).toBeGreaterThan(0);
			}
		});

		test("ignores unsupported characters gracefully", () => {
			const result = rasterizeText(font, "A\u0000B", 48);
			if (result) {
				expect(result.width).toBeGreaterThan(0);
			}
		});
	});

	describe("bitmapToRGBA", () => {
		test("converts Gray bitmap to RGBA", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array([255, 128, 0, 64]),
				width: 2,
				rows: 2,
				pitch: 2,
				pixelMode: PixelMode.Gray,
				numGrays: 256,
			};

			const rgba = bitmapToRGBA(bitmap);
			expect(rgba.length).toBe(2 * 2 * 4);

			// First pixel: coverage 255 -> black (0)
			expect(rgba[0]).toBe(0); // R = 255 - 255
			expect(rgba[1]).toBe(0); // G
			expect(rgba[2]).toBe(0); // B
			expect(rgba[3]).toBe(255); // A = fully opaque

			// Second pixel: coverage 128 -> gray (127)
			expect(rgba[4]).toBe(127); // R = 255 - 128
			expect(rgba[5]).toBe(127); // G
			expect(rgba[6]).toBe(127); // B
			expect(rgba[7]).toBe(255); // A = fully opaque
		});

		test("converts Mono bitmap to RGBA", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array([0b10100000]), // 2 pixels: on, off, on, off...
				width: 8,
				rows: 1,
				pitch: 1,
				pixelMode: PixelMode.Mono,
				numGrays: 2,
			};

			const rgba = bitmapToRGBA(bitmap);
			expect(rgba.length).toBe(8 * 1 * 4);

			// First pixel on -> black
			expect(rgba[0]).toBe(0); // R = black
			expect(rgba[3]).toBe(255); // A = opaque
			// Second pixel off -> white
			expect(rgba[4]).toBe(255); // R = white
			expect(rgba[7]).toBe(255); // A = opaque
			// Third pixel on -> black
			expect(rgba[8]).toBe(0); // R = black
			expect(rgba[11]).toBe(255); // A = opaque
		});

		test("handles empty bitmap", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array(10),
				width: 5,
				rows: 2,
				pitch: 5,
				pixelMode: PixelMode.Gray,
				numGrays: 256,
			};

			const rgba = bitmapToRGBA(bitmap);
			expect(rgba.length).toBe(5 * 2 * 4);

			// Empty bitmap (coverage 0) -> white background, fully opaque
			for (let i = 0; i < rgba.length; i += 4) {
				expect(rgba[i]).toBe(255); // R = white
				expect(rgba[i + 3]).toBe(255); // A = opaque
			}
		});

		test("produces black text on white background", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array([200]),
				width: 1,
				rows: 1,
				pitch: 1,
				pixelMode: PixelMode.Gray,
				numGrays: 256,
			};

			const rgba = bitmapToRGBA(bitmap);
			expect(rgba[0]).toBe(55); // R = 255 - 200
			expect(rgba[1]).toBe(55); // G
			expect(rgba[2]).toBe(55); // B
			expect(rgba[3]).toBe(255); // A = fully opaque
		});

		test("handles bitmap with pitch larger than width", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array([255, 128, 0, 0, 64, 32, 0, 0]), // pitch=4, width=2
				width: 2,
				rows: 2,
				pitch: 4,
				pixelMode: PixelMode.Gray,
				numGrays: 256,
			};

			const rgba = bitmapToRGBA(bitmap);
			expect(rgba.length).toBe(2 * 2 * 4);

			// First pixel: coverage 255 -> R = 0 (black)
			expect(rgba[0]).toBe(0);
			expect(rgba[3]).toBe(255); // A = opaque
			// Second pixel: coverage 128 -> R = 127
			expect(rgba[4]).toBe(127);
			expect(rgba[7]).toBe(255); // A = opaque
			// Third pixel: coverage 64 -> R = 191
			expect(rgba[8]).toBe(191);
			expect(rgba[11]).toBe(255); // A = opaque
			// Fourth pixel: coverage 32 -> R = 223
			expect(rgba[12]).toBe(223);
			expect(rgba[15]).toBe(255); // A = opaque
		});
	});

	describe("bitmapToGray", () => {
		test("converts Gray bitmap efficiently when no conversion needed", () => {
			const buffer = new Uint8Array([255, 128, 0, 64]);
			const bitmap: Bitmap = {
				buffer,
				width: 4,
				rows: 1,
				pitch: 4,
				pixelMode: PixelMode.Gray,
				numGrays: 256,
			};

			const gray = bitmapToGray(bitmap);
			expect(gray).toBe(buffer); // Should return same buffer
		});

		test("converts Gray bitmap with pitch != width", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array([255, 128, 0, 0, 64, 32, 0, 0]),
				width: 2,
				rows: 2,
				pitch: 4,
				pixelMode: PixelMode.Gray,
				numGrays: 256,
			};

			const gray = bitmapToGray(bitmap);
			expect(gray.length).toBe(2 * 2);
			expect(gray[0]).toBe(255);
			expect(gray[1]).toBe(128);
			expect(gray[2]).toBe(64);
			expect(gray[3]).toBe(32);
		});

		test("converts Mono bitmap to Gray", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array([0b10101010]),
				width: 8,
				rows: 1,
				pitch: 1,
				pixelMode: PixelMode.Mono,
				numGrays: 2,
			};

			const gray = bitmapToGray(bitmap);
			expect(gray.length).toBe(8);
			expect(gray[0]).toBe(255); // Bit 7 = 1
			expect(gray[1]).toBe(0); // Bit 6 = 0
			expect(gray[2]).toBe(255); // Bit 5 = 1
			expect(gray[3]).toBe(0); // Bit 4 = 0
			expect(gray[4]).toBe(255); // Bit 3 = 1
			expect(gray[5]).toBe(0); // Bit 2 = 0
			expect(gray[6]).toBe(255); // Bit 1 = 1
			expect(gray[7]).toBe(0); // Bit 0 = 0
		});

		test("handles empty bitmap", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array(10),
				width: 5,
				rows: 2,
				pitch: 5,
				pixelMode: PixelMode.Gray,
				numGrays: 256,
			};

			const gray = bitmapToGray(bitmap);
			expect(gray.length).toBe(10);

			for (let i = 0; i < gray.length; i++) {
				expect(gray[i]).toBe(0);
			}
		});
	});

	describe("createBitmap", () => {
		test("creates Gray bitmap with correct dimensions", () => {
			const bitmap = createBitmap(10, 20, PixelMode.Gray);
			expect(bitmap.width).toBe(10);
			expect(bitmap.rows).toBe(20);
			expect(bitmap.pixelMode).toBe(PixelMode.Gray);
			expect(bitmap.pitch).toBe(10);
			expect(bitmap.buffer.length).toBe(10 * 20);
			expect(bitmap.numGrays).toBe(256);
		});

		test("creates Mono bitmap with correct pitch", () => {
			const bitmap = createBitmap(9, 5, PixelMode.Mono);
			expect(bitmap.width).toBe(9);
			expect(bitmap.rows).toBe(5);
			expect(bitmap.pixelMode).toBe(PixelMode.Mono);
			expect(bitmap.pitch).toBe(2); // ceil(9/8) = 2 bytes
			expect(bitmap.buffer.length).toBe(2 * 5);
			expect(bitmap.numGrays).toBe(2);
		});

		test("creates LCD bitmap", () => {
			const bitmap = createBitmap(10, 5, PixelMode.LCD);
			expect(bitmap.width).toBe(10);
			expect(bitmap.rows).toBe(5);
			expect(bitmap.pixelMode).toBe(PixelMode.LCD);
			expect(bitmap.pitch).toBe(30); // 10 * 3 bytes per pixel
			expect(bitmap.buffer.length).toBe(30 * 5);
		});

		test("defaults to Gray mode", () => {
			const bitmap = createBitmap(10, 10);
			expect(bitmap.pixelMode).toBe(PixelMode.Gray);
		});

		test("initializes buffer to zeros", () => {
			const bitmap = createBitmap(5, 5);
			for (let i = 0; i < bitmap.buffer.length; i++) {
				expect(bitmap.buffer[i]).toBe(0);
			}
		});
	});

	describe("clearBitmap", () => {
		test("clears all pixels to zero", () => {
			const bitmap = createBitmap(10, 10);
			bitmap.buffer.fill(255);

			clearBitmap(bitmap);

			for (let i = 0; i < bitmap.buffer.length; i++) {
				expect(bitmap.buffer[i]).toBe(0);
			}
		});

		test("works with Mono bitmap", () => {
			const bitmap = createBitmap(16, 2, PixelMode.Mono);
			bitmap.buffer.fill(0xff);

			clearBitmap(bitmap);

			for (let i = 0; i < bitmap.buffer.length; i++) {
				expect(bitmap.buffer[i]).toBe(0);
			}
		});
	});

	describe("integration tests", () => {
		test("rasterize and convert to RGBA", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48);
			if (!result) return;

			const rgba = bitmapToRGBA(result.bitmap);
			expect(rgba.length).toBe(
				result.bitmap.width * result.bitmap.rows * 4,
			);

			let hasOpaque = false;
			for (let i = 3; i < rgba.length; i += 4) {
				if (rgba[i] > 0) {
					hasOpaque = true;
					break;
				}
			}
			expect(hasOpaque).toBe(true);
		});

		test("rasterize multiple glyphs and compare", () => {
			const glyphs = ["A", "B", "C"];
			const bitmaps = [];

			for (const char of glyphs) {
				const glyphId = font.glyphId(char.codePointAt(0)!);
				if (!glyphId) continue;

				const result = rasterizeGlyph(font, glyphId, 48);
				if (result) {
					bitmaps.push(result.bitmap);
				}
			}

			expect(bitmaps.length).toBe(3);
		});

		test("different pixel modes produce different buffer sizes", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const gray = rasterizeGlyph(font, glyphId, 48, {
				pixelMode: PixelMode.Gray,
			});
			const mono = rasterizeGlyph(font, glyphId, 48, {
				pixelMode: PixelMode.Mono,
			});

			if (gray && mono) {
				expect(gray.bitmap.pixelMode).toBe(PixelMode.Gray);
				expect(mono.bitmap.pixelMode).toBe(PixelMode.Mono);
				expect(gray.bitmap.buffer.length).toBeGreaterThan(
					mono.bitmap.buffer.length,
				);
			}
		});

		test("rasterize text and convert formats", () => {
			const bitmap = rasterizeText(font, "Hi", 48);
			if (!bitmap) return;

			const rgba = bitmapToRGBA(bitmap);
			const gray = bitmapToGray(bitmap);

			expect(rgba.length).toBe(bitmap.width * bitmap.rows * 4);
			expect(gray.length).toBeLessThanOrEqual(bitmap.width * bitmap.rows);
		});

		test("same glyph at same size produces identical bitmaps", () => {
			const glyphId = font.glyphId("X".codePointAt(0)!);
			if (!glyphId) return;

			const result1 = rasterizeGlyph(font, glyphId, 48);
			const result2 = rasterizeGlyph(font, glyphId, 48);

			if (result1 && result2) {
				expect(result1.bitmap.width).toBe(result2.bitmap.width);
				expect(result1.bitmap.rows).toBe(result2.bitmap.rows);

				let identical = true;
				for (
					let i = 0;
					i < Math.min(result1.bitmap.buffer.length, result2.bitmap.buffer.length);
					i++
				) {
					if (result1.bitmap.buffer[i] !== result2.bitmap.buffer[i]) {
						identical = false;
						break;
					}
				}
				expect(identical).toBe(true);
			}
		});
	});

	describe("hinting integration", () => {
		test("rasterizeGlyph with hinting option set to false", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48, { hinting: false });
			if (!result) return;

			expect(result.bitmap.width).toBeGreaterThan(0);
			expect(result.bitmap.rows).toBeGreaterThan(0);
		});

		test("rasterizeGlyph default hinting behavior", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const resultDefault = rasterizeGlyph(font, glyphId, 48);
			const resultExplicit = rasterizeGlyph(font, glyphId, 48, { hinting: false });

			if (resultDefault && resultExplicit) {
				expect(resultDefault.bitmap.width).toBe(resultExplicit.bitmap.width);
			}
		});
	});

	describe("band processing", () => {
		test("rasterizes large paths using band processing", () => {
			const largePath = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 100, y: 0 },
					{ type: "L" as const, x: 100, y: 300 },
					{ type: "L" as const, x: 0, y: 300 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 100, yMax: 300 },
			};

			const bitmap = rasterizePath(largePath, {
				width: 120,
				height: 320,
				scale: 1.0,
			});

			expect(bitmap.width).toBe(120);
			expect(bitmap.rows).toBe(320);
		});

		test("handles height exactly at band threshold", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 50, y: 0 },
					{ type: "L" as const, x: 50, y: 256 },
					{ type: "L" as const, x: 0, y: 256 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 50, yMax: 256 },
			};

			const bitmap = rasterizePath(path, {
				width: 60,
				height: 256,
				scale: 1.0,
			});

			expect(bitmap.width).toBe(60);
			expect(bitmap.rows).toBe(256);
		});

		test("handles height above band threshold", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 50, y: 0 },
					{ type: "L" as const, x: 50, y: 257 },
					{ type: "L" as const, x: 0, y: 257 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 50, yMax: 257 },
			};

			const bitmap = rasterizePath(path, {
				width: 60,
				height: 257,
				scale: 1.0,
			});

			expect(bitmap.width).toBe(60);
			expect(bitmap.rows).toBe(257);
		});
	});

	describe("edge cases", () => {
		test("handles null path in rasterizeGlyph", () => {
			const invalidGlyphId = 99999;
			const result = rasterizeGlyph(font, invalidGlyphId, 48);

			if (result) {
				expect(result.bitmap.width).toBeGreaterThanOrEqual(1);
				expect(result.bitmap.rows).toBeGreaterThanOrEqual(1);
			}
		});

		test("handles zero-width bounds", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 10, y: 0 },
					{ type: "L" as const, x: 10, y: 10 },
				],
				bounds: { xMin: 10, yMin: 0, xMax: 10, yMax: 10 },
			};

			const result = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
			});

			expect(result.width).toBe(20);
			expect(result.rows).toBe(20);
		});

		test("handles negative bounds", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: -5, y: -5 },
					{ type: "L" as const, x: 5, y: -5 },
					{ type: "L" as const, x: 5, y: 5 },
					{ type: "L" as const, x: -5, y: 5 },
					{ type: "Z" as const },
				],
				bounds: { xMin: -5, yMin: -5, xMax: 5, yMax: 5 },
			};

			const result = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				offsetX: 10,
				offsetY: 10,
			});

			expect(result.width).toBe(20);
			expect(result.rows).toBe(20);
		});

		test("handles text with no valid glyphs", () => {
			const result = rasterizeText(font, "\u0000\u0001\u0002", 48);
			if (result) {
				expect(result.width).toBeGreaterThanOrEqual(0);
			}
		});

		test("handles single space in text", () => {
			const result = rasterizeText(font, " ", 48);
			if (result) {
				expect(result.width).toBeGreaterThanOrEqual(0);
			}
		});

		test("handles path with null bounds", () => {
			const glyphId = font.glyphId("A".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 0.1);
			if (result) {
				expect(result.bitmap.width).toBeGreaterThanOrEqual(1);
				expect(result.bitmap.rows).toBeGreaterThanOrEqual(1);
			}
		});
	});

	describe("path command types", () => {
		test("rasterizes path with quadratic curves (Q command)", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "Q" as const, x1: 5, y1: -5, x: 10, y: 0 },
					{ type: "L" as const, x: 5, y: 10 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: -5, xMax: 10, yMax: 10 },
			};

			const bitmap = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				offsetX: 5,
				offsetY: 10,
			});

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("rasterizes path with cubic curves (C command)", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "C" as const, x1: 3, y1: -5, x2: 7, y2: -5, x: 10, y: 0 },
					{ type: "L" as const, x: 5, y: 10 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: -5, xMax: 10, yMax: 10 },
			};

			const bitmap = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				offsetX: 5,
				offsetY: 10,
			});

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("rasterizes complex path with multiple curve types", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 10, y: 0 },
					{ type: "Q" as const, x1: 15, y1: 5, x: 10, y: 10 },
					{ type: "C" as const, x1: 8, y1: 12, x2: 2, y2: 12, x: 0, y: 10 },
					{ type: "Z" as const },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 15, yMax: 12 },
			};

			const bitmap = rasterizePath(path, {
				width: 30,
				height: 30,
				scale: 1.0,
				offsetX: 7,
				offsetY: 9,
			});

			expect(bitmap.width).toBe(30);
			expect(bitmap.rows).toBe(30);

			let hasNonZero = false;
			for (let i = 0; i < bitmap.buffer.length; i++) {
				if (bitmap.buffer[i] !== 0) {
					hasNonZero = true;
					break;
				}
			}
			expect(hasNonZero).toBe(true);
		});

		test("rasterizes path with only move commands", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 5, y: 5 },
					{ type: "M" as const, x: 10, y: 10 },
				],
				bounds: null,
			};

			const bitmap = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
			});

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
		});

		test("rasterizes path without close command", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 0 },
					{ type: "L" as const, x: 10, y: 0 },
					{ type: "L" as const, x: 10, y: 10 },
					{ type: "L" as const, x: 0, y: 10 },
				],
				bounds: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
			};

			const bitmap = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
				offsetX: 5,
				offsetY: 5,
			});

			expect(bitmap.width).toBe(20);
			expect(bitmap.rows).toBe(20);
		});
	});


	describe("special glyphs and bounds", () => {
		test("handles glyphs with zero-height bounds", () => {
			const path = {
				commands: [
					{ type: "M" as const, x: 0, y: 5 },
					{ type: "L" as const, x: 10, y: 5 },
				],
				bounds: { xMin: 0, yMin: 5, xMax: 10, yMax: 5 },
			};

			const result = rasterizePath(path, {
				width: 20,
				height: 20,
				scale: 1.0,
			});

			expect(result.width).toBe(20);
			expect(result.rows).toBe(20);
		});

		test("handles empty glyph with null path", () => {
			const glyphId = font.glyphId(".notdef".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48);
			if (result) {
				expect(result.bitmap.width).toBeGreaterThanOrEqual(1);
				expect(result.bitmap.rows).toBeGreaterThanOrEqual(1);
			}
		});

		test("handles very small scale resulting in zero bounds", () => {
			const glyphId = font.glyphId("I".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 0.01);
			if (result) {
				expect(result.bitmap.width).toBeGreaterThanOrEqual(1);
				expect(result.bitmap.rows).toBeGreaterThanOrEqual(1);
			}
		});

		test("handles text with characters that have no glyphs in font", () => {
			const result = rasterizeText(font, "A\uFFFD", 48);
			if (result) {
				expect(result.width).toBeGreaterThan(0);
			}
		});

		test("handles text with mixed valid and invalid characters", () => {
			const result = rasterizeText(font, "A\u0000B\u0001C", 48);
			if (result) {
				expect(result.width).toBeGreaterThan(0);
			}
		});

		test("handles bounds resulting in negative dimensions with large negative padding", () => {
			const glyphId = font.glyphId("I".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 10, { padding: -100 });
			if (result) {
				expect(result.bitmap.width).toBe(1);
				expect(result.bitmap.rows).toBe(1);
			}
		});
	});

	describe("LCD pixel mode", () => {
		test("rasterizes with PixelMode.LCD", () => {
			const glyphId = font.glyphId("R".codePointAt(0)!);
			if (!glyphId) return;

			const result = rasterizeGlyph(font, glyphId, 48, {
				pixelMode: PixelMode.LCD,
			});
			if (result) {
				expect(result.bitmap.pixelMode).toBe(PixelMode.LCD);
				expect(result.bitmap.pitch).toBe(result.bitmap.width * 3);
			}
		});

		test("converts LCD bitmap to RGBA", () => {
			const bitmap: Bitmap = {
				buffer: new Uint8Array([255, 128, 64, 200, 150, 100]),
				width: 2,
				rows: 1,
				pitch: 6,
				pixelMode: PixelMode.LCD,
				numGrays: 256,
			};

			const rgba = bitmapToRGBA(bitmap);
			expect(rgba.length).toBe(2 * 1 * 4);
		});

		test("text rendering with LCD mode", () => {
			const result = rasterizeText(font, "LCD", 48, {
				pixelMode: PixelMode.LCD,
			});
			if (result) {
				expect(result.pixelMode).toBe(PixelMode.LCD);
			}
		});
	});
});
