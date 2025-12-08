import { test, expect } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { rasterizeGlyph, PixelMode } from "../../src/raster/rasterize.ts";

test("simple hinting test", async () => {
	const font = await Font.fromFile(
		"/System/Library/Fonts/Supplemental/Arial.ttf",
	);

	// Test every pixel mode with hinting
	const modes = [
		PixelMode.Gray,
		PixelMode.Mono,
		PixelMode.LCD,
		PixelMode.LCD_V,
		PixelMode.RGBA,
	];

	for (const mode of modes) {
		const glyphId = font.glyphId("A".codePointAt(0)!);
		const result = rasterizeGlyph(font, glyphId, 48, {
			hinting: true,
			pixelMode: mode,
		});

		expect(result).not.toBeNull();
		if (result) {
			expect(result.bitmap.pixelMode).toBe(mode);
		}
	}

	// Test large glyph to trigger buffer allocation
	const largeGlyphId = font.glyphId("W".codePointAt(0)!);
	const largeResult = rasterizeGlyph(font, largeGlyphId, 256, {
		hinting: true,
		pixelMode: PixelMode.RGBA,
	});
	expect(largeResult).not.toBeNull();
	if (largeResult) {
		expect(largeResult.bitmap.buffer.length).toBeGreaterThan(4096);
	}

	// Test sequence for buffer reuse
	const smallId = font.glyphId("i".codePointAt(0)!);
	const small1 = rasterizeGlyph(font, smallId, 12, { hinting: true });
	const large = rasterizeGlyph(font, largeGlyphId, 200, {
		hinting: true,
		pixelMode: PixelMode.RGBA,
	});
	const small2 = rasterizeGlyph(font, smallId, 12, { hinting: true });

	expect(small1).not.toBeNull();
	expect(large).not.toBeNull();
	expect(small2).not.toBeNull();

	// Test many different glyphs
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let count = 0;
	for (const char of chars) {
		const gid = font.glyphId(char.codePointAt(0)!);
		if (!gid) continue;

		try {
			const r = rasterizeGlyph(font, gid, 48, { hinting: true });
			if (r) count++;
		} catch (e) {
			// Skip errors
		}
	}
	expect(count).toBeGreaterThan(50);
});
