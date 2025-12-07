import {
	type Coverage,
	parseCoverageAt,
} from "../../layout/structures/coverage.ts";
import {
	type FeatureList,
	LookupFlag,
	parseFeatureList,
	parseScriptList,
	type ScriptList,
} from "../../layout/structures/layout-common.ts";
import type { GlyphId, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import {
	type ChainingContextSubstSubtable,
	type ContextSubstSubtable,
	parseChainingContextSubst,
	parseContextSubst,
} from "./gsub-contextual.ts";

/** GSUB lookup types */
export enum GsubLookupType {
	Single = 1,
	Multiple = 2,
	Alternate = 3,
	Ligature = 4,
	Context = 5,
	ChainingContext = 6,
	Extension = 7,
	ReverseChainingSingle = 8,
}

/** Base interface for all GSUB lookups */
export interface GsubLookup {
	type: GsubLookupType;
	flag: uint16;
	markFilteringSet?: uint16;
}

/** Single substitution lookup (Type 1) */
export interface SingleSubstLookup extends GsubLookup {
	type: GsubLookupType.Single;
	subtables: SingleSubstSubtable[];
}

export interface SingleSubstSubtable {
	format: 1 | 2;
	coverage: Coverage;
	deltaGlyphId?: number;
	substituteGlyphIds?: GlyphId[];
}

/** Multiple substitution lookup (Type 2) */
export interface MultipleSubstLookup extends GsubLookup {
	type: GsubLookupType.Multiple;
	subtables: MultipleSubstSubtable[];
}

export interface MultipleSubstSubtable {
	coverage: Coverage;
	sequences: GlyphId[][];
}

/** Alternate substitution lookup (Type 3) */
export interface AlternateSubstLookup extends GsubLookup {
	type: GsubLookupType.Alternate;
	subtables: AlternateSubstSubtable[];
}

export interface AlternateSubstSubtable {
	coverage: Coverage;
	alternateSets: GlyphId[][];
}

/** Ligature substitution lookup (Type 4) */
export interface LigatureSubstLookup extends GsubLookup {
	type: GsubLookupType.Ligature;
	subtables: LigatureSubstSubtable[];
}

export interface LigatureSubstSubtable {
	coverage: Coverage;
	ligatureSets: LigatureSet[];
}

export interface LigatureSet {
	ligatures: Ligature[];
}

export interface Ligature {
	ligatureGlyph: GlyphId;
	componentGlyphIds: GlyphId[];
}

/** Context substitution lookup (Type 5) */
export interface ContextSubstLookup extends GsubLookup {
	type: GsubLookupType.Context;
	subtables: ContextSubstSubtable[];
}

/** Chaining context substitution lookup (Type 6) */
export interface ChainingContextSubstLookup extends GsubLookup {
	type: GsubLookupType.ChainingContext;
	subtables: ChainingContextSubstSubtable[];
}

/** Reverse chaining single substitution lookup (Type 8) */
export interface ReverseChainingSingleSubstLookup extends GsubLookup {
	type: GsubLookupType.ReverseChainingSingle;
	subtables: ReverseChainingSingleSubstSubtable[];
}

export interface ReverseChainingSingleSubstSubtable {
	coverage: Coverage;
	backtrackCoverages: Coverage[];
	lookaheadCoverages: Coverage[];
	substituteGlyphIds: GlyphId[];
}

/** Union of all GSUB lookup types */
export type AnyGsubLookup =
	| SingleSubstLookup
	| MultipleSubstLookup
	| AlternateSubstLookup
	| LigatureSubstLookup
	| ContextSubstLookup
	| ChainingContextSubstLookup
	| ReverseChainingSingleSubstLookup;

/** GSUB table */
export interface GsubTable {
	version: { major: number; minor: number };
	scriptList: ScriptList;
	featureList: FeatureList;
	lookups: AnyGsubLookup[];
}

// Re-export for use in shaper
export type { SequenceLookupRecord } from "./gsub-contextual.ts";

export function parseGsub(reader: Reader): GsubTable {
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

	const lookups: AnyGsubLookup[] = [];
	for (const lookupOffset of lookupOffsets) {
		const lookupReader = lookupListReader.sliceFrom(lookupOffset);
		const lookup = parseGsubLookup(
			lookupReader,
			lookupListReader,
			lookupOffset,
		);
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

function parseGsubLookup(
	reader: Reader,
	_lookupListReader: Reader,
	_lookupOffset: number,
): AnyGsubLookup | null {
	const lookupType = reader.uint16();
	const lookupFlag = reader.uint16();
	const subtableCount = reader.uint16();
	const subtableOffsets = Array.from(reader.uint16Array(subtableCount));

	let markFilteringSet: uint16 | undefined;
	if (lookupFlag & LookupFlag.UseMarkFilteringSet) {
		markFilteringSet = reader.uint16();
	}

	const baseProps = { flag: lookupFlag, markFilteringSet };

	switch (lookupType) {
		case GsubLookupType.Single:
			return {
				type: GsubLookupType.Single,
				...baseProps,
				subtables: parseSingleSubst(reader, subtableOffsets),
			};

		case GsubLookupType.Multiple:
			return {
				type: GsubLookupType.Multiple,
				...baseProps,
				subtables: parseMultipleSubst(reader, subtableOffsets),
			};

		case GsubLookupType.Alternate:
			return {
				type: GsubLookupType.Alternate,
				...baseProps,
				subtables: parseAlternateSubst(reader, subtableOffsets),
			};

		case GsubLookupType.Ligature:
			return {
				type: GsubLookupType.Ligature,
				...baseProps,
				subtables: parseLigatureSubst(reader, subtableOffsets),
			};

		case GsubLookupType.Context:
			return {
				type: GsubLookupType.Context,
				...baseProps,
				subtables: parseContextSubst(reader, subtableOffsets),
			};

		case GsubLookupType.ChainingContext:
			return {
				type: GsubLookupType.ChainingContext,
				...baseProps,
				subtables: parseChainingContextSubst(reader, subtableOffsets),
			};

		case GsubLookupType.Extension:
			return parseExtensionLookup(reader, subtableOffsets, baseProps);

		case GsubLookupType.ReverseChainingSingle:
			return {
				type: GsubLookupType.ReverseChainingSingle,
				...baseProps,
				subtables: parseReverseChainingSingleSubst(reader, subtableOffsets),
			};

		default:
			return null;
	}
}

function parseSingleSubst(
	reader: Reader,
	subtableOffsets: number[],
): SingleSubstSubtable[] {
	const subtables: SingleSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const deltaGlyphId = r.int16();
			const coverage = parseCoverageAt(r, coverageOffset);
			subtables.push({ format: 1, coverage, deltaGlyphId });
		} else if (format === 2) {
			const coverageOffset = r.offset16();
			const glyphCount = r.uint16();
			const substituteGlyphIds = Array.from(r.uint16Array(glyphCount));
			const coverage = parseCoverageAt(r, coverageOffset);
			subtables.push({ format: 2, coverage, substituteGlyphIds });
		}
	}

	return subtables;
}

function parseMultipleSubst(
	reader: Reader,
	subtableOffsets: number[],
): MultipleSubstSubtable[] {
	const subtables: MultipleSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const sequenceCount = r.uint16();
			const sequenceOffsets = r.uint16Array(sequenceCount);

			const coverage = parseCoverageAt(r, coverageOffset);
			const sequences: GlyphId[][] = [];

			for (const seqOffset of sequenceOffsets) {
				const seqReader = r.sliceFrom(seqOffset);
				const glyphCount = seqReader.uint16();
				sequences.push(Array.from(seqReader.uint16Array(glyphCount)));
			}

			subtables.push({ coverage, sequences });
		}
	}

	return subtables;
}

function parseAlternateSubst(
	reader: Reader,
	subtableOffsets: number[],
): AlternateSubstSubtable[] {
	const subtables: AlternateSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const alternateSetCount = r.uint16();
			const alternateSetOffsets = r.uint16Array(alternateSetCount);

			const coverage = parseCoverageAt(r, coverageOffset);
			const alternateSets: GlyphId[][] = [];

			for (const altOffset of alternateSetOffsets) {
				const altReader = r.sliceFrom(altOffset);
				const glyphCount = altReader.uint16();
				alternateSets.push(Array.from(altReader.uint16Array(glyphCount)));
			}

			subtables.push({ coverage, alternateSets });
		}
	}

	return subtables;
}

function parseLigatureSubst(
	reader: Reader,
	subtableOffsets: number[],
): LigatureSubstSubtable[] {
	const subtables: LigatureSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const ligatureSetCount = r.uint16();
			const ligatureSetOffsets = r.uint16Array(ligatureSetCount);

			const coverage = parseCoverageAt(r, coverageOffset);
			const ligatureSets: LigatureSet[] = [];

			for (const setOffset of ligatureSetOffsets) {
				const setReader = r.sliceFrom(setOffset);
				const ligatureCount = setReader.uint16();
				const ligatureOffsets = setReader.uint16Array(ligatureCount);

				const ligatures: Ligature[] = [];
				for (const ligOffset of ligatureOffsets) {
					const ligReader = setReader.sliceFrom(ligOffset);
					const ligatureGlyph = ligReader.uint16();
					const componentCount = ligReader.uint16();
					const componentGlyphIds = Array.from(
						ligReader.uint16Array(componentCount - 1),
					);
					ligatures.push({ ligatureGlyph, componentGlyphIds });
				}

				ligatureSets.push({ ligatures });
			}

			subtables.push({ coverage, ligatureSets });
		}
	}

	return subtables;
}

function parseReverseChainingSingleSubst(
	reader: Reader,
	subtableOffsets: number[],
): ReverseChainingSingleSubstSubtable[] {
	const subtables: ReverseChainingSingleSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();

			const backtrackCount = r.uint16();
			const backtrackCoverageOffsets = r.uint16Array(backtrackCount);

			const lookaheadCount = r.uint16();
			const lookaheadCoverageOffsets = r.uint16Array(lookaheadCount);

			const glyphCount = r.uint16();
			const substituteGlyphIds = Array.from(r.uint16Array(glyphCount));

			const coverage = parseCoverageAt(r, coverageOffset);

			const backtrackCoverages: Coverage[] = [];
			for (const covOffset of backtrackCoverageOffsets) {
				backtrackCoverages.push(parseCoverageAt(r, covOffset));
			}

			const lookaheadCoverages: Coverage[] = [];
			for (const covOffset of lookaheadCoverageOffsets) {
				lookaheadCoverages.push(parseCoverageAt(r, covOffset));
			}

			subtables.push({
				coverage,
				backtrackCoverages,
				lookaheadCoverages,
				substituteGlyphIds,
			});
		}
	}

	return subtables;
}

function parseExtensionLookup(
	reader: Reader,
	subtableOffsets: number[],
	baseProps: { flag: uint16; markFilteringSet?: uint16 },
): AnyGsubLookup | null {
	if (subtableOffsets.length === 0) return null;

	// Parse all extension subtables
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
	const _actualOffsets = extSubtables.map((_, _i) => 0); // All at offset 0 of their readers

	// Create a combined reader for all subtables
	switch (actualType) {
		case GsubLookupType.Single: {
			const subtables: SingleSubstSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseSingleSubst(ext.reader, [0]));
			}
			return { type: GsubLookupType.Single, ...baseProps, subtables };
		}

		case GsubLookupType.Multiple: {
			const subtables: MultipleSubstSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseMultipleSubst(ext.reader, [0]));
			}
			return { type: GsubLookupType.Multiple, ...baseProps, subtables };
		}

		case GsubLookupType.Alternate: {
			const subtables: AlternateSubstSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseAlternateSubst(ext.reader, [0]));
			}
			return { type: GsubLookupType.Alternate, ...baseProps, subtables };
		}

		case GsubLookupType.Ligature: {
			const subtables: LigatureSubstSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseLigatureSubst(ext.reader, [0]));
			}
			return { type: GsubLookupType.Ligature, ...baseProps, subtables };
		}

		case GsubLookupType.Context: {
			const subtables: ContextSubstSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseContextSubst(ext.reader, [0]));
			}
			return { type: GsubLookupType.Context, ...baseProps, subtables };
		}

		case GsubLookupType.ChainingContext: {
			const subtables: ChainingContextSubstSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseChainingContextSubst(ext.reader, [0]));
			}
			return { type: GsubLookupType.ChainingContext, ...baseProps, subtables };
		}

		case GsubLookupType.ReverseChainingSingle: {
			const subtables: ReverseChainingSingleSubstSubtable[] = [];
			for (const ext of extSubtables) {
				subtables.push(...parseReverseChainingSingleSubst(ext.reader, [0]));
			}
			return {
				type: GsubLookupType.ReverseChainingSingle,
				...baseProps,
				subtables,
			};
		}

		default:
			return null;
	}
}

// Utility functions for applying lookups

export function applySingleSubst(
	lookup: SingleSubstLookup,
	glyphId: GlyphId,
): GlyphId | null {
	for (const subtable of lookup.subtables) {
		const coverageIndex = subtable.coverage.get(glyphId);
		if (coverageIndex === null) continue;

		if (subtable.format === 1 && subtable.deltaGlyphId !== undefined) {
			return (glyphId + subtable.deltaGlyphId) & 0xffff;
		}

		if (subtable.format === 2 && subtable.substituteGlyphIds) {
			return subtable.substituteGlyphIds[coverageIndex] ?? null;
		}
	}

	return null;
}

export function applyLigatureSubst(
	lookup: LigatureSubstLookup,
	glyphIds: GlyphId[],
	startIndex: number,
): { ligatureGlyph: GlyphId; consumed: number } | null {
	const firstGlyph = glyphIds[startIndex];
	if (firstGlyph === undefined) return null;

	for (const subtable of lookup.subtables) {
		const coverageIndex = subtable.coverage.get(firstGlyph);
		if (coverageIndex === null) continue;

		const ligatureSet = subtable.ligatureSets[coverageIndex];
		if (!ligatureSet) continue;

		for (const ligature of ligatureSet.ligatures) {
			const componentCount = ligature.componentGlyphIds.length;

			if (startIndex + 1 + componentCount > glyphIds.length) continue;

			let matches = true;
			for (let i = 0; i < componentCount; i++) {
				if (glyphIds[startIndex + 1 + i] !== ligature.componentGlyphIds[i]) {
					matches = false;
					break;
				}
			}

			if (matches) {
				return {
					ligatureGlyph: ligature.ligatureGlyph,
					consumed: 1 + componentCount,
				};
			}
		}
	}

	return null;
}

/**
 * Apply ligature substitution using a Uint16Array directly (avoids Array.from allocation).
 * glyphIds is a pre-allocated typed array, matchLen is the valid length to consider.
 */
export function applyLigatureSubstDirect(
	lookup: LigatureSubstLookup,
	glyphIds: Uint16Array,
	matchLen: number,
	startIndex: number,
): { ligatureGlyph: GlyphId; consumed: number } | null {
	const firstGlyph = glyphIds[startIndex];
	if (firstGlyph === undefined) return null;

	for (const subtable of lookup.subtables) {
		const coverageIndex = subtable.coverage.get(firstGlyph);
		if (coverageIndex === null) continue;

		const ligatureSet = subtable.ligatureSets[coverageIndex];
		if (!ligatureSet) continue;

		for (const ligature of ligatureSet.ligatures) {
			const componentCount = ligature.componentGlyphIds.length;

			if (startIndex + 1 + componentCount > matchLen) continue;

			let matches = true;
			for (let i = 0; i < componentCount; i++) {
				if (glyphIds[startIndex + 1 + i] !== ligature.componentGlyphIds[i]) {
					matches = false;
					break;
				}
			}

			if (matches) {
				return {
					ligatureGlyph: ligature.ligatureGlyph,
					consumed: 1 + componentCount,
				};
			}
		}
	}

	return null;
}
