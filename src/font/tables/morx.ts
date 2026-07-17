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
	// Bound each parser to its own subtable: header offsets are relative to
	// the subtable content, and lookup formats 0/4 need a real end boundary.
	const body = reader.slice(subtableStart, Math.max(0, length - 12));

	let subtable: MorxSubtable | null = null;

	switch (type) {
		case MorxSubtableType.Rearrangement:
			subtable = parseRearrangementSubtable(body, coverage, subFeatureFlags);
			break;
		case MorxSubtableType.Contextual:
			subtable = parseContextualSubtable(body, coverage, subFeatureFlags);
			break;
		case MorxSubtableType.Ligature:
			subtable = parseLigatureSubtable(body, coverage, subFeatureFlags);
			break;
		case MorxSubtableType.NonContextual:
			subtable = parseNonContextualSubtable(body, coverage, subFeatureFlags);
			break;
		case MorxSubtableType.Insertion:
			subtable = parseInsertionSubtable(body, coverage, subFeatureFlags);
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
	const stateArrayOffset = reader.offset32();
	const entryTableOffset = reader.offset32();
	const ligatureActionsOffset = reader.offset32();
	const componentsOffset = reader.offset32();
	const ligaturesOffset = reader.offset32();

	// The header gives no element counts; each region runs to the nearest
	// following region (they are not guaranteed to be emitted in order), or
	// to the end of the subtable.
	const tableLength = reader.length - stateTableOffset;
	const regionEnd = (start: number): number => {
		let end = tableLength;
		for (const offset of [
			classTableOffset,
			stateArrayOffset,
			entryTableOffset,
			ligatureActionsOffset,
			componentsOffset,
			ligaturesOffset,
		]) {
			if (offset > start && offset < end) end = offset;
		}
		return end;
	};
	const regionReader = (start: number): Reader => {
		const boundedStart = Math.min(start, tableLength);
		const boundedEnd = Math.max(
			boundedStart,
			Math.min(regionEnd(start), tableLength),
		);
		return reader.slice(
			stateTableOffset + boundedStart,
			boundedEnd - boundedStart,
		);
	};

	// Format 0 has no embedded count, so the class lookup must not be allowed
	// to consume the adjacent state, entry, or action regions.
	const classTable = parseClassTable(regionReader(classTableOffset));

	// State array: rows of nClasses uint16 entry indices
	const stateArrayReader = regionReader(stateArrayOffset);
	const stateCount =
		nClasses > 0 ? Math.floor(stateArrayReader.length / (2 * nClasses)) : 0;
	const rawStates: number[][] = [];
	let maxEntryIndex = -1;
	for (let s = 0; s < stateCount; s++) {
		const row: number[] = new Array(nClasses);
		for (let c = 0; c < nClasses; c++) {
			const entryIndex = stateArrayReader.uint16();
			row[c] = entryIndex;
			if (entryIndex > maxEntryIndex) maxEntryIndex = entryIndex;
		}
		rawStates.push(row);
	}

	// Entry table: {newState, flags, ligActionIndex}, sized by the highest
	// entry index the state array references
	const entryReader = regionReader(entryTableOffset);
	const entries: LigatureEntry[] = [];
	for (let e = 0; e <= maxEntryIndex && entryReader.hasRemaining(6); e++) {
		entries.push({
			newState: entryReader.uint16(),
			flags: entryReader.uint16(),
			ligActionIndex: entryReader.uint16(),
		});
	}

	const fallbackEntry: LigatureEntry = {
		newState: 0,
		flags: 0,
		ligActionIndex: 0,
	};
	const stateArray: LigatureEntry[][] = rawStates.map((row) =>
		row.map((entryIndex) => entries[entryIndex] ?? fallbackEntry),
	);

	const ligatureActions: uint32[] = [];
	const actionsReader = regionReader(ligatureActionsOffset);
	while (actionsReader.hasRemaining(4)) {
		ligatureActions.push(actionsReader.uint32());
	}

	const components: uint16[] = [];
	const componentsReader = regionReader(componentsOffset);
	while (componentsReader.hasRemaining(2)) {
		components.push(componentsReader.uint16());
	}

	const ligatures: GlyphId[] = [];
	const ligaturesReader = regionReader(ligaturesOffset);
	while (ligaturesReader.hasRemaining(2)) {
		ligatures.push(ligaturesReader.uint16());
	}

	return {
		type: MorxSubtableType.Ligature,
		coverage,
		subFeatureFlags,
		stateTable: {
			nClasses,
			classTable,
			stateArray,
		},
		ligatureActions,
		components,
		ligatures,
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

/**
 * Parse an AAT lookup table (formats 0, 2, 4, 6, 8, 10). The reader must
 * start at the lookup table itself and be bounded by its containing subtable:
 * format 0 runs to the end of the data and format 4 uses offsets relative to
 * the lookup table start.
 */
function parseLookupTable(reader: Reader): LookupTable {
	const format = reader.uint16();
	const mapping = new Map<GlyphId, GlyphId>();

	switch (format) {
		case 0: {
			// Simple array: one value per glyph, bounded by the enclosing slice
			let glyph = 0;
			while (reader.hasRemaining(2)) {
				mapping.set(glyph, reader.uint16());
				glyph++;
			}
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
				if (firstGlyph === 0xffff) continue; // binary-search terminator

				for (let g = firstGlyph; g <= lastGlyph; g++) {
					mapping.set(g, value);
				}
			}
			break;
		}
		case 4: {
			// Segment array: per-glyph values at an offset from the lookup start
			const _unitSize = reader.uint16();
			const nUnits = reader.uint16();
			reader.skip(6);

			for (let i = 0; i < nUnits; i++) {
				const lastGlyph = reader.uint16();
				const firstGlyph = reader.uint16();
				const valueOffset = reader.uint16();
				if (firstGlyph === 0xffff) continue;

				const count = lastGlyph - firstGlyph + 1;
				if (count <= 0 || valueOffset >= reader.length) continue;
				const values = reader.slice(
					valueOffset,
					Math.min(count * 2, reader.length - valueOffset),
				);
				for (let g = 0; g < count && values.hasRemaining(2); g++) {
					mapping.set(firstGlyph + g, values.uint16());
				}
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
				if (glyph === 0xffff) continue;
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
		case 10: {
			// Extended trimmed array with configurable unit size
			const unitSize = reader.uint16();
			const firstGlyph = reader.uint16();
			const glyphCount = reader.uint16();

			for (let i = 0; i < glyphCount && reader.hasRemaining(unitSize); i++) {
				const value =
					unitSize === 1
						? reader.uint8()
						: unitSize === 4
							? reader.uint32()
							: reader.uint16();
				mapping.set(firstGlyph + i, value);
			}
			break;
		}
	}

	return { format, mapping };
}

function parseClassTable(reader: Reader): ClassTable {
	const lookup = parseLookupTable(reader);
	const classArray: number[] = [];
	for (const [glyph, value] of lookup.mapping) {
		if (glyph <= 0xfffe) {
			classArray[glyph] = value;
		}
	}
	// Unmapped holes resolve to CLASS_OUT_OF_BOUNDS at lookup time.
	return { format: lookup.format, classArray };
}

/**
 * Apply non-contextual substitution
 */
export function applyNonContextual(
	subtable: MorxNonContextualSubtable,
	glyphId: GlyphId,
): GlyphId | null {
	const replacement = subtable.lookupTable.mapping.get(glyphId);
	// Apple specifies zero lookup values as explicit no-ops in morx tables.
	return replacement === undefined || replacement === 0 ? null : replacement;
}
