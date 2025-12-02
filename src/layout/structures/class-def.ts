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
		if (index >= 0 && index < this.classValueArray.length) {
			return this.classValueArray[index]!;
		}
		return 0; // Default class
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

/** Format 2: Ranges of glyph IDs with class values */
class ClassDefFormat2 implements ClassDef {
	private readonly ranges: ClassRangeRecord[];

	constructor(ranges: ClassRangeRecord[]) {
		this.ranges = ranges;
	}

	get(glyphId: GlyphId): number {
		// Binary search through ranges
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

		return 0; // Default class
	}

	glyphsInClass(classValue: number): GlyphId[] {
		const result: GlyphId[] = [];
		for (const range of this.ranges) {
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
