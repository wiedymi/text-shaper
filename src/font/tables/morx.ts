import type { GlyphId, uint16, uint32 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";

/**
 * Extended Glyph Metamorphosis table (morx)
 * Apple Advanced Typography substitution
 */
export interface MorxTable {
	version: number;
	chains: MorxChain[];
}

/**
 * Feature chain in morx
 */
export interface MorxChain {
	defaultFlags: uint32;
	features: MorxFeature[];
	subtables: MorxSubtable[];
}

/**
 * Feature entry
 */
export interface MorxFeature {
	featureType: uint16;
	featureSetting: uint16;
	enableFlags: uint32;
	disableFlags: uint32;
}

/**
 * Subtable types
 */
export enum MorxSubtableType {
	Rearrangement = 0,
	Contextual = 1,
	Ligature = 2,
	NonContextual = 4,
	Insertion = 5,
}

/**
 * Base subtable
 */
export interface MorxSubtableBase {
	type: MorxSubtableType;
	coverage: MorxCoverage;
	subFeatureFlags: uint32;
}

export interface MorxCoverage {
	vertical: boolean;
	descending: boolean;
	logical: boolean;
}

export type MorxSubtable =
	| MorxRearrangementSubtable
	| MorxContextualSubtable
	| MorxLigatureSubtable
	| MorxNonContextualSubtable
	| MorxInsertionSubtable;

/**
 * Type 0: Rearrangement (reorders glyphs)
 */
export interface MorxRearrangementSubtable extends MorxSubtableBase {
	type: MorxSubtableType.Rearrangement;
	stateTable: StateTable<RearrangementEntry>;
}

export interface RearrangementEntry {
	newState: uint16;
	flags: uint16;
}

/**
 * Type 1: Contextual substitution
 */
export interface MorxContextualSubtable extends MorxSubtableBase {
	type: MorxSubtableType.Contextual;
	stateTable: StateTable<ContextualEntry>;
	substitutionTable: Map<GlyphId, GlyphId>[];
}

export interface ContextualEntry {
	newState: uint16;
	flags: uint16;
	markIndex: uint16;
	currentIndex: uint16;
}

/**
 * Type 2: Ligature
 */
export interface MorxLigatureSubtable extends MorxSubtableBase {
	type: MorxSubtableType.Ligature;
	stateTable: StateTable<LigatureEntry>;
	ligatureActions: uint32[];
	components: uint16[];
	ligatures: GlyphId[];
}

export interface LigatureEntry {
	newState: uint16;
	flags: uint16;
	ligActionIndex: uint16;
}

/**
 * Type 4: Non-contextual (simple substitution)
 */
export interface MorxNonContextualSubtable extends MorxSubtableBase {
	type: MorxSubtableType.NonContextual;
	lookupTable: LookupTable;
}

/**
 * Type 5: Insertion
 */
export interface MorxInsertionSubtable extends MorxSubtableBase {
	type: MorxSubtableType.Insertion;
	stateTable: StateTable<InsertionEntry>;
	insertionGlyphs: GlyphId[];
}

export interface InsertionEntry {
	newState: uint16;
	flags: uint16;
	currentInsertIndex: uint16;
	markedInsertIndex: uint16;
}

/**
 * State table for state machine processing
 */
export interface StateTable<E> {
	nClasses: uint32;
	classTable: ClassTable;
	stateArray: E[][];
}

/**
 * Class lookup table
 */
export interface ClassTable {
	format: number;
	classArray: number[]; // Maps glyph ID to class
}

/**
 * Lookup table for substitutions
 */
export interface LookupTable {
	format: number;
	mapping: Map<GlyphId, GlyphId>;
}

/**
 * Parse morx table
 */
export function parseMorx(reader: Reader): MorxTable {
	const version = reader.uint16();
	reader.skip(2); // unused

	if (version < 2) {
		// Version 1 (mort) - not supported
		return { version, chains: [] };
	}

	const nChains = reader.uint32();
	const chains: MorxChain[] = [];

	for (let i = 0; i < nChains; i++) {
		const chain = parseMorxChain(reader);
		chains.push(chain);
	}

	return { version, chains };
}

function parseMorxChain(reader: Reader): MorxChain {
	const defaultFlags = reader.uint32();
	const _chainLength = reader.uint32();
	const nFeatureEntries = reader.uint32();
	const nSubtables = reader.uint32();

	// Parse features
	const features: MorxFeature[] = [];
	for (let i = 0; i < nFeatureEntries; i++) {
		features.push({
			featureType: reader.uint16(),
			featureSetting: reader.uint16(),
			enableFlags: reader.uint32(),
			disableFlags: reader.uint32(),
		});
	}

	// Parse subtables
	const subtables: MorxSubtable[] = [];
	for (let i = 0; i < nSubtables; i++) {
		const subtable = parseMorxSubtable(reader);
		if (subtable) subtables.push(subtable);
	}

	return { defaultFlags, features, subtables };
}

function parseMorxSubtable(reader: Reader): MorxSubtable | null {
	const length = reader.uint32();
	const coverageBits = reader.uint32();
	const subFeatureFlags = reader.uint32();

	const type = coverageBits & 0xff;
	const coverage: MorxCoverage = {
		vertical: (coverageBits & 0x80000000) !== 0,
		descending: (coverageBits & 0x40000000) !== 0,
		logical: (coverageBits & 0x10000000) !== 0,
	};

	const subtableStart = reader.offset;
	const subtableEnd = subtableStart + length - 12;

	let subtable: MorxSubtable | null = null;

	switch (type) {
		case MorxSubtableType.Rearrangement:
			subtable = parseRearrangementSubtable(reader, coverage, subFeatureFlags);
			break;
		case MorxSubtableType.Contextual:
			subtable = parseContextualSubtable(reader, coverage, subFeatureFlags);
			break;
		case MorxSubtableType.Ligature:
			subtable = parseLigatureSubtable(reader, coverage, subFeatureFlags);
			break;
		case MorxSubtableType.NonContextual:
			subtable = parseNonContextualSubtable(reader, coverage, subFeatureFlags);
			break;
		case MorxSubtableType.Insertion:
			subtable = parseInsertionSubtable(reader, coverage, subFeatureFlags);
			break;
	}

	// Skip to end of subtable
	reader.seek(subtableEnd);

	return subtable;
}

function parseNonContextualSubtable(
	reader: Reader,
	coverage: MorxCoverage,
	subFeatureFlags: uint32,
): MorxNonContextualSubtable {
	const lookupTable = parseLookupTable(reader);

	return {
		type: MorxSubtableType.NonContextual,
		coverage,
		subFeatureFlags,
		lookupTable,
	};
}

function parseContextualSubtable(
	reader: Reader,
	coverage: MorxCoverage,
	subFeatureFlags: uint32,
): MorxContextualSubtable {
	const stateTableOffset = reader.offset;
	const nClasses = reader.uint32();
	const classTableOffset = reader.offset32();
	const _stateArrayOffset = reader.offset32();
	const _entryTableOffset = reader.offset32();
	const _substitutionTableOffset = reader.offset32();

	// Parse class table
	const classTable = parseClassTable(
		reader.sliceFrom(stateTableOffset + classTableOffset),
	);

	// Parse state array and entries (simplified)
	const stateTable: StateTable<ContextualEntry> = {
		nClasses,
		classTable,
		stateArray: [],
	};

	const substitutionTable: Map<GlyphId, GlyphId>[] = [];

	return {
		type: MorxSubtableType.Contextual,
		coverage,
		subFeatureFlags,
		stateTable,
		substitutionTable,
	};
}

function parseLigatureSubtable(
	reader: Reader,
	coverage: MorxCoverage,
	subFeatureFlags: uint32,
): MorxLigatureSubtable {
	const stateTableOffset = reader.offset;
	const nClasses = reader.uint32();
	const classTableOffset = reader.offset32();
	const _stateArrayOffset = reader.offset32();
	const _entryTableOffset = reader.offset32();
	const _ligatureActionsOffset = reader.offset32();
	const _componentsOffset = reader.offset32();
	const _ligaturesOffset = reader.offset32();

	// Parse class table
	const classTable = parseClassTable(
		reader.sliceFrom(stateTableOffset + classTableOffset),
	);

	// State table (simplified)
	const stateTable: StateTable<LigatureEntry> = {
		nClasses,
		classTable,
		stateArray: [],
	};

	return {
		type: MorxSubtableType.Ligature,
		coverage,
		subFeatureFlags,
		stateTable,
		ligatureActions: [],
		components: [],
		ligatures: [],
	};
}

function parseRearrangementSubtable(
	reader: Reader,
	coverage: MorxCoverage,
	subFeatureFlags: uint32,
): MorxRearrangementSubtable {
	const stateTableOffset = reader.offset;
	const nClasses = reader.uint32();
	const classTableOffset = reader.offset32();
	const stateArrayOffset = reader.offset32();
	const entryTableOffset = reader.offset32();

	// Parse class table
	const classTable = parseClassTable(
		reader.sliceFrom(stateTableOffset + classTableOffset),
	);

	// Parse state array
	const stateArrayReader = reader.sliceFrom(
		stateTableOffset + stateArrayOffset,
	);
	const entryReader = reader.sliceFrom(stateTableOffset + entryTableOffset);

	// Parse entries (each entry is 4 bytes: newState uint16, flags uint16)
	const entries: RearrangementEntry[] = [];
	const entryCount = 256; // Reasonable max
	for (let i = 0; i < entryCount; i++) {
		entries.push({
			newState: entryReader.uint16(),
			flags: entryReader.uint16(),
		});
	}

	// Build state array
	const stateArray: RearrangementEntry[][] = [];
	const stateCount = Math.min(
		256,
		Math.ceil((entryTableOffset - stateArrayOffset) / (nClasses * 2)),
	);
	for (let s = 0; s < stateCount; s++) {
		const row: RearrangementEntry[] = [];
		for (let c = 0; c < nClasses; c++) {
			const entryIndex = stateArrayReader.uint16();
			row.push(entries[entryIndex] ?? { newState: 0, flags: 0 });
		}
		stateArray.push(row);
	}

	return {
		type: MorxSubtableType.Rearrangement,
		coverage,
		subFeatureFlags,
		stateTable: {
			nClasses,
			classTable,
			stateArray,
		},
	};
}

function parseInsertionSubtable(
	reader: Reader,
	coverage: MorxCoverage,
	subFeatureFlags: uint32,
): MorxInsertionSubtable {
	const stateTableOffset = reader.offset;
	const nClasses = reader.uint32();
	const classTableOffset = reader.offset32();
	const stateArrayOffset = reader.offset32();
	const entryTableOffset = reader.offset32();
	const insertionActionOffset = reader.offset32();

	// Parse class table
	const classTable = parseClassTable(
		reader.sliceFrom(stateTableOffset + classTableOffset),
	);

	// Parse insertion glyphs array
	const insertionReader = reader.sliceFrom(
		stateTableOffset + insertionActionOffset,
	);
	const insertionGlyphs: GlyphId[] = [];
	// Read a reasonable number of insertion glyphs
	const maxInsertionGlyphs = 1024;
	for (let i = 0; i < maxInsertionGlyphs; i++) {
		try {
			insertionGlyphs.push(insertionReader.uint16());
		} catch {
			break;
		}
	}

	// Parse entries
	const entryReader = reader.sliceFrom(stateTableOffset + entryTableOffset);
	const entries: InsertionEntry[] = [];
	const entryCount = 256;
	for (let i = 0; i < entryCount; i++) {
		entries.push({
			newState: entryReader.uint16(),
			flags: entryReader.uint16(),
			currentInsertIndex: entryReader.uint16(),
			markedInsertIndex: entryReader.uint16(),
		});
	}

	// Build state array
	const stateArrayReader = reader.sliceFrom(
		stateTableOffset + stateArrayOffset,
	);
	const stateArray: InsertionEntry[][] = [];
	const stateCount = Math.min(
		256,
		Math.ceil((entryTableOffset - stateArrayOffset) / (nClasses * 2)),
	);
	for (let s = 0; s < stateCount; s++) {
		const row: InsertionEntry[] = [];
		for (let c = 0; c < nClasses; c++) {
			const entryIndex = stateArrayReader.uint16();
			row.push(
				entries[entryIndex] ?? {
					newState: 0,
					flags: 0,
					currentInsertIndex: 0xffff,
					markedInsertIndex: 0xffff,
				},
			);
		}
		stateArray.push(row);
	}

	return {
		type: MorxSubtableType.Insertion,
		coverage,
		subFeatureFlags,
		stateTable: {
			nClasses,
			classTable,
			stateArray,
		},
		insertionGlyphs,
	};
}

function parseLookupTable(reader: Reader): LookupTable {
	const format = reader.uint16();
	const mapping = new Map<GlyphId, GlyphId>();

	switch (format) {
		case 0: {
			// Simple array
			// Format 0 uses lookup by glyph index directly
			break;
		}
		case 2: {
			// Segment single
			const _unitSize = reader.uint16();
			const nUnits = reader.uint16();
			reader.skip(6); // searchRange, entrySelector, rangeShift

			for (let i = 0; i < nUnits; i++) {
				const lastGlyph = reader.uint16();
				const firstGlyph = reader.uint16();
				const value = reader.uint16();

				for (let g = firstGlyph; g <= lastGlyph; g++) {
					mapping.set(g, value);
				}
			}
			break;
		}
		case 4: {
			// Segment array
			const _unitSize = reader.uint16();
			const nUnits = reader.uint16();
			reader.skip(6);

			for (let i = 0; i < nUnits; i++) {
				const _lastGlyph = reader.uint16();
				const _firstGlyph = reader.uint16();
				const _valueOffset = reader.uint16();

				// Values would be read from valueOffset
				// Simplified: skip for now
			}
			break;
		}
		case 6: {
			// Single table
			const _unitSize = reader.uint16();
			const nUnits = reader.uint16();
			reader.skip(6);

			for (let i = 0; i < nUnits; i++) {
				const glyph = reader.uint16();
				const value = reader.uint16();
				mapping.set(glyph, value);
			}
			break;
		}
		case 8: {
			// Trimmed array
			const firstGlyph = reader.uint16();
			const glyphCount = reader.uint16();

			for (let i = 0; i < glyphCount; i++) {
				const value = reader.uint16();
				if (value !== 0) {
					mapping.set(firstGlyph + i, value);
				}
			}
			break;
		}
	}

	return { format, mapping };
}

function parseClassTable(reader: Reader): ClassTable {
	const format = reader.uint16();
	const classArray: number[] = [];

	if (format === 2) {
		// Binary search segments
		const _unitSize = reader.uint16();
		const nUnits = reader.uint16();
		reader.skip(6);

		const segments: { first: number; last: number; classValue: number }[] = [];
		for (let i = 0; i < nUnits; i++) {
			segments.push({
				last: reader.uint16(),
				first: reader.uint16(),
				classValue: reader.uint16(),
			});
		}

		// Build class array (simplified, might be large)
		const maxGlyph = Math.max(...segments.map((s) => s.last), 0);
		for (let g = 0; g <= maxGlyph; g++) {
			const seg = segments.find((s) => g >= s.first && g <= s.last);
			classArray[g] = seg?.classValue ?? 1; // Class 1 = out of bounds
		}
	}

	return { format, classArray };
}

/**
 * Apply non-contextual substitution
 */
export function applyNonContextual(
	subtable: MorxNonContextualSubtable,
	glyphId: GlyphId,
): GlyphId | null {
	return subtable.lookupTable.mapping.get(glyphId) ?? null;
}
