import type { GlyphId, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * loca table - Glyph location index
 * Maps glyph IDs to byte offsets in the glyf table
 */

export interface LocaTable {
	/** Glyph offsets (numGlyphs + 1 entries) */
	offsets: uint32[];
	/** Whether the font uses short (16-bit) or long (32-bit) offsets */
	isShort: boolean;
}

/**
 * Parse loca table
 * @param reader - Reader positioned at start of loca table
 * @param numGlyphs - Number of glyphs from maxp table
 * @param indexToLocFormat - 0 for short offsets, 1 for long (from head table)
 */
export function parseLoca(
	reader: Reader,
	numGlyphs: number,
	indexToLocFormat: number,
): LocaTable {
	const isShort = indexToLocFormat === 0;
	const offsets: uint32[] = [];

	// loca has numGlyphs + 1 entries (last entry marks end of last glyph)
	const count = numGlyphs + 1;

	if (isShort) {
		// Short format: offsets are uint16, multiply by 2 to get actual byte offset
		for (let i = 0; i < count; i++) {
			offsets.push(reader.uint16() * 2);
		}
	} else {
		// Long format: offsets are uint32
		for (let i = 0; i < count; i++) {
			offsets.push(reader.uint32());
		}
	}

	return { offsets, isShort };
}

/**
 * Get byte offset and length for a glyph in the glyf table
 * Returns null if glyph has no outline (empty glyph)
 */
export function getGlyphLocation(
	loca: LocaTable,
	glyphId: GlyphId,
): { offset: uint32; length: uint32 } | null {
	if (glyphId < 0 || glyphId >= loca.offsets.length - 1) {
		return null;
	}

	const offset = loca.offsets[glyphId];
	const nextOffset = loca.offsets[glyphId + 1];
	if (offset === undefined || nextOffset === undefined) {
		return null;
	}

	const length = nextOffset - offset;

	// Zero-length means empty glyph (space, etc.)
	if (length === 0) {
		return null;
	}

	return { offset, length };
}

/**
 * Check if a glyph has outline data
 */
export function hasGlyphOutline(loca: LocaTable, glyphId: GlyphId): boolean {
	return getGlyphLocation(loca, glyphId) !== null;
}
