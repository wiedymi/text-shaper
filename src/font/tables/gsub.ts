import type { GlyphId, Tag, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import {
	type Coverage,
	parseCoverage,
	parseCoverageAt,
} from "../../layout/structures/coverage.ts";
import {
	type ScriptList,
	type FeatureList,
	type LookupHeader,
	parseScriptList,
	parseFeatureList,
	parseLookupHeaders,
	LookupFlag,
} from "../../layout/structures/layout-common.ts";

/** GSUB lookup types */
export const enum GsubLookupType {
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

/** Single substitution subtable */
export interface SingleSubstSubtable {
	format: 1 | 2;
	coverage: Coverage;
	/** Format 1: delta to add to glyph ID */
	deltaGlyphId?: number;
	/** Format 2: substitute glyph IDs */
	substituteGlyphIds?: GlyphId[];
}

/** Ligature substitution lookup (Type 4) */
export interface LigatureSubstLookup extends GsubLookup {
	type: GsubLookupType.Ligature;
	subtables: LigatureSubstSubtable[];
}

/** Ligature substitution subtable */
export interface LigatureSubstSubtable {
	coverage: Coverage;
	ligatureSets: LigatureSet[];
}

/** Set of ligatures starting with a specific first glyph */
export interface LigatureSet {
	ligatures: Ligature[];
}

/** A single ligature rule */
export interface Ligature {
	/** Resulting ligature glyph */
	ligatureGlyph: GlyphId;
	/** Component glyphs (excluding first, which is in coverage) */
	componentGlyphIds: GlyphId[];
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

/** Union of all GSUB lookup types */
export type AnyGsubLookup =
	| SingleSubstLookup
	| MultipleSubstLookup
	| AlternateSubstLookup
	| LigatureSubstLookup;
// TODO: Add Context, ChainingContext, Extension, ReverseChainingSingle

/** GSUB table */
export interface GsubTable {
	version: { major: number; minor: number };
	scriptList: ScriptList;
	featureList: FeatureList;
	lookups: AnyGsubLookup[];
}

export function parseGsub(reader: Reader): GsubTable {
	const majorVersion = reader.uint16();
	const minorVersion = reader.uint16();

	const scriptListOffset = reader.offset16();
	const featureListOffset = reader.offset16();
	const lookupListOffset = reader.offset16();

	// Version 1.1 has additional feature variations offset
	let _featureVariationsOffset = 0;
	if (majorVersion === 1 && minorVersion >= 1) {
		_featureVariationsOffset = reader.offset32();
	}

	const scriptList = parseScriptList(reader.sliceFrom(scriptListOffset));
	const featureList = parseFeatureList(reader.sliceFrom(featureListOffset));

	// Parse lookup list
	const lookupListReader = reader.sliceFrom(lookupListOffset);
	const lookupHeaders = parseLookupHeaders(lookupListReader);

	// Parse each lookup
	const lookups: AnyGsubLookup[] = [];
	const lookupCount = lookupListReader.peek(() => lookupListReader.uint16());
	const lookupOffsets = lookupListReader.peek(() => {
		lookupListReader.skip(2);
		return lookupListReader.uint16Array(lookupCount);
	});

	for (let i = 0; i < lookupHeaders.length; i++) {
		const header = lookupHeaders[i]!;
		const lookupOffset = lookupOffsets[i]!;
		const lookupReader = lookupListReader.sliceFrom(lookupOffset);

		const lookup = parseGsubLookup(lookupReader, header);
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
	header: LookupHeader,
): AnyGsubLookup | null {
	// Skip the header we already parsed
	reader.skip(6 + header.subtableOffsets.length * 2);
	if (header.lookupFlag & LookupFlag.UseMarkFilteringSet) {
		reader.skip(2);
	}

	// Re-read from start for subtables
	reader.seek(0);
	const lookupType = reader.uint16();
	const lookupFlag = reader.uint16();
	const subtableCount = reader.uint16();
	const subtableOffsets = Array.from(reader.uint16Array(subtableCount));

	switch (lookupType) {
		case GsubLookupType.Single:
			return parseSingleSubstLookup(reader, subtableOffsets, header);

		case GsubLookupType.Multiple:
			return parseMultipleSubstLookup(reader, subtableOffsets, header);

		case GsubLookupType.Alternate:
			return parseAlternateSubstLookup(reader, subtableOffsets, header);

		case GsubLookupType.Ligature:
			return parseLigatureSubstLookup(reader, subtableOffsets, header);

		case GsubLookupType.Extension: {
			// Extension lookup - parse actual lookup from extension
			return parseExtensionLookup(reader, subtableOffsets, header);
		}

		// TODO: Context, ChainingContext, ReverseChainingSingle
		default:
			return null;
	}
}

function parseSingleSubstLookup(
	reader: Reader,
	subtableOffsets: number[],
	header: LookupHeader,
): SingleSubstLookup {
	const subtables: SingleSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const subtableReader = reader.sliceFrom(offset);
		const format = subtableReader.uint16();

		if (format === 1) {
			const coverageOffset = subtableReader.offset16();
			const deltaGlyphId = subtableReader.int16();
			const coverage = parseCoverageAt(subtableReader, coverageOffset);

			subtables.push({
				format: 1,
				coverage,
				deltaGlyphId,
			});
		} else if (format === 2) {
			const coverageOffset = subtableReader.offset16();
			const glyphCount = subtableReader.uint16();
			const substituteGlyphIds = Array.from(
				subtableReader.uint16Array(glyphCount),
			);
			const coverage = parseCoverageAt(subtableReader, coverageOffset);

			subtables.push({
				format: 2,
				coverage,
				substituteGlyphIds,
			});
		}
	}

	return {
		type: GsubLookupType.Single,
		flag: header.lookupFlag,
		markFilteringSet: header.markFilteringSet,
		subtables,
	};
}

function parseMultipleSubstLookup(
	reader: Reader,
	subtableOffsets: number[],
	header: LookupHeader,
): MultipleSubstLookup {
	const subtables: MultipleSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const subtableReader = reader.sliceFrom(offset);
		const format = subtableReader.uint16();

		if (format === 1) {
			const coverageOffset = subtableReader.offset16();
			const sequenceCount = subtableReader.uint16();
			const sequenceOffsets = subtableReader.uint16Array(sequenceCount);

			const coverage = parseCoverageAt(subtableReader, coverageOffset);
			const sequences: GlyphId[][] = [];

			for (const seqOffset of sequenceOffsets) {
				const seqReader = subtableReader.sliceFrom(seqOffset);
				const glyphCount = seqReader.uint16();
				sequences.push(Array.from(seqReader.uint16Array(glyphCount)));
			}

			subtables.push({ coverage, sequences });
		}
	}

	return {
		type: GsubLookupType.Multiple,
		flag: header.lookupFlag,
		markFilteringSet: header.markFilteringSet,
		subtables,
	};
}

function parseAlternateSubstLookup(
	reader: Reader,
	subtableOffsets: number[],
	header: LookupHeader,
): AlternateSubstLookup {
	const subtables: AlternateSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const subtableReader = reader.sliceFrom(offset);
		const format = subtableReader.uint16();

		if (format === 1) {
			const coverageOffset = subtableReader.offset16();
			const alternateSetCount = subtableReader.uint16();
			const alternateSetOffsets = subtableReader.uint16Array(alternateSetCount);

			const coverage = parseCoverageAt(subtableReader, coverageOffset);
			const alternateSets: GlyphId[][] = [];

			for (const altOffset of alternateSetOffsets) {
				const altReader = subtableReader.sliceFrom(altOffset);
				const glyphCount = altReader.uint16();
				alternateSets.push(Array.from(altReader.uint16Array(glyphCount)));
			}

			subtables.push({ coverage, alternateSets });
		}
	}

	return {
		type: GsubLookupType.Alternate,
		flag: header.lookupFlag,
		markFilteringSet: header.markFilteringSet,
		subtables,
	};
}

function parseLigatureSubstLookup(
	reader: Reader,
	subtableOffsets: number[],
	header: LookupHeader,
): LigatureSubstLookup {
	const subtables: LigatureSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const subtableReader = reader.sliceFrom(offset);
		const format = subtableReader.uint16();

		if (format === 1) {
			const coverageOffset = subtableReader.offset16();
			const ligatureSetCount = subtableReader.uint16();
			const ligatureSetOffsets = subtableReader.uint16Array(ligatureSetCount);

			const coverage = parseCoverageAt(subtableReader, coverageOffset);
			const ligatureSets: LigatureSet[] = [];

			for (const setOffset of ligatureSetOffsets) {
				const setReader = subtableReader.sliceFrom(setOffset);
				const ligatureCount = setReader.uint16();
				const ligatureOffsets = setReader.uint16Array(ligatureCount);

				const ligatures: Ligature[] = [];
				for (const ligOffset of ligatureOffsets) {
					const ligReader = setReader.sliceFrom(ligOffset);
					const ligatureGlyph = ligReader.uint16();
					const componentCount = ligReader.uint16();
					// Component count includes first glyph, so subtract 1
					const componentGlyphIds = Array.from(
						ligReader.uint16Array(componentCount - 1),
					);

					ligatures.push({
						ligatureGlyph,
						componentGlyphIds,
					});
				}

				ligatureSets.push({ ligatures });
			}

			subtables.push({ coverage, ligatureSets });
		}
	}

	return {
		type: GsubLookupType.Ligature,
		flag: header.lookupFlag,
		markFilteringSet: header.markFilteringSet,
		subtables,
	};
}

function parseExtensionLookup(
	reader: Reader,
	subtableOffsets: number[],
	header: LookupHeader,
): AnyGsubLookup | null {
	if (subtableOffsets.length === 0) return null;

	// Read extension header from first subtable
	const extReader = reader.sliceFrom(subtableOffsets[0]!);
	const format = extReader.uint16();
	if (format !== 1) return null;

	const extensionLookupType = extReader.uint16();
	const extensionOffset = extReader.uint32();

	// Parse the actual lookup
	const actualReader = extReader.sliceFrom(extensionOffset - 8); // Adjust for header

	const newHeader: LookupHeader = {
		...header,
		lookupType: extensionLookupType,
	};

	// Recursively parse
	switch (extensionLookupType) {
		case GsubLookupType.Single:
			return parseSingleSubstLookup(actualReader, [0], newHeader);
		case GsubLookupType.Multiple:
			return parseMultipleSubstLookup(actualReader, [0], newHeader);
		case GsubLookupType.Alternate:
			return parseAlternateSubstLookup(actualReader, [0], newHeader);
		case GsubLookupType.Ligature:
			return parseLigatureSubstLookup(actualReader, [0], newHeader);
		default:
			return null;
	}
}

/** Apply single substitution to a glyph */
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

/** Apply ligature substitution - returns ligature glyph and number of consumed glyphs */
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

		// Try each ligature in the set (longer matches first in proper fonts)
		for (const ligature of ligatureSet.ligatures) {
			const componentCount = ligature.componentGlyphIds.length;

			// Check if we have enough glyphs
			if (startIndex + 1 + componentCount > glyphIds.length) continue;

			// Check if components match
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
