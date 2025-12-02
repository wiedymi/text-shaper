import type { GlyphId, int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Vertical Metrics table (vmtx)
 * Contains vertical metrics for each glyph
 */
export interface VmtxTable {
	/** Vertical metrics (advance height + top side bearing) */
	vMetrics: VerticalMetric[];
	/** Top side bearings for remaining glyphs */
	topSideBearings: int16[];
}

/**
 * Vertical metric record
 */
export interface VerticalMetric {
	/** Advance height in font units */
	advanceHeight: uint16;
	/** Top side bearing in font units */
	topSideBearing: int16;
}

/**
 * Parse vmtx table
 * @param reader Binary reader
 * @param numberOfVMetrics From vhea table
 * @param numGlyphs Total number of glyphs
 */
export function parseVmtx(
	reader: Reader,
	numberOfVMetrics: number,
	numGlyphs: number,
): VmtxTable {
	const vMetrics: VerticalMetric[] = [];

	// Read full vertical metrics
	for (let i = 0; i < numberOfVMetrics; i++) {
		vMetrics.push({
			advanceHeight: reader.uint16(),
			topSideBearing: reader.int16(),
		});
	}

	// Read additional top side bearings
	const topSideBearings: int16[] = [];
	const remaining = numGlyphs - numberOfVMetrics;

	for (let i = 0; i < remaining; i++) {
		topSideBearings.push(reader.int16());
	}

	return { vMetrics, topSideBearings };
}

/**
 * Get vertical metrics for a glyph
 */
export function getVerticalMetrics(
	vmtx: VmtxTable,
	glyphId: GlyphId,
): { advanceHeight: number; topSideBearing: number } {
	if (glyphId < vmtx.vMetrics.length) {
		const metric = vmtx.vMetrics[glyphId]!;
		return {
			advanceHeight: metric.advanceHeight,
			topSideBearing: metric.topSideBearing,
		};
	}

	// Use last advance height, get TSB from array
	const lastMetric = vmtx.vMetrics[vmtx.vMetrics.length - 1];
	const advanceHeight = lastMetric?.advanceHeight ?? 0;
	const tsbIndex = glyphId - vmtx.vMetrics.length;
	const topSideBearing = vmtx.topSideBearings[tsbIndex] ?? 0;

	return { advanceHeight, topSideBearing };
}
