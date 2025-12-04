import { Font } from "./src/font/font.ts";
import { rasterizeGlyph, PixelMode } from "./src/raster/rasterize.ts";

const fontPath = "/Users/uyakauleu/Library/Fonts/8_AGARAMONDPRO-REGULAR.ttf";
const fontData = await Bun.file(fontPath).arrayBuffer();
const font = Font.load(fontData);

console.log("Font loaded, CFF:", font.cff !== null);

const glyphId = font.glyphId("A".charCodeAt(0));
console.log("Glyph ID for A:", glyphId);

// Get contours first
const contours = font.getGlyphContours(glyphId);
console.log("Contours:", contours?.length, "Total points:", contours?.reduce((s, c) => s + c.length, 0));

// Try rasterizing
const result = rasterizeGlyph(font, glyphId, 32, {
	pixelMode: PixelMode.Gray,
	hinting: false,
	padding: 2,
});

if (result) {
	console.log("Rasterize result:");
	console.log("  Bitmap size:", result.bitmap.width, "x", result.bitmap.rows);
	console.log("  Buffer length:", result.bitmap.buffer.length);
	console.log("  Non-zero pixels:", result.bitmap.buffer.filter(v => v > 0).length);
	console.log("  Bearing:", result.bearingX, result.bearingY);

	// Print ASCII art of the glyph
	console.log("\nASCII preview:");
	const chars = " .:-=+*#%@";
	for (let y = 0; y < result.bitmap.rows; y++) {
		let line = "";
		for (let x = 0; x < result.bitmap.width; x++) {
			const val = result.bitmap.buffer[y * result.bitmap.pitch + x] ?? 0;
			const charIdx = Math.floor(val / 256 * chars.length);
			line += chars[Math.min(charIdx, chars.length - 1)];
		}
		console.log(line);
	}
} else {
	console.log("Rasterization failed!");
}
