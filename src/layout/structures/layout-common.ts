import type { Tag, uint16 } from "../../types.ts";
import type { Reader } from "../../font/binary/reader.ts";

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
	for (const record of scriptRecords) {
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
	for (const record of langSysRecords) {
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
	const featureIndices = Array.from(reader.uint16Array(featureIndexCount));

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
	for (const record of featureRecords) {
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
	const lookupListIndices = Array.from(reader.uint16Array(lookupIndexCount));

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
	for (const offset of lookupOffsets) {
		const lookupReader = reader.sliceFrom(offset);
		headers.push(parseLookupHeader(lookupReader));
	}

	return headers;
}

function parseLookupHeader(reader: Reader): LookupHeader {
	const lookupType = reader.uint16();
	const lookupFlag = reader.uint16();
	const subtableCount = reader.uint16();
	const subtableOffsets = Array.from(reader.uint16Array(subtableCount));

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

/** Find script in script list */
export function findScript(
	scriptList: ScriptList,
	scriptTag: Tag,
): Script | null {
	for (const record of scriptList.scripts) {
		if (record.scriptTag === scriptTag) {
			return record.script;
		}
	}
	return null;
}

/** Find language system in script */
export function findLangSys(
	script: Script,
	langSysTag: Tag | null,
): LangSys | null {
	if (langSysTag === null) {
		return script.defaultLangSys;
	}

	for (const record of script.langSysRecords) {
		if (record.langSysTag === langSysTag) {
			return record.langSys;
		}
	}

	return script.defaultLangSys;
}

/** Get feature by index */
export function getFeature(
	featureList: FeatureList,
	index: number,
): FeatureRecord | null {
	return featureList.features[index] ?? null;
}
