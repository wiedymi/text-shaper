import type { GlyphId, int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Vertical Origin table (VORG)
 * Provides y-coordinate of vertical origin for CFF fonts
 * Used for proper vertical text layout in CJK fonts
 */
export interface VorgTable {
	majorVersion: uint16;
	minorVersion: uint16;
	defaultVertOriginY: int16;
	vertOriginYMetrics: VertOriginYMetric[];
}

/**
 * Vertical origin metric for a specific glyph
 */
export interface VertOriginYMetric {
	glyphIndex: GlyphId;
	vertOriginY: int16;
}

/**
 * Parse VORG table
 */
export function parseVorg(reader: Reader): VorgTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const defaultVertOriginY = reader.int16();
	const numVertOriginYMetrics = reader.uint16();

	const vertOriginYMetrics: VertOriginYMetric[] = [];
	for (let i = 0; i < numVertOriginYMetrics; i++) {
		vertOriginYMetrics.push({
			glyphIndex: reader.uint16(),
			vertOriginY: reader.int16(),
		});
	}

	// Sort by glyph index for binary search
	vertOriginYMetrics.sort((a, b) => a.glyphIndex - b.glyphIndex);

	return {
		majorVersion,
		minorVersion,
		defaultVertOriginY,
		vertOriginYMetrics,
	};
}

/**
 * Get vertical origin Y coordinate for a glyph
 * Returns the y-coordinate of the glyph's vertical origin
 */
export function getVertOriginY(vorg: VorgTable, glyphId: GlyphId): int16 {
	// Binary search for the glyph
	const metrics = vorg.vertOriginYMetrics;
	let lo = 0;
	let hi = metrics.length - 1;

	while (lo <= hi) {
		const mid = (lo + hi) >>> 1;
		const metric = metrics[mid]!;

		if (metric.glyphIndex === glyphId) {
			return metric.vertOriginY;
		} else if (metric.glyphIndex < glyphId) {
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	// Not found, use default
	return vorg.defaultVertOriginY;
}

/**
 * Check if a glyph has a specific vertical origin entry
 */
export function hasVertOriginY(vorg: VorgTable, glyphId: GlyphId): boolean {
	const metrics = vorg.vertOriginYMetrics;
	let lo = 0;
	let hi = metrics.length - 1;

	while (lo <= hi) {
		const mid = (lo + hi) >>> 1;
		const metric = metrics[mid]!;

		if (metric.glyphIndex === glyphId) {
			return true;
		} else if (metric.glyphIndex < glyphId) {
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	return false;
}
