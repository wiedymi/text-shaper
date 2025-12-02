import type { GlyphId, uint16 } from "../../types.ts";
import type { Reader } from "../binary/reader.ts";
import {
	type Coverage,
	parseCoverageAt,
} from "../../layout/structures/coverage.ts";
import {
	type ClassDef,
	parseClassDefAt,
} from "../../layout/structures/class-def.ts";
import type { GposLookup } from "./gpos.ts";

/** Position lookup record - applies a lookup at a position */
export interface PosLookupRecord {
	sequenceIndex: uint16; // Position in input sequence
	lookupListIndex: uint16; // Lookup to apply
}

/** Context positioning lookup (Type 7) */
export interface ContextPosLookup extends GposLookup {
	type: 7;
	subtables: ContextPosSubtable[];
}

export type ContextPosSubtable =
	| ContextPosFormat1
	| ContextPosFormat2
	| ContextPosFormat3;

/** Format 1: Simple glyph contexts */
export interface ContextPosFormat1 {
	format: 1;
	coverage: Coverage;
	ruleSets: (PosContextRule[] | null)[];
}

export interface PosContextRule {
	glyphCount: uint16;
	inputSequence: GlyphId[]; // Excludes first glyph (in coverage)
	lookupRecords: PosLookupRecord[];
}

/** Format 2: Class-based contexts */
export interface ContextPosFormat2 {
	format: 2;
	coverage: Coverage;
	classDef: ClassDef;
	classRuleSets: (PosClassRule[] | null)[];
}

export interface PosClassRule {
	glyphCount: uint16;
	inputClasses: uint16[]; // Excludes first class
	lookupRecords: PosLookupRecord[];
}

/** Format 3: Coverage-based contexts */
export interface ContextPosFormat3 {
	format: 3;
	coverages: Coverage[];
	lookupRecords: PosLookupRecord[];
}

/** Chaining context positioning lookup (Type 8) */
export interface ChainingContextPosLookup extends GposLookup {
	type: 8;
	subtables: ChainingContextPosSubtable[];
}

export type ChainingContextPosSubtable =
	| ChainingContextPosFormat1
	| ChainingContextPosFormat2
	| ChainingContextPosFormat3;

/** Format 1: Simple chaining context */
export interface ChainingContextPosFormat1 {
	format: 1;
	coverage: Coverage;
	chainRuleSets: (PosChainRule[] | null)[];
}

export interface PosChainRule {
	backtrackSequence: GlyphId[];
	inputSequence: GlyphId[]; // Excludes first glyph
	lookaheadSequence: GlyphId[];
	lookupRecords: PosLookupRecord[];
}

/** Format 2: Class-based chaining context */
export interface ChainingContextPosFormat2 {
	format: 2;
	coverage: Coverage;
	backtrackClassDef: ClassDef;
	inputClassDef: ClassDef;
	lookaheadClassDef: ClassDef;
	chainClassRuleSets: (PosChainClassRule[] | null)[];
}

export interface PosChainClassRule {
	backtrackClasses: uint16[];
	inputClasses: uint16[]; // Excludes first class
	lookaheadClasses: uint16[];
	lookupRecords: PosLookupRecord[];
}

/** Format 3: Coverage-based chaining context */
export interface ChainingContextPosFormat3 {
	format: 3;
	backtrackCoverages: Coverage[];
	inputCoverages: Coverage[];
	lookaheadCoverages: Coverage[];
	lookupRecords: PosLookupRecord[];
}

export function parseContextPos(
	reader: Reader,
	subtableOffsets: number[],
): ContextPosSubtable[] {
	const subtables: ContextPosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		switch (format) {
			case 1:
				subtables.push(parseContextPosFormat1(r));
				break;
			case 2:
				subtables.push(parseContextPosFormat2(r));
				break;
			case 3:
				subtables.push(parseContextPosFormat3(r));
				break;
		}
	}

	return subtables;
}

function parseContextPosFormat1(reader: Reader): ContextPosFormat1 {
	const coverageOffset = reader.offset16();
	const ruleSetCount = reader.uint16();
	const ruleSetOffsets = reader.uint16Array(ruleSetCount);

	const coverage = parseCoverageAt(reader, coverageOffset);
	const ruleSets: (PosContextRule[] | null)[] = [];

	for (const ruleSetOffset of ruleSetOffsets) {
		if (ruleSetOffset === 0) {
			ruleSets.push(null);
			continue;
		}

		const rsReader = reader.sliceFrom(ruleSetOffset);
		const ruleCount = rsReader.uint16();
		const ruleOffsets = rsReader.uint16Array(ruleCount);

		const rules: PosContextRule[] = [];
		for (const ruleOffset of ruleOffsets) {
			const ruleReader = rsReader.sliceFrom(ruleOffset);
			const glyphCount = ruleReader.uint16();
			const lookupCount = ruleReader.uint16();
			const inputSequence = Array.from(ruleReader.uint16Array(glyphCount - 1));
			const lookupRecords = parsePosLookupRecords(ruleReader, lookupCount);

			rules.push({ glyphCount, inputSequence, lookupRecords });
		}

		ruleSets.push(rules);
	}

	return { format: 1, coverage, ruleSets };
}

function parseContextPosFormat2(reader: Reader): ContextPosFormat2 {
	const coverageOffset = reader.offset16();
	const classDefOffset = reader.offset16();
	const classRuleSetCount = reader.uint16();
	const classRuleSetOffsets = reader.uint16Array(classRuleSetCount);

	const coverage = parseCoverageAt(reader, coverageOffset);
	const classDef = parseClassDefAt(reader, classDefOffset);
	const classRuleSets: (PosClassRule[] | null)[] = [];

	for (const crsOffset of classRuleSetOffsets) {
		if (crsOffset === 0) {
			classRuleSets.push(null);
			continue;
		}

		const crsReader = reader.sliceFrom(crsOffset);
		const ruleCount = crsReader.uint16();
		const ruleOffsets = crsReader.uint16Array(ruleCount);

		const rules: PosClassRule[] = [];
		for (const ruleOffset of ruleOffsets) {
			const ruleReader = crsReader.sliceFrom(ruleOffset);
			const glyphCount = ruleReader.uint16();
			const lookupCount = ruleReader.uint16();
			const inputClasses = Array.from(ruleReader.uint16Array(glyphCount - 1));
			const lookupRecords = parsePosLookupRecords(ruleReader, lookupCount);

			rules.push({ glyphCount, inputClasses, lookupRecords });
		}

		classRuleSets.push(rules);
	}

	return { format: 2, coverage, classDef, classRuleSets };
}

function parseContextPosFormat3(reader: Reader): ContextPosFormat3 {
	const glyphCount = reader.uint16();
	const lookupCount = reader.uint16();
	const coverageOffsets = reader.uint16Array(glyphCount);

	const coverages: Coverage[] = [];
	for (const offset of coverageOffsets) {
		coverages.push(parseCoverageAt(reader, offset));
	}

	const lookupRecords = parsePosLookupRecords(reader, lookupCount);

	return { format: 3, coverages, lookupRecords };
}

export function parseChainingContextPos(
	reader: Reader,
	subtableOffsets: number[],
): ChainingContextPosSubtable[] {
	const subtables: ChainingContextPosSubtable[] = [];

	for (const offset of subtableOffsets) {
		const r = reader.sliceFrom(offset);
		const format = r.uint16();

		switch (format) {
			case 1:
				subtables.push(parseChainingPosFormat1(r));
				break;
			case 2:
				subtables.push(parseChainingPosFormat2(r));
				break;
			case 3:
				subtables.push(parseChainingPosFormat3(r));
				break;
		}
	}

	return subtables;
}

function parseChainingPosFormat1(reader: Reader): ChainingContextPosFormat1 {
	const coverageOffset = reader.offset16();
	const chainRuleSetCount = reader.uint16();
	const chainRuleSetOffsets = reader.uint16Array(chainRuleSetCount);

	const coverage = parseCoverageAt(reader, coverageOffset);
	const chainRuleSets: (PosChainRule[] | null)[] = [];

	for (const crsOffset of chainRuleSetOffsets) {
		if (crsOffset === 0) {
			chainRuleSets.push(null);
			continue;
		}

		const crsReader = reader.sliceFrom(crsOffset);
		const ruleCount = crsReader.uint16();
		const ruleOffsets = crsReader.uint16Array(ruleCount);

		const rules: PosChainRule[] = [];
		for (const ruleOffset of ruleOffsets) {
			const ruleReader = crsReader.sliceFrom(ruleOffset);

			const backtrackCount = ruleReader.uint16();
			const backtrackSequence = Array.from(ruleReader.uint16Array(backtrackCount));

			const inputCount = ruleReader.uint16();
			const inputSequence = Array.from(ruleReader.uint16Array(inputCount - 1));

			const lookaheadCount = ruleReader.uint16();
			const lookaheadSequence = Array.from(ruleReader.uint16Array(lookaheadCount));

			const lookupCount = ruleReader.uint16();
			const lookupRecords = parsePosLookupRecords(ruleReader, lookupCount);

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

function parseChainingPosFormat2(reader: Reader): ChainingContextPosFormat2 {
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

	const chainClassRuleSets: (PosChainClassRule[] | null)[] = [];

	for (const ccrsOffset of chainClassRuleSetOffsets) {
		if (ccrsOffset === 0) {
			chainClassRuleSets.push(null);
			continue;
		}

		const ccrsReader = reader.sliceFrom(ccrsOffset);
		const ruleCount = ccrsReader.uint16();
		const ruleOffsets = ccrsReader.uint16Array(ruleCount);

		const rules: PosChainClassRule[] = [];
		for (const ruleOffset of ruleOffsets) {
			const ruleReader = ccrsReader.sliceFrom(ruleOffset);

			const backtrackCount = ruleReader.uint16();
			const backtrackClasses = Array.from(ruleReader.uint16Array(backtrackCount));

			const inputCount = ruleReader.uint16();
			const inputClasses = Array.from(ruleReader.uint16Array(inputCount - 1));

			const lookaheadCount = ruleReader.uint16();
			const lookaheadClasses = Array.from(ruleReader.uint16Array(lookaheadCount));

			const lookupCount = ruleReader.uint16();
			const lookupRecords = parsePosLookupRecords(ruleReader, lookupCount);

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

function parseChainingPosFormat3(reader: Reader): ChainingContextPosFormat3 {
	const backtrackCount = reader.uint16();
	const backtrackCoverageOffsets = reader.uint16Array(backtrackCount);

	const inputCount = reader.uint16();
	const inputCoverageOffsets = reader.uint16Array(inputCount);

	const lookaheadCount = reader.uint16();
	const lookaheadCoverageOffsets = reader.uint16Array(lookaheadCount);

	const lookupCount = reader.uint16();
	const lookupRecords = parsePosLookupRecords(reader, lookupCount);

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

function parsePosLookupRecords(
	reader: Reader,
	count: number,
): PosLookupRecord[] {
	const records: PosLookupRecord[] = [];
	for (let i = 0; i < count; i++) {
		records.push({
			sequenceIndex: reader.uint16(),
			lookupListIndex: reader.uint16(),
		});
	}
	return records;
}
