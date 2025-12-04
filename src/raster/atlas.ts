/**
 * Texture atlas generator for GPU font rendering
 *
 * Packs multiple glyph bitmaps into a single texture atlas
 * using shelf/skyline bin packing algorithm.
 */

import type { Font } from "../font/font.ts";
import { rasterizeGlyph } from "./rasterize.ts";
import {
	type AtlasOptions,
	type Bitmap,
	createBitmap,
	type GlyphAtlas,
	type GlyphMetrics,
	PixelMode,
} from "./types.ts";

/**
 * Shelf packing node
 */
interface Shelf {
	y: number;
	height: number;
	width: number;
}

/**
 * Build a texture atlas from a set of glyphs
 */
export function buildAtlas(
	font: Font,
	glyphIds: number[],
	options: AtlasOptions,
): GlyphAtlas {
	const {
		fontSize,
		padding = 1,
		maxWidth = 2048,
		maxHeight = 2048,
		pixelMode = PixelMode.Gray,
	} = options;

	// First pass: rasterize all glyphs and collect sizes
	const glyphData: Array<{
		glyphId: number;
		bitmap: Bitmap;
		bearingX: number;
		bearingY: number;
		advance: number;
	}> = [];

	const scale = fontSize / font.unitsPerEm;

	for (const glyphId of glyphIds) {
		const result = rasterizeGlyph(font, glyphId, fontSize, {
			padding: 0,
			pixelMode,
		});
		if (!result) continue;

		const advance = font.advanceWidth(glyphId) * scale;

		glyphData.push({
			glyphId,
			bitmap: result.bitmap,
			bearingX: result.bearingX,
			bearingY: result.bearingY,
			advance,
		});
	}

	// Sort by height (descending) for better packing
	glyphData.sort((a, b) => b.bitmap.rows - a.bitmap.rows);

	// Calculate required atlas size
	const {
		width: atlasWidth,
		height: atlasHeight,
		placements,
	} = packGlyphs(
		glyphData.map((g) => ({
			width: g.bitmap.width + padding * 2,
			height: g.bitmap.rows + padding * 2,
		})),
		maxWidth,
		maxHeight,
	);

	// Create atlas bitmap
	const atlas = createBitmap(atlasWidth, atlasHeight, pixelMode);

	// Copy glyphs into atlas and build metrics map
	const glyphMetrics = new Map<number, GlyphMetrics>();

	for (let i = 0; i < glyphData.length; i++) {
		const glyph = glyphData[i]!;
		const placement = placements[i]!;

		if (!placement.placed) continue;

		// Copy glyph bitmap into atlas
		copyBitmap(
			glyph.bitmap,
			atlas,
			placement.x + padding,
			placement.y + padding,
		);

		// Store metrics
		glyphMetrics.set(glyph.glyphId, {
			glyphId: glyph.glyphId,
			atlasX: placement.x + padding,
			atlasY: placement.y + padding,
			width: glyph.bitmap.width,
			height: glyph.bitmap.rows,
			bearingX: glyph.bearingX,
			bearingY: glyph.bearingY,
			advance: glyph.advance,
		});
	}

	return {
		bitmap: atlas,
		glyphs: glyphMetrics,
		fontSize,
	};
}

/**
 * Build atlas for ASCII printable characters (32-126)
 */
export function buildAsciiAtlas(font: Font, options: AtlasOptions): GlyphAtlas {
	const glyphIds: number[] = [];

	for (let codepoint = 32; codepoint <= 126; codepoint++) {
		const glyphId = font.glyphId(codepoint);
		if (glyphId !== undefined && glyphId !== 0) {
			glyphIds.push(glyphId);
		}
	}

	return buildAtlas(font, glyphIds, options);
}

/**
 * Build atlas for a specific string (including all unique glyphs)
 */
export function buildStringAtlas(
	font: Font,
	text: string,
	options: AtlasOptions,
): GlyphAtlas {
	const glyphIdSet = new Set<number>();

	for (const char of text) {
		const codepoint = char.codePointAt(0);
		if (codepoint === undefined) continue;

		const glyphId = font.glyphId(codepoint);
		if (glyphId !== undefined && glyphId !== 0) {
			glyphIdSet.add(glyphId);
		}
	}

	return buildAtlas(font, Array.from(glyphIdSet), options);
}

/**
 * Placement result for a glyph
 */
interface Placement {
	x: number;
	y: number;
	placed: boolean;
}

/**
 * Pack rectangles using shelf algorithm
 */
function packGlyphs(
	sizes: Array<{ width: number; height: number }>,
	maxWidth: number,
	maxHeight: number,
): { width: number; height: number; placements: Placement[] } {
	const shelves: Shelf[] = [];
	const placements: Placement[] = [];

	let atlasWidth = 0;
	let atlasHeight = 0;

	for (const size of sizes) {
		let placed = false;
		let bestShelf = -1;
		let bestY = maxHeight;

		// Try to find an existing shelf
		for (let i = 0; i < shelves.length; i++) {
			const shelf = shelves[i]!;

			// Check if glyph fits in this shelf
			if (shelf.width + size.width <= maxWidth && size.height <= shelf.height) {
				if (shelf.y < bestY) {
					bestShelf = i;
					bestY = shelf.y;
				}
			}
		}

		if (bestShelf >= 0) {
			// Place in existing shelf
			const shelf = shelves[bestShelf]!;
			placements.push({
				x: shelf.width,
				y: shelf.y,
				placed: true,
			});
			shelf.width += size.width;
			atlasWidth = Math.max(atlasWidth, shelf.width);
			placed = true;
		} else {
			// Create new shelf
			const newY = atlasHeight;

			if (newY + size.height <= maxHeight && size.width <= maxWidth) {
				shelves.push({
					y: newY,
					height: size.height,
					width: size.width,
				});
				placements.push({
					x: 0,
					y: newY,
					placed: true,
				});
				atlasHeight = newY + size.height;
				atlasWidth = Math.max(atlasWidth, size.width);
				placed = true;
			}
		}

		if (!placed) {
			placements.push({ x: 0, y: 0, placed: false });
		}
	}

	// Round up to power of 2 for GPU compatibility
	const finalWidth = nextPowerOf2(atlasWidth);
	const finalHeight = nextPowerOf2(atlasHeight);

	return {
		width: Math.min(finalWidth, maxWidth),
		height: Math.min(finalHeight, maxHeight),
		placements,
	};
}

/**
 * Copy source bitmap into destination at specified position
 */
function copyBitmap(
	src: Bitmap,
	dst: Bitmap,
	dstX: number,
	dstY: number,
): void {
	const bytesPerPixel = src.pixelMode === PixelMode.LCD ? 3 : 1;

	for (let y = 0; y < src.rows; y++) {
		const srcRow = y * src.pitch;
		const dstRow = (dstY + y) * dst.pitch + dstX * bytesPerPixel;

		for (let x = 0; x < src.width * bytesPerPixel; x++) {
			dst.buffer[dstRow + x] = src.buffer[srcRow + x]!;
		}
	}
}

/**
 * Get next power of 2 >= n
 */
function nextPowerOf2(n: number): number {
	if (n <= 0) return 1;
	n--;
	n |= n >> 1;
	n |= n >> 2;
	n |= n >> 4;
	n |= n >> 8;
	n |= n >> 16;
	return n + 1;
}

/**
 * Export atlas to formats suitable for GPU upload
 */
export function atlasToRGBA(atlas: GlyphAtlas): Uint8Array {
	const { bitmap } = atlas;
	const rgba = new Uint8Array(bitmap.width * bitmap.rows * 4);

	for (let y = 0; y < bitmap.rows; y++) {
		for (let x = 0; x < bitmap.width; x++) {
			const srcIdx = y * bitmap.pitch + x;
			const dstIdx = (y * bitmap.width + x) * 4;

			const alpha = bitmap.buffer[srcIdx] ?? 0;

			// White text on transparent background
			rgba[dstIdx] = 255;
			rgba[dstIdx + 1] = 255;
			rgba[dstIdx + 2] = 255;
			rgba[dstIdx + 3] = alpha;
		}
	}

	return rgba;
}

/**
 * Export atlas as single-channel alpha texture
 */
export function atlasToAlpha(atlas: GlyphAtlas): Uint8Array {
	const { bitmap } = atlas;

	if (bitmap.pitch === bitmap.width) {
		return bitmap.buffer;
	}

	// Copy without padding
	const alpha = new Uint8Array(bitmap.width * bitmap.rows);
	for (let y = 0; y < bitmap.rows; y++) {
		for (let x = 0; x < bitmap.width; x++) {
			alpha[y * bitmap.width + x] = bitmap.buffer[y * bitmap.pitch + x]!;
		}
	}

	return alpha;
}

/**
 * Get UV coordinates for a glyph in the atlas
 */
export function getGlyphUV(
	atlas: GlyphAtlas,
	glyphId: number,
): { u0: number; v0: number; u1: number; v1: number } | null {
	const metrics = atlas.glyphs.get(glyphId);
	if (!metrics) return null;

	const { bitmap } = atlas;

	return {
		u0: metrics.atlasX / bitmap.width,
		v0: metrics.atlasY / bitmap.rows,
		u1: (metrics.atlasX + metrics.width) / bitmap.width,
		v1: (metrics.atlasY + metrics.height) / bitmap.rows,
	};
}
