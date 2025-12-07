import type { int16, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * BASE table - Baseline alignment data
 * Provides baseline offsets for scripts to align mixed-script text
 */

/** Baseline tags */
export const BaselineTag = {
	/** Hanging baseline (Devanagari, Tibetan) */
	hang: 0x68616e67,
	/** Ideographic character face bottom edge (CJK) */
	icfb: 0x69636662,
	/** Ideographic character face top edge (CJK) */
	icft: 0x69636674,
	/** Ideographic em-box bottom edge (CJK) */
	ideo: 0x6964656f,
	/** Ideographic em-box top edge */
	idtp: 0x69647470,
	/** Mathematical baseline (math layout) */
	math: 0x6d617468,
	/** Roman baseline (Latin, Greek, Cyrillic) */
	romn: 0x726f6d6e,
} as const;

/** A single baseline value */
export interface BaselineValue {
	baselineTag: number;
	coordinate: int16;
}

/** Min/max extent values */
export interface MinMaxRecord {
	minCoord: int16 | null;
	maxCoord: int16 | null;
}

/** Feature-specific min/max values */
export interface FeatMinMaxRecord {
	featureTag: number;
	minCoord: int16 | null;
	maxCoord: int16 | null;
}

/** Base values for a script */
export interface BaseValues {
	defaultBaselineIndex: uint16;
	baseCoords: int16[];
}

/** MinMax values for a language system */
export interface MinMax {
	minCoord: int16 | null;
	maxCoord: int16 | null;
	featMinMaxRecords: FeatMinMaxRecord[];
}

/** Base script record */
export interface BaseScriptRecord {
	scriptTag: number;
	baseValues: BaseValues | null;
	defaultMinMax: MinMax | null;
	baseLangSysRecords: Map<number, MinMax>;
}

/** Axis table (horizontal or vertical) */
export interface AxisTable {
	baseTagList: number[];
	baseScriptList: BaseScriptRecord[];
}

/** BASE table */
export interface BaseTable {
	majorVersion: uint16;
	minorVersion: uint16;
	horizAxis: AxisTable | null;
	vertAxis: AxisTable | null;
}

/** Coordinate format */
interface BaseCoord {
	format: uint16;
	coordinate: int16;
	referenceGlyph?: uint16;
	baseCoordPoint?: uint16;
	deviceOffset?: uint16;
}

function parseBaseCoord(reader: Reader): BaseCoord {
	const format = reader.uint16();
	const coordinate = reader.int16();

	const result: BaseCoord = { format, coordinate };

	if (format === 2) {
		result.referenceGlyph = reader.uint16();
		result.baseCoordPoint = reader.uint16();
	} else if (format === 3) {
		result.deviceOffset = reader.uint16();
	}

	return result;
}

function parseMinMax(reader: Reader, minMaxOffset: number): MinMax | null {
	if (minMaxOffset === 0) return null;

	const minMaxReader = reader.sliceFrom(minMaxOffset);
	const minCoordOffset = minMaxReader.uint16();
	const maxCoordOffset = minMaxReader.uint16();
	const featMinMaxCount = minMaxReader.uint16();

	let minCoord: int16 | null = null;
	let maxCoord: int16 | null = null;

	if (minCoordOffset !== 0) {
		const coordReader = reader.sliceFrom(minMaxOffset + minCoordOffset);
		minCoord = parseBaseCoord(coordReader).coordinate;
	}

	if (maxCoordOffset !== 0) {
		const coordReader = reader.sliceFrom(minMaxOffset + maxCoordOffset);
		maxCoord = parseBaseCoord(coordReader).coordinate;
	}

	const featMinMaxRecords: FeatMinMaxRecord[] = [];
	for (let i = 0; i < featMinMaxCount; i++) {
		const featureTag = minMaxReader.uint32();
		const minOffset = minMaxReader.uint16();
		const maxOffset = minMaxReader.uint16();

		let featMin: int16 | null = null;
		let featMax: int16 | null = null;

		if (minOffset !== 0) {
			const coordReader = reader.sliceFrom(minMaxOffset + minOffset);
			featMin = parseBaseCoord(coordReader).coordinate;
		}

		if (maxOffset !== 0) {
			const coordReader = reader.sliceFrom(minMaxOffset + maxOffset);
			featMax = parseBaseCoord(coordReader).coordinate;
		}

		featMinMaxRecords.push({
			featureTag,
			minCoord: featMin,
			maxCoord: featMax,
		});
	}

	return { minCoord, maxCoord, featMinMaxRecords };
}

function parseBaseValues(
	reader: Reader,
	baseValuesOffset: number,
	_baseTagList: number[],
): BaseValues | null {
	if (baseValuesOffset === 0) return null;

	const bvReader = reader.sliceFrom(baseValuesOffset);
	const defaultBaselineIndex = bvReader.uint16();
	const baseCoordCount = bvReader.uint16();

	const coordOffsets: uint16[] = [];
	for (let i = 0; i < baseCoordCount; i++) {
		coordOffsets.push(bvReader.uint16());
	}

	const baseCoords: int16[] = [];
	for (let i = 0; i < coordOffsets.length; i++) {
		const offset = coordOffsets[i]!;
		if (offset !== 0) {
			const coordReader = reader.sliceFrom(baseValuesOffset + offset);
			baseCoords.push(parseBaseCoord(coordReader).coordinate);
		} else {
			baseCoords.push(0);
		}
	}

	return { defaultBaselineIndex, baseCoords };
}

function parseBaseScriptRecord(
	reader: Reader,
	scriptOffset: number,
	baseTagList: number[],
): Omit<BaseScriptRecord, "scriptTag"> {
	const scriptReader = reader.sliceFrom(scriptOffset);
	const baseValuesOffset = scriptReader.uint16();
	const defaultMinMaxOffset = scriptReader.uint16();
	const baseLangSysCount = scriptReader.uint16();

	const baseLangSysRecords = new Map<number, MinMax>();
	const langSysData: Array<{ tag: number; offset: number }> = [];

	for (let i = 0; i < baseLangSysCount; i++) {
		const tag = scriptReader.uint32();
		const offset = scriptReader.uint16();
		langSysData.push({ tag, offset });
	}

	const baseValues = parseBaseValues(
		reader,
		scriptOffset + baseValuesOffset,
		baseTagList,
	);
	const defaultMinMax = parseMinMax(reader, scriptOffset + defaultMinMaxOffset);

	for (let i = 0; i < langSysData.length; i++) {
		const item = langSysData[i]!;
		const minMax = parseMinMax(reader, scriptOffset + item.offset);
		if (minMax) {
			baseLangSysRecords.set(item.tag, minMax);
		}
	}

	return { baseValues, defaultMinMax, baseLangSysRecords };
}

function parseAxisTable(reader: Reader, axisOffset: number): AxisTable | null {
	if (axisOffset === 0) return null;

	const axisReader = reader.sliceFrom(axisOffset);
	const baseTagListOffset = axisReader.uint16();
	const baseScriptListOffset = axisReader.uint16();

	// Parse base tag list
	const baseTagList: number[] = [];
	if (baseTagListOffset !== 0) {
		const tagReader = reader.sliceFrom(axisOffset + baseTagListOffset);
		const baseTagCount = tagReader.uint16();
		for (let i = 0; i < baseTagCount; i++) {
			baseTagList.push(tagReader.uint32());
		}
	}

	// Parse base script list
	const baseScriptList: BaseScriptRecord[] = [];
	if (baseScriptListOffset !== 0) {
		const scriptListReader = reader.sliceFrom(
			axisOffset + baseScriptListOffset,
		);
		const baseScriptCount = scriptListReader.uint16();

		const scriptData: Array<{ tag: number; offset: number }> = [];
		for (let i = 0; i < baseScriptCount; i++) {
			const tag = scriptListReader.uint32();
			const offset = scriptListReader.uint16();
			scriptData.push({ tag, offset });
		}

		for (let i = 0; i < scriptData.length; i++) {
			const item = scriptData[i]!;
			const record = parseBaseScriptRecord(
				reader,
				axisOffset + baseScriptListOffset + item.offset,
				baseTagList,
			);
			baseScriptList.push({ scriptTag: item.tag, ...record });
		}
	}

	return { baseTagList, baseScriptList };
}

export function parseBase(reader: Reader): BaseTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const horizAxisOffset = reader.uint16();
	const vertAxisOffset = reader.uint16();

	const horizAxis = parseAxisTable(reader, horizAxisOffset);
	const vertAxis = parseAxisTable(reader, vertAxisOffset);

	return {
		majorVersion,
		minorVersion,
		horizAxis,
		vertAxis,
	};
}

/** Get baseline value for a script */
export function getBaselineForScript(
	base: BaseTable,
	scriptTag: number,
	baselineTag: number,
	horizontal: boolean = true,
): int16 | null {
	const axis = horizontal ? base.horizAxis : base.vertAxis;
	if (!axis) return null;

	// Find script record
	const scriptRecord = axis.baseScriptList.find(
		(r) => r.scriptTag === scriptTag,
	);
	if (!scriptRecord?.baseValues) return null;

	// Find baseline tag index
	const tagIndex = axis.baseTagList.indexOf(baselineTag);
	if (tagIndex === -1) return null;

	return scriptRecord.baseValues.baseCoords[tagIndex] ?? null;
}

/** Get default baseline for a script */
export function getDefaultBaseline(
	base: BaseTable,
	scriptTag: number,
	horizontal: boolean = true,
): { tag: number; coordinate: int16 } | null {
	const axis = horizontal ? base.horizAxis : base.vertAxis;
	if (!axis) return null;

	const scriptRecord = axis.baseScriptList.find(
		(r) => r.scriptTag === scriptTag,
	);
	if (!scriptRecord?.baseValues) return null;

	const index = scriptRecord.baseValues.defaultBaselineIndex;
	const tag = axis.baseTagList[index];
	const coordinate = scriptRecord.baseValues.baseCoords[index];

	if (tag === undefined || coordinate === undefined) return null;

	return { tag, coordinate };
}

/** Get min/max extent for a script/language */
export function getMinMaxExtent(
	base: BaseTable,
	scriptTag: number,
	languageTag?: number,
	horizontal: boolean = true,
): MinMaxRecord | null {
	const axis = horizontal ? base.horizAxis : base.vertAxis;
	if (!axis) return null;

	const scriptRecord = axis.baseScriptList.find(
		(r) => r.scriptTag === scriptTag,
	);
	if (!scriptRecord) return null;

	// Try language-specific first
	if (languageTag !== undefined) {
		const langMinMax = scriptRecord.baseLangSysRecords.get(languageTag);
		if (langMinMax) {
			return { minCoord: langMinMax.minCoord, maxCoord: langMinMax.maxCoord };
		}
	}

	// Fall back to default
	if (scriptRecord.defaultMinMax) {
		return {
			minCoord: scriptRecord.defaultMinMax.minCoord,
			maxCoord: scriptRecord.defaultMinMax.maxCoord,
		};
	}

	return null;
}
