import type { uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * JSTF table - Justification data
 * Provides justification alternatives for scripts
 */

/** Justification priority levels */
export const JstfPriority = {
	/** Shrink GPOS lookups */
	ShrinkGpos: 0,
	/** Disable GPOS lookups */
	DisableGpos: 1,
	/** Shrink GSUB lookups */
	ShrinkGsub: 2,
	/** Disable GSUB lookups */
	DisableGsub: 3,
	/** Enable GPOS lookups */
	EnableGpos: 4,
	/** Enable GSUB lookups */
	EnableGsub: 5,
	/** Max extension GPOS lookups */
	MaxExtendGpos: 6,
	/** Max extension GSUB lookups */
	MaxExtendGsub: 7,
} as const;

/** JstfMax table - lookup indices for maximum extension */
export interface JstfMax {
	lookupIndices: uint16[];
}

/** JstfModList - enable/disable lookup list */
export interface JstfModList {
	lookupIndices: uint16[];
}

/** Justification priority record */
export interface JstfPriorityRecord {
	/** GSUB lookups to enable for shrinkage */
	shrinkageEnableGsub: JstfModList | null;
	/** GSUB lookups to disable for shrinkage */
	shrinkageDisableGsub: JstfModList | null;
	/** GPOS lookups to enable for shrinkage */
	shrinkageEnableGpos: JstfModList | null;
	/** GPOS lookups to disable for shrinkage */
	shrinkageDisableGpos: JstfModList | null;
	/** Maximum shrinkage GSUB */
	shrinkageJstfMax: JstfMax | null;
	/** GSUB lookups to enable for extension */
	extensionEnableGsub: JstfModList | null;
	/** GSUB lookups to disable for extension */
	extensionDisableGsub: JstfModList | null;
	/** GPOS lookups to enable for extension */
	extensionEnableGpos: JstfModList | null;
	/** GPOS lookups to disable for extension */
	extensionDisableGpos: JstfModList | null;
	/** Maximum extension GSUB */
	extensionJstfMax: JstfMax | null;
}

/** Justification language system */
export interface JstfLangSys {
	priorities: JstfPriorityRecord[];
}

/** Justification script record */
export interface JstfScriptRecord {
	scriptTag: number;
	/** Extender glyphs for Kashida-like justification */
	extenderGlyphs: uint16[];
	/** Default language system */
	defaultLangSys: JstfLangSys | null;
	/** Language-specific systems */
	langSysRecords: Map<number, JstfLangSys>;
}

/** JSTF table */
export interface JstfTable {
	majorVersion: uint16;
	minorVersion: uint16;
	scripts: JstfScriptRecord[];
}

function parseJstfModList(reader: Reader, offset: number): JstfModList | null {
	if (offset === 0) return null;

	const modReader = reader.sliceFrom(offset);
	const lookupCount = modReader.uint16();
	const lookupIndices: uint16[] = [];

	for (let i = 0; i < lookupCount; i++) {
		lookupIndices.push(modReader.uint16());
	}

	return { lookupIndices };
}

function parseJstfMax(reader: Reader, offset: number): JstfMax | null {
	if (offset === 0) return null;

	const maxReader = reader.sliceFrom(offset);
	const lookupCount = maxReader.uint16();
	const lookupIndices: uint16[] = [];

	for (let i = 0; i < lookupCount; i++) {
		lookupIndices.push(maxReader.uint16());
	}

	return { lookupIndices };
}

function parseJstfPriority(reader: Reader, offset: number): JstfPriorityRecord {
	const priReader = reader.sliceFrom(offset);

	const shrinkageEnableGsubOffset = priReader.uint16();
	const shrinkageDisableGsubOffset = priReader.uint16();
	const shrinkageEnableGposOffset = priReader.uint16();
	const shrinkageDisableGposOffset = priReader.uint16();
	const shrinkageJstfMaxOffset = priReader.uint16();
	const extensionEnableGsubOffset = priReader.uint16();
	const extensionDisableGsubOffset = priReader.uint16();
	const extensionEnableGposOffset = priReader.uint16();
	const extensionDisableGposOffset = priReader.uint16();
	const extensionJstfMaxOffset = priReader.uint16();

	return {
		shrinkageEnableGsub: parseJstfModList(
			reader,
			offset + shrinkageEnableGsubOffset,
		),
		shrinkageDisableGsub: parseJstfModList(
			reader,
			offset + shrinkageDisableGsubOffset,
		),
		shrinkageEnableGpos: parseJstfModList(
			reader,
			offset + shrinkageEnableGposOffset,
		),
		shrinkageDisableGpos: parseJstfModList(
			reader,
			offset + shrinkageDisableGposOffset,
		),
		shrinkageJstfMax: parseJstfMax(reader, offset + shrinkageJstfMaxOffset),
		extensionEnableGsub: parseJstfModList(
			reader,
			offset + extensionEnableGsubOffset,
		),
		extensionDisableGsub: parseJstfModList(
			reader,
			offset + extensionDisableGsubOffset,
		),
		extensionEnableGpos: parseJstfModList(
			reader,
			offset + extensionEnableGposOffset,
		),
		extensionDisableGpos: parseJstfModList(
			reader,
			offset + extensionDisableGposOffset,
		),
		extensionJstfMax: parseJstfMax(reader, offset + extensionJstfMaxOffset),
	};
}

function parseJstfLangSys(reader: Reader, offset: number): JstfLangSys {
	const langReader = reader.sliceFrom(offset);
	const jstfPriorityCount = langReader.uint16();

	const priorityOffsets: uint16[] = [];
	for (let i = 0; i < jstfPriorityCount; i++) {
		priorityOffsets.push(langReader.uint16());
	}

	const priorities: JstfPriorityRecord[] = [];
	for (let i = 0; i < priorityOffsets.length; i++) {
		const priOffset = priorityOffsets[i]!;
		priorities.push(parseJstfPriority(reader, offset + priOffset));
	}

	return { priorities };
}

function parseJstfScript(
	reader: Reader,
	offset: number,
): Omit<JstfScriptRecord, "scriptTag"> {
	const scriptReader = reader.sliceFrom(offset);
	const extenderGlyphOffset = scriptReader.uint16();
	const defJstfLangSysOffset = scriptReader.uint16();
	const jstfLangSysCount = scriptReader.uint16();

	// Parse language system records
	const langSysData: Array<{ tag: number; offset: number }> = [];
	for (let i = 0; i < jstfLangSysCount; i++) {
		const tag = scriptReader.uint32();
		const langOffset = scriptReader.uint16();
		langSysData.push({ tag, offset: langOffset });
	}

	// Parse extender glyphs
	const extenderGlyphs: uint16[] = [];
	if (extenderGlyphOffset !== 0) {
		const extReader = reader.sliceFrom(offset + extenderGlyphOffset);
		const glyphCount = extReader.uint16();
		for (let i = 0; i < glyphCount; i++) {
			extenderGlyphs.push(extReader.uint16());
		}
	}

	// Parse default lang sys
	const defaultLangSys =
		defJstfLangSysOffset !== 0
			? parseJstfLangSys(reader, offset + defJstfLangSysOffset)
			: null;

	// Parse language-specific systems
	const langSysRecords = new Map<number, JstfLangSys>();
	for (let i = 0; i < langSysData.length; i++) {
		const { tag, offset: langOffset } = langSysData[i]!;
		langSysRecords.set(tag, parseJstfLangSys(reader, offset + langOffset));
	}

	return { extenderGlyphs, defaultLangSys, langSysRecords };
}

export function parseJstf(reader: Reader): JstfTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();
	const jstfScriptCount = reader.uint16();

	// Read script record offsets
	const scriptData: Array<{ tag: number; offset: number }> = [];
	for (let i = 0; i < jstfScriptCount; i++) {
		const tag = reader.uint32();
		const offset = reader.uint16();
		scriptData.push({ tag, offset });
	}

	// Parse scripts
	const scripts: JstfScriptRecord[] = [];
	for (let i = 0; i < scriptData.length; i++) {
		const { tag, offset } = scriptData[i]!;
		const script = parseJstfScript(reader, offset);
		scripts.push({ scriptTag: tag, ...script });
	}

	return {
		majorVersion,
		minorVersion,
		scripts,
	};
}

/** Get extender glyphs for a script (e.g., Kashida for Arabic) */
export function getExtenderGlyphs(
	jstf: JstfTable,
	scriptTag: number,
): uint16[] {
	const script = jstf.scripts.find((s) => s.scriptTag === scriptTag);
	return script?.extenderGlyphs ?? [];
}

/** Get justification priorities for a script/language */
export function getJstfPriorities(
	jstf: JstfTable,
	scriptTag: number,
	languageTag?: number,
): JstfPriorityRecord[] {
	const script = jstf.scripts.find((s) => s.scriptTag === scriptTag);
	if (!script) return [];

	// Try language-specific first
	if (languageTag !== undefined) {
		const langSys = script.langSysRecords.get(languageTag);
		if (langSys) return langSys.priorities;
	}

	// Fall back to default
	return script.defaultLangSys?.priorities ?? [];
}

/** Get lookup modifications for shrinkage at a given priority level */
export function getShrinkageMods(priority: JstfPriorityRecord): {
	enableGsub: uint16[];
	disableGsub: uint16[];
	enableGpos: uint16[];
	disableGpos: uint16[];
	maxLookups: uint16[];
} {
	return {
		enableGsub: priority.shrinkageEnableGsub?.lookupIndices ?? [],
		disableGsub: priority.shrinkageDisableGsub?.lookupIndices ?? [],
		enableGpos: priority.shrinkageEnableGpos?.lookupIndices ?? [],
		disableGpos: priority.shrinkageDisableGpos?.lookupIndices ?? [],
		maxLookups: priority.shrinkageJstfMax?.lookupIndices ?? [],
	};
}

/** Get lookup modifications for extension at a given priority level */
export function getExtensionMods(priority: JstfPriorityRecord): {
	enableGsub: uint16[];
	disableGsub: uint16[];
	enableGpos: uint16[];
	disableGpos: uint16[];
	maxLookups: uint16[];
} {
	return {
		enableGsub: priority.extensionEnableGsub?.lookupIndices ?? [],
		disableGsub: priority.extensionDisableGsub?.lookupIndices ?? [],
		enableGpos: priority.extensionEnableGpos?.lookupIndices ?? [],
		disableGpos: priority.extensionDisableGpos?.lookupIndices ?? [],
		maxLookups: priority.extensionJstfMax?.lookupIndices ?? [],
	};
}
