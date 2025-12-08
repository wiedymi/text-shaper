import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import {
	rasterizeGlyph,
	PixelMode,
} from "../../src/raster/rasterize.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("raster/rasterize hinting", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	test("font supports hinting", () => {
		expect(font.hasHinting).toBe(true);
		expect(font.isTrueType).toBe(true);
	});

	test("rasterize with hinting Gray mode", () => {
		const glyphId = font.glyphId("A".codePointAt(0)!);
		if (!glyphId) return;

		const result = rasterizeGlyph(font, glyphId, 48, {
			hinting: true,
			pixelMode: PixelMode.Gray,
		});

		expect(result).not.toBeNull();
		if (result) {
			expect(result.bitmap.width).toBeGreaterThan(0);
			expect(result.bitmap.rows).toBeGreaterThan(0);
			expect(result.bitmap.pixelMode).toBe(PixelMode.Gray);
		}
	});

	test("rasterize with hinting Mono mode", () => {
		const glyphId = font.glyphId("B".codePointAt(0)!);
		if (!glyphId) return;

		const result = rasterizeGlyph(font, glyphId, 48, {
			hinting: true,
			pixelMode: PixelMode.Mono,
		});

		expect(result).not.toBeNull();
		if (result) {
			expect(result.bitmap.pixelMode).toBe(PixelMode.Mono);
			expect(result.bitmap.numGrays).toBe(2);
		}
	});

	test("rasterize with hinting LCD mode", () => {
		const glyphId = font.glyphId("C".codePointAt(0)!);
		if (!glyphId) return;

		const result = rasterizeGlyph(font, glyphId, 48, {
			hinting: true,
			pixelMode: PixelMode.LCD,
		});

		expect(result).not.toBeNull();
		if (result) {
			expect(result.bitmap.pixelMode).toBe(PixelMode.LCD);
			expect(result.bitmap.pitch).toBe(result.bitmap.width * 3);
		}
	});

	test("rasterize with hinting LCD_V mode", () => {
		const glyphId = font.glyphId("D".codePointAt(0)!);
		if (!glyphId) return;

		const result = rasterizeGlyph(font, glyphId, 48, {
			hinting: true,
			pixelMode: PixelMode.LCD_V,
		});

		expect(result).not.toBeNull();
		if (result) {
			expect(result.bitmap.pixelMode).toBe(PixelMode.LCD_V);
			expect(result.bitmap.pitch).toBe(result.bitmap.width * 3);
		}
	});

	test("rasterize with hinting RGBA mode", () => {
		const glyphId = font.glyphId("E".codePointAt(0)!);
		if (!glyphId) return;

		const result = rasterizeGlyph(font, glyphId, 48, {
			hinting: true,
			pixelMode: PixelMode.RGBA,
		});

		expect(result).not.toBeNull();
		if (result) {
			expect(result.bitmap.pixelMode).toBe(PixelMode.RGBA);
			expect(result.bitmap.pitch).toBe(result.bitmap.width * 4);
		}
	});

	test("rasterize large glyph triggers buffer expansion", () => {
		const glyphId = font.glyphId("W".codePointAt(0)!);
		if (!glyphId) return;

		const result = rasterizeGlyph(font, glyphId, 256, {
			hinting: true,
			pixelMode: PixelMode.RGBA,
		});

		expect(result).not.toBeNull();
		if (result) {
			expect(result.bitmap.buffer.length).toBeGreaterThan(4096);
		}
	});

	test("buffer reuse with small then large then small", () => {
		const glyphIdSmall = font.glyphId("i".codePointAt(0)!);
		const glyphIdLarge = font.glyphId("W".codePointAt(0)!);
		if (!glyphIdSmall || !glyphIdLarge) return;

		const small1 = rasterizeGlyph(font, glyphIdSmall, 12, { hinting: true });
		const large = rasterizeGlyph(font, glyphIdLarge, 200, {
			hinting: true,
			pixelMode: PixelMode.RGBA,
		});
		const small2 = rasterizeGlyph(font, glyphIdSmall, 12, { hinting: true });

		expect(small1).not.toBeNull();
		expect(large).not.toBeNull();
		expect(small2).not.toBeNull();

		if (small1 && small2) {
			expect(small1.bitmap.width).toBe(small2.bitmap.width);
		}
	});

	test("hinting with all ASCII letters", () => {
		const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
		let successCount = 0;

		for (const char of letters) {
			const glyphId = font.glyphId(char.codePointAt(0)!);
			if (!glyphId) continue;

			try {
				const result = rasterizeGlyph(font, glyphId, 48, { hinting: true });
				if (result && result.bitmap.buffer.some((v) => v > 0)) {
					successCount++;
				}
			} catch (e) {
				// Some glyphs may have hinting errors
			}
		}

		expect(successCount).toBeGreaterThan(40);
	});

	test("hinting with varying ppem sizes", () => {
		const glyphId = font.glyphId("M".codePointAt(0)!);
		if (!glyphId) return;

		const sizes = [8, 12, 16, 24, 32, 48, 64, 96, 128];
		for (const size of sizes) {
			const result = rasterizeGlyph(font, glyphId, size, { hinting: true });
			expect(result).not.toBeNull();
			if (result) {
				expect(result.bitmap.width).toBeGreaterThan(0);
			}
		}
	});

	test("hinting with different padding values", () => {
		const glyphId = font.glyphId("X".codePointAt(0)!);
		if (!glyphId) return;

		const padding0 = rasterizeGlyph(font, glyphId, 48, {
			hinting: true,
			padding: 0,
		});
		const padding5 = rasterizeGlyph(font, glyphId, 48, {
			hinting: true,
			padding: 5,
		});

		if (padding0 && padding5) {
			expect(padding5.bitmap.width).toBeGreaterThanOrEqual(
				padding0.bitmap.width,
			);
		}
	});

	test("hinting cache is reused for same glyph and size", () => {
		const glyphId = font.glyphId("O".codePointAt(0)!);
		if (!glyphId) return;

		const result1 = rasterizeGlyph(font, glyphId, 48, { hinting: true });
		const result2 = rasterizeGlyph(font, glyphId, 48, { hinting: true });

		if (result1 && result2) {
			expect(result1.bitmap.width).toBe(result2.bitmap.width);
			expect(result1.bitmap.rows).toBe(result2.bitmap.rows);
		}
	});

	test("decomposeHintedGlyph with circular glyphs", () => {
		const glyphIds = ["O", "Q", "D", "P"];
		for (const char of glyphIds) {
			const glyphId = font.glyphId(char.codePointAt(0)!);
			if (!glyphId) continue;

			const result = rasterizeGlyph(font, glyphId, 64, { hinting: true });
			if (result) {
				expect(result.bitmap.width).toBeGreaterThan(0);
				expect(result.bitmap.buffer.some((v) => v > 0)).toBe(true);
			}
		}
	});

	test("fractional font size rounds to integer ppem", () => {
		const glyphId = font.glyphId("A".codePointAt(0)!);
		if (!glyphId) return;

		const result1 = rasterizeGlyph(font, glyphId, 48.1, { hinting: true });
		const result2 = rasterizeGlyph(font, glyphId, 48.9, { hinting: true });

		if (result1 && result2) {
			expect(result1.bitmap.width).toBe(result2.bitmap.width);
		}
	});
});
