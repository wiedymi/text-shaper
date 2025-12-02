import type { FWord, GlyphId, UFWord } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/** Horizontal metric for a glyph */
export interface LongHorMetric {
	advanceWidth: UFWord;
	lsb: FWord; // left side bearing
}

/** Horizontal metrics table */
export interface HmtxTable {
	hMetrics: LongHorMetric[];
	leftSideBearings: FWord[];
}

/**
 * Parse hmtx table.
 * @param reader - Reader positioned at hmtx table start
 * @param numberOfHMetrics - From hhea table
 * @param numGlyphs - From maxp table
 */
export function parseHmtx(
	reader: Reader,
	numberOfHMetrics: number,
	numGlyphs: number,
): HmtxTable {
	// Read full metrics (advanceWidth + lsb)
	const hMetrics: LongHorMetric[] = new Array(numberOfHMetrics);
	for (let i = 0; i < numberOfHMetrics; i++) {
		hMetrics[i] = {
			advanceWidth: reader.ufword(),
			lsb: reader.fword(),
		};
	}

	// Remaining glyphs share the last advanceWidth, only store lsb
	const numLeftSideBearings = numGlyphs - numberOfHMetrics;
	const leftSideBearings: FWord[] = new Array(numLeftSideBearings);
	for (let i = 0; i < numLeftSideBearings; i++) {
		leftSideBearings[i] = reader.fword();
	}

	return { hMetrics, leftSideBearings };
}

/** Get advance width for a glyph */
export function getAdvanceWidth(hmtx: HmtxTable, glyphId: GlyphId): number {
	if (glyphId < hmtx.hMetrics.length) {
		return hmtx.hMetrics[glyphId]?.advanceWidth;
	}
	// Use last advanceWidth for remaining glyphs
	return hmtx.hMetrics[hmtx.hMetrics.length - 1]?.advanceWidth;
}

/** Get left side bearing for a glyph */
export function getLeftSideBearing(hmtx: HmtxTable, glyphId: GlyphId): number {
	if (glyphId < hmtx.hMetrics.length) {
		return hmtx.hMetrics[glyphId]?.lsb;
	}
	const idx = glyphId - hmtx.hMetrics.length;
	return hmtx.leftSideBearings[idx] ?? 0;
}
