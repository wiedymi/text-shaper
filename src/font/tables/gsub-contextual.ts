import {
	type ClassDef,
	parseClassDefAt,
} from "../../layout/structures/class-def.ts";
import {
	type Coverage,
	parseCoverageAt,
} from "../../layout/structures/coverage.ts";
import type { GlyphId, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import type { GsubLookup } from "./gsub.ts";

/** Sequence lookup record - applies a lookup at a position */
export interface SequenceLookupRecord {
	sequenceIndex: uint16; // Position in input sequence
	lookupListIndex: uint16; // Lookup to apply
}

/** Context substitution lookup (Type 5) */
export interface ContextSubstLookup extends GsubLookup {
	type: 5;
	subtables: ContextSubstSubtable[];
}

export type ContextSubstSubtable =
	| ContextSubstFormat1
	| ContextSubstFormat2
	| ContextSubstFormat3;

/** Format 1: Simple glyph contexts */
export interface ContextSubstFormat1 {
	format: 1;
	coverage: Coverage;
	ruleSets: (ContextRule[] | null)[];
}

export interface ContextRule {
	glyphCount: uint16;
	inputSequence: GlyphId[]; // Excludes first glyph (in coverage)
	lookupRecords: SequenceLookupRecord[];
}

/** Format 2: Class-based contexts */
export interface ContextSubstFormat2 {
	format: 2;
	coverage: Coverage;
	classDef: ClassDef;
	classRuleSets: (ClassRule[] | null)[];
}

export interface ClassRule {
	glyphCount: uint16;
	inputClasses: uint16[]; // Excludes first class
	lookupRecords: SequenceLookupRecord[];
}

/** Format 3: Coverage-based contexts */
export interface ContextSubstFormat3 {
	format: 3;
	coverages: Coverage[];
	lookupRecords: SequenceLookupRecord[];
}

/** Chaining context substitution lookup (Type 6) */
export interface ChainingContextSubstLookup extends GsubLookup {
	type: 6;
	subtables: ChainingContextSubstSubtable[];
}

export type ChainingContextSubstSubtable =
	| ChainingContextFormat1
	| ChainingContextFormat2
	| ChainingContextFormat3;

/** Format 1: Simple chaining context */
export interface ChainingContextFormat1 {
	format: 1;
	coverage: Coverage;
	chainRuleSets: (ChainRule[] | null)[];
}

export interface ChainRule {
	backtrackSequence: GlyphId[];
	inputSequence: GlyphId[]; // Excludes first glyph
	lookaheadSequence: GlyphId[];
	lookupRecords: SequenceLookupRecord[];
}

/** Format 2: Class-based chaining context */
export interface ChainingContextFormat2 {
	format: 2;
	coverage: Coverage;
	backtrackClassDef: ClassDef;
	inputClassDef: ClassDef;
	lookaheadClassDef: ClassDef;
	chainClassRuleSets: (ChainClassRule[] | null)[];
}

export interface ChainClassRule {
	backtrackClasses: uint16[];
	inputClasses: uint16[]; // Excludes first class
	lookaheadClasses: uint16[];
	lookupRecords: SequenceLookupRecord[];
}

/** Format 3: Coverage-based chaining context */
export interface ChainingContextFormat3 {
	format: 3;
	backtrackCoverages: Coverage[];
	inputCoverages: Coverage[];
	lookaheadCoverages: Coverage[];
	lookupRecords: SequenceLookupRecord[];
}

export function parseContextSubst(
	reader: Reader,
	subtableOffsets: number[],
): ContextSubstSubtable[] {
	const subtables: ContextSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		switch (format) {
			case 1:
				subtables.push(parseContextFormat1(r));
				break;
			case 2:
				subtables.push(parseContextFormat2(r));
				break;
			case 3:
				subtables.push(parseContextFormat3(r));
				break;
		}
	}

	return subtables;
}

function parseContextFormat1(reader: Reader): ContextSubstFormat1 {
	const coverageOffset = reader.offset16();
	const ruleSetCount = reader.uint16();
	const ruleSetOffsets = reader.uint16Array(ruleSetCount);

	const coverage = parseCoverageAt(reader, coverageOffset);
	const ruleSets: (ContextRule[] | null)[] = [];

	for (const ruleSetOffset of ruleSetOffsets) {
		if (ruleSetOffset === 0) {
			ruleSets.push(null);
			continue;
		}

		const rsReader = reader.sliceFrom(ruleSetOffset);
		const ruleCount = rsReader.uint16();
		const ruleOffsets = rsReader.uint16Array(ruleCount);

		const rules: ContextRule[] = [];
		for (const ruleOffset of ruleOffsets) {
			const ruleReader = rsReader.sliceFrom(ruleOffset);
			const glyphCount = ruleReader.uint16();
			const lookupCount = ruleReader.uint16();
			const inputSequence = Array.from(ruleReader.uint16Array(glyphCount - 1));
			const lookupRecords = parseLookupRecords(ruleReader, lookupCount);

			rules.push({ glyphCount, inputSequence, lookupRecords });
		}

		ruleSets.push(rules);
	}

	return { format: 1, coverage, ruleSets };
}

function parseContextFormat2(reader: Reader): ContextSubstFormat2 {
	const coverageOffset = reader.offset16();
	const classDefOffset = reader.offset16();
	const classRuleSetCount = reader.uint16();
	const classRuleSetOffsets = reader.uint16Array(classRuleSetCount);

	const coverage = parseCoverageAt(reader, coverageOffset);
	const classDef = parseClassDefAt(reader, classDefOffset);
	const classRuleSets: (ClassRule[] | null)[] = [];

	for (const crsOffset of classRuleSetOffsets) {
		if (crsOffset === 0) {
			classRuleSets.push(null);
			continue;
		}

		const crsReader = reader.sliceFrom(crsOffset);
		const ruleCount = crsReader.uint16();
		const ruleOffsets = crsReader.uint16Array(ruleCount);

		const rules: ClassRule[] = [];
		for (const ruleOffset of ruleOffsets) {
			const ruleReader = crsReader.sliceFrom(ruleOffset);
			const glyphCount = ruleReader.uint16();
			const lookupCount = ruleReader.uint16();
			const inputClasses = Array.from(ruleReader.uint16Array(glyphCount - 1));
			const lookupRecords = parseLookupRecords(ruleReader, lookupCount);

			rules.push({ glyphCount, inputClasses, lookupRecords });
		}

		classRuleSets.push(rules);
	}

	return { format: 2, coverage, classDef, classRuleSets };
}

function parseContextFormat3(reader: Reader): ContextSubstFormat3 {
	const glyphCount = reader.uint16();
	const lookupCount = reader.uint16();
	const coverageOffsets = reader.uint16Array(glyphCount);

	const coverages: Coverage[] = [];
	for (const offset of coverageOffsets) {
		coverages.push(parseCoverageAt(reader, offset));
	}

	const lookupRecords = parseLookupRecords(reader, lookupCount);

	return { format: 3, coverages, lookupRecords };
}

export function parseChainingContextSubst(
	reader: Reader,
	subtableOffsets: number[],
): ChainingContextSubstSubtable[] {
	const subtables: ChainingContextSubstSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		switch (format) {
			case 1:
				subtables.push(parseChainingFormat1(r));
				break;
			case 2:
				subtables.push(parseChainingFormat2(r));
				break;
			case 3:
				subtables.push(parseChainingFormat3(r));
				break;
		}
	}

	return subtables;
}

function parseChainingFormat1(reader: Reader): ChainingContextFormat1 {
	const coverageOffset = reader.offset16();
	const chainRuleSetCount = reader.uint16();
	const chainRuleSetOffsets = reader.uint16Array(chainRuleSetCount);

	const coverage = parseCoverageAt(reader, coverageOffset);
	const chainRuleSets: (ChainRule[] | null)[] = [];

	for (const crsOffset of chainRuleSetOffsets) {
		if (crsOffset === 0) {
			chainRuleSets.push(null);
			continue;
		}

		const crsReader = reader.sliceFrom(crsOffset);
		const ruleCount = crsReader.uint16();
		const ruleOffsets = crsReader.uint16Array(ruleCount);

		const rules: ChainRule[] = [];
		for (const ruleOffset of ruleOffsets) {
			const ruleReader = crsReader.sliceFrom(ruleOffset);

			const backtrackCount = ruleReader.uint16();
			const backtrackSequence = Array.from(
				ruleReader.uint16Array(backtrackCount),
			);

			const inputCount = ruleReader.uint16();
			const inputSequence = Array.from(ruleReader.uint16Array(inputCount - 1));

			const lookaheadCount = ruleReader.uint16();
			const lookaheadSequence = Array.from(
				ruleReader.uint16Array(lookaheadCount),
			);

			const lookupCount = ruleReader.uint16();
			const lookupRecords = parseLookupRecords(ruleReader, lookupCount);

			rules.push({
				backtrackSequence,
				inputSequence,
				lookaheadSequence,
				lookupRecords,
			});
		}

		chainRuleSets.push(rules);
	}

	return { format: 1, coverage, chainRuleSets };
}

function parseChainingFormat2(reader: Reader): ChainingContextFormat2 {
	const coverageOffset = reader.offset16();
	const backtrackClassDefOffset = reader.offset16();
	const inputClassDefOffset = reader.offset16();
	const lookaheadClassDefOffset = reader.offset16();
	const chainClassRuleSetCount = reader.uint16();
	const chainClassRuleSetOffsets = reader.uint16Array(chainClassRuleSetCount);

	const coverage = parseCoverageAt(reader, coverageOffset);
	const backtrackClassDef = parseClassDefAt(reader, backtrackClassDefOffset);
	const inputClassDef = parseClassDefAt(reader, inputClassDefOffset);
	const lookaheadClassDef = parseClassDefAt(reader, lookaheadClassDefOffset);

	const chainClassRuleSets: (ChainClassRule[] | null)[] = [];

	for (const ccrsOffset of chainClassRuleSetOffsets) {
		if (ccrsOffset === 0) {
			chainClassRuleSets.push(null);
			continue;
		}

		const ccrsReader = reader.sliceFrom(ccrsOffset);
		const ruleCount = ccrsReader.uint16();
		const ruleOffsets = ccrsReader.uint16Array(ruleCount);

		const rules: ChainClassRule[] = [];
		for (const ruleOffset of ruleOffsets) {
			const ruleReader = ccrsReader.sliceFrom(ruleOffset);

			const backtrackCount = ruleReader.uint16();
			const backtrackClasses = Array.from(
				ruleReader.uint16Array(backtrackCount),
			);

			const inputCount = ruleReader.uint16();
			const inputClasses = Array.from(ruleReader.uint16Array(inputCount - 1));

			const lookaheadCount = ruleReader.uint16();
			const lookaheadClasses = Array.from(
				ruleReader.uint16Array(lookaheadCount),
			);

			const lookupCount = ruleReader.uint16();
			const lookupRecords = parseLookupRecords(ruleReader, lookupCount);

			rules.push({
				backtrackClasses,
				inputClasses,
				lookaheadClasses,
				lookupRecords,
			});
		}

		chainClassRuleSets.push(rules);
	}

	return {
		format: 2,
		coverage,
		backtrackClassDef,
		inputClassDef,
		lookaheadClassDef,
		chainClassRuleSets,
	};
}

function parseChainingFormat3(reader: Reader): ChainingContextFormat3 {
	const backtrackCount = reader.uint16();
	const backtrackCoverageOffsets = reader.uint16Array(backtrackCount);

	const inputCount = reader.uint16();
	const inputCoverageOffsets = reader.uint16Array(inputCount);

	const lookaheadCount = reader.uint16();
	const lookaheadCoverageOffsets = reader.uint16Array(lookaheadCount);

	const lookupCount = reader.uint16();
	const lookupRecords = parseLookupRecords(reader, lookupCount);

	const backtrackCoverages: Coverage[] = [];
	for (const offset of backtrackCoverageOffsets) {
		backtrackCoverages.push(parseCoverageAt(reader, offset));
	}

	const inputCoverages: Coverage[] = [];
	for (const offset of inputCoverageOffsets) {
		inputCoverages.push(parseCoverageAt(reader, offset));
	}

	const lookaheadCoverages: Coverage[] = [];
	for (const offset of lookaheadCoverageOffsets) {
		lookaheadCoverages.push(parseCoverageAt(reader, offset));
	}

	return {
		format: 3,
		backtrackCoverages,
		inputCoverages,
		lookaheadCoverages,
		lookupRecords,
	};
}

function parseLookupRecords(
	reader: Reader,
	count: number,
): SequenceLookupRecord[] {
	const records: SequenceLookupRecord[] = [];
	for (let i = 0; i < count; i++) {
		records.push({
			sequenceIndex: reader.uint16(),
			lookupListIndex: reader.uint16(),
		});
	}
	return records;
}
