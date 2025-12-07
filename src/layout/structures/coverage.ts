import type { Reader } from "../../font/binary/reader.ts";
import type { GlyphId, uint16 } from "../../types.ts";

/** Coverage table - maps glyph IDs to coverage indices */
export interface Coverage {
	/** Get coverage index for a glyph ID, or null if not covered */
	get(glyphId: GlyphId): number | null;

	/** Check if glyph is covered */
	covers(glyphId: GlyphId): boolean;

	/** Get all covered glyph IDs */
	glyphs(): GlyphId[];

	/** Number of covered glyphs */
	readonly size: number;
}

/** Format 1: Individual glyph IDs */
class CoverageFormat1 implements Coverage {
	private readonly glyphArray: Uint16Array;

	constructor(glyphArray: Uint16Array) {
		this.glyphArray = glyphArray;
	}

	get size(): number {
		return this.glyphArray.length;
	}

	get(glyphId: GlyphId): number | null {
		// Binary search since glyphs are sorted
		let low = 0;
		let high = this.glyphArray.length - 1;

		while (low <= high) {
			const mid = (low + high) >>> 1;
			const midVal = this.glyphArray[mid];
			if (midVal === undefined) continue;

			if (midVal < glyphId) {
				low = mid + 1;
			} else if (midVal > glyphId) {
				high = mid - 1;
			} else {
				return mid; // Found - return coverage index
			}
		}

		return null; // Not found
	}

	covers(glyphId: GlyphId): boolean {
		// Reuse binary search - no redundant Set needed
		return this.get(glyphId) !== null;
	}

	glyphs(): GlyphId[] {
		return Array.from(this.glyphArray);
	}
}

/** Range record for Format 2 */
interface RangeRecord {
	startGlyphId: GlyphId;
	endGlyphId: GlyphId;
	startCoverageIndex: uint16;
}

/** Format 2: Ranges of glyph IDs */
class CoverageFormat2 implements Coverage {
	private readonly ranges: RangeRecord[];
	private readonly _size: number;

	constructor(ranges: RangeRecord[]) {
		this.ranges = ranges;
		// Calculate total size
		if (ranges.length === 0) {
			this._size = 0;
		} else {
			const lastRange = ranges[ranges.length - 1];
			if (lastRange) {
				this._size =
					lastRange.startCoverageIndex +
					(lastRange.endGlyphId - lastRange.startGlyphId + 1);
			} else {
				this._size = 0;
			}
		}
	}

	get size(): number {
		return this._size;
	}

	get(glyphId: GlyphId): number | null {
		// Binary search through ranges
		let low = 0;
		let high = this.ranges.length - 1;

		while (low <= high) {
			const mid = (low + high) >>> 1;
			const range = this.ranges[mid];
			if (!range) continue;

			if (glyphId > range.endGlyphId) {
				low = mid + 1;
			} else if (glyphId < range.startGlyphId) {
				high = mid - 1;
			} else {
				// Found - calculate coverage index
				return range.startCoverageIndex + (glyphId - range.startGlyphId);
			}
		}

		return null;
	}

	covers(glyphId: GlyphId): boolean {
		return this.get(glyphId) !== null;
	}

	glyphs(): GlyphId[] {
		const result: GlyphId[] = [];
		for (const range of this.ranges) {
			for (let g = range.startGlyphId; g <= range.endGlyphId; g++) {
				result.push(g);
			}
		}
		return result;
	}
}

/** Parse a Coverage table */
export function parseCoverage(reader: Reader): Coverage {
	const format = reader.uint16();

	if (format === 1) {
		const glyphCount = reader.uint16();
		const glyphArray = reader.uint16Array(glyphCount);
		return new CoverageFormat1(glyphArray);
	}

	if (format === 2) {
		const rangeCount = reader.uint16();
		const ranges: RangeRecord[] = new Array(rangeCount);

		for (let i = 0; i < rangeCount; i++) {
			ranges[i] = {
				startGlyphId: reader.uint16(),
				endGlyphId: reader.uint16(),
				startCoverageIndex: reader.uint16(),
			};
		}

		return new CoverageFormat2(ranges);
	}

	throw new Error(`Unknown Coverage format: ${format}`);
}

/** Parse Coverage from offset (creates sub-reader) */
export function parseCoverageAt(reader: Reader, offset: number): Coverage {
	return parseCoverage(reader.sliceFrom(offset));
}
