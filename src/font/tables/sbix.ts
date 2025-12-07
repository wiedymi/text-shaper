import type { GlyphId, int16, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Standard Bitmap Graphics table (sbix)
 * Apple's bitmap/PNG glyph table for color emoji and bitmap fonts
 */
export interface SbixTable {
	version: uint16;
	flags: uint16;
	strikes: SbixStrike[];
}

/**
 * Strike (bitmap size) in sbix
 */
export interface SbixStrike {
	ppem: uint16;
	ppi: uint16;
	glyphData: Map<GlyphId, SbixGlyph>;
}

/**
 * Glyph data in sbix
 */
export interface SbixGlyph {
	originOffsetX: int16;
	originOffsetY: int16;
	graphicType: string; // 4-char tag: 'png ', 'jpg ', 'tiff', 'pdf ', etc.
	data: Uint8Array;
}

/**
 * Common graphic types in sbix
 */
export const SbixGraphicType = {
	PNG: "png ",
	JPG: "jpg ",
	TIFF: "tiff",
	PDF: "pdf ",
	MASK: "mask", // Mask for another glyph
	DUPE: "dupe", // Duplicate of another glyph (data is glyph ID)
} as const;

/**
 * Parse sbix table
 */
export function parseSbix(reader: Reader, numGlyphs: number): SbixTable {
	const tableStart = reader.offset;
	const version = reader.uint16();
	const flags = reader.uint16();
	const numStrikes = reader.uint32();

	// Read strike offsets
	const strikeOffsets: uint32[] = [];
	for (let i = 0; i < numStrikes; i++) {
		strikeOffsets.push(reader.uint32());
	}

	// Parse each strike
	const strikes: SbixStrike[] = [];
	for (let i = 0; i < strikeOffsets.length; i++) {
		const strikeOffset = strikeOffsets[i]!;
		const strike = parseStrike(reader, tableStart + strikeOffset, numGlyphs);
		strikes.push(strike);
	}

	return { version, flags, strikes };
}

function parseStrike(
	reader: Reader,
	strikeOffset: number,
	numGlyphs: number,
): SbixStrike {
	const strikeReader = reader.sliceFrom(strikeOffset);
	const ppem = strikeReader.uint16();
	const ppi = strikeReader.uint16();

	// Read glyph data offsets (numGlyphs + 1 for sentinel)
	const glyphDataOffsets: uint32[] = [];
	for (let i = 0; i <= numGlyphs; i++) {
		glyphDataOffsets.push(strikeReader.uint32());
	}

	// Parse glyph data
	const glyphData = new Map<GlyphId, SbixGlyph>();

	for (let glyphId = 0; glyphId < numGlyphs; glyphId++) {
		const offset = glyphDataOffsets[glyphId];
		const nextOffset = glyphDataOffsets[glyphId + 1];
		if (offset === undefined || nextOffset === undefined) continue;
		const dataLength = nextOffset - offset;

		if (dataLength <= 8) {
			// No data or just header (minimum is 8 bytes for header)
			continue;
		}

		const glyphReader = reader.sliceFrom(strikeOffset + offset);
		const originOffsetX = glyphReader.int16();
		const originOffsetY = glyphReader.int16();
		const graphicType = glyphReader.tagString();

		// Read actual image data
		const imageDataLength = dataLength - 8;
		const data = glyphReader.bytes(imageDataLength);

		glyphData.set(glyphId, {
			originOffsetX,
			originOffsetY,
			graphicType,
			data,
		});
	}

	return { ppem, ppi, glyphData };
}

/**
 * Get glyph bitmap for a specific ppem
 * Returns the best matching strike
 */
export function getGlyphBitmap(
	sbix: SbixTable,
	glyphId: GlyphId,
	ppem: number,
): SbixGlyph | null {
	// Find best matching strike
	let bestStrike: SbixStrike | null = null;
	let bestDiff = Infinity;

	for (let i = 0; i < sbix.strikes.length; i++) {
		const strike = sbix.strikes[i]!;
		const diff = Math.abs(strike.ppem - ppem);
		if (diff < bestDiff) {
			bestDiff = diff;
			bestStrike = strike;
		}
	}

	if (!bestStrike) return null;

	return bestStrike.glyphData.get(glyphId) ?? null;
}

/**
 * Get exact ppem strike
 */
export function getStrikeForPpem(
	sbix: SbixTable,
	ppem: number,
): SbixStrike | null {
	return sbix.strikes.find((s) => s.ppem === ppem) ?? null;
}

/**
 * Get all available ppem sizes
 */
export function getAvailablePpemSizes(sbix: SbixTable): number[] {
	return sbix.strikes.map((s) => s.ppem).sort((a, b) => a - b);
}

/**
 * Check if glyph has bitmap data
 */
export function hasGlyphBitmap(
	sbix: SbixTable,
	glyphId: GlyphId,
	ppem?: number,
): boolean {
	if (ppem !== undefined) {
		const strike = getStrikeForPpem(sbix, ppem);
		return strike?.glyphData.has(glyphId) ?? false;
	}

	// Check any strike
	for (let i = 0; i < sbix.strikes.length; i++) {
		const strike = sbix.strikes[i]!;
		if (strike.glyphData.has(glyphId)) {
			return true;
		}
	}
	return false;
}

/**
 * Resolve dupe graphic type
 * Returns the actual glyph data for duplicates
 */
export function resolveDupeGlyph(
	sbix: SbixTable,
	strike: SbixStrike,
	glyph: SbixGlyph,
): SbixGlyph | null {
	if (glyph.graphicType !== SbixGraphicType.DUPE) {
		return glyph;
	}

	// Data contains the glyph ID to reference
	if (glyph.data.length < 2) return null;

	const dupeGlyphId = ((glyph.data[0] ?? 0) << 8) | (glyph.data[1] ?? 0);
	const resolved = strike.glyphData.get(dupeGlyphId);

	if (!resolved) return null;

	// Recursively resolve if it's also a dupe
	if (resolved.graphicType === SbixGraphicType.DUPE) {
		return resolveDupeGlyph(sbix, strike, resolved);
	}

	return resolved;
}
