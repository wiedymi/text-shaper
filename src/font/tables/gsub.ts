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
import { SetDigest } from "../../layout/structures/set-digest.ts";
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
	/** Bloom filter for fast O(1) glyph rejection */
	digest: SetDigest;
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
	for (let i = 0; i < lookupOffsets.length; i++) {
		const lookupOffset = lookupOffsets[i]!;
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
	const typedOffsets = reader.uint16Array(subtableCount);
	const subtableOffsets = new Array(typedOffsets.length);
	for (let i = 0; i < typedOffsets.length; i++)
		subtableOffsets[i] = typedOffsets[i];

	let markFilteringSet: uint16 | undefined;
	if (lookupFlag & LookupFlag.UseMarkFilteringSet) {
		markFilteringSet = reader.uint16();
	}

	const baseProps = { flag: lookupFlag, markFilteringSet };

	// Helper to build digest from subtables with coverage
	const buildDigest = (subtables: { coverage: Coverage }[]): SetDigest => {
		const digest = new SetDigest();
		for (let i = 0; i < subtables.length; i++) {
			const st = subtables[i]!;
			digest.addCoverage(st.coverage);
		}
		return digest;
	};

	switch (lookupType) {
		case GsubLookupType.Single: {
			const subtables = parseSingleSubst(reader, subtableOffsets);
			return {
				type: GsubLookupType.Single,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GsubLookupType.Multiple: {
			const subtables = parseMultipleSubst(reader, subtableOffsets);
			return {
				type: GsubLookupType.Multiple,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GsubLookupType.Alternate: {
			const subtables = parseAlternateSubst(reader, subtableOffsets);
			return {
				type: GsubLookupType.Alternate,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GsubLookupType.Ligature: {
			const subtables = parseLigatureSubst(reader, subtableOffsets);
			return {
				type: GsubLookupType.Ligature,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GsubLookupType.Context: {
			const subtables = parseContextSubst(reader, subtableOffsets);
			// Context subtables may not have direct coverage - use empty digest
			const digest = new SetDigest();
			for (let i = 0; i < subtables.length; i++) {
				const st = subtables[i]!;
				if ("coverage" in st && st.coverage) {
					digest.addCoverage(st.coverage);
				}
			}
			return {
				type: GsubLookupType.Context,
				...baseProps,
				subtables,
				digest,
			};
		}

		case GsubLookupType.ChainingContext: {
			const subtables = parseChainingContextSubst(reader, subtableOffsets);
			// Chaining context - use input coverage if available
			const digest = new SetDigest();
			for (let i = 0; i < subtables.length; i++) {
				const st = subtables[i]!;
				if ("coverage" in st && st.coverage) {
					digest.addCoverage(st.coverage);
				} else if ("inputCoverages" in st && st.inputCoverages?.[0]) {
					digest.addCoverage(st.inputCoverages[0]);
				}
			}
			return {
				type: GsubLookupType.ChainingContext,
				...baseProps,
				subtables,
				digest,
			};
		}

		case GsubLookupType.Extension:
			return parseExtensionLookup(reader, subtableOffsets, baseProps);

		case GsubLookupType.ReverseChainingSingle: {
			const subtables = parseReverseChainingSingleSubst(
				reader,
				subtableOffsets,
			);
			return {
				type: GsubLookupType.ReverseChainingSingle,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		default:
			return null;
	}
}

function parseSingleSubst(
	reader: Reader,
	subtableOffsets: number[],
): SingleSubstSubtable[] {
	const subtables: SingleSubstSubtable[] = [];

	for (let i = 0; i < subtableOffsets.length; i++) {
		const offset = subtableOffsets[i]!;
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
			const typedIds = r.uint16Array(glyphCount);
			const substituteGlyphIds = new Array(typedIds.length);
			for (let j = 0; j < typedIds.length; j++)
				substituteGlyphIds[j] = typedIds[j];
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

	for (let i = 0; i < subtableOffsets.length; i++) {
		const offset = subtableOffsets[i]!;
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const sequenceCount = r.uint16();
			const sequenceOffsets = r.uint16Array(sequenceCount);

			const coverage = parseCoverageAt(r, coverageOffset);
			const sequences: GlyphId[][] = [];

			for (let j = 0; j < sequenceOffsets.length; j++) {
				const seqOffset = sequenceOffsets[j]!;
				const seqReader = r.sliceFrom(seqOffset);
				const glyphCount = seqReader.uint16();
				const typedSeq = seqReader.uint16Array(glyphCount);
				const seq = new Array(typedSeq.length);
				for (let k = 0; k < typedSeq.length; k++) seq[k] = typedSeq[k];
				sequences.push(seq);
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

	for (let i = 0; i < subtableOffsets.length; i++) {
		const offset = subtableOffsets[i]!;
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const alternateSetCount = r.uint16();
			const alternateSetOffsets = r.uint16Array(alternateSetCount);

			const coverage = parseCoverageAt(r, coverageOffset);
			const alternateSets: GlyphId[][] = [];

			for (let j = 0; j < alternateSetOffsets.length; j++) {
				const altOffset = alternateSetOffsets[j]!;
				const altReader = r.sliceFrom(altOffset);
				const glyphCount = altReader.uint16();
				const typedAlts = altReader.uint16Array(glyphCount);
				const alts = new Array(typedAlts.length);
				for (let k = 0; k < typedAlts.length; k++) alts[k] = typedAlts[k];
				alternateSets.push(alts);
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

	for (let i = 0; i < subtableOffsets.length; i++) {
		const offset = subtableOffsets[i]!;
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();
			const ligatureSetCount = r.uint16();
			const ligatureSetOffsets = r.uint16Array(ligatureSetCount);

			const coverage = parseCoverageAt(r, coverageOffset);
			const ligatureSets: LigatureSet[] = [];

			for (let j = 0; j < ligatureSetOffsets.length; j++) {
				const setOffset = ligatureSetOffsets[j]!;
				const setReader = r.sliceFrom(setOffset);
				const ligatureCount = setReader.uint16();
				const ligatureOffsets = setReader.uint16Array(ligatureCount);

				const ligatures: Ligature[] = [];
				for (let k = 0; k < ligatureOffsets.length; k++) {
					const ligOffset = ligatureOffsets[k]!;
					const ligReader = setReader.sliceFrom(ligOffset);
					const ligatureGlyph = ligReader.uint16();
					const componentCount = ligReader.uint16();
					const typedComps = ligReader.uint16Array(componentCount - 1);
					const componentGlyphIds = new Array(typedComps.length);
					for (let m = 0; m < typedComps.length; m++)
						componentGlyphIds[m] = typedComps[m];
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

	for (let i = 0; i < subtableOffsets.length; i++) {
		const offset = subtableOffsets[i]!;
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		if (format === 1) {
			const coverageOffset = r.offset16();

			const backtrackCount = r.uint16();
			const backtrackCoverageOffsets = r.uint16Array(backtrackCount);

			const lookaheadCount = r.uint16();
			const lookaheadCoverageOffsets = r.uint16Array(lookaheadCount);

			const glyphCount = r.uint16();
			const typedIds = r.uint16Array(glyphCount);
			const substituteGlyphIds = new Array(typedIds.length);
			for (let j = 0; j < typedIds.length; j++)
				substituteGlyphIds[j] = typedIds[j];

			const coverage = parseCoverageAt(r, coverageOffset);

			const backtrackCoverages: Coverage[] = [];
			for (let j = 0; j < backtrackCoverageOffsets.length; j++) {
				const covOffset = backtrackCoverageOffsets[j]!;
				backtrackCoverages.push(parseCoverageAt(r, covOffset));
			}

			const lookaheadCoverages: Coverage[] = [];
			for (let j = 0; j < lookaheadCoverageOffsets.length; j++) {
				const covOffset = lookaheadCoverageOffsets[j]!;
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

	for (let i = 0; i < subtableOffsets.length; i++) {
		const offset = subtableOffsets[i]!;
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

	// Helper to build digest from subtables with coverage
	const buildDigest = (subtables: { coverage: Coverage }[]): SetDigest => {
		const digest = new SetDigest();
		for (let i = 0; i < subtables.length; i++) {
			const st = subtables[i]!;
			digest.addCoverage(st.coverage);
		}
		return digest;
	};

	// Create a combined reader for all subtables
	switch (actualType) {
		case GsubLookupType.Single: {
			const subtables: SingleSubstSubtable[] = [];
			for (let i = 0; i < extSubtables.length; i++) {
				const ext = extSubtables[i]!;
				subtables.push(...parseSingleSubst(ext.reader, [0]));
			}
			return {
				type: GsubLookupType.Single,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GsubLookupType.Multiple: {
			const subtables: MultipleSubstSubtable[] = [];
			for (let i = 0; i < extSubtables.length; i++) {
				const ext = extSubtables[i]!;
				subtables.push(...parseMultipleSubst(ext.reader, [0]));
			}
			return {
				type: GsubLookupType.Multiple,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GsubLookupType.Alternate: {
			const subtables: AlternateSubstSubtable[] = [];
			for (let i = 0; i < extSubtables.length; i++) {
				const ext = extSubtables[i]!;
				subtables.push(...parseAlternateSubst(ext.reader, [0]));
			}
			return {
				type: GsubLookupType.Alternate,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GsubLookupType.Ligature: {
			const subtables: LigatureSubstSubtable[] = [];
			for (let i = 0; i < extSubtables.length; i++) {
				const ext = extSubtables[i]!;
				subtables.push(...parseLigatureSubst(ext.reader, [0]));
			}
			return {
				type: GsubLookupType.Ligature,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
			};
		}

		case GsubLookupType.Context: {
			const subtables: ContextSubstSubtable[] = [];
			for (let i = 0; i < extSubtables.length; i++) {
				const ext = extSubtables[i]!;
				subtables.push(...parseContextSubst(ext.reader, [0]));
			}
			const digest = new SetDigest();
			for (let i = 0; i < subtables.length; i++) {
				const st = subtables[i]!;
				if ("coverage" in st && st.coverage) {
					digest.addCoverage(st.coverage);
				}
			}
			return { type: GsubLookupType.Context, ...baseProps, subtables, digest };
		}

		case GsubLookupType.ChainingContext: {
			const subtables: ChainingContextSubstSubtable[] = [];
			for (let i = 0; i < extSubtables.length; i++) {
				const ext = extSubtables[i]!;
				subtables.push(...parseChainingContextSubst(ext.reader, [0]));
			}
			const digest = new SetDigest();
			for (let i = 0; i < subtables.length; i++) {
				const st = subtables[i]!;
				if ("coverage" in st && st.coverage) {
					digest.addCoverage(st.coverage);
				} else if ("inputCoverages" in st && st.inputCoverages?.[0]) {
					digest.addCoverage(st.inputCoverages[0]);
				}
			}
			return {
				type: GsubLookupType.ChainingContext,
				...baseProps,
				subtables,
				digest,
			};
		}

		case GsubLookupType.ReverseChainingSingle: {
			const subtables: ReverseChainingSingleSubstSubtable[] = [];
			for (let i = 0; i < extSubtables.length; i++) {
				const ext = extSubtables[i]!;
				subtables.push(...parseReverseChainingSingleSubst(ext.reader, [0]));
			}
			return {
				type: GsubLookupType.ReverseChainingSingle,
				...baseProps,
				subtables,
				digest: buildDigest(subtables),
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
	for (let i = 0; i < lookup.subtables.length; i++) {
		const subtable = lookup.subtables[i]!;
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

	for (let i = 0; i < lookup.subtables.length; i++) {
		const subtable = lookup.subtables[i]!;
		const coverageIndex = subtable.coverage.get(firstGlyph);
		if (coverageIndex === null) continue;

		const ligatureSet = subtable.ligatureSets[coverageIndex];
		if (!ligatureSet) continue;

		for (let j = 0; j < ligatureSet.ligatures.length; j++) {
			const ligature = ligatureSet.ligatures[j]!;
			const componentCount = ligature.componentGlyphIds.length;

			if (startIndex + 1 + componentCount > glyphIds.length) continue;

			let matches = true;
			for (let k = 0; k < componentCount; k++) {
				if (glyphIds[startIndex + 1 + k] !== ligature.componentGlyphIds[k]) {
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

	for (let i = 0; i < lookup.subtables.length; i++) {
		const subtable = lookup.subtables[i]!;
		const coverageIndex = subtable.coverage.get(firstGlyph);
		if (coverageIndex === null) continue;

		const ligatureSet = subtable.ligatureSets[coverageIndex];
		if (!ligatureSet) continue;

		for (let j = 0; j < ligatureSet.ligatures.length; j++) {
			const ligature = ligatureSet.ligatures[j]!;
			const componentCount = ligature.componentGlyphIds.length;

			if (startIndex + 1 + componentCount > matchLen) continue;

			let matches = true;
			for (let k = 0; k < componentCount; k++) {
				if (glyphIds[startIndex + 1 + k] !== ligature.componentGlyphIds[k]) {
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

// Export internal functions for testing
export const __testing = {
	parseGsubLookup,
	parseExtensionLookup,
};
