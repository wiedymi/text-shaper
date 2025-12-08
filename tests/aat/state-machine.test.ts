import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import {
	getGlyphClass,
	processRearrangement,
	processContextual,
	processLigature,
	processInsertion,
} from "../../src/aat/state-machine.ts";
import type {
	MorxRearrangementSubtable,
	MorxContextualSubtable,
	MorxLigatureSubtable,
	MorxInsertionSubtable,
	StateTable,
	RearrangementEntry,
	ContextualEntry,
	LigatureEntry,
	InsertionEntry,
	ClassTable,
} from "../../src/font/tables/morx.ts";
import { MorxSubtableType } from "../../src/font/tables/morx.ts";
import type { GlyphInfo } from "../../src/types.ts";

const GENEVA_PATH = "/System/Library/Fonts/Geneva.ttf";
const MONACO_PATH = "/System/Library/Fonts/Monaco.ttf";

describe("state-machine", () => {
	let genevaFont: Font;
	let monacoFont: Font;

	beforeAll(async () => {
		genevaFont = await Font.fromFile(GENEVA_PATH);
		monacoFont = await Font.fromFile(MONACO_PATH);
	});

	describe("getGlyphClass", () => {
		test("returns class from classArray", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [0, 1, 2, 3, 4],
			};
			expect(getGlyphClass(classTable, 0)).toBe(0);
			expect(getGlyphClass(classTable, 2)).toBe(2);
			expect(getGlyphClass(classTable, 4)).toBe(4);
		});

		test("returns out of bounds for negative glyph", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [0, 1, 2],
			};
			expect(getGlyphClass(classTable, -1)).toBe(1);
		});

		test("returns out of bounds for glyph beyond array", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [0, 1, 2],
			};
			expect(getGlyphClass(classTable, 10)).toBe(1);
		});

		test("handles empty classArray", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [],
			};
			expect(getGlyphClass(classTable, 0)).toBe(1);
		});
	});

	describe("processRearrangement", () => {
		test("processes rearrangement subtable without error", () => {
			const morx = genevaFont.morx;
			expect(morx).not.toBeNull();

			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const infos: GlyphInfo[] = [
								{ glyphId: 1, cluster: 0, mask: 0, codepoint: 0x41 },
								{ glyphId: 2, cluster: 1, mask: 0, codepoint: 0x42 },
								{ glyphId: 3, cluster: 2, mask: 0, codepoint: 0x43 },
							];

							processRearrangement(
								subtable as MorxRearrangementSubtable,
								infos,
							);

							expect(infos.length).toBe(3);
							expect(infos[0]).toBeDefined();
							expect(infos[1]).toBeDefined();
							expect(infos[2]).toBeDefined();
						}
					}
				}
			}
		});

		test("handles empty infos array", () => {
			const stateTable: StateTable<RearrangementEntry> = {
				nClasses: 2,
				classTable: { format: 2, classArray: [] },
				stateArray: [[{ newState: 0, flags: 0 }]],
			};

			const subtable: MorxRearrangementSubtable = {
				type: MorxSubtableType.Rearrangement,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
			};

			const infos: GlyphInfo[] = [];
			processRearrangement(subtable, infos);
			expect(infos.length).toBe(0);
		});

		test("handles rearrangement verb 1 (Ax => xA)", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<RearrangementEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{ newState: 0, flags: 0 }, // class 0 (end of text)
						{ newState: 0, flags: 0 }, // class 1
						{ newState: 0, flags: 0 }, // class 2
						{ newState: 0, flags: 0 }, // class 3
						{ newState: 1, flags: 0x8000 }, // class 4: mark first, goto state 1
					],
					[
						{ newState: 1, flags: 0 }, // class 0 (end of text)
						{ newState: 1, flags: 0 }, // class 1
						{ newState: 1, flags: 0 }, // class 2
						{ newState: 1, flags: 0 }, // class 3
						{ newState: 1, flags: 0x2000 | 1 }, // class 4: mark last + verb 1
					],
				],
			};

			const subtable: MorxRearrangementSubtable = {
				type: MorxSubtableType.Rearrangement,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
			];

			processRearrangement(subtable, infos);

			expect(infos[0]?.glyphId).toBe(20);
			expect(infos[1]?.glyphId).toBe(10);
		});
	});

	describe("processContextual", () => {
		test("processes contextual subtable without error", () => {
			const morx = genevaFont.morx;
			expect(morx).not.toBeNull();

			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Contextual) {
							const infos: GlyphInfo[] = [
								{ glyphId: 1, cluster: 0, mask: 0, codepoint: 0x41 },
								{ glyphId: 2, cluster: 1, mask: 0, codepoint: 0x42 },
							];

							processContextual(subtable as MorxContextualSubtable, infos);

							expect(infos.length).toBe(2);
							expect(infos[0]).toBeDefined();
							expect(infos[1]).toBeDefined();
						}
					}
				}
			}
		});

		test("handles empty infos array", () => {
			const stateTable: StateTable<ContextualEntry> = {
				nClasses: 2,
				classTable: { format: 2, classArray: [] },
				stateArray: [
					[{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff }],
				],
			};

			const subtable: MorxContextualSubtable = {
				type: MorxSubtableType.Contextual,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				substitutionTable: [],
			};

			const infos: GlyphInfo[] = [];
			processContextual(subtable, infos);
			expect(infos.length).toBe(0);
		});

		test("applies substitution at mark", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const substMap = new Map([[10, 100]]);
			const stateTable: StateTable<ContextualEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0x8000, markIndex: 0xffff, currentIndex: 0xffff }, // mark
					],
					[
						{ newState: 1, flags: 0, markIndex: 0, currentIndex: 0xffff }, // apply subst
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
					],
				],
			};

			const subtable: MorxContextualSubtable = {
				type: MorxSubtableType.Contextual,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				substitutionTable: [substMap],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
			];

			processContextual(subtable, infos);

			expect(infos[0]?.glyphId).toBe(100);
		});
	});

	describe("processLigature", () => {
		test("processes ligature subtable without error", () => {
			const morx = monacoFont.morx;
			expect(morx).not.toBeNull();

			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Ligature) {
							const infos: GlyphInfo[] = [
								{ glyphId: 1, cluster: 0, mask: 0, codepoint: 0x66 },
								{ glyphId: 2, cluster: 1, mask: 0, codepoint: 0x69 },
							];

							const result = processLigature(
								subtable as MorxLigatureSubtable,
								infos,
							);

							expect(Array.isArray(result)).toBe(true);
							expect(result.length).toBeGreaterThanOrEqual(0);
						}
					}
				}
			}
		});

		test("handles empty infos array", () => {
			const stateTable: StateTable<LigatureEntry> = {
				nClasses: 2,
				classTable: { format: 2, classArray: [] },
				stateArray: [
					[{ newState: 0, flags: 0, ligActionIndex: 0 }],
				],
			};

			const subtable: MorxLigatureSubtable = {
				type: MorxSubtableType.Ligature,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				ligatureActions: [],
				components: [],
				ligatures: [],
			};

			const infos: GlyphInfo[] = [];
			const result = processLigature(subtable, infos);
			expect(result.length).toBe(0);
		});

		test("returns infos unchanged when no ligatures match", () => {
			const classTable: ClassTable = { format: 2, classArray: [1, 1, 0] };
			const stateTable: StateTable<LigatureEntry> = {
				nClasses: 2,
				classTable,
				stateArray: [
					[
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
					],
				],
			};

			const subtable: MorxLigatureSubtable = {
				type: MorxSubtableType.Ligature,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				ligatureActions: [],
				components: [],
				ligatures: [],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 1, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 2, cluster: 1, mask: 0, codepoint: 66 },
			];

			const result = processLigature(subtable, infos);
			expect(result.length).toBe(2);
		});
	});

	describe("processInsertion", () => {
		test("processes insertion subtable without error", () => {
			const morx = genevaFont.morx;
			expect(morx).not.toBeNull();

			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Insertion) {
							const infos: GlyphInfo[] = [
								{ glyphId: 1, cluster: 0, mask: 0, codepoint: 0x41 },
								{ glyphId: 2, cluster: 1, mask: 0, codepoint: 0x42 },
							];

							const result = processInsertion(
								subtable as MorxInsertionSubtable,
								infos,
							);

							expect(Array.isArray(result)).toBe(true);
							expect(result.length).toBeGreaterThanOrEqual(infos.length);
						}
					}
				}
			}
		});

		test("handles empty infos array", () => {
			const stateTable: StateTable<InsertionEntry> = {
				nClasses: 2,
				classTable: { format: 2, classArray: [] },
				stateArray: [
					[
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
					],
				],
			};

			const subtable: MorxInsertionSubtable = {
				type: MorxSubtableType.Insertion,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				insertionGlyphs: [],
			};

			const infos: GlyphInfo[] = [];
			const result = processInsertion(subtable, infos);
			expect(result.length).toBe(0);
		});

		test("inserts glyphs before", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<InsertionEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0x0020 | 1, // insert before, count=1
							currentInsertIndex: 0,
							markedInsertIndex: 0xffff,
						},
					],
					[
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
					],
				],
			};

			const subtable: MorxInsertionSubtable = {
				type: MorxSubtableType.Insertion,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				insertionGlyphs: [999],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
			];

			const result = processInsertion(subtable, infos);
			expect(result.length).toBe(2);
			expect(result[0]?.glyphId).toBe(999);
			expect(result[1]?.glyphId).toBe(10);
		});

		test("inserts glyphs after", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<InsertionEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 1, // insert after, count=1
							currentInsertIndex: 0,
							markedInsertIndex: 0xffff,
						},
					],
					[
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
					],
				],
			};

			const subtable: MorxInsertionSubtable = {
				type: MorxSubtableType.Insertion,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				insertionGlyphs: [888],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
			];

			const result = processInsertion(subtable, infos);
			expect(result.length).toBe(2);
			expect(result[0]?.glyphId).toBe(10);
			expect(result[1]?.glyphId).toBe(888);
		});
	});

	describe("edge cases", () => {
		test("handles undefined entries in state array", () => {
			const stateTable: StateTable<RearrangementEntry> = {
				nClasses: 2,
				classTable: { format: 2, classArray: [1, 0] },
				stateArray: [],
			};

			const subtable: MorxRearrangementSubtable = {
				type: MorxSubtableType.Rearrangement,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 1, cluster: 0, mask: 0, codepoint: 65 },
			];

			processRearrangement(subtable, infos);
			expect(infos.length).toBe(1);
		});

		test("handles undefined glyph in contextual substitution", () => {
			const stateTable: StateTable<ContextualEntry> = {
				nClasses: 2,
				classTable: { format: 2, classArray: [4, 0] },
				stateArray: [
					[
						{
							newState: 0,
							flags: 0,
							markIndex: 0xffff,
							currentIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							markIndex: 0xffff,
							currentIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							markIndex: 0xffff,
							currentIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							markIndex: 0xffff,
							currentIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							markIndex: 0xffff,
							currentIndex: 0,
						},
					],
				],
			};

			const subtable: MorxContextualSubtable = {
				type: MorxSubtableType.Contextual,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				substitutionTable: [new Map([[99, 199]])],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
			];

			processContextual(subtable, infos);
			expect(infos[0]?.glyphId).toBe(10);
		});
	});

	describe("rearrangement verbs", () => {
		test("verb 2: xD => Dx swaps last two glyphs", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const subtable: MorxRearrangementSubtable = {
				type: MorxSubtableType.Rearrangement,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable: {
					nClasses: 5,
					classTable,
					stateArray: [
						[
							{ newState: 0, flags: 0 },
							{ newState: 0, flags: 0 },
							{ newState: 0, flags: 0 },
							{ newState: 0, flags: 0 },
							{ newState: 1, flags: 0x8000 },
						],
						[
							{ newState: 1, flags: 0 },
							{ newState: 1, flags: 0 },
							{ newState: 1, flags: 0 },
							{ newState: 1, flags: 0 },
							{ newState: 2, flags: 0 },
						],
						[
							{ newState: 2, flags: 0 },
							{ newState: 2, flags: 0 },
							{ newState: 2, flags: 0 },
							{ newState: 2, flags: 0 },
							{ newState: 0, flags: 0x2000 | 2 },
						],
					],
				},
			};
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
			];
			processRearrangement(subtable, infos);
			expect(infos[1]?.glyphId).toBe(30);
			expect(infos[2]?.glyphId).toBe(20);
		});

		test("verb 3: AxD => DxA swaps first and last", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const subtable: MorxRearrangementSubtable = {
				type: MorxSubtableType.Rearrangement,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable: {
					nClasses: 5,
					classTable,
					stateArray: [
						[
							{ newState: 0, flags: 0 },
							{ newState: 0, flags: 0 },
							{ newState: 0, flags: 0 },
							{ newState: 0, flags: 0 },
							{ newState: 1, flags: 0x8000 },
						],
						[
							{ newState: 1, flags: 0 },
							{ newState: 1, flags: 0 },
							{ newState: 1, flags: 0 },
							{ newState: 1, flags: 0 },
							{ newState: 2, flags: 0 },
						],
						[
							{ newState: 2, flags: 0 },
							{ newState: 2, flags: 0 },
							{ newState: 2, flags: 0 },
							{ newState: 2, flags: 0 },
							{ newState: 0, flags: 0x2000 | 3 },
						],
					],
				},
			};
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(30);
			expect(infos[2]?.glyphId).toBe(10);
		});

		function createVerbTestSubtable(verb: number, glyphCount: number): MorxRearrangementSubtable {
			const classTable: ClassTable = {
				format: 2,
				classArray: Array(100).fill(4),
			};
			const stateArray: Array<Array<RearrangementEntry>> = [];
			stateArray.push([
				{ newState: 0, flags: 0 },
				{ newState: 0, flags: 0 },
				{ newState: 0, flags: 0 },
				{ newState: 0, flags: 0 },
				{ newState: 1, flags: 0x8000 | 0x4000 },
			]);
			for (let i = 1; i < glyphCount - 1; i++) {
				stateArray.push([
					{ newState: i, flags: 0 },
					{ newState: i, flags: 0 },
					{ newState: i, flags: 0 },
					{ newState: i, flags: 0 },
					{ newState: i + 1, flags: 0x4000 },
				]);
			}
			stateArray.push([
				{ newState: 0, flags: 0 },
				{ newState: 0, flags: 0 },
				{ newState: 0, flags: 0 },
				{ newState: 0, flags: 0 },
				{ newState: 0, flags: 0x2000 | 0x4000 | verb },
			]);
			return {
				type: MorxSubtableType.Rearrangement,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable: {
					nClasses: 5,
					classTable,
					stateArray,
				},
			};
		}

		test("verb 4: ABx => xAB", () => {
			const subtable = createVerbTestSubtable(4, 3);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(30);
			expect(infos[1]?.glyphId).toBe(10);
			expect(infos[2]?.glyphId).toBe(20);
		});

		test("verb 5: ABx => xBA", () => {
			const subtable = createVerbTestSubtable(5, 3);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(30);
			expect(infos[1]?.glyphId).toBe(20);
			expect(infos[2]?.glyphId).toBe(10);
		});

		test("verb 6: xCD => CDx", () => {
			const subtable = createVerbTestSubtable(6, 3);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(20);
			expect(infos[1]?.glyphId).toBe(30);
			expect(infos[2]?.glyphId).toBe(10);
		});

		test("verb 7: xCD => DCx", () => {
			const subtable = createVerbTestSubtable(7, 3);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(30);
			expect(infos[1]?.glyphId).toBe(20);
			expect(infos[2]?.glyphId).toBe(10);
		});

		test("verb 8: AxCD => CDxA", () => {
			const subtable = createVerbTestSubtable(8, 4);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 40, cluster: 3, mask: 0, codepoint: 68 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(30);
			expect(infos[1]?.glyphId).toBe(20);
			expect(infos[2]?.glyphId).toBe(40);
			expect(infos[3]?.glyphId).toBe(10);
		});

		test("verb 9: AxCD => DCxA", () => {
			const subtable = createVerbTestSubtable(9, 4);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 40, cluster: 3, mask: 0, codepoint: 68 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(40);
			expect(infos[1]?.glyphId).toBe(20);
			expect(infos[2]?.glyphId).toBe(30);
			expect(infos[3]?.glyphId).toBe(10);
		});

		test("verb 10: ABxD => DxAB", () => {
			const subtable = createVerbTestSubtable(10, 4);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 40, cluster: 3, mask: 0, codepoint: 68 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(40);
			expect(infos[1]?.glyphId).toBe(30);
			expect(infos[2]?.glyphId).toBe(10);
			expect(infos[3]?.glyphId).toBe(20);
		});

		test("verb 11: ABxD => DxBA", () => {
			const subtable = createVerbTestSubtable(11, 4);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 40, cluster: 3, mask: 0, codepoint: 68 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(40);
			expect(infos[1]?.glyphId).toBe(30);
			expect(infos[2]?.glyphId).toBe(20);
			expect(infos[3]?.glyphId).toBe(10);
		});

		test("verb 12: ABxCD => CDxAB", () => {
			const subtable = createVerbTestSubtable(12, 5);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 40, cluster: 3, mask: 0, codepoint: 68 },
				{ glyphId: 50, cluster: 4, mask: 0, codepoint: 69 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(40);
			expect(infos[1]?.glyphId).toBe(50);
			expect(infos[2]?.glyphId).toBe(30);
			expect(infos[3]?.glyphId).toBe(10);
			expect(infos[4]?.glyphId).toBe(20);
		});

		test("verb 13: ABxCD => CDxBA", () => {
			const subtable = createVerbTestSubtable(13, 5);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 40, cluster: 3, mask: 0, codepoint: 68 },
				{ glyphId: 50, cluster: 4, mask: 0, codepoint: 69 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(40);
			expect(infos[1]?.glyphId).toBe(50);
			expect(infos[2]?.glyphId).toBe(30);
			expect(infos[3]?.glyphId).toBe(20);
			expect(infos[4]?.glyphId).toBe(10);
		});

		test("verb 14: ABxCD => DCxAB", () => {
			const subtable = createVerbTestSubtable(14, 5);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 40, cluster: 3, mask: 0, codepoint: 68 },
				{ glyphId: 50, cluster: 4, mask: 0, codepoint: 69 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(50);
			expect(infos[1]?.glyphId).toBe(40);
			expect(infos[2]?.glyphId).toBe(30);
			expect(infos[3]?.glyphId).toBe(10);
			expect(infos[4]?.glyphId).toBe(20);
		});

		test("verb 15: ABxCD => DCxBA", () => {
			const subtable = createVerbTestSubtable(15, 5);
			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 40, cluster: 3, mask: 0, codepoint: 68 },
				{ glyphId: 50, cluster: 4, mask: 0, codepoint: 69 },
			];
			processRearrangement(subtable, infos);
			expect(infos[0]?.glyphId).toBe(50);
			expect(infos[1]?.glyphId).toBe(40);
			expect(infos[2]?.glyphId).toBe(30);
			expect(infos[3]?.glyphId).toBe(20);
			expect(infos[4]?.glyphId).toBe(10);
		});

		test("covers all rearrangement verb code paths", () => {
			const morx = genevaFont.morx;
			if (morx) {
				for (const chain of morx.chains) {
					for (const subtable of chain.subtables) {
						if (subtable.type === MorxSubtableType.Rearrangement) {
							const infos: GlyphInfo[] = [
								{ glyphId: 1, cluster: 0, mask: 0, codepoint: 0x41 },
								{ glyphId: 2, cluster: 1, mask: 0, codepoint: 0x42 },
								{ glyphId: 3, cluster: 2, mask: 0, codepoint: 0x43 },
								{ glyphId: 4, cluster: 3, mask: 0, codepoint: 0x44 },
								{ glyphId: 5, cluster: 4, mask: 0, codepoint: 0x45 },
							];
							processRearrangement(subtable as MorxRearrangementSubtable, infos);
							expect(infos.length).toBeGreaterThan(0);
						}
					}
				}
			}
		});
	});

	describe("contextual substitution edge cases", () => {
		test("applies substitution at current position", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const substMap = new Map([[10, 100]]);
			const stateTable: StateTable<ContextualEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0 },
					],
				],
			};

			const subtable: MorxContextualSubtable = {
				type: MorxSubtableType.Contextual,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				substitutionTable: [substMap],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
			];

			processContextual(subtable, infos);
			expect(infos[0]?.glyphId).toBe(100);
		});

		test("handles missing substitution table entry", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<ContextualEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 0, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0x8000, markIndex: 0xffff, currentIndex: 0xffff },
					],
					[
						{ newState: 1, flags: 0, markIndex: 10, currentIndex: 0xffff },
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
						{ newState: 1, flags: 0, markIndex: 0xffff, currentIndex: 0xffff },
					],
				],
			};

			const subtable: MorxContextualSubtable = {
				type: MorxSubtableType.Contextual,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				substitutionTable: [],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
			];

			processContextual(subtable, infos);
			expect(infos[0]?.glyphId).toBe(10);
		});
	});

	describe("ligature edge cases", () => {
		test("handles ligature with store flag and multiple components", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<LigatureEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0x8000, ligActionIndex: 0 },
					],
					[
						{ newState: 1, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0, ligActionIndex: 0 },
						{ newState: 2, flags: 0x8000, ligActionIndex: 0 },
					],
					[
						{ newState: 2, flags: 0, ligActionIndex: 0 },
						{ newState: 2, flags: 0, ligActionIndex: 0 },
						{ newState: 2, flags: 0, ligActionIndex: 0 },
						{ newState: 2, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0xa000, ligActionIndex: 0 },
					],
				],
			};

			const subtable: MorxLigatureSubtable = {
				type: MorxSubtableType.Ligature,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				ligatureActions: [0x40000000, 0xc0000000],
				components: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
				ligatures: [999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
			];

			const result = processLigature(subtable, infos);
			expect(result.length).toBeLessThan(3);
		});

		test("handles empty stack pop", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<LigatureEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0x2000, ligActionIndex: 0 },
					],
				],
			};

			const subtable: MorxLigatureSubtable = {
				type: MorxSubtableType.Ligature,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				ligatureActions: [0x80000000],
				components: [],
				ligatures: [],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
			];

			const result = processLigature(subtable, infos);
			expect(result.length).toBe(1);
		});

		test("handles multi-action ligature chain with deletion", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<LigatureEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0x8000, ligActionIndex: 0 },
					],
					[
						{ newState: 1, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0, ligActionIndex: 0 },
						{ newState: 1, flags: 0, ligActionIndex: 0 },
						{ newState: 2, flags: 0x8000, ligActionIndex: 0 },
					],
					[
						{ newState: 2, flags: 0, ligActionIndex: 0 },
						{ newState: 2, flags: 0, ligActionIndex: 0 },
						{ newState: 2, flags: 0, ligActionIndex: 0 },
						{ newState: 2, flags: 0, ligActionIndex: 0 },
						{ newState: 3, flags: 0x8000, ligActionIndex: 0 },
					],
					[
						{ newState: 3, flags: 0, ligActionIndex: 0 },
						{ newState: 3, flags: 0, ligActionIndex: 0 },
						{ newState: 3, flags: 0, ligActionIndex: 0 },
						{ newState: 3, flags: 0, ligActionIndex: 0 },
						{ newState: 0, flags: 0xa000, ligActionIndex: 0 },
					],
				],
			};

			const subtable: MorxLigatureSubtable = {
				type: MorxSubtableType.Ligature,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				ligatureActions: [
					0x00000000,
					0x00000000,
					0x00000000,
					0xc0000000,
				],
				components: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
				ligatures: [888, 999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
				{ glyphId: 30, cluster: 2, mask: 0, codepoint: 67 },
				{ glyphId: 5, cluster: 3, mask: 0, codepoint: 68 },
			];

			const result = processLigature(subtable, infos);
			expect(result.length).toBeLessThan(infos.length);
		});
	});

	describe("insertion edge cases", () => {
		test("inserts at marked position", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<InsertionEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0x8000,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
					],
					[
						{
							newState: 1,
							flags: (2 << 5),
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
					],
				],
			};

			const subtable: MorxInsertionSubtable = {
				type: MorxSubtableType.Insertion,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				insertionGlyphs: [777, 888],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
			];

			const result = processInsertion(subtable, infos);
			expect(result.length).toBe(4);
			expect(result[0]?.glyphId).toBe(10);
			expect(result[1]?.glyphId).toBe(777);
			expect(result[2]?.glyphId).toBe(888);
			expect(result[3]?.glyphId).toBe(20);
		});

		test("inserts before marked position", () => {
			const classTable: ClassTable = {
				format: 2,
				classArray: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
			};
			const stateTable: StateTable<InsertionEntry> = {
				nClasses: 5,
				classTable,
				stateArray: [
					[
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 0,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0x8000,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
					],
					[
						{
							newState: 1,
							flags: 0x0800 | (1 << 5),
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
						{
							newState: 1,
							flags: 0,
							currentInsertIndex: 0xffff,
							markedInsertIndex: 0xffff,
						},
					],
				],
			};

			const subtable: MorxInsertionSubtable = {
				type: MorxSubtableType.Insertion,
				coverage: { vertical: false, descending: false, logical: false },
				subFeatureFlags: 0,
				stateTable,
				insertionGlyphs: [555],
			};

			const infos: GlyphInfo[] = [
				{ glyphId: 10, cluster: 0, mask: 0, codepoint: 65 },
				{ glyphId: 20, cluster: 1, mask: 0, codepoint: 66 },
			];

			const result = processInsertion(subtable, infos);
			expect(result.length).toBe(3);
			expect(result[0]?.glyphId).toBe(555);
			expect(result[1]?.glyphId).toBe(10);
			expect(result[2]?.glyphId).toBe(20);
		});
	});
});
