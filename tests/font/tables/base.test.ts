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

	describe("BaseCoord formats", () => {
		test("parses BaseCoord format 2 with reference glyph", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false); // baseTagListOffset
			view.setUint16(10, 12, false); // baseScriptListOffset

			// Base tag list at offset 12
			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			// Base script list at offset 20
			view.setUint16(20, 1, false); // baseScriptCount
			view.setUint32(22, 0x6c61746e, false); // scriptTag
			view.setUint16(26, 8, false); // offset to BaseScript table

			// BaseScript table at offset 28 (20 + 8)
			view.setUint16(28, 6, false); // baseValuesOffset
			view.setUint16(30, 0, false); // defaultMinMaxOffset
			view.setUint16(32, 0, false); // baseLangSysCount

			// BaseValues at offset 34 (28 + 6)
			view.setUint16(34, 0, false); // defaultBaselineIndex
			view.setUint16(36, 1, false); // baseCoordCount
			view.setUint16(38, 6, false); // coordOffset

			// BaseCoord format 2 at offset 40 (34 + 6)
			view.setUint16(40, 2, false); // format = 2
			view.setInt16(42, -120, false); // coordinate
			view.setUint16(44, 42, false); // referenceGlyph
			view.setUint16(46, 5, false); // baseCoordPoint

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords?.[0]).toBe(-120);
		});

		test("parses BaseCoord format 3 with device table", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false); // baseTagListOffset
			view.setUint16(10, 12, false); // baseScriptListOffset

			// Base tag list at offset 12
			view.setUint16(12, 1, false);
			view.setUint32(14, BaselineTag.romn, false);

			// Base script list at offset 20
			view.setUint16(20, 1, false); // baseScriptCount
			view.setUint32(22, 0x6c61746e, false); // scriptTag
			view.setUint16(26, 8, false); // offset to BaseScript table

			// BaseScript table at offset 28 (20 + 8)
			view.setUint16(28, 6, false); // baseValuesOffset
			view.setUint16(30, 0, false); // defaultMinMaxOffset
			view.setUint16(32, 0, false); // baseLangSysCount

			// BaseValues at offset 34 (28 + 6)
			view.setUint16(34, 0, false); // defaultBaselineIndex
			view.setUint16(36, 1, false); // baseCoordCount
			view.setUint16(38, 6, false); // coordOffset

			// BaseCoord format 3 at offset 40 (34 + 6)
			view.setUint16(40, 3, false); // format = 3
			view.setInt16(42, 100, false); // coordinate
			view.setUint16(44, 12, false); // deviceOffset

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords?.[0]).toBe(100);
		});
	});

	describe("MinMax table parsing", () => {
		test("parses MinMax with minCoord only", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);
			// Initialize all bytes to 0
			for (let i = 0; i < buffer.byteLength; i++) {
				view.setUint8(i, 0);
			}

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false); // baseTagListOffset
			view.setUint16(10, 10, false); // baseScriptListOffset

			// BaseTagList at offset 12 (8 + 4)
			view.setUint16(12, 0, false); // empty tag list

			// Base script list at offset 18 (8 + 10)
			view.setUint16(18, 1, false); // baseScriptCount
			view.setUint32(20, 0x6c61746e, false); // scriptTag
			view.setUint16(24, 8, false); // offset to BaseScript table

			// BaseScript table at offset 26 (18 + 8)
			view.setUint16(26, 18, false); // baseValuesOffset -> offset 44
			view.setUint16(28, 10, false); // defaultMinMaxOffset -> offset 36
			view.setUint16(30, 0, false); // baseLangSysCount

			// MinMax table at offset 36 (26 + 10)
			view.setUint16(36, 6, false); // minCoordOffset
			view.setUint16(38, 0, false); // maxCoordOffset (null)
			view.setUint16(40, 0, false); // featMinMaxCount

			// BaseCoord for minCoord at offset 42 (36 + 6)
			view.setUint16(42, 1, false); // format
			view.setInt16(44, -200, false); // coordinate

			// Empty BaseValues at offset 44 (26 + 18)
			view.setUint16(44, 0, false); // defaultBaselineIndex
			view.setUint16(46, 0, false); // baseCoordCount = 0

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const minMax = base.horizAxis?.baseScriptList[0]?.defaultMinMax;
			expect(minMax?.minCoord).toBe(-200);
			expect(minMax?.maxCoord).toBeNull();
		});

		test("parses MinMax with maxCoord only", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);
			for (let i = 0; i < buffer.byteLength; i++) {
				view.setUint8(i, 0);
			}

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false); // baseTagListOffset
			view.setUint16(10, 10, false); // baseScriptListOffset

			// BaseTagList at offset 12 (8 + 4)
			view.setUint16(12, 0, false); // empty tag list

			// Base script list at offset 18 (8 + 10)
			view.setUint16(18, 1, false); // baseScriptCount
			view.setUint32(20, 0x6c61746e, false); // scriptTag
			view.setUint16(24, 8, false); // offset to BaseScript table

			// BaseScript table at offset 26 (18 + 8)
			view.setUint16(26, 20, false); // baseValuesOffset -> offset 46
			view.setUint16(28, 10, false); // defaultMinMaxOffset -> offset 36
			view.setUint16(30, 0, false); // baseLangSysCount

			// MinMax table at offset 36 (26 + 10)
			view.setUint16(36, 0, false); // minCoordOffset (null)
			view.setUint16(38, 6, false); // maxCoordOffset
			view.setUint16(40, 0, false); // featMinMaxCount

			// BaseCoord for maxCoord at offset 42 (36 + 6)
			view.setUint16(42, 1, false); // format
			view.setInt16(44, 900, false); // coordinate

			// Empty BaseValues at offset 46 (26 + 20)
			view.setUint16(46, 0, false); // defaultBaselineIndex
			view.setUint16(48, 0, false); // baseCoordCount = 0

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const minMax = base.horizAxis?.baseScriptList[0]?.defaultMinMax;
			expect(minMax?.minCoord).toBeNull();
			expect(minMax?.maxCoord).toBe(900);
		});

		test("parses MinMax with FeatMinMaxRecords", () => {
			const buffer = new ArrayBuffer(300);
			const view = new DataView(buffer);

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false); // baseTagListOffset
			view.setUint16(10, 10, false); // baseScriptListOffset

			// BaseTagList at offset 12 (8 + 4)
			view.setUint16(12, 0, false); // empty tag list

			// Base script list at offset 18 (8 + 10)
			view.setUint16(18, 1, false); // baseScriptCount
			view.setUint32(20, 0x6c61746e, false); // scriptTag
			view.setUint16(24, 8, false); // offset to BaseScript table

			// BaseScript table at offset 26 (18 + 8)
			view.setUint16(26, 0, false); // baseValuesOffset (null)
			view.setUint16(28, 6, false); // defaultMinMaxOffset
			view.setUint16(30, 0, false); // baseLangSysCount

			// MinMax table at offset 32 (26 + 6)
			view.setUint16(32, 0, false); // minCoordOffset
			view.setUint16(34, 0, false); // maxCoordOffset
			view.setUint16(36, 2, false); // featMinMaxCount

			// FeatMinMaxRecord 1
			view.setUint32(38, 0x73697a65, false); // featureTag 'size'
			view.setUint16(42, 24, false); // minOffset
			view.setUint16(44, 30, false); // maxOffset

			// FeatMinMaxRecord 2
			view.setUint32(46, 0x6b65726e, false); // featureTag 'kern'
			view.setUint16(50, 36, false); // minOffset
			view.setUint16(52, 0, false); // maxOffset (null)

			// BaseCoord for FeatMinMaxRecord 1 min at offset 56 (32 + 24)
			view.setUint16(56, 1, false); // format
			view.setInt16(58, -150, false); // coordinate

			// BaseCoord for FeatMinMaxRecord 1 max at offset 62 (32 + 30)
			view.setUint16(62, 1, false); // format
			view.setInt16(64, 950, false); // coordinate

			// BaseCoord for FeatMinMaxRecord 2 min at offset 68 (32 + 36)
			view.setUint16(68, 1, false); // format
			view.setInt16(70, -200, false); // coordinate

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const minMax = base.horizAxis?.baseScriptList[0]?.defaultMinMax;
			expect(minMax?.featMinMaxRecords.length).toBe(2);
			expect(minMax?.featMinMaxRecords[0]).toEqual({
				featureTag: 0x73697a65,
				minCoord: -150,
				maxCoord: 950,
			});
			expect(minMax?.featMinMaxRecords[1]).toEqual({
				featureTag: 0x6b65726e,
				minCoord: -200,
				maxCoord: null,
			});
		});

		test("parses FeatMinMaxRecord with null min and non-null max", () => {
			const buffer = new ArrayBuffer(300);
			const view = new DataView(buffer);

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false);
			view.setUint16(10, 10, false);

			// BaseTagList at offset 12 (8 + 4)
			view.setUint16(12, 0, false); // empty tag list

			// Base script list at offset 18 (8 + 10)
			view.setUint16(18, 1, false);
			view.setUint32(20, 0x6c61746e, false);
			view.setUint16(24, 8, false);

			// BaseScript table at offset 26 (18 + 8)
			view.setUint16(26, 0, false);
			view.setUint16(28, 6, false);
			view.setUint16(30, 0, false);

			// MinMax table at offset 32 (26 + 6)
			view.setUint16(32, 0, false); // minCoordOffset
			view.setUint16(34, 0, false); // maxCoordOffset
			view.setUint16(36, 1, false); // featMinMaxCount

			// FeatMinMaxRecord
			view.setUint32(38, 0x6c696761, false); // featureTag 'liga'
			view.setUint16(42, 0, false); // minOffset (null)
			view.setUint16(44, 14, false); // maxOffset

			// BaseCoord for max at offset 46 (32 + 14)
			view.setUint16(46, 1, false); // format
			view.setInt16(48, 800, false); // coordinate

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const minMax = base.horizAxis?.baseScriptList[0]?.defaultMinMax;
			expect(minMax?.featMinMaxRecords[0]).toEqual({
				featureTag: 0x6c696761,
				minCoord: null,
				maxCoord: 800,
			});
		});
	});

	describe("BaseValues parsing", () => {
		test("parses BaseValues with zero offset coordinate", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false); // baseTagListOffset
			view.setUint16(10, 16, false); // baseScriptListOffset

			// Base tag list at offset 12 (8 + 4)
			view.setUint16(12, 2, false);
			view.setUint32(14, BaselineTag.romn, false);
			view.setUint32(18, BaselineTag.ideo, false);

			// Base script list at offset 24 (8 + 16)
			view.setUint16(24, 1, false); // baseScriptCount
			view.setUint32(26, 0x6c61746e, false); // scriptTag
			view.setUint16(30, 8, false); // offset to BaseScript table

			// BaseScript table at offset 32 (24 + 8)
			view.setUint16(32, 6, false); // baseValuesOffset
			view.setUint16(34, 0, false); // defaultMinMaxOffset
			view.setUint16(36, 0, false); // baseLangSysCount

			// BaseValues at offset 38 (32 + 6)
			view.setUint16(38, 0, false); // defaultBaselineIndex
			view.setUint16(40, 2, false); // baseCoordCount
			view.setUint16(42, 0, false); // coordOffset[0] = 0 (null)
			view.setUint16(44, 10, false); // coordOffset[1]

			// BaseCoord for second coord at offset 48 (38 + 10)
			view.setUint16(48, 1, false); // format
			view.setInt16(50, -120, false); // coordinate

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const coords = base.horizAxis?.baseScriptList[0]?.baseValues?.baseCoords;
			expect(coords?.[0]).toBe(0); // Zero offset becomes 0
			expect(coords?.[1]).toBe(-120);
		});
	});

	describe("BaseLangSys records", () => {
		test("parses BaseLangSys records with MinMax", () => {
			const buffer = new ArrayBuffer(300);
			const view = new DataView(buffer);

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false); // baseTagListOffset
			view.setUint16(10, 10, false); // baseScriptListOffset

			// BaseTagList at offset 12 (8 + 4)
			view.setUint16(12, 0, false); // empty tag list

			// Base script list at offset 18 (8 + 10)
			view.setUint16(18, 1, false); // baseScriptCount
			view.setUint32(20, 0x6c61746e, false); // scriptTag
			view.setUint16(24, 8, false); // offset to BaseScript table

			// BaseScript table at offset 26 (18 + 8)
			view.setUint16(26, 0, false); // baseValuesOffset (null)
			view.setUint16(28, 0, false); // defaultMinMaxOffset (null)
			view.setUint16(30, 2, false); // baseLangSysCount

			// BaseLangSysRecord 1
			view.setUint32(32, 0x44455520, false); // languageTag 'DEU '
			view.setUint16(36, 18, false); // offset to MinMax

			// BaseLangSysRecord 2
			view.setUint32(38, 0x46524120, false); // languageTag 'FRA '
			view.setUint16(42, 32, false); // offset to MinMax

			// MinMax for DEU at offset 44 (26 + 18)
			view.setUint16(44, 6, false); // minCoordOffset
			view.setUint16(46, 12, false); // maxCoordOffset
			view.setUint16(48, 0, false); // featMinMaxCount

			// BaseCoord for DEU min at offset 50 (44 + 6)
			view.setUint16(50, 1, false); // format
			view.setInt16(52, -250, false); // coordinate

			// BaseCoord for DEU max at offset 56 (44 + 12)
			view.setUint16(56, 1, false); // format
			view.setInt16(58, 950, false); // coordinate

			// MinMax for FRA at offset 58 (26 + 32)
			view.setUint16(58, 6, false); // minCoordOffset
			view.setUint16(60, 12, false); // maxCoordOffset
			view.setUint16(62, 0, false); // featMinMaxCount

			// BaseCoord for FRA min at offset 64 (58 + 6)
			view.setUint16(64, 1, false); // format
			view.setInt16(66, -300, false); // coordinate

			// BaseCoord for FRA max at offset 70 (58 + 12)
			view.setUint16(70, 1, false); // format
			view.setInt16(72, 1000, false); // coordinate

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const scriptRecord = base.horizAxis?.baseScriptList[0];
			expect(scriptRecord?.baseLangSysRecords.size).toBe(2);

			const deuMinMax = scriptRecord?.baseLangSysRecords.get(0x44455520);
			expect(deuMinMax?.minCoord).toBe(-250);
			expect(deuMinMax?.maxCoord).toBe(950);

			const fraMinMax = scriptRecord?.baseLangSysRecords.get(0x46524120);
			expect(fraMinMax?.minCoord).toBe(-300);
			expect(fraMinMax?.maxCoord).toBe(1000);
		});

		test("parses BaseLangSys with both min and max coords", () => {
			const buffer = new ArrayBuffer(200);
			const view = new DataView(buffer);

			// BASE table header
			view.setUint16(0, 1, false);
			view.setUint16(2, 0, false);
			view.setUint16(4, 8, false);
			view.setUint16(6, 0, false);

			// Axis table at offset 8
			view.setUint16(8, 4, false);
			view.setUint16(10, 10, false);

			// BaseTagList at offset 12 (8 + 4)
			view.setUint16(12, 0, false); // empty tag list

			// Base script list at offset 18 (8 + 10)
			view.setUint16(18, 1, false);
			view.setUint32(20, 0x6c61746e, false);
			view.setUint16(24, 8, false);

			// BaseScript table at offset 26 (18 + 8)
			view.setUint16(26, 0, false);
			view.setUint16(28, 0, false);
			view.setUint16(30, 1, false); // baseLangSysCount

			// BaseLangSysRecord
			view.setUint32(32, 0x44455520, false); // languageTag
			view.setUint16(36, 12, false); // offset to MinMax

			// MinMax at offset 38 (26 + 12)
			view.setUint16(38, 6, false); // minCoordOffset
			view.setUint16(40, 12, false); // maxCoordOffset
			view.setUint16(42, 0, false); // featMinMaxCount

			// BaseCoord for min at offset 44 (38 + 6)
			view.setUint16(44, 1, false); // format
			view.setInt16(46, -180, false); // coordinate

			// BaseCoord for max at offset 50 (38 + 12)
			view.setUint16(50, 1, false); // format
			view.setInt16(52, 920, false); // coordinate

			const reader = new Reader(buffer);
			const base = parseBase(reader);

			const scriptRecord = base.horizAxis?.baseScriptList[0];
			expect(scriptRecord?.baseLangSysRecords.size).toBe(1);

			const minMax = scriptRecord?.baseLangSysRecords.get(0x44455520);
			expect(minMax?.minCoord).toBe(-180);
			expect(minMax?.maxCoord).toBe(920);
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
