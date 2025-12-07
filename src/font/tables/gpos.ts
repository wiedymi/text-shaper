import {
	type ClassDef,
	parseClassDefAt,
} from "../../layout/structures/class-def.ts";
import {
	type Coverage,
	parseCoverageAt,
} from "../../layout/structures/coverage.ts";
import {
	type DeviceOrVariationIndex,
	parseDeviceAt,
} from "../../layout/structures/device.ts";
import {
	type FeatureList,
	LookupFlag,
	parseFeatureList,
	parseScriptList,
	type ScriptList,
} from "../../layout/structures/layout-common.ts";
import { SetDigest } from "../../layout/structures/set-digest.ts";
import type { GlyphId, GlyphPosition, int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import {
	type ChainingContextPosLookup,
	type ChainingContextPosSubtable,
	type ContextPosLookup,
	type ContextPosSubtable,
	parseChainingContextPos,
	parseContextPos,
} from "./gpos-contextual.ts";
import {
	type CursivePosSubtable,
	type MarkBasePosSubtable,
	type MarkLigaturePosSubtable,
	type MarkMarkPosSubtable,
	parseCursivePos,
	parseMarkBasePos,
	parseMarkLigaturePos,
	parseMarkMarkPos,
} from "./gpos-mark.ts";

/** GPOS lookup types */
export enum GposLookupType {
	Single = 1,
	Pair = 2,
	Cursive = 3,
	MarkToBase = 4,
	MarkToLigature = 5,
	MarkToMark = 6,
	Context = 7,
	ChainingContext = 8,
	Extension = 9,
}

/** Value record - positioning adjustments */
export interface ValueRecord {
	xPlacement?: int16;
	yPlacement?: int16;
	xAdvance?: int16;
	yAdvance?: int16;
	xPlaDevice?: DeviceOrVariationIndex;
	yPlaDevice?: DeviceOrVariationIndex;
	xAdvDevice?: DeviceOrVariationIndex;
	yAdvDevice?: DeviceOrVariationIndex;
}

/** Value format flags */
export const ValueFormat = {
	XPlacement: 0x0001,
	YPlacement: 0x0002,
	XAdvance: 0x0004,
	YAdvance: 0x0008,
	XPlaDevice: 0x0010,
	YPlaDevice: 0x0020,
	XAdvDevice: 0x0040,
	YAdvDevice: 0x0080,
} as const;

/** Base interface for all GPOS lookups */
export interface GposLookup {
	type: GposLookupType;
	flag: uint16;
	markFilteringSet?: uint16;
	/** Bloom filter for fast O(1) glyph rejection */
	digest: SetDigest;
}

/** Single adjustment lookup (Type 1) */
export interface SinglePosLookup extends GposLookup {
	type: GposLookupType.Single;
	subtables: SinglePosSubtable[];
}

export interface SinglePosSubtable {
	format: 1 | 2;
	coverage: Coverage;
	valueFormat: uint16;
	value?: ValueRecord;
	values?: ValueRecord[];
}

/** Pair adjustment lookup (Type 2) - kerning */
export interface PairPosLookup extends GposLookup {
	type: GposLookupType.Pair;
	subtables: PairPosSubtable[];
}

export type PairPosSubtable = PairPosFormat1 | PairPosFormat2;

export interface PairPosFormat1 {
	format: 1;
	coverage: Coverage;
	valueFormat1: uint16;
	valueFormat2: uint16;
	pairSets: PairSet[];
}

export interface PairSet {
	pairValueRecords: PairValueRecord[];
}

export interface PairValueRecord {
	secondGlyph: GlyphId;
	value1: ValueRecord;
	value2: ValueRecord;
}

export interface PairPosFormat2 {
	format: 2;
	coverage: Coverage;
	valueFormat1: uint16;
	valueFormat2: uint16;
	classDef1: ClassDef;
	classDef2: ClassDef;
	class1Count: uint16;
	class2Count: uint16;
	class1Records: Class1Record[];
}

export interface Class1Record {
	class2Records: Class2Record[];
}

export interface Class2Record {
	value1: ValueRecord;
	value2: ValueRecord;
}

/** Cursive attachment lookup (Type 3) */
export interface CursivePosLookup extends GposLookup {
	type: GposLookupType.Cursive;
	subtables: CursivePosSubtable[];
}

/** Mark-to-base attachment lookup (Type 4) */
export interface MarkBasePosLookup extends GposLookup {
	type: GposLookupType.MarkToBase;
	subtables: MarkBasePosSubtable[];
}

/** Mark-to-ligature attachment lookup (Type 5) */
export interface MarkLigaturePosLookup extends GposLookup {
	type: GposLookupType.MarkToLigature;
	subtables: MarkLigaturePosSubtable[];
}

/** Mark-to-mark attachment lookup (Type 6) */
export interface MarkMarkPosLookup extends GposLookup {
	type: GposLookupType.MarkToMark;
	subtables: MarkMarkPosSubtable[];
}

/** Union of all GPOS lookup types */
export type AnyGposLookup =
	| SinglePosLookup
	| PairPosLookup
	| CursivePosLookup
	| MarkBasePosLookup
	| MarkLigaturePosLookup
	| MarkMarkPosLookup
	| ContextPosLookup
	| ChainingContextPosLookup;

/** GPOS table */
export interface GposTable {
	version: { major: number; minor: number };
	scriptList: ScriptList;
	featureList: FeatureList;
	lookups: AnyGposLookup[];
}

// Re-export mark types
export type { Anchor, MarkArray } from "./gpos-mark.ts";

export function parseGpos(reader: Reader): GposTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();

	const scriptListOffset = reader.offset16();
	const featureListOffset = reader.offset16();
	const lookupListOffset = reader.offset16();

	if (majorVersion === 1 && minorVersion >= 1) {
		reader.offset32(); // featureVariationsOffset
	}

	const scriptList = parseScriptList(reader.sliceFrom(scriptListOffset));
	const featureList = parseFeatureList(reader.sliceFrom(featureListOffset));

	const lookupListReader = reader.sliceFrom(lookupListOffset);
	const lookupCount = lookupListReader.uint16();
	const lookupOffsets = lookupListReader.uint16Array(lookupCount);

	const lookups: AnyGposLookup[] = [];
	for (const lookupOffset of lookupOffsets) {
		const lookupReader = lookupListReader.sliceFrom(lookupOffset);
		const lookup = parseGposLookup(lookupReader);
		if (lookup) {
			lookups.push(lookup);
		}
	}

	return {
		version: { major: majorVersion, minor: minorVersion },
		scriptList,
		featureList,
		lookups,
	};
}

function parseGposLookup(reader: Reader): AnyGposLookup | null {
	const lookupType = reader.uint16();
	const lookupFlag = reader.uint16();
	const subtableCount = reader.uint16();
	const subtableOffsets = Array.from(reader.uint16Array(subtableCount));

	let markFilteringSet: uint16 | undefined;
	if (lookupFlag & LookupFlag.UseMarkFilteringSet) {
		markFilteringSet = reader.uint16();
	}

	const baseProps = { flag: lookupFlag, markFilteringSet };

	// Helper to build digest from subtables with coverage
	const buildDigest = (subtables: { coverage: Coverage }[]): SetDigest => {
		const digest = new SetDigest();
		for (const st of subtables) {
			digest.addCoverage(st.coverage);
		}
		return digest;
	};

	// Helper for mark lookups (need markCoverage)
	const buildMarkDigest = (
		subtables: { markCoverage: Coverage }[],
	): SetDigest => {
		const digest = new SetDigest();
		for (const st of subtables) {
			digest.addCoverage(st.markCoverage);
		}
		return digest;
	};

	switch (lookupType) {
		case GposLookupType.Single: {
			const subtables = parseSinglePos(reader, subtableOffsets);
			return {
				type: GposLookupType.Single,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GposLookupType.Pair: {
			const subtables = parsePairPos(reader, subtableOffsets);
			return {
				type: GposLookupType.Pair,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GposLookupType.Cursive: {
			const subtables = parseCursivePos(reader, subtableOffsets);
			return {
				type: GposLookupType.Cursive,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GposLookupType.MarkToBase: {
			const subtables = parseMarkBasePos(reader, subtableOffsets);
			return {
				type: GposLookupType.MarkToBase,
				...baseProps,
				subtables,
				digest: buildMarkDigest(subtables),
			};
		}

		case GposLookupType.MarkToLigature: {
			const subtables = parseMarkLigaturePos(reader, subtableOffsets);
			return {
				type: GposLookupType.MarkToLigature,
				...baseProps,
				subtables,
				digest: buildMarkDigest(subtables),
			};
		}

		case GposLookupType.MarkToMark: {
			const subtables = parseMarkMarkPos(reader, subtableOffsets);
			// MarkMark uses mark1Coverage for the first mark
			const digest = new SetDigest();
			for (const st of subtables) {
				digest.addCoverage(st.mark1Coverage);
			}
			return {
				type: GposLookupType.MarkToMark,
				...baseProps,
				subtables,
				digest,
			};
		}

		case GposLookupType.Context: {
			const subtables = parseContextPos(reader, subtableOffsets);
			const digest = new SetDigest();
			for (const st of subtables) {
				if ("coverage" in st && st.coverage) {
					digest.addCoverage(st.coverage);
				}
			}
			return {
				type: GposLookupType.Context,
				...baseProps,
				subtables,
				digest,
			};
		}

		case GposLookupType.ChainingContext: {
			const subtables = parseChainingContextPos(reader, subtableOffsets);
			const digest = new SetDigest();
			for (const st of subtables) {
				if ("coverage" in st && st.coverage) {
					digest.addCoverage(st.coverage);
				} else if ("inputCoverages" in st && st.inputCoverages?.[0]) {
					digest.addCoverage(st.inputCoverages[0]);
				}
			}
			return {
				type: GposLookupType.ChainingContext,
				...baseProps,
				subtables,
				digest,
			};
		}

		case GposLookupType.Extension:
			return parseExtensionLookup(reader, subtableOffsets, baseProps);

		default:
			return null;
	}
}

function parseValueRecord(
	reader: Reader,
	valueFormat: uint16,
	subtableReader?: Reader,
): ValueRecord {
	const record: ValueRecord = {};

	if (valueFormat & ValueFormat.XPlacement) record.xPlacement = reader.int16();
	if (valueFormat & ValueFormat.YPlacement) record.yPlacement = reader.int16();
	if (valueFormat & ValueFormat.XAdvance) record.xAdvance = reader.int16();
	if (valueFormat & ValueFormat.YAdvance) record.yAdvance = reader.int16();

	// Parse Device tables if we have a subtable reader to resolve offsets
	const deviceReader = subtableReader ?? reader;
	if (valueFormat & ValueFormat.XPlaDevice) {
		const offset = reader.uint16();
		if (offset !== 0)
			record.xPlaDevice = parseDeviceAt(deviceReader, offset) ?? undefined;
	}
	if (valueFormat & ValueFormat.YPlaDevice) {
		const offset = reader.uint16();
		if (offset !== 0)
			record.yPlaDevice = parseDeviceAt(deviceReader, offset) ?? undefined;
	}
	if (valueFormat & ValueFormat.XAdvDevice) {
		const offset = reader.uint16();
		if (offset !== 0)
			record.xAdvDevice = parseDeviceAt(deviceReader, offset) ?? undefined;
	}
	if (valueFormat & ValueFormat.YAdvDevice) {
		const offset = reader.uint16();
		if (offset !== 0)
			record.yAdvDevice = parseDeviceAt(deviceReader, offset) ?? undefined;
	}

	return record;
}

function parseSinglePos(
	reader: Reader,
	subtableOffsets: number[],
): SinglePosSubtable[] {
	const subtables: SinglePosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const subtableReader = reader.sliceFrom(offset);
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const valueFormat = r.uint16();
			const value = parseValueRecord(r, valueFormat, subtableReader);
			const coverage = parseCoverageAt(subtableReader, coverageOffset);
			subtables.push({ format: 1, coverage, valueFormat, value });
		} else if (format === 2) {
			const coverageOffset = r.offset16();
			const valueFormat = r.uint16();
			const valueCount = r.uint16();
			const values: ValueRecord[] = [];
			for (let i = 0; i < valueCount; i++) {
				values.push(parseValueRecord(r, valueFormat, subtableReader));
			}
			const coverage = parseCoverageAt(subtableReader, coverageOffset);
			subtables.push({ format: 2, coverage, valueFormat, values });
		}
	}

	return subtables;
}

function parsePairPos(
	reader: Reader,
	subtableOffsets: number[],
): PairPosSubtable[] {
	const subtables: PairPosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const subtableReader = reader.sliceFrom(offset);
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			subtables.push(parsePairPosFormat1(r, subtableReader));
		} else if (format === 2) {
			subtables.push(parsePairPosFormat2(r, subtableReader));
		}
	}

	return subtables;
}

function parsePairPosFormat1(
	reader: Reader,
	subtableReader: Reader,
): PairPosFormat1 {
	const coverageOffset = reader.offset16();
	const valueFormat1 = reader.uint16();
	const valueFormat2 = reader.uint16();
	const pairSetCount = reader.uint16();
	const pairSetOffsets = reader.uint16Array(pairSetCount);

	const coverage = parseCoverageAt(subtableReader, coverageOffset);
	const pairSets: PairSet[] = [];

	for (const pairSetOffset of pairSetOffsets) {
		const pairSetReader = subtableReader.sliceFrom(pairSetOffset);
		const r = subtableReader.sliceFrom(pairSetOffset);
		const pairValueCount = r.uint16();
		const pairValueRecords: PairValueRecord[] = [];

		for (let i = 0; i < pairValueCount; i++) {
			const secondGlyph = r.uint16();
			const value1 = parseValueRecord(r, valueFormat1, pairSetReader);
			const value2 = parseValueRecord(r, valueFormat2, pairSetReader);
			pairValueRecords.push({ secondGlyph, value1, value2 });
		}

		pairSets.push({ pairValueRecords });
	}

	return { format: 1, coverage, valueFormat1, valueFormat2, pairSets };
}

function parsePairPosFormat2(
	reader: Reader,
	subtableReader: Reader,
): PairPosFormat2 {
	const coverageOffset = reader.offset16();
	const valueFormat1 = reader.uint16();
	const valueFormat2 = reader.uint16();
	const classDef1Offset = reader.offset16();
	const classDef2Offset = reader.offset16();
	const class1Count = reader.uint16();
	const class2Count = reader.uint16();

	const coverage = parseCoverageAt(subtableReader, coverageOffset);
	const classDef1 = parseClassDefAt(subtableReader, classDef1Offset);
	const classDef2 = parseClassDefAt(subtableReader, classDef2Offset);

	const class1Records: Class1Record[] = [];
	for (let i = 0; i < class1Count; i++) {
		const class2Records: Class2Record[] = [];
		for (let j = 0; j < class2Count; j++) {
			const value1 = parseValueRecord(reader, valueFormat1, subtableReader);
			const value2 = parseValueRecord(reader, valueFormat2, subtableReader);
			class2Records.push({ value1, value2 });
		}
		class1Records.push({ class2Records });
	}

	return {
		format: 2,
		coverage,
		valueFormat1,
		valueFormat2,
		classDef1,
		classDef2,
		class1Count,
		class2Count,
		class1Records,
	};
}

function parseExtensionLookup(
	reader: Reader,
	subtableOffsets: number[],
	baseProps: { flag: uint16; markFilteringSet?: uint16 },
): AnyGposLookup | null {
	if (subtableOffsets.length === 0) return null;

	const extSubtables: Array<{ type: number; reader: Reader }> = [];

	for (const offset of subtableOffsets) {
		const extReader = reader.sliceFrom(offset);
		const format = extReader.uint16();
		if (format !== 1) continue;

		const extensionLookupType = extReader.uint16();
		const extensionOffset = extReader.uint32();

		// extensionOffset is relative to start of extension subtable
		extSubtables.push({
			type: extensionLookupType,
			reader: extReader.sliceFrom(extensionOffset),
		});
	}

	if (extSubtables.length === 0) return null;

	const actualType = extSubtables[0]?.type;

	// Helper to build digest from subtables with coverage
	const buildDigest = (subtables: { coverage: Coverage }[]): SetDigest => {
		const digest = new SetDigest();
		for (const st of subtables) {
			digest.addCoverage(st.coverage);
		}
		return digest;
	};

	// Helper for mark lookups (need markCoverage)
	const buildMarkDigest = (
		subtables: { markCoverage: Coverage }[],
	): SetDigest => {
		const digest = new SetDigest();
		for (const st of subtables) {
			digest.addCoverage(st.markCoverage);
		}
		return digest;
	};

	switch (actualType) {
		case GposLookupType.Single: {
			const subtables: SinglePosSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseSinglePos(ext.reader, [0]));
			}
			return { type: GposLookupType.Single, ...baseProps, subtables, digest: buildDigest(subtables) };
		}

		case GposLookupType.Pair: {
			const subtables: PairPosSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parsePairPos(ext.reader, [0]));
			}
			return { type: GposLookupType.Pair, ...baseProps, subtables, digest: buildDigest(subtables) };
		}

		case GposLookupType.Cursive: {
			const subtables: CursivePosSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseCursivePos(ext.reader, [0]));
			}
			return { type: GposLookupType.Cursive, ...baseProps, subtables, digest: buildDigest(subtables) };
		}

		case GposLookupType.MarkToBase: {
			const subtables: MarkBasePosSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseMarkBasePos(ext.reader, [0]));
			}
			return { type: GposLookupType.MarkToBase, ...baseProps, subtables, digest: buildMarkDigest(subtables) };
		}

		case GposLookupType.MarkToLigature: {
			const subtables: MarkLigaturePosSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseMarkLigaturePos(ext.reader, [0]));
			}
			return { type: GposLookupType.MarkToLigature, ...baseProps, subtables, digest: buildMarkDigest(subtables) };
		}

		case GposLookupType.MarkToMark: {
			const subtables: MarkMarkPosSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseMarkMarkPos(ext.reader, [0]));
			}
			// MarkMark uses mark1Coverage for the first mark
			const digest = new SetDigest();
			for (const st of subtables) {
				digest.addCoverage(st.mark1Coverage);
			}
			return { type: GposLookupType.MarkToMark, ...baseProps, subtables, digest };
		}

		case GposLookupType.Context: {
			const subtables: ContextPosSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseContextPos(ext.reader, [0]));
			}
			const digest = new SetDigest();
			for (const st of subtables) {
				if ("coverage" in st && st.coverage) {
					digest.addCoverage(st.coverage);
				}
			}
			return { type: GposLookupType.Context, ...baseProps, subtables, digest };
		}

		case GposLookupType.ChainingContext: {
			const subtables: ChainingContextPosSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseChainingContextPos(ext.reader, [0]));
			}
			const digest = new SetDigest();
			for (const st of subtables) {
				if ("coverage" in st && st.coverage) {
					digest.addCoverage(st.coverage);
				} else if ("inputCoverages" in st && st.inputCoverages?.[0]) {
					digest.addCoverage(st.inputCoverages[0]);
				}
			}
			return { type: GposLookupType.ChainingContext, ...baseProps, subtables, digest };
		}

		default:
			return null;
	}
}

// Utility functions

/**
 * Binary search for pair value record in a PairSet.
 * PairValueRecords are sorted by secondGlyph per OpenType spec.
 */
function findPairValueRecord(
	records: PairValueRecord[],
	secondGlyph: GlyphId,
): PairValueRecord | null {
	let low = 0;
	let high = records.length - 1;

	while (low <= high) {
		const mid = (low + high) >>> 1;
		const record = records[mid];
		if (!record) return null;

		if (record.secondGlyph < secondGlyph) {
			low = mid + 1;
		} else if (record.secondGlyph > secondGlyph) {
			high = mid - 1;
		} else {
			return record;
		}
	}

	return null;
}

export function getKerning(
	lookup: PairPosLookup,
	firstGlyph: GlyphId,
	secondGlyph: GlyphId,
): { xAdvance1: number; xAdvance2: number } | null {
	for (const subtable of lookup.subtables) {
		const coverageIndex = subtable.coverage.get(firstGlyph);
		if (coverageIndex === null) continue;

		if (subtable.format === 1) {
			const pairSet = subtable.pairSets[coverageIndex];
			if (!pairSet) continue;

			// Binary search for secondGlyph (records are sorted)
			const record = findPairValueRecord(pairSet.pairValueRecords, secondGlyph);
			if (record) {
				return {
					xAdvance1: record.value1.xAdvance ?? 0,
					xAdvance2: record.value2.xAdvance ?? 0,
				};
			}
		} else if (subtable.format === 2) {
			const class1 = subtable.classDef1.get(firstGlyph);
			const class2 = subtable.classDef2.get(secondGlyph);

			const class1Record = subtable.class1Records[class1];
			if (!class1Record) continue;

			const class2Record = class1Record.class2Records[class2];
			if (!class2Record) continue;

			return {
				xAdvance1: class2Record.value1.xAdvance ?? 0,
				xAdvance2: class2Record.value2.xAdvance ?? 0,
			};
		}
	}

	return null;
}

/**
 * Apply kerning directly to positions, avoiding object allocation.
 * Returns true if kerning was applied, false otherwise.
 */
export function applyKerningDirect(
	lookup: PairPosLookup,
	firstGlyph: GlyphId,
	secondGlyph: GlyphId,
	pos1: GlyphPosition,
	pos2: GlyphPosition,
): boolean {
	for (const subtable of lookup.subtables) {
		const coverageIndex = subtable.coverage.get(firstGlyph);
		if (coverageIndex === null) continue;

		if (subtable.format === 1) {
			const pairSet = subtable.pairSets[coverageIndex];
			if (!pairSet) continue;

			const record = findPairValueRecord(pairSet.pairValueRecords, secondGlyph);
			if (record) {
				const xAdv1 = record.value1.xAdvance;
				const xAdv2 = record.value2.xAdvance;
				if (xAdv1) pos1.xAdvance += xAdv1;
				if (xAdv2) pos2.xAdvance += xAdv2;
				return true;
			}
		} else if (subtable.format === 2) {
			const class1 = subtable.classDef1.get(firstGlyph);
			const class2 = subtable.classDef2.get(secondGlyph);

			const class1Record = subtable.class1Records[class1];
			if (!class1Record) continue;

			const class2Record = class1Record.class2Records[class2];
			if (!class2Record) continue;

			const xAdv1 = class2Record.value1.xAdvance;
			const xAdv2 = class2Record.value2.xAdvance;
			if (xAdv1) pos1.xAdvance += xAdv1;
			if (xAdv2) pos2.xAdvance += xAdv2;
			return true;
		}
	}

	return false;
}
