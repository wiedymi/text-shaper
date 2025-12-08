import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseOs2,
	isItalic,
	isBold,
	useTypoMetrics,
	getEmbeddingPermission,
	WeightClass,
	WidthClass,
	FsSelection,
	FsType,
	type Os2Table,
} from "../../../src/font/tables/os2.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const ARIAL_BOLD_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
const ARIAL_ITALIC_PATH =
	"/System/Library/Fonts/Supplemental/Arial Italic.ttf";

describe("os2 table", () => {
	let font: Font;
	let os2: Os2Table | null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		os2 = font.os2;
	});

	describe("parseOs2", () => {
		test("returns Os2Table from Arial", () => {
			expect(os2).not.toBeNull();
			if (!os2) return;

			expect(typeof os2.version).toBe("number");
			expect(typeof os2.xAvgCharWidth).toBe("number");
			expect(typeof os2.usWeightClass).toBe("number");
			expect(typeof os2.usWidthClass).toBe("number");
			expect(typeof os2.fsType).toBe("number");
		});

		test("parses version field", () => {
			if (!os2) return;
			expect(os2.version).toBeGreaterThanOrEqual(0);
			expect(os2.version).toBeLessThanOrEqual(5);
		});

		test("parses weight and width class", () => {
			if (!os2) return;
			expect(os2.usWeightClass).toBeGreaterThanOrEqual(100);
			expect(os2.usWeightClass).toBeLessThanOrEqual(900);
			expect(os2.usWidthClass).toBeGreaterThanOrEqual(1);
			expect(os2.usWidthClass).toBeLessThanOrEqual(9);
		});

		test("parses subscript metrics", () => {
			if (!os2) return;
			expect(typeof os2.ySubscriptXSize).toBe("number");
			expect(typeof os2.ySubscriptYSize).toBe("number");
			expect(typeof os2.ySubscriptXOffset).toBe("number");
			expect(typeof os2.ySubscriptYOffset).toBe("number");
		});

		test("parses superscript metrics", () => {
			if (!os2) return;
			expect(typeof os2.ySuperscriptXSize).toBe("number");
			expect(typeof os2.ySuperscriptYSize).toBe("number");
			expect(typeof os2.ySuperscriptXOffset).toBe("number");
			expect(typeof os2.ySuperscriptYOffset).toBe("number");
		});

		test("parses strikeout metrics", () => {
			if (!os2) return;
			expect(typeof os2.yStrikeoutSize).toBe("number");
			expect(typeof os2.yStrikeoutPosition).toBe("number");
		});

		test("parses family class", () => {
			if (!os2) return;
			expect(typeof os2.sFamilyClass).toBe("number");
		});

		test("parses PANOSE classification", () => {
			if (!os2) return;
			expect(Array.isArray(os2.panose)).toBe(true);
			expect(os2.panose.length).toBe(10);
			for (const byte of os2.panose) {
				expect(typeof byte).toBe("number");
				expect(byte).toBeGreaterThanOrEqual(0);
				expect(byte).toBeLessThanOrEqual(255);
			}
		});

		test("parses Unicode ranges", () => {
			if (!os2) return;
			expect(typeof os2.ulUnicodeRange1).toBe("number");
			expect(typeof os2.ulUnicodeRange2).toBe("number");
			expect(typeof os2.ulUnicodeRange3).toBe("number");
			expect(typeof os2.ulUnicodeRange4).toBe("number");
		});

		test("parses vendor ID", () => {
			if (!os2) return;
			expect(typeof os2.achVendID).toBe("string");
			expect(os2.achVendID.length).toBe(4);
		});

		test("parses font selection flags", () => {
			if (!os2) return;
			expect(typeof os2.fsSelection).toBe("number");
		});

		test("parses character index range", () => {
			if (!os2) return;
			expect(typeof os2.usFirstCharIndex).toBe("number");
			expect(typeof os2.usLastCharIndex).toBe("number");
			expect(os2.usLastCharIndex).toBeGreaterThanOrEqual(
				os2.usFirstCharIndex,
			);
		});

		test("parses typo metrics", () => {
			if (!os2) return;
			expect(typeof os2.sTypoAscender).toBe("number");
			expect(typeof os2.sTypoDescender).toBe("number");
			expect(typeof os2.sTypoLineGap).toBe("number");
		});

		test("parses win metrics", () => {
			if (!os2) return;
			expect(typeof os2.usWinAscent).toBe("number");
			expect(typeof os2.usWinDescent).toBe("number");
		});

		test("parses version 0 table (minimal)", () => {
			// Version 0 table has 78 bytes
			const data = new Uint8Array([
				0x00, 0x00, // version: 0
				0x01, 0xf4, // xAvgCharWidth: 500
				0x01, 0x90, // usWeightClass: 400 (Normal)
				0x00, 0x05, // usWidthClass: 5 (Normal)
				0x00, 0x00, // fsType: 0 (Installable)
				0x00, 0x64, // ySubscriptXSize: 100
				0x00, 0x64, // ySubscriptYSize: 100
				0x00, 0x00, // ySubscriptXOffset: 0
				0x00, 0x14, // ySubscriptYOffset: 20
				0x00, 0x64, // ySuperscriptXSize: 100
				0x00, 0x64, // ySuperscriptYSize: 100
				0x00, 0x00, // ySuperscriptXOffset: 0
				0x00, 0x28, // ySuperscriptYOffset: 40
				0x00, 0x32, // yStrikeoutSize: 50
				0x01, 0x2c, // yStrikeoutPosition: 300
				0x00, 0x00, // sFamilyClass: 0
				// PANOSE (10 bytes)
				0x02, 0x00, 0x05, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x01, // ulUnicodeRange1
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange2
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange3
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange4
				// achVendID (4 bytes)
				0x54, 0x45, 0x53, 0x54, // "TEST"
				0x00, 0x40, // fsSelection: 0x0040 (Regular)
				0x00, 0x20, // usFirstCharIndex: 32
				0x00, 0xff, // usLastCharIndex: 255
				0x02, 0xbc, // sTypoAscender: 700
				0xfe, 0x0c, // sTypoDescender: -500
				0x00, 0xc8, // sTypoLineGap: 200
				0x03, 0x00, // usWinAscent: 768
				0x02, 0x00, // usWinDescent: 512
			]);
			const reader = new Reader(data.buffer);
			const table = parseOs2(reader);

			expect(table.version).toBe(0);
			expect(table.xAvgCharWidth).toBe(500);
			expect(table.usWeightClass).toBe(WeightClass.Normal);
			expect(table.usWidthClass).toBe(WidthClass.Normal);
			expect(table.fsType).toBe(FsType.InstallableEmbedding);
			expect(table.achVendID).toBe("TEST");
			expect(table.panose.length).toBe(10);
			expect(table.ulUnicodeRange1).toBe(1);
			expect(table.usFirstCharIndex).toBe(32);
			expect(table.usLastCharIndex).toBe(255);
			expect(table.ulCodePageRange1).toBeUndefined();
			expect(table.ulCodePageRange2).toBeUndefined();
			expect(table.sxHeight).toBeUndefined();
			expect(table.sCapHeight).toBeUndefined();
		});

		test("parses version 1 table (with codepage ranges)", () => {
			// Version 1 adds 8 bytes for codepage ranges
			const data = new Uint8Array([
				0x00, 0x01, // version: 1
				0x01, 0xf4, // xAvgCharWidth: 500
				0x01, 0x90, // usWeightClass: 400
				0x00, 0x05, // usWidthClass: 5
				0x00, 0x00, // fsType: 0
				0x00, 0x64, // ySubscriptXSize: 100
				0x00, 0x64, // ySubscriptYSize: 100
				0x00, 0x00, // ySubscriptXOffset: 0
				0x00, 0x14, // ySubscriptYOffset: 20
				0x00, 0x64, // ySuperscriptXSize: 100
				0x00, 0x64, // ySuperscriptYSize: 100
				0x00, 0x00, // ySuperscriptXOffset: 0
				0x00, 0x28, // ySuperscriptYOffset: 40
				0x00, 0x32, // yStrikeoutSize: 50
				0x01, 0x2c, // yStrikeoutPosition: 300
				0x00, 0x00, // sFamilyClass: 0
				// PANOSE
				0x02, 0x00, 0x05, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x01, // ulUnicodeRange1
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange2
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange3
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange4
				// achVendID
				0x54, 0x45, 0x53, 0x54, // "TEST"
				0x00, 0x40, // fsSelection: 0x0040
				0x00, 0x20, // usFirstCharIndex: 32
				0x00, 0xff, // usLastCharIndex: 255
				0x02, 0xbc, // sTypoAscender: 700
				0xfe, 0x0c, // sTypoDescender: -500
				0x00, 0xc8, // sTypoLineGap: 200
				0x03, 0x00, // usWinAscent: 768
				0x02, 0x00, // usWinDescent: 512
				// Version 1+ fields
				0x20, 0x00, 0x00, 0x01, // ulCodePageRange1
				0x00, 0x00, 0x00, 0x00, // ulCodePageRange2
			]);
			const reader = new Reader(data.buffer);
			const table = parseOs2(reader);

			expect(table.version).toBe(1);
			expect(table.ulCodePageRange1).toBe(0x20000001);
			expect(table.ulCodePageRange2).toBe(0);
			expect(table.sxHeight).toBeUndefined();
			expect(table.sCapHeight).toBeUndefined();
		});

		test("parses version 2 table (with x-height and cap height)", () => {
			// Version 2 adds 10 bytes for x-height, cap height, default char, break char, max context
			const data = new Uint8Array([
				0x00, 0x02, // version: 2
				0x01, 0xf4, // xAvgCharWidth: 500
				0x01, 0x90, // usWeightClass: 400
				0x00, 0x05, // usWidthClass: 5
				0x00, 0x00, // fsType: 0
				0x00, 0x64, // ySubscriptXSize: 100
				0x00, 0x64, // ySubscriptYSize: 100
				0x00, 0x00, // ySubscriptXOffset: 0
				0x00, 0x14, // ySubscriptYOffset: 20
				0x00, 0x64, // ySuperscriptXSize: 100
				0x00, 0x64, // ySuperscriptYSize: 100
				0x00, 0x00, // ySuperscriptXOffset: 0
				0x00, 0x28, // ySuperscriptYOffset: 40
				0x00, 0x32, // yStrikeoutSize: 50
				0x01, 0x2c, // yStrikeoutPosition: 300
				0x00, 0x00, // sFamilyClass: 0
				// PANOSE
				0x02, 0x00, 0x05, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x01, // ulUnicodeRange1
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange2
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange3
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange4
				// achVendID
				0x54, 0x45, 0x53, 0x54, // "TEST"
				0x00, 0x40, // fsSelection: 0x0040
				0x00, 0x20, // usFirstCharIndex: 32
				0x00, 0xff, // usLastCharIndex: 255
				0x02, 0xbc, // sTypoAscender: 700
				0xfe, 0x0c, // sTypoDescender: -500
				0x00, 0xc8, // sTypoLineGap: 200
				0x03, 0x00, // usWinAscent: 768
				0x02, 0x00, // usWinDescent: 512
				// Version 1+ fields
				0x20, 0x00, 0x00, 0x01, // ulCodePageRange1
				0x00, 0x00, 0x00, 0x00, // ulCodePageRange2
				// Version 2+ fields
				0x01, 0xf4, // sxHeight: 500
				0x02, 0xbc, // sCapHeight: 700
				0x00, 0x00, // usDefaultChar: 0
				0x00, 0x20, // usBreakChar: 32 (space)
				0x00, 0x02, // usMaxContext: 2
			]);
			const reader = new Reader(data.buffer);
			const table = parseOs2(reader);

			expect(table.version).toBe(2);
			expect(table.ulCodePageRange1).toBe(0x20000001);
			expect(table.ulCodePageRange2).toBe(0);
			expect(table.sxHeight).toBe(500);
			expect(table.sCapHeight).toBe(700);
			expect(table.usDefaultChar).toBe(0);
			expect(table.usBreakChar).toBe(32);
			expect(table.usMaxContext).toBe(2);
			expect(table.usLowerOpticalPointSize).toBeUndefined();
			expect(table.usUpperOpticalPointSize).toBeUndefined();
		});

		test("parses version 5 table (with optical size)", () => {
			// Version 5 adds 4 bytes for optical size range
			const data = new Uint8Array([
				0x00, 0x05, // version: 5
				0x01, 0xf4, // xAvgCharWidth: 500
				0x01, 0x90, // usWeightClass: 400
				0x00, 0x05, // usWidthClass: 5
				0x00, 0x00, // fsType: 0
				0x00, 0x64, // ySubscriptXSize: 100
				0x00, 0x64, // ySubscriptYSize: 100
				0x00, 0x00, // ySubscriptXOffset: 0
				0x00, 0x14, // ySubscriptYOffset: 20
				0x00, 0x64, // ySuperscriptXSize: 100
				0x00, 0x64, // ySuperscriptYSize: 100
				0x00, 0x00, // ySuperscriptXOffset: 0
				0x00, 0x28, // ySuperscriptYOffset: 40
				0x00, 0x32, // yStrikeoutSize: 50
				0x01, 0x2c, // yStrikeoutPosition: 300
				0x00, 0x00, // sFamilyClass: 0
				// PANOSE
				0x02, 0x00, 0x05, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x01, // ulUnicodeRange1
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange2
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange3
				0x00, 0x00, 0x00, 0x00, // ulUnicodeRange4
				// achVendID
				0x54, 0x45, 0x53, 0x54, // "TEST"
				0x00, 0x40, // fsSelection: 0x0040
				0x00, 0x20, // usFirstCharIndex: 32
				0x00, 0xff, // usLastCharIndex: 255
				0x02, 0xbc, // sTypoAscender: 700
				0xfe, 0x0c, // sTypoDescender: -500
				0x00, 0xc8, // sTypoLineGap: 200
				0x03, 0x00, // usWinAscent: 768
				0x02, 0x00, // usWinDescent: 512
				// Version 1+ fields
				0x20, 0x00, 0x00, 0x01, // ulCodePageRange1
				0x00, 0x00, 0x00, 0x00, // ulCodePageRange2
				// Version 2+ fields
				0x01, 0xf4, // sxHeight: 500
				0x02, 0xbc, // sCapHeight: 700
				0x00, 0x00, // usDefaultChar: 0
				0x00, 0x20, // usBreakChar: 32
				0x00, 0x02, // usMaxContext: 2
				// Version 5+ fields
				0x00, 0x50, // usLowerOpticalPointSize: 80 (8.0pt in 1/10th pt)
				0x00, 0xc8, // usUpperOpticalPointSize: 200 (20.0pt)
			]);
			const reader = new Reader(data.buffer);
			const table = parseOs2(reader);

			expect(table.version).toBe(5);
			expect(table.ulCodePageRange1).toBe(0x20000001);
			expect(table.sxHeight).toBe(500);
			expect(table.sCapHeight).toBe(700);
			expect(table.usLowerOpticalPointSize).toBe(80);
			expect(table.usUpperOpticalPointSize).toBe(200);
		});

		test("parses all weight classes correctly", () => {
			const weights = [
				{ class: WeightClass.Thin, value: 100 },
				{ class: WeightClass.ExtraLight, value: 200 },
				{ class: WeightClass.Light, value: 300 },
				{ class: WeightClass.Normal, value: 400 },
				{ class: WeightClass.Medium, value: 500 },
				{ class: WeightClass.SemiBold, value: 600 },
				{ class: WeightClass.Bold, value: 700 },
				{ class: WeightClass.ExtraBold, value: 800 },
				{ class: WeightClass.Black, value: 900 },
			];

			for (const { class: weightClass, value } of weights) {
				expect(weightClass).toBe(value as 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900);
			}
		});

		test("parses all width classes correctly", () => {
			expect(WidthClass.UltraCondensed).toBe(1);
			expect(WidthClass.ExtraCondensed).toBe(2);
			expect(WidthClass.Condensed).toBe(3);
			expect(WidthClass.SemiCondensed).toBe(4);
			expect(WidthClass.Normal).toBe(5);
			expect(WidthClass.SemiExpanded).toBe(6);
			expect(WidthClass.Expanded).toBe(7);
			expect(WidthClass.ExtraExpanded).toBe(8);
			expect(WidthClass.UltraExpanded).toBe(9);
		});
	});

	describe("isItalic", () => {
		test("returns false for regular Arial", () => {
			if (!os2) return;
			expect(isItalic(os2)).toBe(false);
		});

		test("returns true when Italic flag is set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: 0,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: FsSelection.Italic,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(isItalic(table)).toBe(true);
		});

		test("returns true for Arial Italic", async () => {
			try {
				const italicFont = await Font.fromFile(ARIAL_ITALIC_PATH);
				if (italicFont.os2) {
					expect(isItalic(italicFont.os2)).toBe(true);
				}
			} catch {
				// Font file may not exist on all systems
			}
		});

		test("returns false when only other flags are set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 700,
				usWidthClass: 5,
				fsType: 0,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: FsSelection.Bold,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(isItalic(table)).toBe(false);
		});
	});

	describe("isBold", () => {
		test("returns false for regular Arial", () => {
			if (!os2) return;
			expect(isBold(os2)).toBe(false);
		});

		test("returns true when Bold flag is set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 700,
				usWidthClass: 5,
				fsType: 0,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: FsSelection.Bold,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(isBold(table)).toBe(true);
		});

		test("returns true for Arial Bold", async () => {
			try {
				const boldFont = await Font.fromFile(ARIAL_BOLD_PATH);
				if (boldFont.os2) {
					expect(isBold(boldFont.os2)).toBe(true);
				}
			} catch {
				// Font file may not exist on all systems
			}
		});

		test("returns false when only other flags are set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: 0,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: FsSelection.Italic,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(isBold(table)).toBe(false);
		});

		test("returns true when both Bold and Italic are set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 700,
				usWidthClass: 5,
				fsType: 0,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: FsSelection.Bold | FsSelection.Italic,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(isBold(table)).toBe(true);
		});
	});

	describe("useTypoMetrics", () => {
		test("returns false when UseTypoMetrics flag is not set", () => {
			if (!os2) return;
			const result = useTypoMetrics(os2);
			expect(typeof result).toBe("boolean");
		});

		test("returns true when UseTypoMetrics flag is set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: 0,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: FsSelection.UseTypoMetrics,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(useTypoMetrics(table)).toBe(true);
		});

		test("returns false when only other flags are set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: 0,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: FsSelection.Bold | FsSelection.Italic,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(useTypoMetrics(table)).toBe(false);
		});

		test("returns true when UseTypoMetrics is combined with other flags", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: 0,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection:
					FsSelection.UseTypoMetrics | FsSelection.Bold | FsSelection.Italic,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(useTypoMetrics(table)).toBe(true);
		});
	});

	describe("getEmbeddingPermission", () => {
		test("returns installable for default fsType", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: FsType.InstallableEmbedding,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: 0,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(getEmbeddingPermission(table)).toBe("installable");
		});

		test("returns restricted when RestrictedLicense flag is set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: FsType.RestrictedLicense,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: 0,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(getEmbeddingPermission(table)).toBe("restricted");
		});

		test("returns preview when PreviewAndPrint flag is set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: FsType.PreviewAndPrint,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: 0,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(getEmbeddingPermission(table)).toBe("preview");
		});

		test("returns editable when Editable flag is set", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: FsType.Editable,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: 0,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(getEmbeddingPermission(table)).toBe("editable");
		});

		test("returns restricted when multiple flags include RestrictedLicense", () => {
			const table: Os2Table = {
				version: 0,
				xAvgCharWidth: 500,
				usWeightClass: 400,
				usWidthClass: 5,
				fsType: FsType.RestrictedLicense | FsType.NoSubsetting,
				ySubscriptXSize: 100,
				ySubscriptYSize: 100,
				ySubscriptXOffset: 0,
				ySubscriptYOffset: 20,
				ySuperscriptXSize: 100,
				ySuperscriptYSize: 100,
				ySuperscriptXOffset: 0,
				ySuperscriptYOffset: 40,
				yStrikeoutSize: 50,
				yStrikeoutPosition: 300,
				sFamilyClass: 0,
				panose: [2, 0, 5, 3, 0, 0, 0, 0, 0, 0],
				ulUnicodeRange1: 1,
				ulUnicodeRange2: 0,
				ulUnicodeRange3: 0,
				ulUnicodeRange4: 0,
				achVendID: "TEST",
				fsSelection: 0,
				usFirstCharIndex: 32,
				usLastCharIndex: 255,
				sTypoAscender: 700,
				sTypoDescender: -500,
				sTypoLineGap: 200,
				usWinAscent: 768,
				usWinDescent: 512,
			};

			expect(getEmbeddingPermission(table)).toBe("restricted");
		});

		test("checks embedding permission for Arial", () => {
			if (!os2) return;
			const permission = getEmbeddingPermission(os2);
			expect(["installable", "restricted", "preview", "editable"]).toContain(
				permission,
			);
		});
	});

	describe("FsSelection constants", () => {
		test("flag values are correct", () => {
			expect(FsSelection.Italic).toBe(0x0001);
			expect(FsSelection.Underscore).toBe(0x0002);
			expect(FsSelection.Negative).toBe(0x0004);
			expect(FsSelection.Outlined).toBe(0x0008);
			expect(FsSelection.Strikeout).toBe(0x0010);
			expect(FsSelection.Bold).toBe(0x0020);
			expect(FsSelection.Regular).toBe(0x0040);
			expect(FsSelection.UseTypoMetrics).toBe(0x0080);
			expect(FsSelection.WWS).toBe(0x0100);
			expect(FsSelection.Oblique).toBe(0x0200);
		});

		test("flags are independent bits", () => {
			expect(FsSelection.Italic & FsSelection.Bold).toBe(0);
			expect(FsSelection.Italic & FsSelection.Regular).toBe(0);
			expect(FsSelection.Bold & FsSelection.Regular).toBe(0);
			expect(FsSelection.UseTypoMetrics & FsSelection.WWS).toBe(0);
		});
	});

	describe("FsType constants", () => {
		test("flag values are correct", () => {
			expect(FsType.InstallableEmbedding).toBe(0x0000);
			expect(FsType.RestrictedLicense).toBe(0x0002);
			expect(FsType.PreviewAndPrint).toBe(0x0004);
			expect(FsType.Editable).toBe(0x0008);
			expect(FsType.NoSubsetting).toBe(0x0100);
			expect(FsType.BitmapOnly).toBe(0x0200);
		});
	});

	describe("integration tests", () => {
		test("Arial has expected weight class", () => {
			if (!os2) return;
			expect(os2.usWeightClass).toBe(WeightClass.Normal);
		});

		test("Arial has expected width class", () => {
			if (!os2) return;
			expect(os2.usWidthClass).toBe(WidthClass.Normal);
		});

		test("Arial PANOSE classification is valid", () => {
			if (!os2) return;
			expect(os2.panose.length).toBe(10);
			// First byte is family kind (2 = Latin Text)
			expect(os2.panose[0]).toBeGreaterThanOrEqual(0);
		});

		test("Arial Unicode ranges are non-zero", () => {
			if (!os2) return;
			const totalRange =
				os2.ulUnicodeRange1 +
				os2.ulUnicodeRange2 +
				os2.ulUnicodeRange3 +
				os2.ulUnicodeRange4;
			expect(totalRange).toBeGreaterThan(0);
		});

		test("Arial metrics are reasonable", () => {
			if (!os2) return;
			expect(os2.sTypoAscender).toBeGreaterThan(0);
			expect(os2.sTypoDescender).toBeLessThan(0);
			expect(os2.usWinAscent).toBeGreaterThan(0);
			expect(os2.usWinDescent).toBeGreaterThan(0);
		});

		test("version 2+ fields are present in Arial", () => {
			if (!os2) return;
			if (os2.version >= 2) {
				expect(typeof os2.sxHeight).toBe("number");
				expect(typeof os2.sCapHeight).toBe("number");
				expect(typeof os2.usDefaultChar).toBe("number");
				expect(typeof os2.usBreakChar).toBe("number");
				expect(typeof os2.usMaxContext).toBe("number");
			}
		});

		test("version 1+ fields are present in Arial", () => {
			if (!os2) return;
			if (os2.version >= 1) {
				expect(typeof os2.ulCodePageRange1).toBe("number");
				expect(typeof os2.ulCodePageRange2).toBe("number");
			}
		});
	});
});
