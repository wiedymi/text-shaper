import type { Reader } from "../../font/binary/reader.ts";
import type { GlyphId, uint16 } from "../../types.ts";

/** Range record for Format 2 */
interface RangeRecord {
	startGlyphId: GlyphId;
	endGlyphId: GlyphId;
	startCoverageIndex: uint16;
}

/**
 * Coverage table - maps glyph IDs to coverage indices.
 *
 * IMPORTANT: This is a unified class (not interface + implementations) to ensure
 * monomorphic call sites in V8. Polymorphic calls can be 7-8x slower!
 */
export class Coverage {
	// Format 1: hash map for O(1) lookup
	private readonly glyphMap: Map<GlyphId, number> | null;
	// Format 2: ranges for binary search
	private readonly ranges: RangeRecord[] | null;
	// Glyph array for Format 1 (used by glyphs())
	private readonly glyphArray: Uint16Array | null;
	// Cached size
	readonly size: number;

	private constructor(
		glyphMap: Map<GlyphId, number> | null,
		ranges: RangeRecord[] | null,
		glyphArray: Uint16Array | null,
		size: number,
	) {
		this.glyphMap = glyphMap;
		this.ranges = ranges;
		this.glyphArray = glyphArray;
		this.size = size;
	}

	/** Create Format 1 coverage (individual glyphs) */
	static format1(glyphArray: Uint16Array): Coverage {
		const glyphMap = new Map<GlyphId, number>();
		for (let i = 0; i < glyphArray.length; i++) {
			glyphMap.set(glyphArray[i]!, i);
		}
		return new Coverage(glyphMap, null, glyphArray, glyphArray.length);
	}

	/** Create Format 2 coverage (ranges) */
	static format2(ranges: RangeRecord[]): Coverage {
		let size = 0;
		if (ranges.length > 0) {
			const lastRange = ranges[ranges.length - 1];
			if (lastRange) {
				size = lastRange.startCoverageIndex + (lastRange.endGlyphId - lastRange.startGlyphId + 1);
			}
		}
		return new Coverage(null, ranges, null, size);
	}

	/** Get coverage index for a glyph ID, or null if not covered */
	get(glyphId: GlyphId): number | null {
		// Format 1: O(1) hash lookup
		if (this.glyphMap) {
			return this.glyphMap.get(glyphId) ?? null;
		}

		// Format 2: Binary search through ranges
		const ranges = this.ranges!;
		let low = 0;
		let high = ranges.length - 1;

		while (low <= high) {
			const mid = (low + high) >>> 1;
			const range = ranges[mid]!;

			if (glyphId > range.endGlyphId) {
				low = mid + 1;
			} else if (glyphId < range.startGlyphId) {
				high = mid - 1;
			} else {
				return range.startCoverageIndex + (glyphId - range.startGlyphId);
			}
		}

		return null;
	}

	/** Check if glyph is covered */
	covers(glyphId: GlyphId): boolean {
		return this.get(glyphId) !== null;
	}

	/** Get all covered glyph IDs */
	glyphs(): GlyphId[] {
		// Format 1 - manual copy is faster than Array.from
		if (this.glyphArray) {
			const arr = this.glyphArray;
			const result = new Array<GlyphId>(arr.length);
			for (let i = 0; i < arr.length; i++) {
				result[i] = arr[i]!;
			}
			return result;
		}

		// Format 2
		const result: GlyphId[] = [];
		const ranges = this.ranges!;
		for (let i = 0; i < ranges.length; i++) {
			const range = ranges[i]!;
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
		return Coverage.format1(glyphArray);
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

		return Coverage.format2(ranges);
	}

	throw new Error(`Unknown Coverage format: ${format}`);
}

/** Parse Coverage from offset (creates sub-reader) */
export function parseCoverageAt(reader: Reader, offset: number): Coverage {
	return parseCoverage(reader.sliceFrom(offset));
}
