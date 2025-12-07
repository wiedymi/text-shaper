import type { GlyphId, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/** Platform IDs */
export enum PlatformId {
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

/** Variation selector record */
interface VariationSelectorRecord {
	varSelector: number;
	defaultUVS: Array<{
		startUnicodeValue: number;
		additionalCount: number;
	}> | null;
	nonDefaultUVS: Array<{ unicodeValue: number; glyphId: GlyphId }> | null;
}

/** Format 14: Unicode Variation Sequences */
interface CmapFormat14 extends CmapSubtableBase {
	format: 14;
	varSelectorRecords: VariationSelectorRecord[];
	lookupVariation(
		codepoint: number,
		variationSelector: number,
	): GlyphId | undefined | "default";
}

export type CmapSubtable =
	| CmapFormat0
	| CmapFormat4
	| CmapFormat12
	| CmapFormat14;

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
	const _tableStart = reader.offset;
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

	for (let i = 0; i < encodingRecords.length; i++) {
		const record = encodingRecords[i]!;
		// Skip duplicates (multiple records can point to same subtable)
		if (parsedOffsets.has(record.offset)) {
			const key = `${record.platformId}-${record.encodingId}`;
			// Find existing subtable
			const subtablesEntries = Array.from(subtables.entries());
			for (let j = 0; j < subtablesEntries.length; j++) {
				const [existingKey, subtable] = subtablesEntries[j]!;
				const parts = existingKey.split("@");
				const existingOffset = parts[0];
				if (
					existingOffset &&
					Number.parseInt(existingOffset, 10) === record.offset
				) {
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

	for (let i = 0; i < preferredKeys.length; i++) {
		const key = preferredKeys[i]!;
		const subtable = subtables.get(key);
		if (subtable && subtable.format !== 14) {
			bestSubtable = subtable;
			break;
		}
	}

	// Fallback to first non-format-14 subtable
	if (!bestSubtable) {
		const subtablesValues = Array.from(subtables.values());
		for (let i = 0; i < subtablesValues.length; i++) {
			const subtable = subtablesValues[i]!;
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
	const _idRangeOffsetPos = reader.offset;
	const idRangeOffsets = reader.uint16Array(segCount);

	// Read remaining glyph IDs
	const remainingBytes = reader.remaining;
	const glyphIdCount = remainingBytes / 2;
	const glyphIdArray = reader.uint16Array(glyphIdCount);

	// Helper function for binary search lookup (used for cache building and fallback)
	const binarySearchLookup = (codepoint: number): GlyphId | undefined => {
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
					const idRangeOffset = idRangeOffsets[mid]!;
					const idDelta = idDeltas[mid]!;

					if (idRangeOffset === 0) {
						return (codepoint + idDelta) & 0xffff;
					}

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
	};

	// Build ASCII cache for O(1) lookups of common characters (0-255)
	// Uses 512 bytes but eliminates binary search for 95%+ of Latin text
	const asciiCache = new Uint16Array(256);
	for (let cp = 0; cp < 256; cp++) {
		const gid = binarySearchLookup(cp);
		// Store glyph ID + 1 so we can distinguish "not found" (0) from glyph 0
		asciiCache[cp] = gid !== undefined ? gid + 1 : 0;
	}

	return {
		format: 4,
		segCount,
		endCodes,
		startCodes,
		idDeltas,
		idRangeOffsets,
		glyphIdArray,
		lookup(codepoint: number): GlyphId | undefined {
			// FAST PATH: O(1) direct lookup for ASCII/Latin-1 (0-255)
			if (codepoint < 256) {
				const cached = asciiCache[codepoint]!;
				return cached === 0 ? undefined : cached - 1;
			}

			if (codepoint > 0xffff) return undefined;

			// SLOW PATH: Binary search for higher codepoints
			return binarySearchLookup(codepoint);
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

	// Helper for binary search lookup
	const binarySearchLookup = (codepoint: number): GlyphId | undefined => {
		let low = 0;
		let high = groups.length - 1;

		while (low <= high) {
			const mid = (low + high) >>> 1;
			const group = groups[mid];
			if (!group) break;

			if (codepoint > group.endCharCode) {
				low = mid + 1;
			} else if (codepoint < group.startCharCode) {
				high = mid - 1;
			} else {
				return group.startGlyphId + (codepoint - group.startCharCode);
			}
		}
		return undefined;
	};

	// Build ASCII cache for O(1) lookups of common characters (0-127)
	// Uses 256 bytes but eliminates binary search for ASCII text
	const asciiCache = new Uint16Array(128);
	for (let cp = 0; cp < 128; cp++) {
		const gid = binarySearchLookup(cp);
		// Store glyph ID + 1 so we can distinguish "not found" (0) from glyph 0
		asciiCache[cp] = gid !== undefined ? gid + 1 : 0;
	}

	return {
		format: 12,
		groups,
		lookup(codepoint: number): GlyphId | undefined {
			// FAST PATH: O(1) direct lookup for ASCII (0-127)
			if (codepoint < 128) {
				const cached = asciiCache[codepoint]!;
				return cached === 0 ? undefined : cached - 1;
			}

			// SLOW PATH: Binary search for higher codepoints
			return binarySearchLookup(codepoint);
		},
	};
}

function parseCmapFormat14(reader: Reader): CmapFormat14 {
	const subtableStart = reader.offset - 2; // Account for format already read
	const _length = reader.uint32();
	const numVarSelectorRecords = reader.uint32();

	// First pass: read all variation selector records
	const rawRecords: Array<{
		varSelector: number;
		defaultUVSOffset: number;
		nonDefaultUVSOffset: number;
	}> = [];

	for (let i = 0; i < numVarSelectorRecords; i++) {
		rawRecords.push({
			varSelector: reader.uint24(),
			defaultUVSOffset: reader.uint32(),
			nonDefaultUVSOffset: reader.uint32(),
		});
	}

	// Second pass: parse the UVS tables
	const varSelectorRecords: VariationSelectorRecord[] = [];

	for (let i = 0; i < rawRecords.length; i++) {
		const raw = rawRecords[i]!;
		let defaultUVS: VariationSelectorRecord["defaultUVS"] = null;
		let nonDefaultUVS: VariationSelectorRecord["nonDefaultUVS"] = null;

		// Parse default UVS table (ranges where default glyph is used)
		if (raw.defaultUVSOffset !== 0) {
			const uvsReader = reader.sliceFrom(subtableStart + raw.defaultUVSOffset);
			const numUnicodeValueRanges = uvsReader.uint32();
			defaultUVS = [];

			for (let j = 0; j < numUnicodeValueRanges; j++) {
				defaultUVS.push({
					startUnicodeValue: uvsReader.uint24(),
					additionalCount: uvsReader.uint8(),
				});
			}
		}

		// Parse non-default UVS table (specific glyph mappings)
		if (raw.nonDefaultUVSOffset !== 0) {
			const uvsReader = reader.sliceFrom(
				subtableStart + raw.nonDefaultUVSOffset,
			);
			const numUVSMappings = uvsReader.uint32();
			nonDefaultUVS = [];

			for (let j = 0; j < numUVSMappings; j++) {
				nonDefaultUVS.push({
					unicodeValue: uvsReader.uint24(),
					glyphId: uvsReader.uint16(),
				});
			}
		}

		varSelectorRecords.push({
			varSelector: raw.varSelector,
			defaultUVS,
			nonDefaultUVS,
		});
	}

	return {
		format: 14,
		varSelectorRecords,
		lookup(_codepoint: number): GlyphId | undefined {
			// Format 14 is only for variation selectors
			return undefined;
		},
		lookupVariation(
			codepoint: number,
			variationSelector: number,
		): GlyphId | undefined | "default" {
			// Binary search for the variation selector
			let low = 0;
			let high = varSelectorRecords.length - 1;
			let record: VariationSelectorRecord | null = null;

			while (low <= high) {
				const mid = (low + high) >>> 1;
				const rec = varSelectorRecords[mid];
				if (!rec) break;

				if (variationSelector > rec.varSelector) {
					low = mid + 1;
				} else if (variationSelector < rec.varSelector) {
					high = mid - 1;
				} else {
					record = rec;
					break;
				}
			}

			if (!record) {
				return undefined;
			}

			// Check non-default UVS first (specific glyph mappings)
			if (record.nonDefaultUVS) {
				let lo = 0;
				let hi = record.nonDefaultUVS.length - 1;

				while (lo <= hi) {
					const mid = (lo + hi) >>> 1;
					const mapping = record.nonDefaultUVS[mid];
					if (!mapping) break;

					if (codepoint > mapping.unicodeValue) {
						lo = mid + 1;
					} else if (codepoint < mapping.unicodeValue) {
						hi = mid - 1;
					} else {
						return mapping.glyphId;
					}
				}
			}

			// Check default UVS (use default glyph for base codepoint)
			if (record.defaultUVS) {
				for (let i = 0; i < record.defaultUVS.length; i++) {
					const range = record.defaultUVS[i]!;
					const end = range.startUnicodeValue + range.additionalCount;
					if (codepoint >= range.startUnicodeValue && codepoint <= end) {
						return "default"; // Signal to use the default glyph
					}
				}
			}

			return undefined;
		},
	};
}

/** Get glyph ID for a codepoint using the best subtable */
export function getGlyphId(cmap: CmapTable, codepoint: number): GlyphId {
	return cmap.bestSubtable?.lookup(codepoint) ?? 0;
}

/** Get glyph ID for a variation sequence (base + variation selector) */
export function getVariationGlyphId(
	cmap: CmapTable,
	codepoint: number,
	variationSelector: number,
): GlyphId | undefined {
	// Find Format 14 subtable
	const format14 = Array.from(cmap.subtables.values()).find(
		(s): s is CmapFormat14 => s.format === 14,
	);

	if (!format14) {
		return undefined;
	}

	const result = format14.lookupVariation(codepoint, variationSelector);

	if (result === "default") {
		// Use the default glyph for this codepoint
		return getGlyphId(cmap, codepoint);
	}

	return result;
}

/** Check if a codepoint is a variation selector */
export function isVariationSelector(codepoint: number): boolean {
	// Variation Selectors block (VS1-VS16)
	if (codepoint >= 0xfe00 && codepoint <= 0xfe0f) {
		return true;
	}
	// Variation Selectors Supplement (VS17-VS256)
	if (codepoint >= 0xe0100 && codepoint <= 0xe01ef) {
		return true;
	}
	return false;
}
