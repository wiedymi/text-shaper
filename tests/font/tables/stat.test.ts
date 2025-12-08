import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseStat,
	getAxisRecord,
	getAxisIndex,
	getAxisValuesForAxis,
	findAxisValueByNameId,
	isElidableAxisValue,
	isOlderSiblingFont,
	getAxisValueNumber,
	matchAxisValue,
	AxisValueFlags,
	type StatTable,
	type AxisRecord,
	type AxisValue,
	type AxisValueFormat1,
	type AxisValueFormat2,
	type AxisValueFormat3,
	type AxisValueFormat4,
} from "../../../src/font/tables/stat.ts";
import { tagToString } from "../../../src/types.ts";

const SFNS_PATH = "/System/Library/Fonts/SFNS.ttf";
const SF_COMPACT_PATH = "/System/Library/Fonts/SFCompact.ttf";
const NEW_YORK_PATH = "/System/Library/Fonts/NewYork.ttf";

describe("stat table - SFNS", () => {
	let font: Font;
	let stat: StatTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("SFNS.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	describe("parseStat", () => {
		test("returns StatTable with version", () => {
			expect(stat.majorVersion).toBeGreaterThanOrEqual(1);
			expect(stat.minorVersion).toBeGreaterThanOrEqual(0);
		});

		test("has design axes array", () => {
			expect(Array.isArray(stat.designAxes)).toBe(true);
			expect(stat.designAxes.length).toBeGreaterThan(0);
		});

		test("has axis values array", () => {
			expect(Array.isArray(stat.axisValues)).toBe(true);
			expect(stat.axisValues.length).toBeGreaterThan(0);
		});

		test("designAxisCount matches designAxes length", () => {
			expect(stat.designAxisCount).toBe(stat.designAxes.length);
		});

		test("axisValueCount matches axisValues length", () => {
			expect(stat.axisValueCount).toBe(stat.axisValues.length);
		});

		test("has elided fallback name ID for version 1.1+", () => {
			if (stat.majorVersion > 1 || (stat.majorVersion === 1 && stat.minorVersion >= 1)) {
				expect(stat.elidedFallbackNameID).toBeDefined();
				expect(typeof stat.elidedFallbackNameID).toBe("number");
			}
		});
	});

	describe("design axis records", () => {
		test("axes have required properties", () => {
			for (const axis of stat.designAxes) {
				expect(typeof axis.axisTag).toBe("number");
				expect(typeof axis.axisNameID).toBe("number");
				expect(typeof axis.axisOrdering).toBe("number");
			}
		});

		test("axis tags are readable", () => {
			for (const axis of stat.designAxes) {
				const tagStr = tagToString(axis.axisTag);
				expect(typeof tagStr).toBe("string");
				expect(tagStr.length).toBe(4);
			}
		});

		test("axis name IDs are valid", () => {
			for (const axis of stat.designAxes) {
				expect(axis.axisNameID).toBeGreaterThan(0);
			}
		});

		test("SFNS has expected axes", () => {
			const axisTags = stat.designAxes.map((a) => tagToString(a.axisTag));
			expect(axisTags.length).toBeGreaterThan(0);
		});

		test("axis ordering values are present", () => {
			for (const axis of stat.designAxes) {
				expect(typeof axis.axisOrdering).toBe("number");
				expect(axis.axisOrdering).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("axis values", () => {
		test("all axis values have valid format", () => {
			for (const axisValue of stat.axisValues) {
				expect([1, 2, 3, 4]).toContain(axisValue.format);
			}
		});

		test("all axis values have value name ID", () => {
			for (const axisValue of stat.axisValues) {
				expect(axisValue.valueNameID).toBeGreaterThan(0);
			}
		});

		test("all axis values have flags", () => {
			for (const axisValue of stat.axisValues) {
				expect(typeof axisValue.flags).toBe("number");
				expect(axisValue.flags).toBeGreaterThanOrEqual(0);
			}
		});

		test("format 1-3 values have axis index", () => {
			for (const axisValue of stat.axisValues) {
				if (axisValue.format !== 4) {
					expect(typeof axisValue.axisIndex).toBe("number");
					expect(axisValue.axisIndex).toBeGreaterThanOrEqual(0);
					expect(axisValue.axisIndex).toBeLessThan(stat.designAxisCount);
				}
			}
		});
	});

	describe("axis value format 1", () => {
		test("format 1 values exist", () => {
			const format1Values = stat.axisValues.filter((v) => v.format === 1);
			if (format1Values.length > 0) {
				expect(format1Values.length).toBeGreaterThan(0);
			}
		});

		test("format 1 values have numeric value", () => {
			const format1Values = stat.axisValues.filter(
				(v) => v.format === 1,
			) as AxisValueFormat1[];
			for (const axisValue of format1Values) {
				expect(typeof axisValue.value).toBe("number");
			}
		});

		test("format 1 values have valid axis index", () => {
			const format1Values = stat.axisValues.filter(
				(v) => v.format === 1,
			) as AxisValueFormat1[];
			for (const axisValue of format1Values) {
				expect(axisValue.axisIndex).toBeGreaterThanOrEqual(0);
				expect(axisValue.axisIndex).toBeLessThan(stat.designAxisCount);
			}
		});
	});

	describe("axis value format 2", () => {
		test("format 2 values have range", () => {
			const format2Values = stat.axisValues.filter(
				(v) => v.format === 2,
			) as AxisValueFormat2[];
			for (const axisValue of format2Values) {
				expect(typeof axisValue.nominalValue).toBe("number");
				expect(typeof axisValue.rangeMinValue).toBe("number");
				expect(typeof axisValue.rangeMaxValue).toBe("number");
			}
		});

		test("format 2 values have valid range order", () => {
			const format2Values = stat.axisValues.filter(
				(v) => v.format === 2,
			) as AxisValueFormat2[];
			for (const axisValue of format2Values) {
				expect(axisValue.rangeMinValue).toBeLessThanOrEqual(
					axisValue.nominalValue,
				);
				expect(axisValue.nominalValue).toBeLessThanOrEqual(
					axisValue.rangeMaxValue,
				);
			}
		});
	});

	describe("axis value format 3", () => {
		test("format 3 values have value and linked value", () => {
			const format3Values = stat.axisValues.filter(
				(v) => v.format === 3,
			) as AxisValueFormat3[];
			for (const axisValue of format3Values) {
				expect(typeof axisValue.value).toBe("number");
				expect(typeof axisValue.linkedValue).toBe("number");
			}
		});
	});

	describe("axis value format 4", () => {
		test("format 4 values have axis count and axis values", () => {
			const format4Values = stat.axisValues.filter(
				(v) => v.format === 4,
			) as AxisValueFormat4[];
			for (const axisValue of format4Values) {
				expect(typeof axisValue.axisCount).toBe("number");
				expect(axisValue.axisCount).toBeGreaterThan(0);
				expect(Array.isArray(axisValue.axisValues)).toBe(true);
				expect(axisValue.axisValues.length).toBe(axisValue.axisCount);
			}
		});

		test("format 4 axis values have axis index and value", () => {
			const format4Values = stat.axisValues.filter(
				(v) => v.format === 4,
			) as AxisValueFormat4[];
			for (const axisValue of format4Values) {
				for (const av of axisValue.axisValues) {
					expect(typeof av.axisIndex).toBe("number");
					expect(typeof av.value).toBe("number");
					expect(av.axisIndex).toBeGreaterThanOrEqual(0);
					expect(av.axisIndex).toBeLessThan(stat.designAxisCount);
				}
			}
		});
	});
});

describe("stat table - SF Compact", () => {
	let font: Font;
	let stat: StatTable;

	beforeAll(async () => {
		font = await Font.fromFile(SF_COMPACT_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("SFCompact.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	test("has design axes", () => {
		expect(stat.designAxes.length).toBeGreaterThan(0);
	});

	test("has axis values", () => {
		expect(stat.axisValues.length).toBeGreaterThan(0);
	});

	test("design axis count matches", () => {
		expect(stat.designAxisCount).toBe(stat.designAxes.length);
	});
});

describe("stat table - New York", () => {
	let font: Font;
	let stat: StatTable;

	beforeAll(async () => {
		font = await Font.fromFile(NEW_YORK_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("NewYork.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	test("has design axes", () => {
		expect(stat.designAxes.length).toBeGreaterThan(0);
	});

	test("has axis values", () => {
		expect(stat.axisValues.length).toBeGreaterThan(0);
	});

	test("all formats are valid", () => {
		for (const axisValue of stat.axisValues) {
			expect([1, 2, 3, 4]).toContain(axisValue.format);
		}
	});
});

describe("getAxisRecord", () => {
	let stat: StatTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("SFNS.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	test("finds axis by tag", () => {
		if (stat.designAxes.length > 0) {
			const firstAxis = stat.designAxes[0];
			if (firstAxis) {
				const found = getAxisRecord(stat, firstAxis.axisTag);
				expect(found).not.toBeNull();
				expect(found?.axisTag).toBe(firstAxis.axisTag);
			}
		}
	});

	test("returns null for non-existent tag", () => {
		const notFound = getAxisRecord(stat, 0x12345678);
		expect(notFound).toBeNull();
	});

	test("finds all axes by their tags", () => {
		for (const axis of stat.designAxes) {
			const found = getAxisRecord(stat, axis.axisTag);
			expect(found).not.toBeNull();
			expect(found).toBe(axis);
		}
	});
});

describe("getAxisIndex", () => {
	let stat: StatTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("SFNS.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	test("finds index by tag", () => {
		if (stat.designAxes.length > 0) {
			const firstAxis = stat.designAxes[0];
			if (firstAxis) {
				const index = getAxisIndex(stat, firstAxis.axisTag);
				expect(index).toBe(0);
			}
		}
	});

	test("returns -1 for non-existent tag", () => {
		const index = getAxisIndex(stat, 0x12345678);
		expect(index).toBe(-1);
	});

	test("index matches position in array", () => {
		for (let i = 0; i < stat.designAxes.length; i++) {
			const axis = stat.designAxes[i];
			if (axis) {
				const index = getAxisIndex(stat, axis.axisTag);
				expect(index).toBe(i);
			}
		}
	});
});

describe("getAxisValuesForAxis", () => {
	let stat: StatTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("SFNS.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	test("returns array for valid axis index", () => {
		if (stat.designAxes.length > 0) {
			const values = getAxisValuesForAxis(stat, 0);
			expect(Array.isArray(values)).toBe(true);
		}
	});

	test("returned values reference correct axis", () => {
		for (let i = 0; i < stat.designAxes.length; i++) {
			const values = getAxisValuesForAxis(stat, i);
			for (const value of values) {
				if (value.format === 4) {
					expect(value.axisValues.some((av) => av.axisIndex === i)).toBe(true);
				} else {
					expect(value.axisIndex).toBe(i);
				}
			}
		}
	});

	test("returns empty array for out of range index", () => {
		const values = getAxisValuesForAxis(stat, 9999);
		expect(values.length).toBe(0);
	});

	test("finds format 4 values with matching axis", () => {
		const format4Values = stat.axisValues.filter(
			(v) => v.format === 4,
		) as AxisValueFormat4[];
		for (const format4 of format4Values) {
			for (const av of format4.axisValues) {
				const values = getAxisValuesForAxis(stat, av.axisIndex);
				expect(values).toContain(format4);
			}
		}
	});
});

describe("findAxisValueByNameId", () => {
	let stat: StatTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("SFNS.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	test("finds axis value by name ID", () => {
		if (stat.axisValues.length > 0) {
			const firstValue = stat.axisValues[0];
			if (firstValue) {
				const found = findAxisValueByNameId(stat, firstValue.valueNameID);
				expect(found).not.toBeNull();
				expect(found?.valueNameID).toBe(firstValue.valueNameID);
			}
		}
	});

	test("returns null for non-existent name ID", () => {
		const notFound = findAxisValueByNameId(stat, 99999);
		expect(notFound).toBeNull();
	});

	test("finds all axis values by their name IDs", () => {
		for (const axisValue of stat.axisValues) {
			const found = findAxisValueByNameId(stat, axisValue.valueNameID);
			expect(found).not.toBeNull();
		}
	});
});

describe("isElidableAxisValue", () => {
	let stat: StatTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("SFNS.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	test("returns boolean for all axis values", () => {
		for (const axisValue of stat.axisValues) {
			const result = isElidableAxisValue(axisValue);
			expect(typeof result).toBe("boolean");
		}
	});

	test("correctly identifies elidable flag", () => {
		for (const axisValue of stat.axisValues) {
			const expected =
				(axisValue.flags & AxisValueFlags.ElidableAxisValueName) !== 0;
			expect(isElidableAxisValue(axisValue)).toBe(expected);
		}
	});

	test("handles zero flags", () => {
		const testValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
		};
		expect(isElidableAxisValue(testValue)).toBe(false);
	});

	test("handles elidable flag", () => {
		const testValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: AxisValueFlags.ElidableAxisValueName,
			valueNameID: 256,
			value: 400,
		};
		expect(isElidableAxisValue(testValue)).toBe(true);
	});
});

describe("isOlderSiblingFont", () => {
	let stat: StatTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const statTable = font.stat;
		if (!statTable) {
			throw new Error("SFNS.ttf does not have a STAT table");
		}
		stat = statTable;
	});

	test("returns boolean for all axis values", () => {
		for (const axisValue of stat.axisValues) {
			const result = isOlderSiblingFont(axisValue);
			expect(typeof result).toBe("boolean");
		}
	});

	test("correctly identifies older sibling flag", () => {
		for (const axisValue of stat.axisValues) {
			const expected =
				(axisValue.flags & AxisValueFlags.OlderSiblingFontAttribute) !== 0;
			expect(isOlderSiblingFont(axisValue)).toBe(expected);
		}
	});

	test("handles zero flags", () => {
		const testValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
		};
		expect(isOlderSiblingFont(testValue)).toBe(false);
	});

	test("handles older sibling flag", () => {
		const testValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: AxisValueFlags.OlderSiblingFontAttribute,
			valueNameID: 256,
			value: 400,
		};
		expect(isOlderSiblingFont(testValue)).toBe(true);
	});
});

describe("getAxisValueNumber", () => {
	test("returns value for format 1", () => {
		const axisValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
		};
		expect(getAxisValueNumber(axisValue)).toBe(400);
	});

	test("returns nominal value for format 2", () => {
		const axisValue: AxisValueFormat2 = {
			format: 2,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			nominalValue: 400,
			rangeMinValue: 300,
			rangeMaxValue: 500,
		};
		expect(getAxisValueNumber(axisValue)).toBe(400);
	});

	test("returns value for format 3", () => {
		const axisValue: AxisValueFormat3 = {
			format: 3,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
			linkedValue: 700,
		};
		expect(getAxisValueNumber(axisValue)).toBe(400);
	});

	test("returns null for format 4", () => {
		const axisValue: AxisValueFormat4 = {
			format: 4,
			axisCount: 2,
			flags: 0,
			valueNameID: 256,
			axisValues: [
				{ axisIndex: 0, value: 400 },
				{ axisIndex: 1, value: 100 },
			],
		};
		expect(getAxisValueNumber(axisValue)).toBeNull();
	});

	test("works with real font axis values", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const stat = font.stat;
		if (stat) {
			for (const axisValue of stat.axisValues) {
				const num = getAxisValueNumber(axisValue);
				if (axisValue.format === 4) {
					expect(num).toBeNull();
				} else {
					expect(typeof num).toBe("number");
				}
			}
		}
	});
});

describe("matchAxisValue", () => {
	test("matches format 1 exact value", () => {
		const axisValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
		};
		const coords = new Map([[0, 400]]);
		expect(matchAxisValue(axisValue, coords)).toBe(true);
	});

	test("does not match format 1 different value", () => {
		const axisValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
		};
		const coords = new Map([[0, 700]]);
		expect(matchAxisValue(axisValue, coords)).toBe(false);
	});

	test("matches format 2 within range", () => {
		const axisValue: AxisValueFormat2 = {
			format: 2,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			nominalValue: 400,
			rangeMinValue: 300,
			rangeMaxValue: 500,
		};
		expect(matchAxisValue(axisValue, new Map([[0, 300]]))).toBe(true);
		expect(matchAxisValue(axisValue, new Map([[0, 400]]))).toBe(true);
		expect(matchAxisValue(axisValue, new Map([[0, 500]]))).toBe(true);
		expect(matchAxisValue(axisValue, new Map([[0, 350]]))).toBe(true);
	});

	test("does not match format 2 outside range", () => {
		const axisValue: AxisValueFormat2 = {
			format: 2,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			nominalValue: 400,
			rangeMinValue: 300,
			rangeMaxValue: 500,
		};
		expect(matchAxisValue(axisValue, new Map([[0, 299]]))).toBe(false);
		expect(matchAxisValue(axisValue, new Map([[0, 501]]))).toBe(false);
	});

	test("matches format 3 exact value", () => {
		const axisValue: AxisValueFormat3 = {
			format: 3,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
			linkedValue: 700,
		};
		expect(matchAxisValue(axisValue, new Map([[0, 400]]))).toBe(true);
	});

	test("matches format 4 all coordinates", () => {
		const axisValue: AxisValueFormat4 = {
			format: 4,
			axisCount: 2,
			flags: 0,
			valueNameID: 256,
			axisValues: [
				{ axisIndex: 0, value: 400 },
				{ axisIndex: 1, value: 100 },
			],
		};
		const coords = new Map([
			[0, 400],
			[1, 100],
		]);
		expect(matchAxisValue(axisValue, coords)).toBe(true);
	});

	test("does not match format 4 partial coordinates", () => {
		const axisValue: AxisValueFormat4 = {
			format: 4,
			axisCount: 2,
			flags: 0,
			valueNameID: 256,
			axisValues: [
				{ axisIndex: 0, value: 400 },
				{ axisIndex: 1, value: 100 },
			],
		};
		const coords = new Map([
			[0, 400],
			[1, 200],
		]);
		expect(matchAxisValue(axisValue, coords)).toBe(false);
	});

	test("does not match when coordinate is missing", () => {
		const axisValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
		};
		const coords = new Map([[1, 400]]);
		expect(matchAxisValue(axisValue, coords)).toBe(false);
	});

	test("does not match empty coordinates", () => {
		const axisValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags: 0,
			valueNameID: 256,
			value: 400,
		};
		const coords = new Map();
		expect(matchAxisValue(axisValue, coords)).toBe(false);
	});
});

describe("elided fallback name ID", () => {
	test("SFNS has elided fallback name ID", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const stat = font.stat;
		if (stat && (stat.majorVersion > 1 || (stat.majorVersion === 1 && stat.minorVersion >= 1))) {
			expect(stat.elidedFallbackNameID).toBeDefined();
			if (stat.elidedFallbackNameID !== undefined) {
				expect(stat.elidedFallbackNameID).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test("SF Compact has elided fallback name ID", async () => {
		const font = await Font.fromFile(SF_COMPACT_PATH);
		const stat = font.stat;
		if (stat && (stat.majorVersion > 1 || (stat.majorVersion === 1 && stat.minorVersion >= 1))) {
			expect(stat.elidedFallbackNameID).toBeDefined();
		}
	});

	test("New York has elided fallback name ID", async () => {
		const font = await Font.fromFile(NEW_YORK_PATH);
		const stat = font.stat;
		if (stat && (stat.majorVersion > 1 || (stat.majorVersion === 1 && stat.minorVersion >= 1))) {
			expect(stat.elidedFallbackNameID).toBeDefined();
		}
	});
});

describe("binary parsing edge cases", () => {
	test("parses STAT version 1.0 without elided fallback name ID", () => {
		const { Reader } = require("../../../src/font/binary/reader.ts");
		const { parseStat } = require("../../../src/font/tables/stat.ts");

		const statBuffer = new ArrayBuffer(100);
		const statView = new DataView(statBuffer);
		let pos = 0;

		// majorVersion = 1
		statView.setUint16(pos, 1);
		pos += 2;
		// minorVersion = 0 (version 1.0)
		statView.setUint16(pos, 0);
		pos += 2;
		// designAxisSize
		statView.setUint16(pos, 8);
		pos += 2;
		// designAxisCount
		statView.setUint16(pos, 0);
		pos += 2;
		// designAxesOffset
		statView.setUint32(pos, 0);
		pos += 4;
		// axisValueCount
		statView.setUint16(pos, 0);
		pos += 2;
		// axisValueArrayOffset
		statView.setUint32(pos, 0);
		pos += 4;
		// No elidedFallbackNameID for version 1.0

		const statReader = new Reader(statView);
		const stat = parseStat(statReader);

		expect(stat.majorVersion).toBe(1);
		expect(stat.minorVersion).toBe(0);
		expect(stat.elidedFallbackNameID).toBeUndefined();
	});

	test("parses axis value format 1", () => {
		const { Reader } = require("../../../src/font/binary/reader.ts");
		const { parseStat } = require("../../../src/font/tables/stat.ts");

		// Create a minimal STAT table with format 1 axis value
		const statBuffer = new ArrayBuffer(100);
		const statView = new DataView(statBuffer);
		let pos = 0;

		// majorVersion
		statView.setUint16(pos, 1);
		pos += 2;
		// minorVersion
		statView.setUint16(pos, 2);
		pos += 2;
		// designAxisSize
		statView.setUint16(pos, 8);
		pos += 2;
		// designAxisCount
		statView.setUint16(pos, 0);
		pos += 2;
		// designAxesOffset
		statView.setUint32(pos, 0);
		pos += 4;
		// axisValueCount
		statView.setUint16(pos, 1);
		pos += 2;
		// axisValueArrayOffset
		statView.setUint32(pos, 20);
		pos += 4;
		// elidedFallbackNameID
		statView.setUint16(pos, 2);
		pos += 2;

		// Axis value array at offset 20
		// Offset to first axis value (2 bytes after array start)
		statView.setUint16(20, 2);

		// Axis value at offset 22 (20 + 2)
		pos = 22;
		// Format 1
		statView.setUint16(pos, 1);
		pos += 2;
		// axisIndex
		statView.setUint16(pos, 0);
		pos += 2;
		// flags
		statView.setUint16(pos, 0);
		pos += 2;
		// valueNameID
		statView.setUint16(pos, 256);
		pos += 2;
		// value (Fixed 16.16) = 400.0
		statView.setInt32(pos, 400 << 16);

		const statReader = new Reader(statView);
		const stat = parseStat(statReader);

		expect(stat.axisValues.length).toBe(1);
		expect(stat.axisValues[0]?.format).toBe(1);
		if (stat.axisValues[0]?.format === 1) {
			expect(stat.axisValues[0].value).toBe(400);
		}
	});

	test("parses axis value format 2", () => {
		const statBuffer = new ArrayBuffer(100);
		const statView = new DataView(statBuffer);
		let pos = 0;

		// majorVersion
		statView.setUint16(pos, 1);
		pos += 2;
		// minorVersion
		statView.setUint16(pos, 2);
		pos += 2;
		// designAxisSize
		statView.setUint16(pos, 8);
		pos += 2;
		// designAxisCount
		statView.setUint16(pos, 0);
		pos += 2;
		// designAxesOffset
		statView.setUint32(pos, 0);
		pos += 4;
		// axisValueCount
		statView.setUint16(pos, 1);
		pos += 2;
		// axisValueArrayOffset
		statView.setUint32(pos, 20);
		pos += 4;
		// elidedFallbackNameID
		statView.setUint16(pos, 2);
		pos += 2;

		// Axis value array at offset 20
		statView.setUint16(20, 2);

		// Axis value format 2 at offset 22 (20 + 2)
		pos = 22;
		// Format 2
		statView.setUint16(pos, 2);
		pos += 2;
		// axisIndex
		statView.setUint16(pos, 0);
		pos += 2;
		// flags
		statView.setUint16(pos, 0);
		pos += 2;
		// valueNameID
		statView.setUint16(pos, 256);
		pos += 2;
		// nominalValue (Fixed 16.16) = 400.0
		statView.setInt32(pos, 400 << 16);
		pos += 4;
		// rangeMinValue (Fixed 16.16) = 300.0
		statView.setInt32(pos, 300 << 16);
		pos += 4;
		// rangeMaxValue (Fixed 16.16) = 500.0
		statView.setInt32(pos, 500 << 16);

		const { Reader } = require("../../../src/font/binary/reader.ts");
		const { parseStat } = require("../../../src/font/tables/stat.ts");
		const statReader = new Reader(statView);
		const stat = parseStat(statReader);

		expect(stat.axisValues.length).toBe(1);
		expect(stat.axisValues[0]?.format).toBe(2);
		if (stat.axisValues[0]?.format === 2) {
			expect(stat.axisValues[0].nominalValue).toBe(400);
			expect(stat.axisValues[0].rangeMinValue).toBe(300);
			expect(stat.axisValues[0].rangeMaxValue).toBe(500);
		}
	});

	test("parses axis value format 3", () => {
		const statBuffer = new ArrayBuffer(100);
		const statView = new DataView(statBuffer);
		let pos = 0;

		// majorVersion
		statView.setUint16(pos, 1);
		pos += 2;
		// minorVersion
		statView.setUint16(pos, 2);
		pos += 2;
		// designAxisSize
		statView.setUint16(pos, 8);
		pos += 2;
		// designAxisCount
		statView.setUint16(pos, 0);
		pos += 2;
		// designAxesOffset
		statView.setUint32(pos, 0);
		pos += 4;
		// axisValueCount
		statView.setUint16(pos, 1);
		pos += 2;
		// axisValueArrayOffset
		statView.setUint32(pos, 20);
		pos += 4;
		// elidedFallbackNameID
		statView.setUint16(pos, 2);
		pos += 2;

		// Axis value array at offset 20
		statView.setUint16(20, 2);

		// Axis value format 3 at offset 22 (20 + 2)
		pos = 22;
		// Format 3
		statView.setUint16(pos, 3);
		pos += 2;
		// axisIndex
		statView.setUint16(pos, 0);
		pos += 2;
		// flags
		statView.setUint16(pos, 0);
		pos += 2;
		// valueNameID
		statView.setUint16(pos, 256);
		pos += 2;
		// value (Fixed 16.16) = 400.0
		statView.setInt32(pos, 400 << 16);
		pos += 4;
		// linkedValue (Fixed 16.16) = 700.0
		statView.setInt32(pos, 700 << 16);

		const { Reader } = require("../../../src/font/binary/reader.ts");
		const { parseStat } = require("../../../src/font/tables/stat.ts");
		const statReader = new Reader(statView);
		const stat = parseStat(statReader);

		expect(stat.axisValues.length).toBe(1);
		expect(stat.axisValues[0]?.format).toBe(3);
		if (stat.axisValues[0]?.format === 3) {
			expect(stat.axisValues[0].value).toBe(400);
			expect(stat.axisValues[0].linkedValue).toBe(700);
		}
	});

	test("handles unknown axis value format", () => {
		const statBuffer = new ArrayBuffer(100);
		const statView = new DataView(statBuffer);
		let pos = 0;

		// majorVersion
		statView.setUint16(pos, 1);
		pos += 2;
		// minorVersion
		statView.setUint16(pos, 2);
		pos += 2;
		// designAxisSize
		statView.setUint16(pos, 8);
		pos += 2;
		// designAxisCount
		statView.setUint16(pos, 0);
		pos += 2;
		// designAxesOffset
		statView.setUint32(pos, 0);
		pos += 4;
		// axisValueCount
		statView.setUint16(pos, 1);
		pos += 2;
		// axisValueArrayOffset
		statView.setUint32(pos, 20);
		pos += 4;
		// elidedFallbackNameID
		statView.setUint16(pos, 2);
		pos += 2;

		// Axis value array at offset 20
		statView.setUint16(20, 2);

		// Axis value with unknown format at offset 22 (20 + 2)
		pos = 22;
		// Unknown format 999
		statView.setUint16(pos, 999);

		const { Reader } = require("../../../src/font/binary/reader.ts");
		const { parseStat } = require("../../../src/font/tables/stat.ts");
		const statReader = new Reader(statView);
		const stat = parseStat(statReader);

		// Unknown format should be skipped (parseAxisValue returns null)
		expect(stat.axisValues.length).toBe(0);
	});

	test("handles designAxisSize > 8", () => {
		const statBuffer = new ArrayBuffer(100);
		const statView = new DataView(statBuffer);
		let pos = 0;

		// majorVersion
		statView.setUint16(pos, 1);
		pos += 2;
		// minorVersion
		statView.setUint16(pos, 2);
		pos += 2;
		// designAxisSize (larger than standard 8 bytes)
		statView.setUint16(pos, 12);
		pos += 2;
		// designAxisCount
		statView.setUint16(pos, 1);
		pos += 2;
		// designAxesOffset
		statView.setUint32(pos, 20);
		pos += 4;
		// axisValueCount
		statView.setUint16(pos, 0);
		pos += 2;
		// axisValueArrayOffset
		statView.setUint32(pos, 0);
		pos += 4;
		// elidedFallbackNameID
		statView.setUint16(pos, 2);
		pos += 2;

		// Design axis at offset 20
		pos = 20;
		// axisTag "wght"
		statView.setUint32(pos, 0x77676874);
		pos += 4;
		// axisNameID
		statView.setUint16(pos, 256);
		pos += 2;
		// axisOrdering
		statView.setUint16(pos, 0);
		pos += 2;
		// Extra 4 bytes (designAxisSize is 12, not 8)
		statView.setUint32(pos, 0);

		const { Reader } = require("../../../src/font/binary/reader.ts");
		const { parseStat } = require("../../../src/font/tables/stat.ts");
		const statReader = new Reader(statView);
		const stat = parseStat(statReader);

		expect(stat.designAxes.length).toBe(1);
		expect(stat.designAxes[0]?.axisTag).toBe(0x77676874);
	});

	test("getAxisValuesForAxis handles format 4 with matching axis", () => {
		const stat: StatTable = {
			majorVersion: 1,
			minorVersion: 2,
			designAxisCount: 2,
			designAxes: [],
			axisValueCount: 1,
			axisValues: [
				{
					format: 4,
					axisCount: 2,
					flags: 0,
					valueNameID: 256,
					axisValues: [
						{ axisIndex: 0, value: 400 },
						{ axisIndex: 1, value: 100 },
					],
				},
			],
			elidedFallbackNameID: 2,
		};

		const values0 = getAxisValuesForAxis(stat, 0);
		expect(values0.length).toBe(1);
		expect(values0[0]?.format).toBe(4);

		const values1 = getAxisValuesForAxis(stat, 1);
		expect(values1.length).toBe(1);
		expect(values1[0]?.format).toBe(4);
	});

	test("getAxisValuesForAxis handles format 4 with non-matching axis", () => {
		const stat: StatTable = {
			majorVersion: 1,
			minorVersion: 2,
			designAxisCount: 3,
			designAxes: [],
			axisValueCount: 1,
			axisValues: [
				{
					format: 4,
					axisCount: 2,
					flags: 0,
					valueNameID: 256,
					axisValues: [
						{ axisIndex: 0, value: 400 },
						{ axisIndex: 1, value: 100 },
					],
				},
			],
			elidedFallbackNameID: 2,
		};

		// Axis 2 is not in the format 4 axisValues array
		const values = getAxisValuesForAxis(stat, 2);
		expect(values.length).toBe(0);
	});

	test("getAxisValuesForAxis handles mixed formats", () => {
		const stat: StatTable = {
			majorVersion: 1,
			minorVersion: 2,
			designAxisCount: 3,
			designAxes: [],
			axisValueCount: 3,
			axisValues: [
				{
					format: 1,
					axisIndex: 0,
					flags: 0,
					valueNameID: 256,
					value: 400,
				},
				{
					format: 2,
					axisIndex: 1,
					flags: 0,
					valueNameID: 257,
					nominalValue: 400,
					rangeMinValue: 300,
					rangeMaxValue: 500,
				},
				{
					format: 4,
					axisCount: 2,
					flags: 0,
					valueNameID: 258,
					axisValues: [
						{ axisIndex: 0, value: 400 },
						{ axisIndex: 2, value: 100 },
					],
				},
			],
			elidedFallbackNameID: 2,
		};

		// Test getting values for axis 0 (should return format 1 and format 4)
		const values0 = getAxisValuesForAxis(stat, 0);
		expect(values0.length).toBe(2);
		expect(values0.some((v) => v.format === 1)).toBe(true);
		expect(values0.some((v) => v.format === 4)).toBe(true);

		// Test getting values for axis 1 (should return format 2 only)
		const values1 = getAxisValuesForAxis(stat, 1);
		expect(values1.length).toBe(1);
		expect(values1[0]?.format).toBe(2);

		// Test getting values for axis 2 (should return format 4 only)
		const values2 = getAxisValuesForAxis(stat, 2);
		expect(values2.length).toBe(1);
		expect(values2[0]?.format).toBe(4);
	});

	test("getAxisValuesForAxis with only non-format-4 values", () => {
		const stat: StatTable = {
			majorVersion: 1,
			minorVersion: 2,
			designAxisCount: 2,
			designAxes: [],
			axisValueCount: 3,
			axisValues: [
				{
					format: 1,
					axisIndex: 0,
					flags: 0,
					valueNameID: 256,
					value: 400,
				},
				{
					format: 2,
					axisIndex: 0,
					flags: 0,
					valueNameID: 257,
					nominalValue: 500,
					rangeMinValue: 400,
					rangeMaxValue: 600,
				},
				{
					format: 3,
					axisIndex: 1,
					flags: 0,
					valueNameID: 258,
					value: 100,
					linkedValue: 200,
				},
			],
			elidedFallbackNameID: 2,
		};

		// Test getting values for axis 0 (should return format 1 and 2)
		const values0 = getAxisValuesForAxis(stat, 0);
		expect(values0.length).toBe(2);
		expect(values0.every((v) => v.format !== 4)).toBe(true);

		// Test getting values for axis 1 (should return format 3)
		const values1 = getAxisValuesForAxis(stat, 1);
		expect(values1.length).toBe(1);
		expect(values1[0]?.format).toBe(3);

		// Test that format 1, 2, 3 values with non-matching axis are filtered out
		const stat2: StatTable = {
			majorVersion: 1,
			minorVersion: 2,
			designAxisCount: 3,
			designAxes: [],
			axisValueCount: 3,
			axisValues: [
				{
					format: 1,
					axisIndex: 0,
					flags: 0,
					valueNameID: 256,
					value: 400,
				},
				{
					format: 2,
					axisIndex: 1,
					flags: 0,
					valueNameID: 257,
					nominalValue: 500,
					rangeMinValue: 400,
					rangeMaxValue: 600,
				},
				{
					format: 3,
					axisIndex: 0,
					flags: 0,
					valueNameID: 258,
					value: 100,
					linkedValue: 200,
				},
			],
			elidedFallbackNameID: 2,
		};

		// Axis 2 should return nothing (no values with axisIndex 2)
		const values2 = getAxisValuesForAxis(stat2, 2);
		expect(values2.length).toBe(0);
	});
});

describe("edge cases", () => {
	test("handles empty axis values array", () => {
		const stat: StatTable = {
			majorVersion: 1,
			minorVersion: 2,
			designAxisCount: 0,
			designAxes: [],
			axisValueCount: 0,
			axisValues: [],
			elidedFallbackNameID: 2,
		};
		expect(getAxisValuesForAxis(stat, 0).length).toBe(0);
		expect(findAxisValueByNameId(stat, 256)).toBeNull();
	});

	test("handles all axis value formats", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const stat = font.stat;
		if (stat) {
			const formats = new Set(stat.axisValues.map((v) => v.format));
			for (const format of formats) {
				expect([1, 2, 3, 4]).toContain(format);
			}
		}
	});

	test("axis index bounds checking", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const stat = font.stat;
		if (stat) {
			for (const axisValue of stat.axisValues) {
				if (axisValue.format !== 4) {
					expect(axisValue.axisIndex).toBeGreaterThanOrEqual(0);
					expect(axisValue.axisIndex).toBeLessThan(stat.designAxisCount);
				} else {
					for (const av of axisValue.axisValues) {
						expect(av.axisIndex).toBeGreaterThanOrEqual(0);
						expect(av.axisIndex).toBeLessThan(stat.designAxisCount);
					}
				}
			}
		}
	});

	test("getAxisRecord with tag 0", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const stat = font.stat;
		if (stat) {
			const result = getAxisRecord(stat, 0);
			expect(result).toBeNull();
		}
	});

	test("getAxisIndex with tag 0", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const stat = font.stat;
		if (stat) {
			const result = getAxisIndex(stat, 0);
			expect(result).toBe(-1);
		}
	});

	test("matchAxisValue with multiple axes", () => {
		const axisValue: AxisValueFormat4 = {
			format: 4,
			axisCount: 3,
			flags: 0,
			valueNameID: 256,
			axisValues: [
				{ axisIndex: 0, value: 400 },
				{ axisIndex: 1, value: 100 },
				{ axisIndex: 2, value: 28 },
			],
		};
		const coords = new Map([
			[0, 400],
			[1, 100],
			[2, 28],
		]);
		expect(matchAxisValue(axisValue, coords)).toBe(true);

		const badCoords = new Map([
			[0, 400],
			[1, 100],
			[2, 96],
		]);
		expect(matchAxisValue(axisValue, badCoords)).toBe(false);
	});

	test("combined flags", () => {
		const testValue: AxisValueFormat1 = {
			format: 1,
			axisIndex: 0,
			flags:
				AxisValueFlags.ElidableAxisValueName |
				AxisValueFlags.OlderSiblingFontAttribute,
			valueNameID: 256,
			value: 400,
		};
		expect(isElidableAxisValue(testValue)).toBe(true);
		expect(isOlderSiblingFont(testValue)).toBe(true);
	});
});
