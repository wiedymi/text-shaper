import { describe, expect, test } from "bun:test";
import {
	parseBase,
	BaselineTag,
	getBaselineForScript,
	getDefaultBaseline,
	getMinMaxExtent,
	type BaseTable,
} from "../../../src/font/tables/base.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

describe("BASE table", () => {
	describe("parseBase - basic structure", () => {
		test("parses minimal BASE table with no axis data", () => {
			const buffer = new ArrayBuffer(8);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false); // majorVersion
			view.setUint16(2, 0, false); // minorVersion
			view.setUint16(4, 0, false); // horizAxisOffset (null)
			view.setUint16(6, 0, false); // vertAxisOffset (null)

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.majorVersion).toBe(1);
			expect(base.minorVersion).toBe(0);
			expect(base.horizAxis).toBeNull();
			expect(base.vertAxis).toBeNull();
		});

		test("parses BASE table version 1.1", () => {
			const buffer = new ArrayBuffer(8);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 1, false);
			view.setUint16(4, 0, false);
			view.setUint16(6, 0, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.majorVersion).toBe(1);
			expect(base.minorVersion).toBe(1);
		});

		test("parses BASE table with horizontal axis only", () => {
			const buffer = new ArrayBuffer(20);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false); // horizAxisOffset
			view.setUint16(6, 0, false);

			// Horizontal Axis Table at offset 8
			view.setUint16(8, 0, false); // baseTagListOffset (null)
			view.setUint16(10, 0, false); // baseScriptListOffset (null)

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis).not.toBeNull();
			expect(base.vertAxis).toBeNull();
			expect(base.horizAxis?.baseTagList).toEqual([]);
			expect(base.horizAxis?.baseScriptList).toEqual([]);
		});

		test("parses BASE table with vertical axis only", () => {
			const buffer = new ArrayBuffer(20);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 0, false);
			view.setUint16(6, 8, false); // vertAxisOffset

			// Vertical Axis Table at offset 8
			view.setUint16(8, 0, false);
			view.setUint16(10, 0, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis).toBeNull();
			expect(base.vertAxis).not.toBeNull();
		});

		test("parses BASE table with both axes", () => {
			const buffer = new ArrayBuffer(30);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false); // horizAxisOffset
			view.setUint16(6, 12, false); // vertAxisOffset

			// Horizontal Axis at offset 8
			view.setUint16(8, 0, false);
			view.setUint16(10, 0, false);

			// Vertical Axis at offset 12
			view.setUint16(12, 0, false);
			view.setUint16(14, 0, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis).not.toBeNull();
			expect(base.vertAxis).not.toBeNull();
		});
	});

	describe("AxisTable - baseline tags", () => {
		test("parses base tag list", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false); // horizAxisOffset
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false); // baseTagListOffset (relative to 8, so absolute 12)
			view.setUint16(10, 0, false); // no script list

			// Base tag list at offset 12
			view.setUint16(12, 3, false); // baseTagCount
			view.setUint32(14, BaselineTag.romn, false);
			view.setUint32(18, BaselineTag.ideo, false);
			view.setUint32(22, BaselineTag.hang, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis?.baseTagList).toEqual([
				BaselineTag.romn,
				BaselineTag.ideo,
				BaselineTag.hang,
			]);
		});

		test("parses empty base tag list", () => {
			const buffer = new ArrayBuffer(50);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false); // baseTagListOffset
			view.setUint16(10, 0, false);

			// Base tag list at offset 12
			view.setUint16(12, 0, false); // baseTagCount = 0

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis?.baseTagList).toEqual([]);
		});

		test("parses all standard baseline tags", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 0, false);

			// All 7 baseline tags at offset 12
			view.setUint16(12, 7, false);
			view.setUint32(14, BaselineTag.romn, false);
			view.setUint32(18, BaselineTag.ideo, false);
			view.setUint32(22, BaselineTag.icfb, false);
			view.setUint32(26, BaselineTag.icft, false);
			view.setUint32(30, BaselineTag.idtp, false);
			view.setUint32(34, BaselineTag.hang, false);
			view.setUint32(38, BaselineTag.math, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis?.baseTagList.length).toBe(7);
			expect(base.horizAxis?.baseTagList).toContain(BaselineTag.romn);
			expect(base.horizAxis?.baseTagList).toContain(BaselineTag.math);
			expect(base.horizAxis?.baseTagList).toContain(BaselineTag.hang);
		});
	});

	describe("BaseScriptRecord - base values", () => {
		test("parses script record with base values and BaseCoord format 1", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			// BASE header (offset 0-7)
			view.setUint16(0, 1, false); // majorVersion
			view.setUint16(2, 0, false); // minorVersion
			view.setUint16(4, 8, false); // horizAxisOffset
			view.setUint16(6, 0, false); // vertAxisOffset

			// Axis table at 8 (offset 8-11)
			view.setUint16(8, 4, false); // baseTagListOffset (8 + 4 = 12)
			view.setUint16(10, 12, false); // baseScriptListOffset (8 + 12 = 20)

			// Base tag list at 12 (offset 12-21)
			view.setUint16(12, 2, false); // baseTagCount
			view.setUint32(14, BaselineTag.romn, false);
			view.setUint32(18, BaselineTag.ideo, false);

			// Base script list at 20 (offset 20-27)
			view.setUint16(20, 1, false); // baseScriptCount = 1
			// Script record: tag(4) + offset(2) = 6 bytes
			view.setUint32(22, 0x6c61746e, false); // scriptTag 'latn'
			view.setUint16(26, 8, false); // script table offset (20 + 8 = 28)

			// Base script table at 28 (offset 28-33)
			view.setUint16(28, 6, false); // baseValuesOffset (28 + 6 = 34)
			view.setUint16(30, 0, false); // defaultMinMaxOffset = 0
			view.setUint16(32, 0, false); // baseLangSysCount = 0

			// BaseValues at 34 (offset 34-41)
			view.setUint16(34, 0, false); // defaultBaselineIndex
			view.setUint16(36, 2, false); // baseCoordCount = 2
			view.setUint16(38, 6, false); // coord1 offset (34 + 6 = 40)
			view.setUint16(40, 10, false); // coord2 offset (34 + 10 = 44)

			// BaseCoord 1 at 40 (format 1 = 4 bytes)
			view.setUint16(40, 1, false); // format
			view.setInt16(42, 0, false); // coordinate

			// BaseCoord 2 at 44 (format 1 = 4 bytes)
			view.setUint16(44, 1, false); // format
			view.setInt16(46, -120, false); // coordinate

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis?.baseScriptList.length).toBe(1);
			const script = base.horizAxis?.baseScriptList[0];
			expect(script?.scriptTag).toBe(0x6c61746e);
			expect(script?.baseValues?.defaultBaselineIndex).toBe(0);
			expect(script?.baseValues?.baseCoords).toEqual([0, -120]);
		});

		test("parses BaseCoord format 2 with reference glyph", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 6, false); // baseValuesOffset -> 32
			view.setUint16(28, 0, false);
			view.setUint16(30, 0, false);

			// BaseValues at 32
			view.setUint16(32, 0, false);
			view.setUint16(34, 1, false); // 1 coord
			view.setUint16(36, 6, false); // coord offset -> 38

			// BaseCoord format 2 at 38
			view.setUint16(38, 2, false); // format
			view.setInt16(40, 150, false); // coordinate
			view.setUint16(42, 42, false); // referenceGlyph
			view.setUint16(44, 5, false); // baseCoordPoint

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords).toEqual([150]);
		});

		test("parses BaseCoord format 3 with device table", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 6, false);
			view.setUint16(28, 0, false);
			view.setUint16(30, 0, false);

			// BaseValues at 32
			view.setUint16(32, 0, false);
			view.setUint16(34, 1, false);
			view.setUint16(36, 6, false);

			// BaseCoord format 3 at 38
			view.setUint16(38, 3, false); // format
			view.setInt16(40, 200, false); // coordinate
			view.setUint16(42, 10, false); // deviceOffset

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords).toEqual([200]);
		});

		test("handles zero offset for base coord (defaults to 0)", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 6, false);
			view.setUint16(28, 0, false);
			view.setUint16(30, 0, false);

			// BaseValues at 32
			view.setUint16(32, 0, false);
			view.setUint16(34, 2, false); // 2 coords
			view.setUint16(36, 0, false); // offset = 0 (null) -> defaults to 0
			view.setUint16(38, 8, false); // offset -> 40

			// BaseCoord at 40
			view.setUint16(40, 1, false);
			view.setInt16(42, 50, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords).toEqual([0, 50]);
		});

		test("parses script with null base values", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 0, false); // baseValuesOffset = 0 (null)
			view.setUint16(28, 0, false);
			view.setUint16(30, 0, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis?.baseScriptList[0]?.baseValues).toBeNull();
		});
	});

	describe("MinMax records", () => {
		test("parses default MinMax", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 0, false); // no baseValues
			view.setUint16(28, 6, false); // defaultMinMaxOffset -> 32
			view.setUint16(30, 0, false);

			// MinMax at 32
			view.setUint16(32, 6, false); // minCoordOffset -> 38
			view.setUint16(34, 10, false); // maxCoordOffset -> 42
			view.setUint16(36, 0, false); // no features

			// BaseCoord for min at 38
			view.setUint16(38, 1, false);
			view.setInt16(40, -200, false);

			// BaseCoord for max at 42
			view.setUint16(42, 1, false);
			view.setInt16(44, 800, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const minMax = base.horizAxis?.baseScriptList[0]?.defaultMinMax;
			expect(minMax?.minCoord).toBe(-200);
			expect(minMax?.maxCoord).toBe(800);
			expect(minMax?.featMinMaxRecords).toEqual([]);
		});

		test("parses MinMax with null min/max coords", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 0, false);
			view.setUint16(28, 6, false);
			view.setUint16(30, 0, false);

			// MinMax at 32
			view.setUint16(32, 0, false); // minCoordOffset = 0 (null)
			view.setUint16(34, 0, false); // maxCoordOffset = 0 (null)
			view.setUint16(36, 0, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const minMax = base.horizAxis?.baseScriptList[0]?.defaultMinMax;
			expect(minMax?.minCoord).toBeNull();
			expect(minMax?.maxCoord).toBeNull();
		});

		test("parses MinMax with feature-specific records", () => {
			const buffer = new ArrayBuffer(150);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 0, false);
			view.setUint16(28, 6, false); // minMaxOffset -> 32
			view.setUint16(30, 0, false);

			// MinMax at 32
			view.setUint16(32, 0, false); // no default min
			view.setUint16(34, 0, false); // no default max
			view.setUint16(36, 2, false); // 2 feature records

			// Feature 1: 'smcp'
			view.setUint32(38, 0x736d6370, false);
			view.setUint16(42, 20, false); // minOffset -> 52
			view.setUint16(44, 24, false); // maxOffset -> 56

			// Feature 2: 'c2sc'
			view.setUint32(46, 0x63327363, false);
			view.setUint16(50, 28, false); // minOffset -> 60
			view.setUint16(52, 0, false); // maxOffset = 0 (null)

			// BaseCoord at 52
			view.setUint16(52, 1, false);
			view.setInt16(54, -50, false);

			// BaseCoord at 56
			view.setUint16(56, 1, false);
			view.setInt16(58, 750, false);

			// BaseCoord at 60
			view.setUint16(60, 1, false);
			view.setInt16(62, -100, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const minMax = base.horizAxis?.baseScriptList[0]?.defaultMinMax;
			expect(minMax?.featMinMaxRecords.length).toBe(2);
			expect(minMax?.featMinMaxRecords[0]?.featureTag).toBe(0x736d6370);
			expect(minMax?.featMinMaxRecords[0]?.minCoord).toBe(-50);
			expect(minMax?.featMinMaxRecords[0]?.maxCoord).toBe(750);
			expect(minMax?.featMinMaxRecords[1]?.featureTag).toBe(0x63327363);
			expect(minMax?.featMinMaxRecords[1]?.minCoord).toBe(-100);
			expect(minMax?.featMinMaxRecords[1]?.maxCoord).toBeNull();
		});

		test("returns null for zero MinMax offset", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 0, false);
			view.setUint16(28, 0, false); // defaultMinMaxOffset = 0 (null)
			view.setUint16(30, 0, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis?.baseScriptList[0]?.defaultMinMax).toBeNull();
		});
	});

	describe("BaseLangSysRecords", () => {
		test("parses language-specific MinMax records", () => {
			const buffer = new ArrayBuffer(150);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 0, false);
			view.setUint16(28, 0, false);
			view.setUint16(30, 2, false); // 2 langSys records

			// LangSys 1: 'DEU '
			view.setUint32(32, 0x44455520, false);
			view.setUint16(36, 16, false); // minMaxOffset -> 42

			// LangSys 2: 'FRA '
			view.setUint32(38, 0x46524120, false);
			view.setUint16(42, 28, false); // minMaxOffset -> 54

			// MinMax for DEU at 42
			view.setUint16(42, 6, false); // minOffset -> 48
			view.setUint16(44, 10, false); // maxOffset -> 52
			view.setUint16(46, 0, false);

			// BaseCoord at 48
			view.setUint16(48, 1, false);
			view.setInt16(50, -150, false);

			// BaseCoord at 52
			view.setUint16(52, 1, false);
			view.setInt16(54, 850, false);

			// MinMax for FRA at 54
			view.setUint16(54, 6, false); // minOffset -> 60
			view.setUint16(56, 0, false); // no max
			view.setUint16(58, 0, false);

			// BaseCoord at 60
			view.setUint16(60, 1, false);
			view.setInt16(62, -180, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const script = base.horizAxis?.baseScriptList[0];
			expect(script?.baseLangSysRecords.size).toBe(2);

			const deu = script?.baseLangSysRecords.get(0x44455520);
			expect(deu?.minCoord).toBe(-150);
			expect(deu?.maxCoord).toBe(850);

			const fra = script?.baseLangSysRecords.get(0x46524120);
			expect(fra?.minCoord).toBe(-180);
			expect(fra?.maxCoord).toBeNull();
		});

		test("ignores null language MinMax offsets", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 0, false);
			view.setUint16(28, 0, false);
			view.setUint16(30, 1, false); // 1 langSys

			// LangSys with null MinMax
			view.setUint32(32, 0x44455520, false);
			view.setUint16(36, 0, false); // minMaxOffset = 0 (null)

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const script = base.horizAxis?.baseScriptList[0];
			expect(script?.baseLangSysRecords.size).toBe(0);
		});
	});

	describe("Multiple scripts", () => {
		test("parses multiple script records", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 20, false); // scriptListOffset -> 28

			// Base tag list at 12
			view.setUint16(12, 2, false);
			view.setUint32(14, BaselineTag.romn, false);
			view.setUint32(18, BaselineTag.ideo, false);

			// Base script list at 28
			view.setUint16(28, 3, false); // 3 scripts

			// Script 1: 'latn'
			view.setUint32(30, 0x6c61746e, false);
			view.setUint16(34, 18, false); // offset -> 46

			// Script 2: 'cyrl'
			view.setUint32(36, 0x6379726c, false);
			view.setUint16(40, 24, false); // offset -> 52

			// Script 3: 'hani'
			view.setUint32(42, 0x68616e69, false);
			view.setUint16(46, 30, false); // offset -> 58

			// Script table 1 at 46
			view.setUint16(46, 0, false);
			view.setUint16(48, 0, false);
			view.setUint16(50, 0, false);

			// Script table 2 at 52
			view.setUint16(52, 0, false);
			view.setUint16(54, 0, false);
			view.setUint16(56, 0, false);

			// Script table 3 at 58
			view.setUint16(58, 0, false);
			view.setUint16(60, 0, false);
			view.setUint16(62, 0, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis?.baseScriptList.length).toBe(3);
			expect(base.horizAxis?.baseScriptList[0]?.scriptTag).toBe(0x6c61746e);
			expect(base.horizAxis?.baseScriptList[1]?.scriptTag).toBe(0x6379726c);
			expect(base.horizAxis?.baseScriptList[2]?.scriptTag).toBe(0x68616e69);
		});

		test("handles empty script list", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 16, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			// Script list at 24
			view.setUint16(24, 0, false); // 0 scripts

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			expect(base.horizAxis?.baseScriptList).toEqual([]);
		});
	});

	describe("getBaselineForScript", () => {
		test("returns baseline coordinate for script", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn, BaselineTag.ideo],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: {
								defaultBaselineIndex: 0,
								baseCoords: [0, -120],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const value = getBaselineForScript(base, 0x6c61746e, BaselineTag.ideo, true);
			expect(value).toBe(-120);
		});

		test("returns null for non-existent script", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: {
								defaultBaselineIndex: 0,
								baseCoords: [0],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const value = getBaselineForScript(base, 0x61726162, BaselineTag.romn, true);
			expect(value).toBeNull();
		});

		test("returns null for non-existent baseline tag", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: {
								defaultBaselineIndex: 0,
								baseCoords: [0],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const value = getBaselineForScript(base, 0x6c61746e, BaselineTag.hang, true);
			expect(value).toBeNull();
		});

		test("returns null when script has no base values", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: null,
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const value = getBaselineForScript(base, 0x6c61746e, BaselineTag.romn, true);
			expect(value).toBeNull();
		});

		test("returns null when axis is null", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: null,
				vertAxis: null,
			};

			const value = getBaselineForScript(base, 0x6c61746e, BaselineTag.romn, true);
			expect(value).toBeNull();
		});

		test("queries vertical axis when horizontal=false", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: null,
				vertAxis: {
					baseTagList: [BaselineTag.ideo],
					baseScriptList: [
						{
							scriptTag: 0x68616e69,
							baseValues: {
								defaultBaselineIndex: 0,
								baseCoords: [-250],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
			};

			const value = getBaselineForScript(base, 0x68616e69, BaselineTag.ideo, false);
			expect(value).toBe(-250);
		});

		test("returns null when baseline index out of range", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: {
								defaultBaselineIndex: 0,
								baseCoords: [0],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const value = getBaselineForScript(base, 0x6c61746e, 0x12345678, true);
			expect(value).toBeNull();
		});
	});

	describe("getDefaultBaseline", () => {
		test("returns default baseline tag and coordinate", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn, BaselineTag.ideo, BaselineTag.hang],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: {
								defaultBaselineIndex: 1,
								baseCoords: [0, -120, -200],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getDefaultBaseline(base, 0x6c61746e, true);
			expect(result).toEqual({
				tag: BaselineTag.ideo,
				coordinate: -120,
			});
		});

		test("returns null for non-existent script", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: {
								defaultBaselineIndex: 0,
								baseCoords: [0],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getDefaultBaseline(base, 0x61726162, true);
			expect(result).toBeNull();
		});

		test("returns null when script has no base values", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: null,
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getDefaultBaseline(base, 0x6c61746e, true);
			expect(result).toBeNull();
		});

		test("returns null when axis is null", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: null,
				vertAxis: null,
			};

			const result = getDefaultBaseline(base, 0x6c61746e, true);
			expect(result).toBeNull();
		});

		test("queries vertical axis when horizontal=false", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: null,
				vertAxis: {
					baseTagList: [BaselineTag.ideo, BaselineTag.icfb],
					baseScriptList: [
						{
							scriptTag: 0x68616e69,
							baseValues: {
								defaultBaselineIndex: 0,
								baseCoords: [-250, -300],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
			};

			const result = getDefaultBaseline(base, 0x68616e69, false);
			expect(result).toEqual({
				tag: BaselineTag.ideo,
				coordinate: -250,
			});
		});

		test("returns null when default index is out of bounds", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: {
								defaultBaselineIndex: 5,
								baseCoords: [0],
							},
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getDefaultBaseline(base, 0x6c61746e, true);
			expect(result).toBeNull();
		});
	});

	describe("getMinMaxExtent", () => {
		test("returns default MinMax extent", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: null,
							defaultMinMax: {
								minCoord: -200,
								maxCoord: 900,
								featMinMaxRecords: [],
							},
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getMinMaxExtent(base, 0x6c61746e, undefined, true);
			expect(result).toEqual({
				minCoord: -200,
				maxCoord: 900,
			});
		});

		test("returns language-specific MinMax extent", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: null,
							defaultMinMax: {
								minCoord: -200,
								maxCoord: 900,
								featMinMaxRecords: [],
							},
							baseLangSysRecords: new Map([
								[
									0x44455520,
									{
										minCoord: -250,
										maxCoord: 950,
										featMinMaxRecords: [],
									},
								],
							]),
						},
					],
				},
				vertAxis: null,
			};

			const result = getMinMaxExtent(base, 0x6c61746e, 0x44455520, true);
			expect(result).toEqual({
				minCoord: -250,
				maxCoord: 950,
			});
		});

		test("falls back to default when language not found", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: null,
							defaultMinMax: {
								minCoord: -200,
								maxCoord: 900,
								featMinMaxRecords: [],
							},
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getMinMaxExtent(base, 0x6c61746e, 0x44455520, true);
			expect(result).toEqual({
				minCoord: -200,
				maxCoord: 900,
			});
		});

		test("returns null for non-existent script", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: null,
							defaultMinMax: {
								minCoord: -200,
								maxCoord: 900,
								featMinMaxRecords: [],
							},
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getMinMaxExtent(base, 0x61726162, undefined, true);
			expect(result).toBeNull();
		});

		test("returns null when script has no MinMax data", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: null,
							defaultMinMax: null,
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getMinMaxExtent(base, 0x6c61746e, undefined, true);
			expect(result).toBeNull();
		});

		test("returns null when axis is null", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: null,
				vertAxis: null,
			};

			const result = getMinMaxExtent(base, 0x6c61746e, undefined, true);
			expect(result).toBeNull();
		});

		test("queries vertical axis when horizontal=false", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: null,
				vertAxis: {
					baseTagList: [BaselineTag.ideo],
					baseScriptList: [
						{
							scriptTag: 0x68616e69,
							baseValues: null,
							defaultMinMax: {
								minCoord: -300,
								maxCoord: 1000,
								featMinMaxRecords: [],
							},
							baseLangSysRecords: new Map(),
						},
					],
				},
			};

			const result = getMinMaxExtent(base, 0x68616e69, undefined, false);
			expect(result).toEqual({
				minCoord: -300,
				maxCoord: 1000,
			});
		});

		test("handles null min and max coords", () => {
			const base: BaseTable = {
				majorVersion: 1,
				minorVersion: 0,
				horizAxis: {
					baseTagList: [BaselineTag.romn],
					baseScriptList: [
						{
							scriptTag: 0x6c61746e,
							baseValues: null,
							defaultMinMax: {
								minCoord: null,
								maxCoord: null,
								featMinMaxRecords: [],
							},
							baseLangSysRecords: new Map(),
						},
					],
				},
				vertAxis: null,
			};

			const result = getMinMaxExtent(base, 0x6c61746e, undefined, true);
			expect(result).toEqual({
				minCoord: null,
				maxCoord: null,
			});
		});
	});

	describe("BaselineTag constants", () => {
		test("has correct tag values", () => {
			expect(BaselineTag.romn).toBe(0x726f6d6e);
			expect(BaselineTag.ideo).toBe(0x6964656f);
			expect(BaselineTag.icfb).toBe(0x69636662);
			expect(BaselineTag.icft).toBe(0x69636674);
			expect(BaselineTag.idtp).toBe(0x69647470);
			expect(BaselineTag.hang).toBe(0x68616e67);
			expect(BaselineTag.math).toBe(0x6d617468);
		});
	});

	describe("edge cases", () => {
		test("handles very large coordinate values", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 6, false);
			view.setUint16(28, 0, false);
			view.setUint16(30, 0, false);

			// BaseValues at 32
			view.setUint16(32, 0, false);
			view.setUint16(34, 1, false);
			view.setUint16(36, 6, false);

			// Large negative value
			view.setUint16(38, 1, false);
			view.setInt16(40, -32768, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords?.[0]).toBe(-32768);
		});

		test("handles maximum positive coordinate", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 6, false);
			view.setUint16(28, 0, false);
			view.setUint16(30, 0, false);

			// BaseValues at 32
			view.setUint16(32, 0, false);
			view.setUint16(34, 1, false);
			view.setUint16(36, 6, false);

			view.setUint16(38, 1, false);
			view.setInt16(40, 32767, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords?.[0]).toBe(32767);
		});

		test("handles zero as valid coordinate", () => {
			const buffer = new ArrayBuffer(100);
			const view = new DataView(buffer);

			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			view.setUint16(8, 4, false);
			view.setUint16(10, 12, false);

			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			view.setUint16(20, 1, false);
			view.setUint32(22, 0x6c61746e, false);
			view.setUint16(26, 6, false);

			// Base script table at 26
			view.setUint16(26, 6, false);
			view.setUint16(28, 0, false);
			view.setUint16(30, 0, false);

			// BaseValues at 32
			view.setUint16(32, 0, false);
			view.setUint16(34, 1, false);
			view.setUint16(36, 6, false);

			view.setUint16(38, 1, false);
			view.setInt16(40, 0, false);

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords?.[0]).toBe(0);
		});
	});
});
