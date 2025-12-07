import type { Reader } from "../../font/binary/reader.ts";
import type { GlyphId, uint16 } from "../../types.ts";

/** Class Definition table - maps glyph IDs to class values */
export interface ClassDef {
	/** Get class for a glyph ID (returns 0 if not defined) */
	get(glyphId: GlyphId): number;

	/** Get all glyphs in a specific class */
	glyphsInClass(classValue: number): GlyphId[];
}

/** Format 1: Array of class values for a range of glyph IDs */
class ClassDefFormat1 implements ClassDef {
	private readonly startGlyphId: GlyphId;
	private readonly classValueArray: Uint16Array;

	constructor(startGlyphId: GlyphId, classValueArray: Uint16Array) {
		this.startGlyphId = startGlyphId;
		this.classValueArray = classValueArray;
	}

	get(glyphId: GlyphId): number {
		const index = glyphId - this.startGlyphId;
		// Uint16Array always returns a number (0 for uninitialized), no null coalescing needed
		return index >= 0 && index < this.classValueArray.length
			? this.classValueArray[index]!
			: 0;
	}

	glyphsInClass(classValue: number): GlyphId[] {
		const result: GlyphId[] = [];
		for (let i = 0; i < this.classValueArray.length; i++) {
			if (this.classValueArray[i] === classValue) {
				result.push(this.startGlyphId + i);
			}
		}
		return result;
	}
}

/** Class range record for Format 2 */
interface ClassRangeRecord {
	startGlyphId: GlyphId;
	endGlyphId: GlyphId;
	classValue: uint16;
}

/** Format 2: Ranges of glyph IDs with class values - uses hash for small ranges */
class ClassDefFormat2 implements ClassDef {
	private readonly ranges: ClassRangeRecord[];
	private readonly glyphMap: Map<GlyphId, number> | null;

	constructor(ranges: ClassRangeRecord[]) {
		this.ranges = ranges;

		// Calculate total glyphs covered
		let totalGlyphs = 0;
		for (let i = 0; i < ranges.length; i++) {
			const range = ranges[i]!;
			totalGlyphs += range.endGlyphId - range.startGlyphId + 1;
		}

		// Use hash map for small-large tables (< 10000 glyphs) for O(1) lookup
		// Very large tables stick with binary search to avoid memory overhead
		if (totalGlyphs < 10000) {
			this.glyphMap = new Map();
			for (let i = 0; i < ranges.length; i++) {
				const range = ranges[i]!;
				for (let g = range.startGlyphId; g <= range.endGlyphId; g++) {
					this.glyphMap.set(g, range.classValue);
				}
			}
		} else {
			this.glyphMap = null;
		}
	}

	get(glyphId: GlyphId): number {
		// O(1) hash lookup if available
		if (this.glyphMap) {
			return this.glyphMap.get(glyphId) ?? 0;
		}

		// Binary search for large tables
		let low = 0;
		let high = this.ranges.length - 1;

		while (low <= high) {
			const mid = (low + high) >>> 1;
			const range = this.ranges[mid]!;

			if (glyphId > range.endGlyphId) {
				low = mid + 1;
			} else if (glyphId < range.startGlyphId) {
				high = mid - 1;
			} else {
				return range.classValue;
			}
		}

		return 0;
	}

	glyphsInClass(classValue: number): GlyphId[] {
		const result: GlyphId[] = [];
		for (let i = 0; i < this.ranges.length; i++) {
			const range = this.ranges[i]!;
			if (range.classValue === classValue) {
				for (let g = range.startGlyphId; g <= range.endGlyphId; g++) {
					result.push(g);
				}
			}
		}
		return result;
	}
}

/** Empty class definition (all glyphs are class 0) */
class ClassDefEmpty implements ClassDef {
	get(_glyphId: GlyphId): number {
		return 0;
	}

	glyphsInClass(_classValue: number): GlyphId[] {
		return [];
	}
}

/** Singleton empty ClassDef */
export const EMPTY_CLASS_DEF: ClassDef = new ClassDefEmpty();

/** Parse a Class Definition table */
export function parseClassDef(reader: Reader): ClassDef {
	const format = reader.uint16();

	if (format === 1) {
		const startGlyphId = reader.uint16();
		const glyphCount = reader.uint16();
		const classValueArray = reader.uint16Array(glyphCount);
		return new ClassDefFormat1(startGlyphId, classValueArray);
	}

	if (format === 2) {
		const classRangeCount = reader.uint16();
		const ranges: ClassRangeRecord[] = new Array(classRangeCount);

		for (let i = 0; i < classRangeCount; i++) {
			ranges[i] = {
				startGlyphId: reader.uint16(),
				endGlyphId: reader.uint16(),
				classValue: reader.uint16(),
			};
		}

		return new ClassDefFormat2(ranges);
	}

	throw new Error(`Unknown ClassDef format: ${format}`);
}

/** Parse ClassDef from offset, or return empty if offset is 0 */
export function parseClassDefAt(reader: Reader, offset: number): ClassDef {
	if (offset === 0) {
		return EMPTY_CLASS_DEF;
	}
	return parseClassDef(reader.sliceFrom(offset));
}
