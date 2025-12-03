/**
 * Tests for the font rasterizer
 */

import { test, expect } from "bun:test";
import { Font } from "../src/font/font.ts";
import { rasterizeGlyph, rasterizePath, bitmapToRGBA, PixelMode } from "../src/raster/rasterize.ts";
import { getGlyphPath } from "../src/render/path.ts";
import { GrayRaster } from "../src/raster/gray-raster.ts";
import { createBitmap } from "../src/raster/types.ts";
import { ONE_PIXEL } from "../src/raster/fixed-point.ts";

// Test with a system font - use .otf or .ttf, not .ttc (collections)
const FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

test("GrayRaster renders a simple triangle", () => {
	const raster = new GrayRaster();
	const bitmap = createBitmap(10, 10, PixelMode.Gray);

	raster.setClip(0, 0, 10, 10);
	raster.reset();

	// Draw a triangle
	const scale = ONE_PIXEL;
	raster.moveTo(5 * scale, 1 * scale);
	raster.lineTo(9 * scale, 9 * scale);
	raster.lineTo(1 * scale, 9 * scale);
	raster.lineTo(5 * scale, 1 * scale); // Close

	raster.sweep(bitmap);

	// Check that some pixels are filled
	let filledPixels = 0;
	for (let i = 0; i < bitmap.buffer.length; i++) {
		if (bitmap.buffer[i]! > 0) filledPixels++;
	}

	expect(filledPixels).toBeGreaterThan(0);
	console.log(`Triangle: ${filledPixels} pixels filled`);
});

test("GrayRaster renders a square", () => {
	const raster = new GrayRaster();
	const bitmap = createBitmap(10, 10, PixelMode.Gray);

	raster.setClip(0, 0, 10, 10);
	raster.reset();

	// Draw a 6x6 square at (2, 2)
	const scale = ONE_PIXEL;
	raster.moveTo(2 * scale, 2 * scale);
	raster.lineTo(8 * scale, 2 * scale);
	raster.lineTo(8 * scale, 8 * scale);
	raster.lineTo(2 * scale, 8 * scale);
	raster.lineTo(2 * scale, 2 * scale); // Close

	raster.sweep(bitmap);

	// Check that the interior is filled
	let filledPixels = 0;
	for (let i = 0; i < bitmap.buffer.length; i++) {
		if (bitmap.buffer[i]! > 0) filledPixels++;
	}

	expect(filledPixels).toBeGreaterThan(0);
	console.log(`Square: ${filledPixels} pixels filled`);

	// Print the bitmap as ASCII art
	console.log("Square bitmap:");
	for (let y = 0; y < 10; y++) {
		let row = "";
		for (let x = 0; x < 10; x++) {
			const val = bitmap.buffer[y * 10 + x]!;
			if (val > 200) row += "#";
			else if (val > 100) row += "+";
			else if (val > 50) row += ".";
			else row += " ";
		}
		console.log(row);
	}
});

test("Load font and rasterize a glyph", async () => {
	const file = Bun.file(FONT_PATH);
	if (!(await file.exists())) {
		console.log("Skipping: font not found at", FONT_PATH);
		return;
	}

	const data = await file.arrayBuffer();
	const font = Font.load(data);

	// Get glyph for 'A'
	const glyphId = font.glyphId(65); // 'A'
	expect(glyphId).toBeDefined();

	if (glyphId === undefined) return;

	// Rasterize at 48px
	const result = rasterizeGlyph(font, glyphId, 48);
	expect(result).not.toBeNull();

	if (!result) return;

	console.log(`Glyph 'A' rasterized: ${result.bitmap.width}x${result.bitmap.rows}`);
	console.log(`Bearing: (${result.bearingX}, ${result.bearingY})`);

	// Print as ASCII art
	console.log("Glyph 'A' bitmap:");
	for (let y = 0; y < Math.min(result.bitmap.rows, 30); y++) {
		let row = "";
		for (let x = 0; x < result.bitmap.width; x++) {
			const val = result.bitmap.buffer[y * result.bitmap.pitch + x]!;
			if (val > 200) row += "@";
			else if (val > 150) row += "#";
			else if (val > 100) row += "+";
			else if (val > 50) row += ".";
			else if (val > 20) row += ":";
			else row += " ";
		}
		console.log(row);
	}
});

test("Rasterize curved glyph (letter 'o')", async () => {
	const file = Bun.file(FONT_PATH);
	if (!(await file.exists())) {
		console.log("Skipping: font not found at", FONT_PATH);
		return;
	}

	const data = await file.arrayBuffer();
	const font = Font.load(data);

	const glyphId = font.glyphId(111); // 'o'
	expect(glyphId).toBeDefined();

	if (glyphId === undefined) return;

	const result = rasterizeGlyph(font, glyphId, 48);
	expect(result).not.toBeNull();

	if (!result) return;

	console.log(`Glyph 'o' rasterized: ${result.bitmap.width}x${result.bitmap.rows}`);

	// Print as ASCII art
	console.log("Glyph 'o' bitmap:");
	for (let y = 0; y < result.bitmap.rows; y++) {
		let row = "";
		for (let x = 0; x < result.bitmap.width; x++) {
			const val = result.bitmap.buffer[y * result.bitmap.pitch + x]!;
			if (val > 200) row += "@";
			else if (val > 150) row += "#";
			else if (val > 100) row += "+";
			else if (val > 50) row += ".";
			else if (val > 20) row += ":";
			else row += " ";
		}
		console.log(row);
	}
});

test("bitmapToRGBA produces valid RGBA data", () => {
	const bitmap = createBitmap(2, 2, PixelMode.Gray);
	bitmap.buffer[0] = 255;
	bitmap.buffer[1] = 128;
	bitmap.buffer[2] = 64;
	bitmap.buffer[3] = 0;

	const rgba = bitmapToRGBA(bitmap);

	expect(rgba.length).toBe(16); // 2x2x4

	// Check first pixel (255 alpha)
	expect(rgba[0]).toBe(255); // R
	expect(rgba[1]).toBe(255); // G
	expect(rgba[2]).toBe(255); // B
	expect(rgba[3]).toBe(255); // A

	// Check second pixel (128 alpha)
	expect(rgba[7]).toBe(128); // A
});

test("Rasterize multiple glyphs", async () => {
	const file = Bun.file(FONT_PATH);
	if (!(await file.exists())) {
		console.log("Skipping: font not found at", FONT_PATH);
		return;
	}

	const data = await file.arrayBuffer();
	const font = Font.load(data);

	// Test various characters
	const chars = ["H", "e", "l", "l", "o", "W", "0", "9", "@", "&"];
	let allPassed = true;

	for (const char of chars) {
		const glyphId = font.glyphId(char.charCodeAt(0));
		if (glyphId === undefined) {
			console.log(`No glyph for '${char}'`);
			continue;
		}

		const result = rasterizeGlyph(font, glyphId, 24);
		if (!result) {
			console.log(`Failed to rasterize '${char}'`);
			allPassed = false;
			continue;
		}

		// Check bitmap has content
		let hasContent = false;
		for (let i = 0; i < result.bitmap.buffer.length; i++) {
			if (result.bitmap.buffer[i]! > 0) {
				hasContent = true;
				break;
			}
		}

		if (!hasContent) {
			console.log(`Empty bitmap for '${char}'`);
			allPassed = false;
		}
	}

	expect(allPassed).toBe(true);
});

test("Monochrome rendering mode", () => {
	const raster = new GrayRaster();
	const bitmap = createBitmap(16, 16, PixelMode.Mono);

	raster.setClip(0, 0, 16, 16);
	raster.reset();

	// Draw a filled square
	const scale = ONE_PIXEL;
	raster.moveTo(4 * scale, 4 * scale);
	raster.lineTo(12 * scale, 4 * scale);
	raster.lineTo(12 * scale, 12 * scale);
	raster.lineTo(4 * scale, 12 * scale);
	raster.lineTo(4 * scale, 4 * scale);

	raster.sweep(bitmap);

	// Count set bits
	let setBits = 0;
	for (let y = 0; y < 16; y++) {
		for (let x = 0; x < 16; x++) {
			const byteIdx = y * bitmap.pitch + (x >> 3);
			const bitIdx = 7 - (x & 7);
			if ((bitmap.buffer[byteIdx]! >> bitIdx) & 1) {
				setBits++;
			}
		}
	}

	// Should have roughly 64 bits set (8x8 inner area)
	expect(setBits).toBeGreaterThan(50);
	expect(setBits).toBeLessThan(80);
	console.log(`Mono mode: ${setBits} bits set`);
});

test("Anti-aliased edges", () => {
	const raster = new GrayRaster();
	const bitmap = createBitmap(20, 20, PixelMode.Gray);

	raster.setClip(0, 0, 20, 20);
	raster.reset();

	// Draw a diagonal line (should produce anti-aliased pixels)
	const scale = ONE_PIXEL;
	raster.moveTo(2 * scale, 2 * scale);
	raster.lineTo(18 * scale, 2 * scale);
	raster.lineTo(18 * scale, 18 * scale);
	raster.lineTo(2 * scale, 2 * scale); // Diagonal

	raster.sweep(bitmap);

	// Check for intermediate gray values (anti-aliasing)
	let hasAntiAliasing = false;
	for (let i = 0; i < bitmap.buffer.length; i++) {
		const val = bitmap.buffer[i]!;
		if (val > 0 && val < 255) {
			hasAntiAliasing = true;
			break;
		}
	}

	expect(hasAntiAliasing).toBe(true);
	console.log("Anti-aliasing detected on diagonal edge");
});

test("Quadratic curve rendering", () => {
	const raster = new GrayRaster();
	const bitmap = createBitmap(20, 20, PixelMode.Gray);

	raster.setClip(0, 0, 20, 20);
	raster.reset();

	// Draw a curved shape
	const scale = ONE_PIXEL;
	raster.moveTo(5 * scale, 10 * scale);
	raster.conicTo(10 * scale, 2 * scale, 15 * scale, 10 * scale);
	raster.lineTo(15 * scale, 15 * scale);
	raster.lineTo(5 * scale, 15 * scale);
	raster.lineTo(5 * scale, 10 * scale);

	raster.sweep(bitmap);

	// Check for filled pixels
	let filledPixels = 0;
	for (let i = 0; i < bitmap.buffer.length; i++) {
		if (bitmap.buffer[i]! > 0) filledPixels++;
	}

	expect(filledPixels).toBeGreaterThan(30);
	console.log(`Quadratic curve: ${filledPixels} pixels filled`);
});

test("Cubic curve rendering", () => {
	const raster = new GrayRaster();
	const bitmap = createBitmap(20, 20, PixelMode.Gray);

	raster.setClip(0, 0, 20, 20);
	raster.reset();

	// Draw an S-curve shape
	const scale = ONE_PIXEL;
	raster.moveTo(5 * scale, 15 * scale);
	raster.cubicTo(
		5 * scale, 5 * scale,   // control 1
		15 * scale, 15 * scale, // control 2
		15 * scale, 5 * scale   // end
	);
	raster.lineTo(17 * scale, 5 * scale);
	raster.cubicTo(
		17 * scale, 17 * scale,
		3 * scale, 3 * scale,
		3 * scale, 15 * scale
	);
	raster.lineTo(5 * scale, 15 * scale);

	raster.sweep(bitmap);

	// Check for filled pixels
	let filledPixels = 0;
	for (let i = 0; i < bitmap.buffer.length; i++) {
		if (bitmap.buffer[i]! > 0) filledPixels++;
	}

	expect(filledPixels).toBeGreaterThan(20);
	console.log(`Cubic curve: ${filledPixels} pixels filled`);
});

test("LCD subpixel rendering", async () => {
	const { rasterizeLcd, LcdMode, LCD_FILTER_DEFAULT, lcdToRGBA } = await import("../src/raster/lcd-filter.ts");
	const { getGlyphPath } = await import("../src/render/path.ts");

	const file = Bun.file(FONT_PATH);
	if (!(await file.exists())) {
		console.log("Skipping: font not found");
		return;
	}

	const data = await file.arrayBuffer();
	const font = Font.load(data);

	const glyphId = font.glyphId(65); // 'A'
	if (glyphId === undefined) return;

	const path = getGlyphPath(font, glyphId);
	if (!path) return;

	const scale = 48 / font.unitsPerEm;
	const width = 40;
	const height = 50;

	const lcd = rasterizeLcd(path, width, height, scale, 5, 45, LcdMode.RGB, LCD_FILTER_DEFAULT);

	// Check bitmap dimensions
	expect(lcd.width).toBe(width);
	expect(lcd.rows).toBe(height);
	expect(lcd.pitch).toBe(width * 3); // 3 bytes per pixel (RGB)

	// Check for content
	let hasContent = false;
	for (let i = 0; i < lcd.buffer.length; i++) {
		if (lcd.buffer[i]! > 0) {
			hasContent = true;
			break;
		}
	}
	expect(hasContent).toBe(true);

	// Convert to RGBA
	const rgba = lcdToRGBA(lcd);
	expect(rgba.length).toBe(width * height * 4);

	console.log(`LCD rendering: ${width}x${height}, ${lcd.buffer.length} bytes`);
});

test("Texture atlas building", async () => {
	const { buildAtlas, buildAsciiAtlas, atlasToRGBA, getGlyphUV } = await import("../src/raster/atlas.ts");

	const file = Bun.file(FONT_PATH);
	if (!(await file.exists())) {
		console.log("Skipping: font not found");
		return;
	}

	const data = await file.arrayBuffer();
	const font = Font.load(data);

	// Build atlas for some glyphs
	const glyphIds: number[] = [];
	for (const char of "Hello World") {
		const glyphId = font.glyphId(char.charCodeAt(0));
		if (glyphId !== undefined) glyphIds.push(glyphId);
	}

	const atlas = buildAtlas(font, glyphIds, { fontSize: 32, padding: 2 });

	// Check atlas was created
	expect(atlas.bitmap.width).toBeGreaterThan(0);
	expect(atlas.bitmap.rows).toBeGreaterThan(0);
	expect(atlas.glyphs.size).toBeGreaterThan(0);

	// Check metrics for 'H'
	const hGlyphId = font.glyphId(72);
	if (hGlyphId !== undefined) {
		const metrics = atlas.glyphs.get(hGlyphId);
		expect(metrics).toBeDefined();
		if (metrics) {
			expect(metrics.width).toBeGreaterThan(0);
			expect(metrics.height).toBeGreaterThan(0);
		}

		// Check UV coordinates
		const uv = getGlyphUV(atlas, hGlyphId);
		expect(uv).not.toBeNull();
		if (uv) {
			expect(uv.u0).toBeGreaterThanOrEqual(0);
			expect(uv.u0).toBeLessThanOrEqual(1);
			expect(uv.v0).toBeGreaterThanOrEqual(0);
			expect(uv.v0).toBeLessThanOrEqual(1);
		}
	}

	// Convert to RGBA
	const rgba = atlasToRGBA(atlas);
	expect(rgba.length).toBe(atlas.bitmap.width * atlas.bitmap.rows * 4);

	console.log(`Atlas: ${atlas.bitmap.width}x${atlas.bitmap.rows}, ${atlas.glyphs.size} glyphs`);
});

test("ASCII atlas", async () => {
	const { buildAsciiAtlas } = await import("../src/raster/atlas.ts");

	const file = Bun.file(FONT_PATH);
	if (!(await file.exists())) {
		console.log("Skipping: font not found");
		return;
	}

	const data = await file.arrayBuffer();
	const font = Font.load(data);

	const atlas = buildAsciiAtlas(font, { fontSize: 24, padding: 1 });

	// Should have ~95 glyphs (32-126)
	expect(atlas.glyphs.size).toBeGreaterThan(80);

	// Atlas should be power of 2
	const isPowerOf2 = (n: number) => (n & (n - 1)) === 0;
	expect(isPowerOf2(atlas.bitmap.width)).toBe(true);
	expect(isPowerOf2(atlas.bitmap.rows)).toBe(true);

	console.log(`ASCII Atlas: ${atlas.bitmap.width}x${atlas.bitmap.rows}, ${atlas.glyphs.size} glyphs`);
});

test("Even-odd fill rule", async () => {
	const { FillRule } = await import("../src/raster/types.ts");
	const raster = new GrayRaster();
	const bitmap = createBitmap(20, 20, PixelMode.Gray);

	raster.setClip(0, 0, 20, 20);
	raster.reset();

	// Draw two overlapping squares (should create hole with even-odd)
	const scale = ONE_PIXEL;

	// Outer square
	raster.moveTo(2 * scale, 2 * scale);
	raster.lineTo(18 * scale, 2 * scale);
	raster.lineTo(18 * scale, 18 * scale);
	raster.lineTo(2 * scale, 18 * scale);
	raster.lineTo(2 * scale, 2 * scale);

	// Inner square (same winding)
	raster.moveTo(6 * scale, 6 * scale);
	raster.lineTo(14 * scale, 6 * scale);
	raster.lineTo(14 * scale, 14 * scale);
	raster.lineTo(6 * scale, 14 * scale);
	raster.lineTo(6 * scale, 6 * scale);

	raster.sweep(bitmap, FillRule.EvenOdd);

	// Check center pixel (should be unfilled with even-odd)
	const centerIdx = 10 * bitmap.pitch + 10;
	const centerValue = bitmap.buffer[centerIdx]!;

	// With even-odd, the center should have a hole
	expect(centerValue).toBeLessThan(128);
	console.log(`Even-odd center value: ${centerValue}`);
});
