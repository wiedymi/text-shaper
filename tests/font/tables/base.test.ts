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
