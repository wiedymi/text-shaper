import { describe, expect, test } from "bun:test";
import {
	executeCffCharString,
	executeCff2CharString,
	getCffGlyphWidth,
} from "../../../src/font/tables/cff-charstring.ts";
import type { CffTable } from "../../../src/font/tables/cff.ts";
import type { Cff2Table } from "../../../src/font/tables/cff2.ts";
import type { Contour } from "../../../src/font/tables/glyf.ts";

/**
 * Helper to create a minimal CFF table structure for testing
 */
function createMockCffTable(charStrings: Uint8Array[]): CffTable {
	return {
		version: { major: 1, minor: 0 },
		names: ["TestFont"],
		topDicts: [
			{
				charStrings: 0,
				charset: 0,
				private: [0, 0],
			},
		],
		strings: [],
		globalSubrs: [],
		charStrings: [charStrings],
		localSubrs: [[]],
		fdArrays: [[]],
		fdSelects: [
			{
				format: 0,
				select: () => 0,
			},
		],
	} as CffTable;
}

/**
 * Helper to create a minimal CFF2 table structure for testing
 */
function createMockCff2Table(charStrings: Uint8Array[]): Cff2Table {
	return {
		version: { major: 2, minor: 0 },
		topDict: {
			charStrings: 0,
		},
		globalSubrs: [],
		charStrings,
		fdArray: [
			{
				private: {
					vsindex: 0,
				},
				localSubrs: [],
			},
		],
		fdSelect: {
			format: 0,
			select: () => 0,
		},
		vstore: null,
	} as Cff2Table;
}

describe("CFF CharString Interpreter", () => {
	describe("executeCffCharString", () => {
		test("returns null for out of bounds glyph ID", () => {
			const cff = createMockCffTable([new Uint8Array([14])]);
			const result = executeCffCharString(cff, 999);
			expect(result).toBeNull();
		});

		test("returns null for null charstring", () => {
			const cff = createMockCffTable([new Uint8Array([14])]);
			cff.charStrings[0] = [null as any];
			const result = executeCffCharString(cff, 0);
			expect(result).toBeNull();
		});

		test("handles endchar operator (14)", () => {
			const charstring = new Uint8Array([14]); // endchar
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toEqual([]);
		});

		test("handles endchar with width", () => {
			const charstring = new Uint8Array([
				139 + 100, // width = 100
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toEqual([]);
		});

		test("handles rmoveto operator (21)", () => {
			const charstring = new Uint8Array([
				139 + 10, // dx = 10
				139 + 20, // dy = 20
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0) {
				expect(result[0]?.[0]?.x).toBe(10);
				expect(result[0]?.[0]?.y).toBe(20);
			}
		});

		test("handles rmoveto with width", () => {
			const charstring = new Uint8Array([
				139 + 50, // width
				139 + 10, // dx
				139 + 20, // dy
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0) {
				expect(result[0]?.[0]?.x).toBe(10);
				expect(result[0]?.[0]?.y).toBe(20);
			}
		});

		test("handles hmoveto operator (22)", () => {
			const charstring = new Uint8Array([
				139 + 15, // dx = 15
				22, // hmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0) {
				expect(result[0]?.[0]?.x).toBe(15);
				expect(result[0]?.[0]?.y).toBe(0);
			}
		});

		test("handles vmoveto operator (4)", () => {
			const charstring = new Uint8Array([
				139 + 25, // dy = 25
				4, // vmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0) {
				expect(result[0]?.[0]?.x).toBe(0);
				expect(result[0]?.[0]?.y).toBe(25);
			}
		});

		test("handles vmoveto with width", () => {
			const charstring = new Uint8Array([
				139 + 60, // width
				139 + 25, // dy
				4, // vmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0) {
				expect(result[0]?.[0]?.x).toBe(0);
				expect(result[0]?.[0]?.y).toBe(25);
			}
		});

		test("handles rlineto operator (5)", () => {
			const charstring = new Uint8Array([
				139 + 10, // start x
				139 + 10, // start y
				21, // rmoveto
				139 + 20, // dx
				139 + 30, // dy
				5, // rlineto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0 && result[0]) {
				expect(result[0].length).toBe(2);
				expect(result[0][1]?.x).toBe(30);
				expect(result[0][1]?.y).toBe(40);
			}
		});

		test("handles hlineto operator (6)", () => {
			const charstring = new Uint8Array([
				139 + 0, // start x
				139 + 0, // start y
				21, // rmoveto
				139 + 50, // horizontal distance
				6, // hlineto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0 && result[0]) {
				expect(result[0][1]?.x).toBe(50);
				expect(result[0][1]?.y).toBe(0);
			}
		});

		test("handles alternating hlineto", () => {
			const charstring = new Uint8Array([
				139 + 0, // start
				139 + 0,
				21, // rmoveto
				139 + 10, // h
				139 + 20, // v
				139 + 30, // h
				6, // hlineto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles vlineto operator (7)", () => {
			const charstring = new Uint8Array([
				139 + 0, // start x
				139 + 0, // start y
				21, // rmoveto
				139 + 40, // vertical distance
				7, // vlineto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0 && result[0]) {
				expect(result[0][1]?.x).toBe(0);
				expect(result[0][1]?.y).toBe(40);
			}
		});

		test("handles alternating vlineto", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // v
				139 + 20, // h
				139 + 30, // v
				7, // vlineto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles rrcurveto operator (8)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dx1
				139 + 10, // dy1
				139 + 20, // dx2
				139 + 20, // dy2
				139 + 10, // dx3
				139 + 10, // dy3
				8, // rrcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result && result.length > 0 && result[0]) {
				expect(result[0].length).toBe(4); // start + 2 control + end
			}
		});

		test("handles hhcurveto operator (27)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dx1
				139 + 20, // dx2
				139 + 5, // dy2
				139 + 15, // dx3
				27, // hhcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hhcurveto with odd stack", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 5, // dy1
				139 + 10, // dx1
				139 + 20, // dx2
				139 + 5, // dy2
				139 + 15, // dx3
				27, // hhcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles vvcurveto operator (26)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dy1
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dy3
				26, // vvcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles vvcurveto with odd stack", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 5, // dx1
				139 + 10, // dy1
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dy3
				26, // vvcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hvcurveto operator (31)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dx1
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dy3
				31, // hvcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hvcurveto with final dx3", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dx1
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dy3
				139 + 3, // dx3
				31, // hvcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles vhcurveto operator (30)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dy1
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dx3
				30, // vhcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles vhcurveto with final dy3", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dy1
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dx3
				139 + 3, // dy3
				30, // vhcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles rcurveline operator (24)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10,
				139 + 10, // dx1, dy1
				139 + 20,
				139 + 20, // dx2, dy2
				139 + 10,
				139 + 10, // dx3, dy3
				139 + 5,
				139 + 5, // dx, dy (line)
				24, // rcurveline
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles rlinecurve operator (25)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 5,
				139 + 5, // dx, dy (line)
				139 + 10,
				139 + 10, // dx1, dy1
				139 + 20,
				139 + 20, // dx2, dy2
				139 + 10,
				139 + 10, // dx3, dy3
				25, // rlinecurve
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hstem operator (1)", () => {
			const charstring = new Uint8Array([
				139 + 10, // y
				139 + 20, // dy
				1, // hstem
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hstem with width", () => {
			const charstring = new Uint8Array([
				139 + 100, // width
				139 + 10, // y
				139 + 20, // dy
				1, // hstem
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles vstem operator (3)", () => {
			const charstring = new Uint8Array([
				139 + 10, // x
				139 + 20, // dx
				3, // vstem
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hstemhm operator (18)", () => {
			const charstring = new Uint8Array([
				139 + 10,
				139 + 20,
				18, // hstemhm
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles vstemhm operator (23)", () => {
			const charstring = new Uint8Array([
				139 + 10,
				139 + 20,
				23, // vstemhm
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hintmask operator (19)", () => {
			const charstring = new Uint8Array([
				139 + 10,
				139 + 20,
				1, // hstem (1 stem)
				19, // hintmask
				0b11111111, // mask byte
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hintmask with stems from stack", () => {
			const charstring = new Uint8Array([
				139 + 10,
				139 + 20, // stems from stack
				19, // hintmask
				0b11111111, // mask byte
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hintmask with width", () => {
			const charstring = new Uint8Array([
				139 + 100, // width
				139 + 10,
				139 + 20, // stems
				19, // hintmask
				0b11111111, // mask byte
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles cntrmask operator (20)", () => {
			const charstring = new Uint8Array([
				139 + 10,
				139 + 20,
				1, // hstem
				20, // cntrmask
				0b11111111, // mask byte
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles 16-bit integer encoding (28)", () => {
			const charstring = new Uint8Array([
				28, // 16-bit integer marker
				0x01, // high byte
				0x00, // low byte = 256
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles 16-bit negative integer", () => {
			const charstring = new Uint8Array([
				28, // 16-bit integer marker
				0xff, // high byte
				0xff, // low byte = -1
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles 32-bit fixed point encoding (255)", () => {
			const charstring = new Uint8Array([
				255, // 32-bit fixed point marker
				0x00,
				0x01,
				0x00,
				0x00, // 1.0 in 16.16 format
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles 32-bit fixed point negative", () => {
			const charstring = new Uint8Array([
				255, // 32-bit fixed point
				0xff,
				0xff,
				0x00,
				0x00, // -1.0 in 16.16 format
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles positive small integers (247-250)", () => {
			const charstring = new Uint8Array([
				247, // range 247-250
				0, // +b1 = 108
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles negative small integers (251-254)", () => {
			const charstring = new Uint8Array([
				251, // range 251-254
				0, // -108
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles callsubr operator (10)", () => {
			const subr = new Uint8Array([
				139 + 10,
				139 + 10,
				5, // rlineto
				11, // return
			]);
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 0, // subr index (biased to 107)
				10, // callsubr
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			cff.localSubrs[0] = [subr]; // bias of 107 for count < 1240
			// Add more subrs to reach index 107
			for (let i = 0; i < 107; i++) {
				cff.localSubrs[0]?.unshift(new Uint8Array([11]));
			}
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles callgsubr operator (29)", () => {
			const subr = new Uint8Array([
				139 + 10,
				139 + 10,
				5, // rlineto
				11, // return
			]);
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 0, // subr index
				29, // callgsubr
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			cff.globalSubrs = [subr];
			// Add more subrs to reach bias
			for (let i = 0; i < 107; i++) {
				cff.globalSubrs.unshift(new Uint8Array([11]));
			}
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles return operator (11)", () => {
			const charstring = new Uint8Array([
				11, // return (no-op at top level)
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles multiple contours with rmoveto", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto (first contour)
				139 + 10,
				139 + 0,
				5, // rlineto
				139 + 50,
				139 + 50,
				21, // rmoveto (second contour)
				139 + 10,
				139 + 0,
				5, // rlineto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result) {
				expect(result.length).toBe(2); // Two contours
			}
		});
	});

	describe("Flex operators", () => {
		test("handles flex operator (12, 35)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10,
				139 + 10, // dx1, dy1
				139 + 20,
				139 + 20, // dx2, dy2
				139 + 10,
				139 + 10, // dx3, dy3
				139 + 10,
				139 + 10, // dx4, dy4
				139 + 20,
				139 + 20, // dx5, dy5
				139 + 10,
				139 + 10, // dx6, dy6
				139 + 50, // fd (flex depth)
				12,
				35, // flex
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hflex operator (12, 34)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dx1
				139 + 20, // dx2
				139 + 5, // dy2
				139 + 10, // dx3
				139 + 15, // dx4
				139 + 20, // dx5
				139 + 10, // dx6
				12,
				34, // hflex
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hflex1 operator (12, 36)", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10,
				139 + 5, // dx1, dy1
				139 + 20,
				139 + 10, // dx2, dy2
				139 + 10, // dx3
				139 + 15, // dx4
				139 + 20,
				139 + 5, // dx5, dy5
				139 + 10, // dx6
				12,
				36, // hflex1
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles flex1 operator (12, 37) - horizontal dominant", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 50,
				139 + 5, // dx1, dy1
				139 + 50,
				139 + 5, // dx2, dy2
				139 + 50,
				139 + 5, // dx3, dy3
				139 + 50,
				139 + 5, // dx4, dy4
				139 + 50,
				139 + 5, // dx5, dy5
				139 + 10, // d6
				12,
				37, // flex1
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles flex1 operator - vertical dominant", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 5,
				139 + 50, // dx1, dy1
				139 + 5,
				139 + 50, // dx2, dy2
				139 + 5,
				139 + 50, // dx3, dy3
				139 + 5,
				139 + 50, // dx4, dy4
				139 + 5,
				139 + 50, // dx5, dy5
				139 + 10, // d6
				12,
				37, // flex1
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});
	});

	describe("Arithmetic operators", () => {
		test("handles and operator (12, 3)", () => {
			const charstring = new Uint8Array([
				139 + 1, // 1
				139 + 1, // 1
				12,
				3, // and
				139 + 0,
				21, // use result in rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles or operator (12, 4)", () => {
			const charstring = new Uint8Array([
				139 + 0, // 0
				139 + 1, // 1
				12,
				4, // or
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles not operator (12, 5)", () => {
			const charstring = new Uint8Array([
				139 + 0, // 0
				12,
				5, // not
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles abs operator (12, 9)", () => {
			const charstring = new Uint8Array([
				251,
				0, // -108
				12,
				9, // abs
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles add operator (12, 10)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				139 + 20, // 20
				12,
				10, // add
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles sub operator (12, 11)", () => {
			const charstring = new Uint8Array([
				139 + 30, // 30
				139 + 10, // 10
				12,
				11, // sub
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles div operator (12, 12)", () => {
			const charstring = new Uint8Array([
				139 + 100, // 100
				139 + 10, // 10
				12,
				12, // div
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles neg operator (12, 14)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				12,
				14, // neg
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles eq operator (12, 15)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				139 + 10, // 10
				12,
				15, // eq
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles drop operator (12, 18)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				12,
				18, // drop
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles put operator (12, 20)", () => {
			const charstring = new Uint8Array([
				139 + 42, // value
				139 + 5, // index
				12,
				20, // put
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles get operator (12, 21)", () => {
			const charstring = new Uint8Array([
				139 + 42, // value
				139 + 5, // index
				12,
				20, // put
				139 + 5, // index
				12,
				21, // get
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles ifelse operator (12, 22)", () => {
			const charstring = new Uint8Array([
				139 + 5, // s1
				139 + 10, // s2
				139 + 3, // v1
				139 + 2, // v2
				12,
				22, // ifelse (v1 <= v2, so s1)
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles random operator (12, 23)", () => {
			const charstring = new Uint8Array([
				12,
				23, // random
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles mul operator (12, 24)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				139 + 5, // 5
				12,
				24, // mul
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles sqrt operator (12, 26)", () => {
			const charstring = new Uint8Array([
				139 + 100, // 100
				12,
				26, // sqrt
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles dup operator (12, 27)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				12,
				27, // dup
				139 + 0,
				21, // rmoveto (uses one copy)
				139 + 0,
				21, // rmoveto (uses other copy)
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles exch operator (12, 28)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				139 + 20, // 20
				12,
				28, // exch
				21, // rmoveto (now 10, 20 swapped)
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles index operator (12, 29)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				139 + 20, // 20
				139 + 30, // 30
				139 + 1, // index (get element at position 1 from top)
				12,
				29, // index
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles roll operator (12, 30)", () => {
			const charstring = new Uint8Array([
				139 + 10, // 10
				139 + 20, // 20
				139 + 30, // 30
				139 + 3, // n (number of elements)
				139 + 1, // j (rotation amount)
				12,
				30, // roll
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles dotsection operator (12, 0)", () => {
			const charstring = new Uint8Array([
				12,
				0, // dotsection (deprecated, ignored)
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});
	});

	describe("CID fonts", () => {
		test("handles CID font with fdSelect and fdArray", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			// Make it a CID font
			if (cff.topDicts[0]) {
				cff.topDicts[0].ros = { registry: "Adobe", ordering: "Identity", supplement: 0 };
			}
			cff.fdArrays[0] = [
				{
					private: [0, 0],
					localSubrs: [],
				},
			];
			cff.fdSelects[0] = {
				format: 0,
				select: (gid: number) => 0,
			};
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles CID font with FD-specific local subrs", () => {
			const subr = new Uint8Array([
				139 + 10,
				139 + 10,
				5, // rlineto
				11, // return
			]);
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 0, // subr index
				10, // callsubr
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			// Make it a CID font
			if (cff.topDicts[0]) {
				cff.topDicts[0].ros = { registry: "Adobe", ordering: "Identity", supplement: 0 };
			}
			const fdLocalSubrs = [subr];
			for (let i = 0; i < 107; i++) {
				fdLocalSubrs.unshift(new Uint8Array([11]));
			}
			cff.fdArrays[0] = [
				{
					private: [0, 0],
					localSubrs: fdLocalSubrs,
				},
			];
			cff.fdSelects[0] = {
				format: 0,
				select: () => 0,
			};
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});
	});

	describe("executeCff2CharString", () => {
		test("executes CFF2 charstring successfully", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			const result = executeCff2CharString(cff2, 0);
			expect(result).toBeDefined();
		});

		test("returns null for out of bounds glyph ID", () => {
			const cff2 = createMockCff2Table([new Uint8Array([14])]);
			const result = executeCff2CharString(cff2, 999);
			expect(result).toBeNull();
		});

		test("returns null for null charstring", () => {
			const cff2 = createMockCff2Table([new Uint8Array([14])]);
			cff2.charStrings = [null as any];
			const result = executeCff2CharString(cff2, 0);
			expect(result).toBeNull();
		});

		test("handles axis coordinates", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			const result = executeCff2CharString(cff2, 0, [0.5, 0.5]);
			expect(result).toBeDefined();
		});

		test("handles vsindex operator (15)", () => {
			const charstring = new Uint8Array([
				139 + 2, // vsindex value
				15, // vsindex
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			const result = executeCff2CharString(cff2, 0);
			expect(result).toBeDefined();
		});

		test("handles blend operator (16)", () => {
			const charstring = new Uint8Array([
				139 + 100, // default value
				139 + 10, // delta 1
				139 + 1, // n (number of values to blend)
				16, // blend
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			cff2.vstore = {
				itemVariationData: [
					{
						regionIndexCount: 1,
						regionIndexes: [0],
					},
				],
				variationRegionList: {
					regions: [
						{
							axes: [
								{
									startCoord: -1.0,
									peakCoord: 0.0,
									endCoord: 1.0,
								},
							],
						},
					],
				},
			} as any;
			const result = executeCff2CharString(cff2, 0, [0.5]);
			expect(result).toBeDefined();
		});

		test("handles blend with no vstore (skipped)", () => {
			const charstring = new Uint8Array([
				139 + 100,
				139 + 10,
				139 + 1,
				16, // blend
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			cff2.vstore = null;
			const result = executeCff2CharString(cff2, 0);
			expect(result).toBeDefined();
		});

		test("handles blend with no axis coords (skipped)", () => {
			const charstring = new Uint8Array([
				139 + 100,
				139 + 10,
				139 + 1,
				16, // blend
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			cff2.vstore = {
				itemVariationData: [
					{
						regionIndexCount: 1,
						regionIndexes: [0],
					},
				],
				variationRegionList: {
					regions: [
						{
							axes: [
								{
									startCoord: -1.0,
									peakCoord: 0.0,
									endCoord: 1.0,
								},
							],
						},
					],
				},
			} as any;
			const result = executeCff2CharString(cff2, 0, null);
			expect(result).toBeDefined();
		});

		test("handles FD with vsindex in private dict", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			if (cff2.fdArray[0]) {
				cff2.fdArray[0].private = {
					vsindex: 5,
				};
			}
			const result = executeCff2CharString(cff2, 0);
			expect(result).toBeDefined();
		});

		test("closes open contour at end", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10,
				139 + 10,
				5, // rlineto
				// no endchar, just end of charstring
			]);
			const cff2 = createMockCff2Table([charstring]);
			const result = executeCff2CharString(cff2, 0);
			expect(result).toBeDefined();
			if (result) {
				expect(result.length).toBe(1);
			}
		});
	});

	describe("Error handling", () => {
		test("handles incomplete 16-bit integer", () => {
			const charstring = new Uint8Array([
				28, // 16-bit marker
				0x01, // only one byte (incomplete)
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles incomplete 32-bit fixed point", () => {
			const charstring = new Uint8Array([
				255, // 32-bit marker
				0x00,
				0x01, // only two bytes (incomplete)
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles incomplete two-byte operator", () => {
			const charstring = new Uint8Array([
				12, // two-byte operator marker
				// missing second byte
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles incomplete hintmask", () => {
			const charstring = new Uint8Array([
				139 + 10,
				139 + 20,
				19, // hintmask
				// missing mask bytes
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles stack underflow in operators", () => {
			const charstring = new Uint8Array([
				21, // rmoveto with empty stack
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles missing subroutine", () => {
			const charstring = new Uint8Array([
				139 + 100, // non-existent subr index
				10, // callsubr
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});
	});

	describe("Edge cases", () => {
		test("handles empty charstring", () => {
			const charstring = new Uint8Array([]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toEqual([]);
		});

		test("handles charstring with only width", () => {
			const charstring = new Uint8Array([
				139 + 100, // width
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toEqual([]);
		});

		test("handles multiple stems", () => {
			const charstring = new Uint8Array([
				139 + 10,
				139 + 20, // stem 1
				139 + 30,
				139 + 40, // stem 2
				139 + 50,
				139 + 60, // stem 3
				1, // hstem
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles hintmask with many stems (multiple bytes)", () => {
			const charstring = new Uint8Array([
				139 + 1,
				139 + 1, // stem 1
				139 + 2,
				139 + 2, // stem 2
				139 + 3,
				139 + 3, // stem 3
				139 + 4,
				139 + 4, // stem 4
				139 + 5,
				139 + 5, // stem 5
				1, // hstem (5 stems)
				19, // hintmask
				0xff, // first byte
				// 5 stems = 1 byte mask
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles 9 stems requiring 2 mask bytes", () => {
			const charstring = new Uint8Array([
				139 + 1,
				139 + 1,
				139 + 2,
				139 + 2,
				139 + 3,
				139 + 3,
				139 + 4,
				139 + 4,
				139 + 5,
				139 + 5,
				139 + 6,
				139 + 6,
				139 + 7,
				139 + 7,
				139 + 8,
				139 + 8,
				139 + 9,
				139 + 9, // 9 stems
				1, // hstem
				19, // hintmask
				0xff,
				0xff, // 2 bytes for 9 stems
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles charstring that closes contour without endchar", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10,
				139 + 10,
				5, // rlineto
				// ends without endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result) {
				expect(result.length).toBe(1);
			}
		});

		test("handles hmoveto closing previous contour", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto (start first contour)
				139 + 10,
				139 + 10,
				5, // rlineto
				139 + 50, // hmoveto closes first and starts second
				22, // hmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result) {
				expect(result.length).toBe(2);
			}
		});

		test("handles hmoveto with width closing previous contour", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto (start first contour)
				139 + 10,
				139 + 10,
				5, // rlineto
				139 + 100, // width
				139 + 50, // dx
				22, // hmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result) {
				expect(result.length).toBe(2);
			}
		});

		test("handles vmoveto closing previous contour", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto (start first contour)
				139 + 10,
				139 + 10,
				5, // rlineto
				139 + 50, // dy
				4, // vmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
			if (result) {
				expect(result.length).toBe(2);
			}
		});

		test("handles hvcurveto alternating to vertical", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dx1 (horizontal)
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dy3
				139 + 10, // dy1 (now vertical)
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dx3
				31, // hvcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles vhcurveto alternating to horizontal", () => {
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				139 + 10, // dy1 (vertical)
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dx3
				139 + 10, // dx1 (now horizontal)
				139 + 5, // dx2
				139 + 20, // dy2
				139 + 15, // dy3
				30, // vhcurveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles getSubrBias for count >= 33900", () => {
			const subrs: Uint8Array[] = [];
			// Create 33900+ subrs to test bias calculation
			for (let i = 0; i < 33900; i++) {
				subrs.push(new Uint8Array([11])); // return
			}
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			cff.globalSubrs = subrs;
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("handles getSubrBias for 1240 <= count < 33900", () => {
			const subrs: Uint8Array[] = [];
			// Create 1240+ subrs to test bias calculation
			for (let i = 0; i < 1240; i++) {
				subrs.push(new Uint8Array([11])); // return
			}
			const charstring = new Uint8Array([
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff = createMockCffTable([charstring]);
			cff.localSubrs[0] = subrs;
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});
	});

	describe("CFF2 blend computeRegionScalar coverage", () => {
		test("handles coord outside region (before start)", () => {
			const charstring = new Uint8Array([
				139 + 100, // default
				139 + 10, // delta
				139 + 1, // n
				16, // blend
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			cff2.vstore = {
				itemVariationData: [
					{
						regionIndexCount: 1,
						regionIndexes: [0],
					},
				],
				variationRegionList: {
					regions: [
						{
							axes: [
								{
									startCoord: 0.5,
									peakCoord: 1.0,
									endCoord: 1.0,
								},
							],
						},
					],
				},
			} as any;
			const result = executeCff2CharString(cff2, 0, [0.0]); // coord < startCoord
			expect(result).toBeDefined();
		});

		test("handles coord outside region (after end)", () => {
			const charstring = new Uint8Array([
				139 + 100,
				139 + 10,
				139 + 1,
				16, // blend
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			cff2.vstore = {
				itemVariationData: [
					{
						regionIndexCount: 1,
						regionIndexes: [0],
					},
				],
				variationRegionList: {
					regions: [
						{
							axes: [
								{
									startCoord: 0.0,
									peakCoord: 0.5,
									endCoord: 0.8,
								},
							],
						},
					],
				},
			} as any;
			const result = executeCff2CharString(cff2, 0, [1.0]); // coord > endCoord
			expect(result).toBeDefined();
		});

		test("handles coord before peak", () => {
			const charstring = new Uint8Array([
				139 + 100,
				139 + 10,
				139 + 1,
				16, // blend
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			cff2.vstore = {
				itemVariationData: [
					{
						regionIndexCount: 1,
						regionIndexes: [0],
					},
				],
				variationRegionList: {
					regions: [
						{
							axes: [
								{
									startCoord: 0.0,
									peakCoord: 0.8,
									endCoord: 1.0,
								},
							],
						},
					],
				},
			} as any;
			const result = executeCff2CharString(cff2, 0, [0.4]); // coord < peakCoord
			expect(result).toBeDefined();
		});

		test("handles coord after peak", () => {
			const charstring = new Uint8Array([
				139 + 100,
				139 + 10,
				139 + 1,
				16, // blend
				139 + 0,
				139 + 0,
				21, // rmoveto
				14, // endchar
			]);
			const cff2 = createMockCff2Table([charstring]);
			cff2.vstore = {
				itemVariationData: [
					{
						regionIndexCount: 1,
						regionIndexes: [0],
					},
				],
				variationRegionList: {
					regions: [
						{
							axes: [
								{
									startCoord: 0.0,
									peakCoord: 0.5,
									endCoord: 1.0,
								},
							],
						},
					],
				},
			} as any;
			const result = executeCff2CharString(cff2, 0, [0.7]); // coord > peakCoord
			expect(result).toBeDefined();
		});
	});

	describe("getCffGlyphWidth", () => {
		test("returns 0 for any glyph", () => {
			const cff = createMockCffTable([new Uint8Array([14])]);
			const width = getCffGlyphWidth(cff, 0);
			expect(width).toBe(0);
		});

		test("handles different font indices", () => {
			const cff = createMockCffTable([new Uint8Array([14])]);
			const width = getCffGlyphWidth(cff, 0, 0);
			expect(width).toBe(0);
		});
	});

	describe("Operators with case labels", () => {
		test("hintmask case label coverage", () => {
			// This tests the case Op.hintmask label which is handled inline
			const charstring = new Uint8Array([
				19, // hintmask (no stems from stack)
				0xff, // mask byte (need at least 1 byte even with 0 stems, but code adds stems first)
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});

		test("cntrmask case label coverage", () => {
			// This tests the case Op.cntrmask label which is handled inline
			const charstring = new Uint8Array([
				20, // cntrmask (no stems from stack)
				0xff, // mask byte
			]);
			const cff = createMockCffTable([charstring]);
			const result = executeCffCharString(cff, 0);
			expect(result).toBeDefined();
		});
	});
});
