import { describe, expect, test } from "bun:test";
import { processLigature } from "../../../src/aat/state-machine.ts";
import { Reader } from "../../../src/font/binary/reader.ts";
import {
	applyNonContextual,
	MorxSubtableType,
	parseMorx,
	type MorxLigatureSubtable,
	type MorxNonContextualSubtable,
	type StateTable,
} from "../../../src/font/tables/morx.ts";
import type { GlyphInfo } from "../../../src/types.ts";

function format0ClassLigatureTable(): ArrayBuffer {
	const buffer = new ArrayBuffer(96);
	const view = new DataView(buffer);
	view.setUint16(0, 2); // morx version
	view.setUint32(4, 1); // one chain
	view.setUint32(8, 1); // default flags
	view.setUint32(12, 88); // chain length
	view.setUint32(20, 1); // one subtable
	view.setUint32(24, 72); // subtable length
	view.setUint32(28, MorxSubtableType.Ligature);
	view.setUint32(32, 1); // enabled by default flags

	const body = 36;
	view.setUint32(body, 5); // nClasses
	view.setUint32(body + 4, 28); // class table
	view.setUint32(body + 8, 36); // state array
	view.setUint32(body + 12, 46); // entry table
	view.setUint32(body + 16, 52); // ligature actions
	view.setUint32(body + 20, 56); // components
	view.setUint32(body + 24, 58); // ligatures

	view.setUint16(body + 28, 0); // lookup format 0
	view.setUint16(body + 30, 4);
	view.setUint16(body + 32, 5);
	view.setUint16(body + 34, 6);
	// The remaining regions are deliberately zero-filled except for one action.
	view.setUint32(body + 52, 0x80000000);
	return buffer;
}

function format4NonContextualTable(): ArrayBuffer {
	const buffer = new ArrayBuffer(60);
	const view = new DataView(buffer);
	view.setUint16(0, 2);
	view.setUint32(4, 1);
	view.setUint32(8, 1);
	view.setUint32(12, 52);
	view.setUint32(20, 1);
	view.setUint32(24, 36);
	view.setUint32(28, MorxSubtableType.NonContextual);
	view.setUint32(32, 1);

	const lookup = 36;
	view.setUint16(lookup, 4);
	view.setUint16(lookup + 2, 6); // segment record size
	view.setUint16(lookup + 4, 1); // one segment
	view.setUint16(lookup + 6, 6); // search range
	view.setUint16(lookup + 12, 11); // last glyph
	view.setUint16(lookup + 14, 10); // first glyph
	view.setUint16(lookup + 16, 18); // values offset from lookup start
	view.setUint16(lookup + 18, 100);
	view.setUint16(lookup + 20, 101);
	return buffer;
}

function glyph(glyphId: number, cluster: number): GlyphInfo {
	return { glyphId, cluster, mask: 0, codepoint: glyphId };
}

function twoComponentStateTable(): StateTable<{
	newState: number;
	flags: number;
	ligActionIndex: number;
}> {
	const idle = { newState: 0, flags: 0, ligActionIndex: 0 };
	return {
		nClasses: 5,
		classTable: {
			format: 8,
			classArray: Array.from({ length: 21 }, (_, glyphId) =>
				glyphId === 10 || glyphId === 20 ? 4 : 1,
			),
		},
		stateArray: [
			[idle, idle, idle, idle, { newState: 1, flags: 0x8000, ligActionIndex: 0 }],
			[idle, idle, idle, idle, { newState: 0, flags: 0xa000, ligActionIndex: 0 }],
		],
	};
}

describe("morx regressions", () => {
	test("bounds a format 0 class lookup to the class-table region", () => {
		const morx = parseMorx(new Reader(format0ClassLigatureTable()));
		const subtable = morx.chains[0]?.subtables[0] as
			| MorxLigatureSubtable
			| undefined;

		expect(subtable?.stateTable.classTable.classArray).toEqual([4, 5, 6]);
		expect(subtable?.stateTable.stateArray).toHaveLength(1);
	});

	test("parses format 4 values at lookup-relative offsets", () => {
		const morx = parseMorx(new Reader(format4NonContextualTable()));
		const subtable = morx.chains[0]?.subtables[0] as
			| MorxNonContextualSubtable
			| undefined;

		expect(subtable?.lookupTable.mapping.get(10)).toBe(100);
		expect(subtable?.lookupTable.mapping.get(11)).toBe(101);
	});

	test("treats a zero lookup value as no substitution", () => {
		const subtable: MorxNonContextualSubtable = {
			type: MorxSubtableType.NonContextual,
			coverage: { vertical: false, descending: false, logical: false },
			subFeatureFlags: 0,
			lookupTable: {
				format: 0,
				mapping: new Map([[10, 0]]),
			},
		};

		expect(applyNonContextual(subtable, 10)).toBeNull();
	});

	test("keeps the ligature accumulator and component stack across Store actions", () => {
		const components = new Array<number>(21).fill(0);
		components[20] = 1;
		components[10] = 1;
		const ligatures = [0, 200, 999];
		const subtable: MorxLigatureSubtable = {
			type: MorxSubtableType.Ligature,
			coverage: { vertical: false, descending: false, logical: false },
			subFeatureFlags: 0,
			stateTable: twoComponentStateTable(),
			ligatureActions: [0x40000000, 0x80000000],
			components,
			ligatures,
		};

		const result = processLigature(subtable, [glyph(10, 0), glyph(20, 1)]);

		expect(result).toHaveLength(1);
		expect(result[0]?.glyphId).toBe(999);
		expect(result[0]?.cluster).toBe(0);
	});

	test("does not substitute when a ligature component lookup is out of bounds", () => {
		const subtable: MorxLigatureSubtable = {
			type: MorxSubtableType.Ligature,
			coverage: { vertical: false, descending: false, logical: false },
			subFeatureFlags: 0,
			stateTable: twoComponentStateTable(),
			ligatureActions: [0x00000000, 0x80000000],
			components: [],
			ligatures: [777],
		};

		const result = processLigature(subtable, [glyph(10, 0), glyph(20, 1)]);

		expect(result.map((info) => info.glyphId)).toEqual([10, 20]);
	});

	test("does not push the same component twice across DontAdvance", () => {
		const idle = { newState: 0, flags: 0, ligActionIndex: 0 };
		const classArray = new Array<number>(31).fill(1);
		classArray[10] = 4;
		classArray[20] = 5;
		classArray[30] = 6;
		const components = new Array<number>(51).fill(0);
		for (const glyphId of [10, 20, 30, 50]) components[glyphId] = 1;
		const subtable: MorxLigatureSubtable = {
			type: MorxSubtableType.Ligature,
			coverage: { vertical: false, descending: false, logical: false },
			subFeatureFlags: 0,
			stateTable: {
				nClasses: 7,
				classTable: { format: 8, classArray },
				stateArray: [
					[
						idle,
						idle,
						idle,
						idle,
						{ newState: 1, flags: 0xc000, ligActionIndex: 0 },
						idle,
						idle,
					],
					[
						idle,
						idle,
						idle,
						idle,
						{ newState: 2, flags: 0x8000, ligActionIndex: 0 },
						idle,
						idle,
					],
					[
						idle,
						idle,
						idle,
						idle,
						idle,
						{ newState: 2, flags: 0xa000, ligActionIndex: 0 },
						{ newState: 2, flags: 0xa000, ligActionIndex: 2 },
					],
				],
			},
			ligatureActions: [
				0x00000000,
				0x80000000,
				0x00000000,
				0x00000000,
				0x80000000,
			],
			components,
			ligatures: [0, 0, 50, 999],
		};

		const result = processLigature(subtable, [
			glyph(10, 0),
			glyph(20, 1),
			glyph(30, 2),
		]);

		expect(result.map((info) => info.glyphId)).toEqual([50, 30]);
	});
});
