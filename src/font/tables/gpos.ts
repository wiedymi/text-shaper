import type { GlyphId, uint16, int16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import {
	type Coverage,
	parseCoverageAt,
} from "../../layout/structures/coverage.ts";
import {
	type ClassDef,
	parseClassDefAt,
} from "../../layout/structures/class-def.ts";
import {
	type ScriptList,
	type FeatureList,
	type LookupHeader,
	parseScriptList,
	parseFeatureList,
	parseLookupHeaders,
	LookupFlag,
} from "../../layout/structures/layout-common.ts";

/** GPOS lookup types */
export const enum GposLookupType {
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
	// Device table offsets (for hinting - not parsed)
	xPlaDeviceOffset?: uint16;
	yPlaDeviceOffset?: uint16;
	xAdvDeviceOffset?: uint16;
	yAdvDeviceOffset?: uint16;
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
	/** Format 1: single value for all */
	value?: ValueRecord;
	/** Format 2: value per glyph */
	values?: ValueRecord[];
}

/** Pair adjustment lookup (Type 2) - kerning */
export interface PairPosLookup extends GposLookup {
	type: GposLookupType.Pair;
	subtables: PairPosSubtable[];
}

export type PairPosSubtable = PairPosFormat1 | PairPosFormat2;

/** Format 1: Specific glyph pairs */
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

/** Format 2: Class-based pairs */
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

/** Union of all GPOS lookup types */
export type AnyGposLookup = SinglePosLookup | PairPosLookup;
// TODO: Add Cursive, MarkToBase, MarkToLigature, MarkToMark, Context, ChainingContext

/** GPOS table */
export interface GposTable {
	version: { major: number; minor: number };
	scriptList: ScriptList;
	featureList: FeatureList;
	lookups: AnyGposLookup[];
}

export function parseGpos(reader: Reader): GposTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();

	const scriptListOffset = reader.offset16();
	const featureListOffset = reader.offset16();
	const lookupListOffset = reader.offset16();

	let _featureVariationsOffset = 0;
	if (majorVersion === 1 && minorVersion >= 1) {
		_featureVariationsOffset = reader.offset32();
	}

	const scriptList = parseScriptList(reader.sliceFrom(scriptListOffset));
	const featureList = parseFeatureList(reader.sliceFrom(featureListOffset));

	// Parse lookup list
	const lookupListReader = reader.sliceFrom(lookupListOffset);
	const lookupHeaders = parseLookupHeaders(lookupListReader);

	const lookupCount = lookupListReader.peek(() => lookupListReader.uint16());
	const lookupOffsets = lookupListReader.peek(() => {
		lookupListReader.skip(2);
		return lookupListReader.uint16Array(lookupCount);
	});

	const lookups: AnyGposLookup[] = [];
	for (let i = 0; i < lookupHeaders.length; i++) {
		const header = lookupHeaders[i]!;
		const lookupOffset = lookupOffsets[i]!;
		const lookupReader = lookupListReader.sliceFrom(lookupOffset);

		const lookup = parseGposLookup(lookupReader, header);
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

function parseGposLookup(
	reader: Reader,
	header: LookupHeader,
): AnyGposLookup | null {
	reader.seek(0);
	const lookupType = reader.uint16();
	const lookupFlag = reader.uint16();
	const subtableCount = reader.uint16();
	const subtableOffsets = Array.from(reader.uint16Array(subtableCount));

	switch (lookupType) {
		case GposLookupType.Single:
			return parseSinglePosLookup(reader, subtableOffsets, header);

		case GposLookupType.Pair:
			return parsePairPosLookup(reader, subtableOffsets, header);

		case GposLookupType.Extension:
			return parseExtensionLookup(reader, subtableOffsets, header);

		// TODO: Other types
		default:
			return null;
	}
}

function parseValueRecord(reader: Reader, valueFormat: uint16): ValueRecord {
	const record: ValueRecord = {};

	if (valueFormat & ValueFormat.XPlacement) {
		record.xPlacement = reader.int16();
	}
	if (valueFormat & ValueFormat.YPlacement) {
		record.yPlacement = reader.int16();
	}
	if (valueFormat & ValueFormat.XAdvance) {
		record.xAdvance = reader.int16();
	}
	if (valueFormat & ValueFormat.YAdvance) {
		record.yAdvance = reader.int16();
	}
	if (valueFormat & ValueFormat.XPlaDevice) {
		record.xPlaDeviceOffset = reader.uint16();
	}
	if (valueFormat & ValueFormat.YPlaDevice) {
		record.yPlaDeviceOffset = reader.uint16();
	}
	if (valueFormat & ValueFormat.XAdvDevice) {
		record.xAdvDeviceOffset = reader.uint16();
	}
	if (valueFormat & ValueFormat.YAdvDevice) {
		record.yAdvDeviceOffset = reader.uint16();
	}

	return record;
}

function valueRecordSize(valueFormat: uint16): number {
	let size = 0;
	for (let i = 0; i < 8; i++) {
		if (valueFormat & (1 << i)) {
			size += 2;
		}
	}
	return size;
}

function parseSinglePosLookup(
	reader: Reader,
	subtableOffsets: number[],
	header: LookupHeader,
): SinglePosLookup {
	const subtables: SinglePosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const subtableReader = reader.sliceFrom(offset);
		const format = subtableReader.uint16();

		if (format === 1) {
			const coverageOffset = subtableReader.offset16();
			const valueFormat = subtableReader.uint16();
			const value = parseValueRecord(subtableReader, valueFormat);
			const coverage = parseCoverageAt(subtableReader, coverageOffset);

			subtables.push({
				format: 1,
				coverage,
				valueFormat,
				value,
			});
		} else if (format === 2) {
			const coverageOffset = subtableReader.offset16();
			const valueFormat = subtableReader.uint16();
			const valueCount = subtableReader.uint16();
			const values: ValueRecord[] = [];

			for (let i = 0; i < valueCount; i++) {
				values.push(parseValueRecord(subtableReader, valueFormat));
			}

			const coverage = parseCoverageAt(subtableReader, coverageOffset);

			subtables.push({
				format: 2,
				coverage,
				valueFormat,
				values,
			});
		}
	}

	return {
		type: GposLookupType.Single,
		flag: header.lookupFlag,
		markFilteringSet: header.markFilteringSet,
		subtables,
	};
}

function parsePairPosLookup(
	reader: Reader,
	subtableOffsets: number[],
	header: LookupHeader,
): PairPosLookup {
	const subtables: PairPosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const subtableReader = reader.sliceFrom(offset);
		const format = subtableReader.uint16();

		if (format === 1) {
			subtables.push(parsePairPosFormat1(subtableReader));
		} else if (format === 2) {
			subtables.push(parsePairPosFormat2(subtableReader));
		}
	}

	return {
		type: GposLookupType.Pair,
		flag: header.lookupFlag,
		markFilteringSet: header.markFilteringSet,
		subtables,
	};
}

function parsePairPosFormat1(reader: Reader): PairPosFormat1 {
	const coverageOffset = reader.offset16();
	const valueFormat1 = reader.uint16();
	const valueFormat2 = reader.uint16();
	const pairSetCount = reader.uint16();
	const pairSetOffsets = reader.uint16Array(pairSetCount);

	const coverage = parseCoverageAt(reader, coverageOffset);
	const pairSets: PairSet[] = [];

	for (const pairSetOffset of pairSetOffsets) {
		const pairSetReader = reader.sliceFrom(pairSetOffset);
		const pairValueCount = pairSetReader.uint16();
		const pairValueRecords: PairValueRecord[] = [];

		for (let i = 0; i < pairValueCount; i++) {
			const secondGlyph = pairSetReader.uint16();
			const value1 = parseValueRecord(pairSetReader, valueFormat1);
			const value2 = parseValueRecord(pairSetReader, valueFormat2);

			pairValueRecords.push({ secondGlyph, value1, value2 });
		}

		pairSets.push({ pairValueRecords });
	}

	return {
		format: 1,
		coverage,
		valueFormat1,
		valueFormat2,
		pairSets,
	};
}

function parsePairPosFormat2(reader: Reader): PairPosFormat2 {
	const coverageOffset = reader.offset16();
	const valueFormat1 = reader.uint16();
	const valueFormat2 = reader.uint16();
	const classDef1Offset = reader.offset16();
	const classDef2Offset = reader.offset16();
	const class1Count = reader.uint16();
	const class2Count = reader.uint16();

	const coverage = parseCoverageAt(reader, coverageOffset);
	const classDef1 = parseClassDefAt(reader, classDef1Offset);
	const classDef2 = parseClassDefAt(reader, classDef2Offset);

	const class1Records: Class1Record[] = [];
	for (let i = 0; i < class1Count; i++) {
		const class2Records: Class2Record[] = [];

		for (let j = 0; j < class2Count; j++) {
			const value1 = parseValueRecord(reader, valueFormat1);
			const value2 = parseValueRecord(reader, valueFormat2);
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
	header: LookupHeader,
): AnyGposLookup | null {
	if (subtableOffsets.length === 0) return null;

	const extReader = reader.sliceFrom(subtableOffsets[0]!);
	const format = extReader.uint16();
	if (format !== 1) return null;

	const extensionLookupType = extReader.uint16();
	const extensionOffset = extReader.uint32();

	const actualReader = extReader.sliceFrom(extensionOffset - 8);
	const newHeader: LookupHeader = {
		...header,
		lookupType: extensionLookupType,
	};

	switch (extensionLookupType) {
		case GposLookupType.Single:
			return parseSinglePosLookup(actualReader, [0], newHeader);
		case GposLookupType.Pair:
			return parsePairPosLookup(actualReader, [0], newHeader);
		default:
			return null;
	}
}

/** Get kerning value for a glyph pair */
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

			// Binary search would be better, but linear is fine for now
			for (const record of pairSet.pairValueRecords) {
				if (record.secondGlyph === secondGlyph) {
					return {
						xAdvance1: record.value1.xAdvance ?? 0,
						xAdvance2: record.value2.xAdvance ?? 0,
					};
				}
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
