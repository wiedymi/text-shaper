import type { Reader } from "../../font/binary/reader.ts";
import type { GlyphId, uint16 } from "../../types.ts";

/** Class range record for Format 2 */
interface ClassRangeRecord {
	startGlyphId: GlyphId;
	endGlyphId: GlyphId;
	classValue: uint16;
}

/**
 * Class Definition table - maps glyph IDs to class values.
 *
 * IMPORTANT: This is a unified class (not interface + implementations) to ensure
 * monomorphic call sites in V8. Polymorphic calls can be 7-8x slower!
 */
export class ClassDef {
	// Format 1: array lookup
	private readonly startGlyphId: GlyphId;
	private readonly classValueArray: Uint16Array | null;
	// Format 2: ranges + optional hash map
	private readonly ranges: ClassRangeRecord[] | null;
	private readonly glyphMap: Map<GlyphId, number> | null;
	// Empty flag
	private readonly isEmpty: boolean;

	private constructor(
		startGlyphId: GlyphId,
		classValueArray: Uint16Array | null,
		ranges: ClassRangeRecord[] | null,
		glyphMap: Map<GlyphId, number> | null,
		isEmpty: boolean,
	) {
		this.startGlyphId = startGlyphId;
		this.classValueArray = classValueArray;
		this.ranges = ranges;
		this.glyphMap = glyphMap;
		this.isEmpty = isEmpty;
	}

	/** Create Format 1 ClassDef (array of class values) */
	static format1(
		startGlyphId: GlyphId,
		classValueArray: Uint16Array,
	): ClassDef {
		return new ClassDef(startGlyphId, classValueArray, null, null, false);
	}

	/** Create Format 2 ClassDef (ranges) */
	static format2(ranges: ClassRangeRecord[]): ClassDef {
		// Calculate total glyphs covered
		let totalGlyphs = 0;
		for (let i = 0; i < ranges.length; i++) {
			const range = ranges[i]!;
			totalGlyphs += range.endGlyphId - range.startGlyphId + 1;
		}

		// Use hash map for small-medium tables (< 10000 glyphs) for O(1) lookup
		// Very large tables stick with binary search to avoid memory overhead
		let glyphMap: Map<GlyphId, number> | null = null;
		if (totalGlyphs < 10000) {
			glyphMap = new Map();
			for (let i = 0; i < ranges.length; i++) {
				const range = ranges[i]!;
				for (let g = range.startGlyphId; g <= range.endGlyphId; g++) {
					glyphMap.set(g, range.classValue);
				}
			}
		}

		return new ClassDef(0, null, ranges, glyphMap, false);
	}

	/** Create empty ClassDef (all glyphs are class 0) */
	static empty(): ClassDef {
		return EMPTY_CLASS_DEF_INSTANCE;
	}

	/** Get class for a glyph ID (returns 0 if not defined) */
	get(glyphId: GlyphId): number {
		// Empty: all glyphs are class 0
		if (this.isEmpty) {
			return 0;
		}

		// Format 1: array lookup
		if (this.classValueArray) {
			const index = glyphId - this.startGlyphId;
			return index >= 0 && index < this.classValueArray.length
				? this.classValueArray[index]!
				: 0;
		}

		// Format 2: hash or binary search
		if (this.glyphMap) {
			return this.glyphMap.get(glyphId) ?? 0;
		}

		// Binary search for large tables
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
				return range.classValue;
			}
		}

		return 0;
	}

	/** Get all glyphs in a specific class */
	glyphsInClass(classValue: number): GlyphId[] {
		// Empty
		if (this.isEmpty) {
			return [];
		}

		// Format 1
		if (this.classValueArray) {
			const result: GlyphId[] = [];
			for (let i = 0; i < this.classValueArray.length; i++) {
				if (this.classValueArray[i] === classValue) {
					result.push(this.startGlyphId + i);
				}
			}
			return result;
		}

		// Format 2
		const result: GlyphId[] = [];
		const ranges = this.ranges!;
		for (let i = 0; i < ranges.length; i++) {
			const range = ranges[i]!;
			if (range.classValue === classValue) {
				for (let g = range.startGlyphId; g <= range.endGlyphId; g++) {
					result.push(g);
				}
			}
		}
		return result;
	}
}

/** Singleton empty ClassDef - created once at module load */
const EMPTY_CLASS_DEF_INSTANCE = new (ClassDef as any)(
	0,
	null,
	null,
	null,
	true,
);

/** Singleton empty ClassDef for external use */
export const EMPTY_CLASS_DEF: ClassDef = EMPTY_CLASS_DEF_INSTANCE;

/** Parse a Class Definition table */
export function parseClassDef(reader: Reader): ClassDef {
	const format = reader.uint16();

	if (format === 1) {
		const startGlyphId = reader.uint16();
		const glyphCount = reader.uint16();
		const classValueArray = reader.uint16Array(glyphCount);
		return ClassDef.format1(startGlyphId, classValueArray);
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

		return ClassDef.format2(ranges);
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
