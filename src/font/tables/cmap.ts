import type { GlyphId, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/** Platform IDs */
export const enum PlatformId {
	Unicode = 0,
	Macintosh = 1,
	ISO = 2, // deprecated
	Windows = 3,
	Custom = 4,
}

/** Encoding record in cmap header */
export interface EncodingRecord {
	platformId: uint16;
	encodingId: uint16;
	offset: uint32;
}

/** Base interface for cmap subtables */
interface CmapSubtableBase {
	format: number;
	lookup(codepoint: number): GlyphId | undefined;
}

/** Format 0: Byte encoding table (legacy, 256 entries) */
interface CmapFormat0 extends CmapSubtableBase {
	format: 0;
	glyphIdArray: Uint8Array;
}

/** Format 4: Segment mapping to delta values (BMP characters) */
interface CmapFormat4 extends CmapSubtableBase {
	format: 4;
	segCount: number;
	endCodes: Uint16Array;
	startCodes: Uint16Array;
	idDeltas: Int16Array;
	idRangeOffsets: Uint16Array;
	glyphIdArray: Uint16Array;
}

/** Format 12: Segmented coverage (full Unicode) */
interface CmapFormat12 extends CmapSubtableBase {
	format: 12;
	groups: Array<{
		startCharCode: uint32;
		endCharCode: uint32;
		startGlyphId: uint32;
	}>;
}

/** Format 14: Unicode Variation Sequences */
interface CmapFormat14 extends CmapSubtableBase {
	format: 14;
	lookupVariation(codepoint: number, variationSelector: number): GlyphId | undefined;
}

export type CmapSubtable = CmapFormat0 | CmapFormat4 | CmapFormat12 | CmapFormat14;

/** Character to glyph index mapping table */
export interface CmapTable {
	version: uint16;
	numTables: uint16;
	encodingRecords: EncodingRecord[];
	subtables: Map<string, CmapSubtable>;
	/** Best subtable for Unicode lookup */
	bestSubtable: CmapSubtable | null;
}

export function parseCmap(reader: Reader, tableLength: number): CmapTable {
	const tableStart = reader.offset;
	const version = reader.uint16();
	const numTables = reader.uint16();

	const encodingRecords: EncodingRecord[] = [];
	for (let i = 0; i < numTables; i++) {
		encodingRecords.push({
			platformId: reader.uint16(),
			encodingId: reader.uint16(),
			offset: reader.uint32(),
		});
	}

	// Parse subtables
	const subtables = new Map<string, CmapSubtable>();
	const parsedOffsets = new Set<number>();

	for (const record of encodingRecords) {
		// Skip duplicates (multiple records can point to same subtable)
		if (parsedOffsets.has(record.offset)) {
			const key = `${record.platformId}-${record.encodingId}`;
			// Find existing subtable
			for (const [existingKey, subtable] of subtables) {
				const [existingOffset] = existingKey.split("@");
				if (Number.parseInt(existingOffset ?? "0") === record.offset) {
					subtables.set(key, subtable);
					break;
				}
			}
			continue;
		}
		parsedOffsets.add(record.offset);

		const subtableReader = reader.slice(
			record.offset,
			tableLength - record.offset,
		);
		const subtable = parseCmapSubtable(subtableReader);

		if (subtable) {
			const key = `${record.platformId}-${record.encodingId}`;
			subtables.set(key, subtable);
		}
	}

	// Find best subtable for Unicode lookup
	// Prefer: Windows Unicode full (3-10), Unicode full (0-4), Windows BMP (3-1), Unicode BMP (0-3)
	const preferredKeys = ["3-10", "0-4", "3-1", "0-3", "0-6", "1-0"];
	let bestSubtable: CmapSubtable | null = null;

	for (const key of preferredKeys) {
		const subtable = subtables.get(key);
		if (subtable && subtable.format !== 14) {
			bestSubtable = subtable;
			break;
		}
	}

	// Fallback to first non-format-14 subtable
	if (!bestSubtable) {
		for (const subtable of subtables.values()) {
			if (subtable.format !== 14) {
				bestSubtable = subtable;
				break;
			}
		}
	}

	return {
		version,
		numTables,
		encodingRecords,
		subtables,
		bestSubtable,
	};
}

function parseCmapSubtable(reader: Reader): CmapSubtable | null {
	const format = reader.uint16();

	switch (format) {
		case 0:
			return parseCmapFormat0(reader);
		case 4:
			return parseCmapFormat4(reader);
		case 12:
			return parseCmapFormat12(reader);
		case 14:
			return parseCmapFormat14(reader);
		default:
			// Unsupported format - skip
			return null;
	}
}

function parseCmapFormat0(reader: Reader): CmapFormat0 {
	const _length = reader.uint16();
	const _language = reader.uint16();
	const glyphIdArray = reader.uint8Array(256);

	return {
		format: 0,
		glyphIdArray,
		lookup(codepoint: number): GlyphId | undefined {
			if (codepoint >= 0 && codepoint < 256) {
				return glyphIdArray[codepoint];
			}
			return undefined;
		},
	};
}

function parseCmapFormat4(reader: Reader): CmapFormat4 {
	const _length = reader.uint16();
	const _language = reader.uint16();
	const segCountX2 = reader.uint16();
	const segCount = segCountX2 / 2;

	reader.skip(6); // searchRange, entrySelector, rangeShift

	const endCodes = reader.uint16Array(segCount);
	reader.skip(2); // reservedPad
	const startCodes = reader.uint16Array(segCount);
	const idDeltas = reader.int16Array(segCount);

	// Save position before idRangeOffsets for glyph ID calculation
	const idRangeOffsetPos = reader.offset;
	const idRangeOffsets = reader.uint16Array(segCount);

	// Read remaining glyph IDs
	const remainingBytes = reader.remaining;
	const glyphIdCount = remainingBytes / 2;
	const glyphIdArray = reader.uint16Array(glyphIdCount);

	return {
		format: 4,
		segCount,
		endCodes,
		startCodes,
		idDeltas,
		idRangeOffsets,
		glyphIdArray,
		lookup(codepoint: number): GlyphId | undefined {
			if (codepoint > 0xffff) return undefined;

			// Binary search for segment
			let low = 0;
			let high = segCount - 1;

			while (low <= high) {
				const mid = (low + high) >>> 1;
				const endCode = endCodes[mid]!;

				if (codepoint > endCode) {
					low = mid + 1;
				} else {
					const startCode = startCodes[mid]!;
					if (codepoint < startCode) {
						high = mid - 1;
					} else {
						// Found segment
						const idRangeOffset = idRangeOffsets[mid]!;
						const idDelta = idDeltas[mid]!;

						if (idRangeOffset === 0) {
							return (codepoint + idDelta) & 0xffff;
						}

						// Calculate index into glyphIdArray
						// idRangeOffset is relative to its own position in the array
						const glyphIdIndex =
							idRangeOffset / 2 - (segCount - mid) + (codepoint - startCode);

						const glyphId = glyphIdArray[glyphIdIndex];
						if (glyphId === undefined || glyphId === 0) {
							return 0;
						}
						return (glyphId + idDelta) & 0xffff;
					}
				}
			}

			return undefined;
		},
	};
}

function parseCmapFormat12(reader: Reader): CmapFormat12 {
	reader.skip(2); // reserved
	const _length = reader.uint32();
	const _language = reader.uint32();
	const numGroups = reader.uint32();

	const groups: CmapFormat12["groups"] = new Array(numGroups);
	for (let i = 0; i < numGroups; i++) {
		groups[i] = {
			startCharCode: reader.uint32(),
			endCharCode: reader.uint32(),
			startGlyphId: reader.uint32(),
		};
	}

	return {
		format: 12,
		groups,
		lookup(codepoint: number): GlyphId | undefined {
			// Binary search for group
			let low = 0;
			let high = groups.length - 1;

			while (low <= high) {
				const mid = (low + high) >>> 1;
				const group = groups[mid]!;

				if (codepoint > group.endCharCode) {
					low = mid + 1;
				} else if (codepoint < group.startCharCode) {
					high = mid - 1;
				} else {
					// Found group
					return group.startGlyphId + (codepoint - group.startCharCode);
				}
			}

			return undefined;
		},
	};
}

function parseCmapFormat14(reader: Reader): CmapFormat14 {
	const _length = reader.uint32();
	const numVarSelectorRecords = reader.uint32();

	// For now, just parse structure but don't implement variation lookup
	// This would require more complex parsing of default/non-default UVS tables
	for (let i = 0; i < numVarSelectorRecords; i++) {
		reader.uint24(); // varSelector
		reader.uint32(); // defaultUVSOffset
		reader.uint32(); // nonDefaultUVSOffset
	}

	return {
		format: 14,
		lookup(_codepoint: number): GlyphId | undefined {
			// Format 14 is only for variation selectors
			return undefined;
		},
		lookupVariation(
			_codepoint: number,
			_variationSelector: number,
		): GlyphId | undefined {
			// TODO: Implement variation sequence lookup
			return undefined;
		},
	};
}

/** Get glyph ID for a codepoint using the best subtable */
export function getGlyphId(cmap: CmapTable, codepoint: number): GlyphId {
	return cmap.bestSubtable?.lookup(codepoint) ?? 0;
}
