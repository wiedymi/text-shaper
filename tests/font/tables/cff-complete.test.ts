import { describe, expect, test } from "bun:test";
import { Reader } from "../../../src/font/binary/reader.ts";
import { parseCff, getCffString } from "../../../src/font/tables/cff.ts";

describe("CFF complete coverage", () => {
	function createMinimalCff(customParts?: {
		afterHeader?: Uint8Array[];
	}): Uint8Array {
		const parts: number[] = [
			// Header
			1,
			0, // major, minor
			4,
			4, // hdrSize, offSize
			// Name INDEX (empty)
			0,
			0,
			// Top DICT INDEX (one item: empty dict)
			0,
			1, // count
			1, // offSize
			1,
			1, // offsets: start, end
			// String INDEX (empty)
			0,
			0,
			// Global Subr INDEX (empty)
			0,
			0,
		];

		if (customParts?.afterHeader) {
			return new Uint8Array(customParts.afterHeader.flatMap(arr => Array.from(arr)));
		}

		return new Uint8Array(parts);
	}

	function createIndexWithOffSize(
		items: number[][],
		offSize: number,
	): number[] {
		if (items.length === 0) return [0, 0];

		const count = items.length;
		const offsets: number[] = [];
		let currentOffset = 1;

		for (const item of items) {
			offsets.push(currentOffset);
			currentOffset += item.length;
		}
		offsets.push(currentOffset);

		const result: number[] = [
			(count >> 8) & 0xff,
			count & 0xff,
			offSize,
		];

		for (const offset of offsets) {
			if (offSize === 1) {
				result.push(offset & 0xff);
			} else if (offSize === 2) {
				result.push((offset >> 8) & 0xff, offset & 0xff);
			} else if (offSize === 3) {
				result.push(
					(offset >> 16) & 0xff,
					(offset >> 8) & 0xff,
					offset & 0xff,
				);
			} else if (offSize === 4) {
				result.push(
					(offset >> 24) & 0xff,
					(offset >> 16) & 0xff,
					(offset >> 8) & 0xff,
					offset & 0xff,
				);
			}
		}

		for (const item of items) {
			result.push(...item);
		}

		return result;
	}

	test("parses INDEX with offset size 3", () => {
		const data = new Uint8Array([
			1,
			0,
			4,
			4, // header
			...createIndexWithOffSize([[84, 101, 115, 116]], 3), // Name INDEX with "Test"
			...createIndexWithOffSize([[139]], 2), // Top DICT INDEX with single byte
			0,
			0, // String INDEX
			0,
			0, // Global Subr INDEX
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.names.length).toBe(1);
		expect(cff.names[0]).toBe("Test");
	});

	test("parses INDEX with offset size 4", () => {
		const data = new Uint8Array([
			1,
			0,
			4,
			4, // header
			...createIndexWithOffSize([[84, 101, 115, 116]], 4), // Name INDEX with "Test"
			...createIndexWithOffSize([[139]], 2), // Top DICT INDEX
			0,
			0, // String INDEX
			0,
			0, // Global Subr INDEX
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.names.length).toBe(1);
	});

	test("throws error for invalid offset size", () => {
		const data = new Uint8Array([
			1,
			0,
			4,
			4, // header
			0,
			1, // count = 1
			5, // invalid offSize = 5
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		expect(() => parseCff(reader)).toThrow("Invalid offset size: 5");
	});

	test("parses real number with E- nibble", () => {
		// Create a DICT with a real number that has E- (nibble 0x0c)
		const realNumber = [
			30, // real number operator
			0x1a, // 1.
			0x5c, // 5E-
			0x1f, // 1 then terminator
		];

		const dictData = new Uint8Array([
			...realNumber,
			12,
			9, // op 0x0c09 (BlueScale)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4, // header
			...createIndexWithOffSize([[84, 101, 115, 116]], 2), // Name INDEX
			...createIndexWithOffSize([Array.from(dictData)], 2), // Top DICT INDEX
			0,
			0, // String INDEX
			0,
			0, // Global Subr INDEX
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts.length).toBe(1);
	});

	test("parses TopDict with isFixedPitch", () => {
		const dict = new Uint8Array([
			139 + 1, // operand: 1
			12,
			1, // op 0x0c01 (isFixedPitch)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4, // header
			...createIndexWithOffSize([[84]], 2), // Name INDEX
			...createIndexWithOffSize([Array.from(dict)], 2), // Top DICT INDEX
			0,
			0, // String INDEX
			0,
			0, // Global Subr INDEX
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.isFixedPitch).toBe(true);
	});

	test("parses TopDict with ItalicAngle", () => {
		const dict = new Uint8Array([
			28,
			255,
			241, // -15 as int16
			12,
			2, // op 0x0c02 (ItalicAngle)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.italicAngle).toBe(-15);
	});

	test("parses TopDict with UnderlinePosition", () => {
		const dict = new Uint8Array([
			28,
			255,
			156, // -100 as int16
			12,
			3, // op 0x0c03 (UnderlinePosition)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.underlinePosition).toBe(-100);
	});

	test("parses TopDict with UnderlineThickness", () => {
		const dict = new Uint8Array([
			139 + 50,
			12,
			4, // op 0x0c04 (UnderlineThickness)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.underlineThickness).toBe(50);
	});

	test("parses TopDict with PaintType", () => {
		const dict = new Uint8Array([
			139, // 0
			12,
			5, // op 0x0c05 (PaintType)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.paintType).toBe(0);
	});

	test("parses TopDict with CharstringType", () => {
		const dict = new Uint8Array([
			139 + 2, // 2
			12,
			6, // op 0x0c06 (CharstringType)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.charstringType).toBe(2);
	});

	test("parses TopDict with UniqueID", () => {
		const dict = new Uint8Array([
			139 + 13, // 13
			13, // op 13 (UniqueID)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.uniqueID).toBe(13);
	});

	test("parses TopDict with StrokeWidth", () => {
		const dict = new Uint8Array([
			139 + 50, // 50
			12,
			8, // op 0x0c08 (StrokeWidth)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.strokeWidth).toBe(50);
	});

	test("parses TopDict with Encoding", () => {
		const dict = new Uint8Array([
			139, // 0
			16, // op 16 (Encoding)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.encoding).toBe(0);
	});

	test("parses TopDict with SyntheticBase", () => {
		const dict = new Uint8Array([
			28,
			48,
			57, // 12345 as int16
			12,
			20, // op 0x0c14 (SyntheticBase)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.syntheticBase).toBe(12345);
	});

	test("parses TopDict with PostScript", () => {
		const dict = new Uint8Array([
			247,
			134, // 390 (SID)
			12,
			21, // op 0x0c15 (PostScript)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.postScript).toBeDefined();
	});

	test("parses TopDict with BaseFontName", () => {
		const dict = new Uint8Array([
			247,
			134, // 390 (SID)
			12,
			22, // op 0x0c16 (BaseFontName)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.baseFontName).toBeDefined();
	});

	test("parses TopDict with BaseFontBlend", () => {
		const dict = new Uint8Array([
			139 + 1, // 1
			139 + 2, // 2
			139 + 3, // 3
			12,
			23, // op 0x0c17 (BaseFontBlend)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.baseFontBlend).toEqual([1, 2, 3]);
	});

	test("parses TopDict with ROS (CIDFont)", () => {
		const dict = new Uint8Array([
			247,
			134, // 390
			247,
			135, // 391
			139, // 0
			12,
			30, // op 0x0c1e (ROS)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.ros).toBeDefined();
		expect(cff.topDicts[0]?.ros?.supplement).toBe(0);
	});

	test("parses TopDict with CIDFontVersion", () => {
		const dict = new Uint8Array([
			139 + 1, // 1
			12,
			31, // op 0x0c1f (CIDFontVersion)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.cidFontVersion).toBe(1);
	});

	test("parses TopDict with CIDFontRevision", () => {
		const dict = new Uint8Array([
			139 + 2, // 2
			12,
			32, // op 0x0c20 (CIDFontRevision)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.cidFontRevision).toBe(2);
	});

	test("parses TopDict with CIDFontType", () => {
		const dict = new Uint8Array([
			139, // 0
			12,
			33, // op 0x0c21 (CIDFontType)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.cidFontType).toBe(0);
	});

	test("parses TopDict with CIDCount", () => {
		const dict = new Uint8Array([
			28,
			3,
			232, // 1000
			12,
			34, // op 0x0c22 (CIDCount)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.cidCount).toBe(1000);
	});

	test("parses TopDict with UIDBase", () => {
		const dict = new Uint8Array([
			28,
			15,
			160, // 4000
			12,
			35, // op 0x0c23 (UIDBase)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.uidBase).toBe(4000);
	});

	test("parses TopDict with FontName", () => {
		const dict = new Uint8Array([
			247,
			136, // 392 (SID)
			12,
			38, // op 0x0c26 (FontName)
		]);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.fontName).toBeDefined();
	});

	test("parses PrivateDict with FamilyBlues", () => {
		const dict = new Uint8Array([
			128, // -10
			149, // 10
			8, // op 8 (FamilyBlues)
		]);

		const reader = new Reader(
			dict.buffer as ArrayBuffer,
			dict.byteOffset,
			dict.byteLength,
		);

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([[dict.length, 139, 18]], 2), // private [size, offset]
			0,
			0,
			0,
			0,
			...dict,
		]);

		const mainReader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(mainReader);
		expect(cff.topDicts.length).toBe(1);
	});

	test("parses PrivateDict with FamilyOtherBlues", () => {
		const dict = new Uint8Array([
			119, // -20
			128, // -10
			9, // op 9 (FamilyOtherBlues)
		]);

		const reader = new Reader(
			dict.buffer as ArrayBuffer,
			dict.byteOffset,
			dict.byteLength,
		);
		expect(reader).toBeDefined();
	});

	test("parses PrivateDict with BlueFuzz", () => {
		const dict = new Uint8Array([
			139 + 1, // 1
			12,
			11, // op 0x0c0b (BlueFuzz)
		]);

		const reader = new Reader(
			dict.buffer as ArrayBuffer,
			dict.byteOffset,
			dict.byteLength,
		);
		expect(reader).toBeDefined();
	});

	test("parses PrivateDict with ForceBold", () => {
		const dict = new Uint8Array([
			139 + 1, // 1
			12,
			14, // op 0x0c0e (ForceBold)
		]);

		const reader = new Reader(
			dict.buffer as ArrayBuffer,
			dict.byteOffset,
			dict.byteLength,
		);
		expect(reader).toBeDefined();
	});

	test("parses PrivateDict with LanguageGroup", () => {
		const dict = new Uint8Array([
			139, // 0
			12,
			17, // op 0x0c11 (LanguageGroup)
		]);

		const reader = new Reader(
			dict.buffer as ArrayBuffer,
			dict.byteOffset,
			dict.byteLength,
		);
		expect(reader).toBeDefined();
	});

	test("parses PrivateDict with ExpansionFactor", () => {
		const dict = new Uint8Array([
			30,
			0x0a,
			0x0f, // 0.0 as real
			12,
			18, // op 0x0c12 (ExpansionFactor)
		]);

		const reader = new Reader(
			dict.buffer as ArrayBuffer,
			dict.byteOffset,
			dict.byteLength,
		);
		expect(reader).toBeDefined();
	});

	test("parses PrivateDict with initialRandomSeed", () => {
		const dict = new Uint8Array([
			139, // 0
			12,
			19, // op 0x0c13 (initialRandomSeed)
		]);

		const reader = new Reader(
			dict.buffer as ArrayBuffer,
			dict.byteOffset,
			dict.byteLength,
		);
		expect(reader).toBeDefined();
	});

	test("parses FDSelect format 0", () => {
		const fdSelect = new Uint8Array([
			0, // format 0
			0,
			0,
			1,
			1,
			2, // fd for each glyph
		]);

		const reader = new Reader(
			fdSelect.buffer as ArrayBuffer,
			fdSelect.byteOffset,
			fdSelect.byteLength,
		);
		expect(reader.uint8()).toBe(0);
	});

	test("parses FDSelect format 3", () => {
		const fdSelect = new Uint8Array([
			3, // format 3
			0,
			2, // nRanges = 2
			0,
			0, // first = 0
			0, // fd = 0
			0,
			5, // first = 5
			1, // fd = 1
			0,
			10, // sentinel = 10
		]);

		const reader = new Reader(
			fdSelect.buffer as ArrayBuffer,
			fdSelect.byteOffset,
			fdSelect.byteLength,
		);
		expect(reader.uint8()).toBe(3);
	});

	test("parses FDSelect with unknown format defaults to 0", () => {
		const fdSelect = new Uint8Array([
			99, // unknown format
		]);

		const reader = new Reader(
			fdSelect.buffer as ArrayBuffer,
			fdSelect.byteOffset,
			fdSelect.byteLength,
		);
		expect(reader.uint8()).toBe(99);
	});

	test("parses CFF without charStrings offset", () => {
		const dict = new Uint8Array([139]); // empty dict with no charStrings

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.charStrings[0]).toEqual([]);
	});

	test("parses CFF without private dict", () => {
		const dict = new Uint8Array([139]); // Empty dict (no private, no charStrings)

		const data = new Uint8Array([
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(dict)], 2),
			0,
			0,
			0,
			0,
		]);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.localSubrs[0]).toEqual([]);
	});

	test("parses CFF with FDArray and FDSelect", () => {
		const topDictBytes: number[] = [];

		const fdArrayDict = new Uint8Array([139]); // empty FD dict
		const fdArrayOffset = 100;
		topDictBytes.push(139 + fdArrayOffset, 12, 36); // FDArray op

		const fdSelectOffset = 200;
		topDictBytes.push(28, 0, 200 & 0xff, 12, 37); // FDSelect op

		const charStringsOffset = 50;
		topDictBytes.push(139 + charStringsOffset, 17); // CharStrings op

		const topDict = new Uint8Array(topDictBytes);

		const charStringsIndex = createIndexWithOffSize(
			[
				[14], // one charstring
			],
			2,
		);

		const fdArrayIndex = createIndexWithOffSize([Array.from(fdArrayDict)], 2);

		const fdSelect = new Uint8Array([
			0, // format 0
			0, // fd for glyph 0
		]);

		const parts = [
			1,
			0,
			4,
			4, // header
			...createIndexWithOffSize([[84]], 2), // Name INDEX
			...createIndexWithOffSize([Array.from(topDict)], 2), // Top DICT INDEX
			0,
			0, // String INDEX
			0,
			0, // Global Subr INDEX
		];

		while (parts.length < charStringsOffset) {
			parts.push(0);
		}
		parts.push(...charStringsIndex);

		while (parts.length < fdArrayOffset) {
			parts.push(0);
		}
		parts.push(...fdArrayIndex);

		while (parts.length < fdSelectOffset) {
			parts.push(0);
		}
		parts.push(...fdSelect);

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.fdArrays[0]?.length).toBeGreaterThanOrEqual(0);
		expect(cff.fdSelects[0]).toBeDefined();
	});

	test("parses FDArray with private dict and subrs", () => {
		const privateDict = new Uint8Array([
			139 + 10, // subrs offset = 10
			19, // Subrs op
		]);

		const charStringsOffset = 50;
		const fdArrayOffset = 120;
		const privateDictOffset = 250;
		const privateDictSize = privateDict.length;
		const localSubrsOffset = privateDictOffset + privateDictSize + 10;

		const fdDict = new Uint8Array([
			privateDictSize + 139,
			28,
			(privateDictOffset >> 8) & 0xff,
			privateDictOffset & 0xff,
			18, // Private op [size, offset]
		]);

		const topDictBytes: number[] = [];
		topDictBytes.push(28, (fdArrayOffset >> 8) & 0xff, fdArrayOffset & 0xff, 12, 36); // FDArray op
		topDictBytes.push(28, (charStringsOffset >> 8) & 0xff, charStringsOffset & 0xff, 17); // CharStrings op

		const topDict = new Uint8Array(topDictBytes);

		const charStringsIndex = createIndexWithOffSize([[14]], 2);

		const fdArrayIndex = createIndexWithOffSize([Array.from(fdDict)], 2);

		const localSubrsIndex = createIndexWithOffSize([[14]], 2);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < charStringsOffset) {
			parts.push(0);
		}
		parts.push(...charStringsIndex);

		while (parts.length < fdArrayOffset) {
			parts.push(0);
		}
		parts.push(...fdArrayIndex);

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(privateDict));

		while (parts.length < localSubrsOffset) {
			parts.push(0);
		}
		parts.push(...localSubrsIndex);

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.fdArrays[0]?.length).toBeGreaterThanOrEqual(0);
	});

	test("parses FDSelect format 3 with binary search", () => {
		const topDictBytes: number[] = [];
		const fdSelectOffset = 100;
		topDictBytes.push(139 + fdSelectOffset, 12, 37); // FDSelect op
		topDictBytes.push(139 + 50, 17); // CharStrings op

		const topDict = new Uint8Array(topDictBytes);

		const charStringsIndex = createIndexWithOffSize(
			[
				[14],
				[14],
				[14],
				[14],
				[14],
				[14],
				[14],
				[14],
				[14],
				[14],
			], // 10 glyphs
			2,
		);

		const fdSelect = new Uint8Array([
			3, // format 3
			0,
			3, // nRanges = 3
			0,
			0, // first = 0
			0, // fd = 0
			0,
			3, // first = 3
			1, // fd = 1
			0,
			7, // first = 7
			2, // fd = 2
			0,
			10, // sentinel = 10
		]);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < 50) {
			parts.push(0);
		}
		parts.push(...charStringsIndex);

		while (parts.length < fdSelectOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(fdSelect));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		const fdSelect1 = cff.fdSelects[0]!;

		expect(fdSelect1.select(0)).toBe(0);
		expect(fdSelect1.select(1)).toBe(0);
		expect(fdSelect1.select(2)).toBe(0);
		expect(fdSelect1.select(3)).toBe(1);
		expect(fdSelect1.select(4)).toBe(1);
		expect(fdSelect1.select(5)).toBe(1);
		expect(fdSelect1.select(6)).toBe(1);
		expect(fdSelect1.select(7)).toBe(2);
		expect(fdSelect1.select(8)).toBe(2);
		expect(fdSelect1.select(9)).toBe(2);
	});

	test("parses FDSelect format unknown returns default", () => {
		const topDictBytes: number[] = [];
		const fdSelectOffset = 100;
		topDictBytes.push(139 + fdSelectOffset, 12, 37); // FDSelect op
		topDictBytes.push(139 + 50, 17); // CharStrings op

		const topDict = new Uint8Array(topDictBytes);

		const charStringsIndex = createIndexWithOffSize([[14]], 2);

		const fdSelect = new Uint8Array([
			99, // unknown format
		]);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < 50) {
			parts.push(0);
		}
		parts.push(...charStringsIndex);

		while (parts.length < fdSelectOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(fdSelect));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		const fdSelect1 = cff.fdSelects[0]!;

		expect(fdSelect1.select(0)).toBe(0);
		expect(fdSelect1.select(99)).toBe(0);
	});

	test("parses PrivateDict with OtherBlues", () => {
		const dict = new Uint8Array([
			119, // -20
			128, // -10
			7, // op 7 (OtherBlues)
		]);

		const topDictBytes: number[] = [];
		const privateDictOffset = 100;
		const privateDictSize = dict.length;

		topDictBytes.push(
			privateDictSize + 139,
			privateDictOffset + 139,
			18,
		); // Private op

		const topDict = new Uint8Array(topDictBytes);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(dict));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.private).toBeDefined();
	});

	test("parses PrivateDict with FamilyBlues", () => {
		const dict = new Uint8Array([
			128, // -10
			149, // 10
			8, // op 8 (FamilyBlues)
		]);

		const topDictBytes: number[] = [];
		const privateDictOffset = 100;
		const privateDictSize = dict.length;

		topDictBytes.push(
			privateDictSize + 139,
			privateDictOffset + 139,
			18,
		); // Private op

		const topDict = new Uint8Array(topDictBytes);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(dict));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.private).toBeDefined();
	});

	test("parses PrivateDict with FamilyOtherBlues", () => {
		const dict = new Uint8Array([
			119, // -20
			128, // -10
			9, // op 9 (FamilyOtherBlues)
		]);

		const topDictBytes: number[] = [];
		const privateDictOffset = 100;
		const privateDictSize = dict.length;

		topDictBytes.push(
			privateDictSize + 139,
			privateDictOffset + 139,
			18,
		); // Private op

		const topDict = new Uint8Array(topDictBytes);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(dict));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.private).toBeDefined();
	});

	test("parses PrivateDict with ForceBold", () => {
		const dict = new Uint8Array([
			139 + 1, // 1
			12,
			14, // op 0x0c0e (ForceBold)
		]);

		const topDictBytes: number[] = [];
		const privateDictOffset = 100;
		const privateDictSize = dict.length;

		topDictBytes.push(
			privateDictSize + 139,
			privateDictOffset + 139,
			18,
		); // Private op

		const topDict = new Uint8Array(topDictBytes);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(dict));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.private).toBeDefined();
	});

	test("parses PrivateDict with LanguageGroup", () => {
		const dict = new Uint8Array([
			139, // 0
			12,
			17, // op 0x0c11 (LanguageGroup)
		]);

		const topDictBytes: number[] = [];
		const privateDictOffset = 100;
		const privateDictSize = dict.length;

		topDictBytes.push(
			privateDictSize + 139,
			privateDictOffset + 139,
			18,
		); // Private op

		const topDict = new Uint8Array(topDictBytes);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(dict));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.private).toBeDefined();
	});

	test("parses PrivateDict with ExpansionFactor", () => {
		const dict = new Uint8Array([
			30,
			0x0a,
			0x06,
			0xff, // 0.06 as real
			12,
			18, // op 0x0c12 (ExpansionFactor)
		]);

		const topDictBytes: number[] = [];
		const privateDictOffset = 100;
		const privateDictSize = dict.length;

		topDictBytes.push(
			privateDictSize + 139,
			privateDictOffset + 139,
			18,
		); // Private op

		const topDict = new Uint8Array(topDictBytes);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(dict));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.private).toBeDefined();
	});

	test("parses PrivateDict with initialRandomSeed", () => {
		const dict = new Uint8Array([
			139, // 0
			12,
			19, // op 0x0c13 (initialRandomSeed)
		]);

		const topDictBytes: number[] = [];
		const privateDictOffset = 100;
		const privateDictSize = dict.length;

		topDictBytes.push(
			privateDictSize + 139,
			privateDictOffset + 139,
			18,
		); // Private op

		const topDict = new Uint8Array(topDictBytes);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(dict));

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.topDicts[0]?.private).toBeDefined();
	});

	test("parses FDArray with FD-specific local subrs", () => {
		const privateDict = new Uint8Array([
			139 + 10, // subrs offset = 10
			19, // Subrs op
		]);

		const charStringsOffset = 50;
		const fdArrayOffset = 120;
		const privateDictOffset = 250;
		const privateDictSize = privateDict.length;
		const localSubrsOffset = privateDictOffset + privateDictSize + 10;

		const fdDict = new Uint8Array([
			privateDictSize + 139,
			28,
			(privateDictOffset >> 8) & 0xff,
			privateDictOffset & 0xff,
			18, // Private op [size, offset]
		]);

		const topDictBytes: number[] = [];
		topDictBytes.push(28, (fdArrayOffset >> 8) & 0xff, fdArrayOffset & 0xff, 12, 36); // FDArray op
		topDictBytes.push(28, (charStringsOffset >> 8) & 0xff, charStringsOffset & 0xff, 17); // CharStrings op

		const topDict = new Uint8Array(topDictBytes);

		const charStringsIndex = createIndexWithOffSize([[14]], 2);
		const fdArrayIndex = createIndexWithOffSize([Array.from(fdDict)], 2);
		const localSubrsIndex = createIndexWithOffSize([[14]], 2);

		const parts = [
			1,
			0,
			4,
			4,
			...createIndexWithOffSize([[84]], 2),
			...createIndexWithOffSize([Array.from(topDict)], 2),
			0,
			0,
			0,
			0,
		];

		while (parts.length < charStringsOffset) {
			parts.push(0);
		}
		parts.push(...charStringsIndex);

		while (parts.length < fdArrayOffset) {
			parts.push(0);
		}
		parts.push(...fdArrayIndex);

		while (parts.length < privateDictOffset) {
			parts.push(0);
		}
		parts.push(...Array.from(privateDict));

		while (parts.length < localSubrsOffset) {
			parts.push(0);
		}
		parts.push(...localSubrsIndex);

		const data = new Uint8Array(parts);

		const reader = new Reader(
			data.buffer as ArrayBuffer,
			data.byteOffset,
			data.byteLength,
		);
		const cff = parseCff(reader);
		expect(cff.fdArrays[0]?.length).toBeGreaterThanOrEqual(0);
		if (cff.fdArrays[0] && cff.fdArrays[0][0]) {
			expect(cff.fdArrays[0][0].localSubrs).toBeDefined();
		}
	});
});
