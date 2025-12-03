/**
 * gasp table - Grid-fitting And Scan-conversion Procedure
 *
 * This table controls when grid-fitting (hinting) and anti-aliasing
 * should be applied based on the rendering size (ppem).
 */

import type { Reader } from "../binary/reader.ts";

/**
 * Gasp behavior flags
 */
export const GaspFlag = {
	/** Use grid-fitting (hinting) */
	GridFit: 0x0001,
	/** Use gray-scale rendering (anti-aliasing) */
	DoGray: 0x0002,
	/** Use symmetric grid-fitting (ClearType) */
	SymmetricGridFit: 0x0004,
	/** Use symmetric smoothing (ClearType) */
	SymmetricSmoothing: 0x0008,
} as const;

/**
 * A ppem range with associated behavior
 */
export interface GaspRange {
	/** Maximum ppem for this range (inclusive) */
	maxPPEM: number;
	/** Behavior flags for this range */
	behavior: number;
}

/**
 * gasp table
 */
export interface GaspTable {
	/** Version (0 or 1) */
	version: number;
	/** Ranges sorted by maxPPEM */
	ranges: GaspRange[];
}

/**
 * Parse gasp table
 */
export function parseGasp(reader: Reader): GaspTable {
	const version = reader.uint16();
	const numRanges = reader.uint16();

	const ranges: GaspRange[] = [];
	for (let i = 0; i < numRanges; i++) {
		const maxPPEM = reader.uint16();
		const behavior = reader.uint16();
		ranges.push({ maxPPEM, behavior });
	}

	// Ranges should be sorted by maxPPEM
	ranges.sort((a, b) => a.maxPPEM - b.maxPPEM);

	return { version, ranges };
}

/**
 * Get behavior flags for a specific ppem
 */
export function getGaspBehavior(gasp: GaspTable, ppem: number): number {
	for (const range of gasp.ranges) {
		if (ppem <= range.maxPPEM) {
			return range.behavior;
		}
	}

	// Above all ranges - use last range or default to all features
	if (gasp.ranges.length > 0) {
		return gasp.ranges[gasp.ranges.length - 1]!.behavior;
	}

	return GaspFlag.GridFit | GaspFlag.DoGray;
}

/**
 * Check if grid-fitting should be used
 */
export function shouldGridFit(gasp: GaspTable, ppem: number): boolean {
	return (getGaspBehavior(gasp, ppem) & GaspFlag.GridFit) !== 0;
}

/**
 * Check if gray-scale rendering should be used
 */
export function shouldDoGray(gasp: GaspTable, ppem: number): boolean {
	return (getGaspBehavior(gasp, ppem) & GaspFlag.DoGray) !== 0;
}
