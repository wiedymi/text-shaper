import type { Reader } from "../../font/binary/reader.ts";
import type { Tag, uint16 } from "../../types.ts";

/** Language system record */
export interface LangSysRecord {
	langSysTag: Tag;
	langSys: LangSys;
}

/** Language system table */
export interface LangSys {
	/** Required feature index (0xFFFF if none) */
	requiredFeatureIndex: uint16;
	/** Feature indices */
	featureIndices: uint16[];
}

/** Script record */
export interface ScriptRecord {
	scriptTag: Tag;
	script: Script;
}

/** Script table */
export interface Script {
	/** Default language system (may be null) */
	defaultLangSys: LangSys | null;
	/** Language system records */
	langSysRecords: LangSysRecord[];
}

/** Script list table */
export interface ScriptList {
	scripts: ScriptRecord[];
}

/** Feature record */
export interface FeatureRecord {
	featureTag: Tag;
	feature: Feature;
}

/** Feature table */
export interface Feature {
	/** Feature parameters offset (usually 0) */
	featureParamsOffset: uint16;
	/** Lookup indices */
	lookupListIndices: uint16[];
}

/** Feature list table */
export interface FeatureList {
	features: FeatureRecord[];
}

/** Lookup table header */
export interface LookupHeader {
	lookupType: uint16;
	lookupFlag: uint16;
	subtableOffsets: uint16[];
	/** Mark filtering set (if UseMarkFilteringSet flag is set) */
	markFilteringSet?: uint16;
}

/** Lookup flags */
export const LookupFlag = {
	RightToLeft: 0x0001,
	IgnoreBaseGlyphs: 0x0002,
	IgnoreLigatures: 0x0004,
	IgnoreMarks: 0x0008,
	UseMarkFilteringSet: 0x0010,
	// Bits 5-7 reserved
	MarkAttachmentTypeMask: 0xff00,
} as const;

/** Extract mark attachment type from lookup flag */
export function getMarkAttachmentType(lookupFlag: uint16): number {
	return (lookupFlag & LookupFlag.MarkAttachmentTypeMask) >> 8;
}

/** Parse ScriptList */
export function parseScriptList(reader: Reader): ScriptList {
	const scriptCount = reader.uint16();
	const scriptRecords: Array<{ tag: Tag; offset: uint16 }> = [];

	for (let i = 0; i < scriptCount; i++) {
		scriptRecords.push({
			tag: reader.tag(),
			offset: reader.offset16(),
		});
	}

	const scripts: ScriptRecord[] = [];
	for (let i = 0; i < scriptRecords.length; i++) {
		const record = scriptRecords[i]!;
		const scriptReader = reader.sliceFrom(record.offset);
		const script = parseScript(scriptReader);
		scripts.push({
			scriptTag: record.tag,
			script,
		});
	}

	return { scripts };
}

function parseScript(reader: Reader): Script {
	const defaultLangSysOffset = reader.offset16();
	const langSysCount = reader.uint16();

	const langSysRecords: Array<{ tag: Tag; offset: uint16 }> = [];
	for (let i = 0; i < langSysCount; i++) {
		langSysRecords.push({
			tag: reader.tag(),
			offset: reader.offset16(),
		});
	}

	// Parse default language system
	let defaultLangSys: LangSys | null = null;
	if (defaultLangSysOffset !== 0) {
		defaultLangSys = parseLangSys(reader.sliceFrom(defaultLangSysOffset));
	}

	// Parse language system records
	const parsedLangSysRecords: LangSysRecord[] = [];
	for (let i = 0; i < langSysRecords.length; i++) {
		const record = langSysRecords[i]!;
		const langSys = parseLangSys(reader.sliceFrom(record.offset));
		parsedLangSysRecords.push({
			langSysTag: record.tag,
			langSys,
		});
	}

	return {
		defaultLangSys,
		langSysRecords: parsedLangSysRecords,
	};
}

function parseLangSys(reader: Reader): LangSys {
	const _lookupOrderOffset = reader.offset16(); // Reserved, always 0
	const requiredFeatureIndex = reader.uint16();
	const featureIndexCount = reader.uint16();
	const uint16Array = reader.uint16Array(featureIndexCount);
	const featureIndices: uint16[] = new Array(featureIndexCount);
	for (let i = 0; i < featureIndexCount; i++) {
		featureIndices[i] = uint16Array[i]!;
	}

	return {
		requiredFeatureIndex,
		featureIndices,
	};
}

/** Parse FeatureList */
export function parseFeatureList(reader: Reader): FeatureList {
	const featureCount = reader.uint16();
	const featureRecords: Array<{ tag: Tag; offset: uint16 }> = [];

	for (let i = 0; i < featureCount; i++) {
		featureRecords.push({
			tag: reader.tag(),
			offset: reader.offset16(),
		});
	}

	const features: FeatureRecord[] = [];
	for (let i = 0; i < featureRecords.length; i++) {
		const record = featureRecords[i]!;
		const featureReader = reader.sliceFrom(record.offset);
		const feature = parseFeature(featureReader);
		features.push({
			featureTag: record.tag,
			feature,
		});
	}

	return { features };
}

function parseFeature(reader: Reader): Feature {
	const featureParamsOffset = reader.offset16();
	const lookupIndexCount = reader.uint16();
	const uint16Array = reader.uint16Array(lookupIndexCount);
	const lookupListIndices: uint16[] = new Array(lookupIndexCount);
	for (let i = 0; i < lookupIndexCount; i++) {
		lookupListIndices[i] = uint16Array[i]!;
	}

	return {
		featureParamsOffset,
		lookupListIndices,
	};
}

/** Parse lookup headers (does not parse subtables) */
export function parseLookupHeaders(reader: Reader): LookupHeader[] {
	const lookupCount = reader.uint16();
	const lookupOffsets = reader.uint16Array(lookupCount);

	const headers: LookupHeader[] = [];
	for (let i = 0; i < lookupOffsets.length; i++) {
		const offset = lookupOffsets[i]!;
		const lookupReader = reader.sliceFrom(offset);
		headers.push(parseLookupHeader(lookupReader));
	}

	return headers;
}

function parseLookupHeader(reader: Reader): LookupHeader {
	const lookupType = reader.uint16();
	const lookupFlag = reader.uint16();
	const subtableCount = reader.uint16();
	const uint16Array = reader.uint16Array(subtableCount);
	const subtableOffsets: uint16[] = new Array(subtableCount);
	for (let i = 0; i < subtableCount; i++) {
		subtableOffsets[i] = uint16Array[i]!;
	}

	let markFilteringSet: uint16 | undefined;
	if (lookupFlag & LookupFlag.UseMarkFilteringSet) {
		markFilteringSet = reader.uint16();
	}

	return {
		lookupType,
		lookupFlag,
		subtableOffsets,
		markFilteringSet,
	};
}

/**
 * Find script in script list by tag
 * @param scriptList - The script list to search
 * @param scriptTag - The script tag to find (e.g., 'latn', 'arab')
 * @returns The script table if found, null otherwise
 */
export function findScript(
	scriptList: ScriptList,
	scriptTag: Tag,
): Script | null {
	for (let i = 0; i < scriptList.scripts.length; i++) {
		const record = scriptList.scripts[i]!;
		if (record.scriptTag === scriptTag) {
			return record.script;
		}
	}
	return null;
}

/**
 * Find language system in script by tag
 * @param script - The script table to search
 * @param langSysTag - The language system tag to find (e.g., 'ENG', 'ARA'), or null for default
 * @returns The language system table if found, or the default language system if langSysTag is null or not found
 */
export function findLangSys(
	script: Script,
	langSysTag: Tag | null,
): LangSys | null {
	if (langSysTag === null) {
		return script.defaultLangSys;
	}

	for (let i = 0; i < script.langSysRecords.length; i++) {
		const record = script.langSysRecords[i]!;
		if (record.langSysTag === langSysTag) {
			return record.langSys;
		}
	}

	return script.defaultLangSys;
}

/**
 * Get feature by index from feature list
 * @param featureList - The feature list to retrieve from
 * @param index - The zero-based feature index
 * @returns The feature record at the specified index, or null if index is out of bounds
 */
export function getFeature(
	featureList: FeatureList,
	index: number,
): FeatureRecord | null {
	return featureList.features[index] ?? null;
}
