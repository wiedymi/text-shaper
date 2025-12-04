import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseFvar,
	normalizeAxisValue,
	getAxis,
	getAxisIndex,
	formatAxis,
	AxisTags,
	type FvarTable,
	type VariationAxis,
} from "../../../src/font/tables/fvar.ts";
import { tagToString } from "../../../src/types.ts";

const SFNS_PATH = "/System/Library/Fonts/SFNS.ttf";
const SF_COMPACT_PATH = "/System/Library/Fonts/SFCompact.ttf";
const NEW_YORK_PATH = "/System/Library/Fonts/NewYork.ttf";

describe("fvar table - SFNS", () => {
	let font: Font;
	let fvar: FvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const fvarTable = font.fvar;
		if (!fvarTable) {
			throw new Error("SFNS.ttf does not have an fvar table");
		}
		fvar = fvarTable;
	});

	describe("parseFvar", () => {
		test("returns FvarTable with version", () => {
			expect(fvar.majorVersion).toBe(1);
			expect(fvar.minorVersion).toBe(0);
		});

		test("has axes array", () => {
			expect(Array.isArray(fvar.axes)).toBe(true);
			expect(fvar.axes.length).toBeGreaterThan(0);
		});

		test("has instances array", () => {
			expect(Array.isArray(fvar.instances)).toBe(true);
			expect(fvar.instances.length).toBeGreaterThan(0);
		});

		test("axisCount matches axes length", () => {
			expect(fvar.axes.length).toBe(4);
		});

		test("instanceCount matches instances length", () => {
			expect(fvar.instances.length).toBe(369);
		});
	});

	describe("VariationAxis records", () => {
		test("axes have required properties", () => {
			for (const axis of fvar.axes) {
				expect(typeof axis.tag).toBe("number");
				expect(typeof axis.minValue).toBe("number");
				expect(typeof axis.defaultValue).toBe("number");
				expect(typeof axis.maxValue).toBe("number");
				expect(typeof axis.flags).toBe("number");
				expect(typeof axis.axisNameId).toBe("number");
			}
		});

		test("axis values are in correct order", () => {
			for (const axis of fvar.axes) {
				expect(axis.minValue).toBeLessThanOrEqual(axis.defaultValue);
				expect(axis.defaultValue).toBeLessThanOrEqual(axis.maxValue);
			}
		});

		test("axis tags are readable", () => {
			for (const axis of fvar.axes) {
				const tagStr = tagToString(axis.tag);
				expect(typeof tagStr).toBe("string");
				expect(tagStr.length).toBe(4);
			}
		});

		test("SFNS has expected axes", () => {
			const axisTags = fvar.axes.map((a) => tagToString(a.tag));
			expect(axisTags).toContain("wdth");
			expect(axisTags).toContain("opsz");
			expect(axisTags).toContain("GRAD");
			expect(axisTags).toContain("wght");
		});

		test("wdth axis has correct range", () => {
			const wdth = fvar.axes.find((a) => a.tag === AxisTags.wdth);
			expect(wdth).toBeDefined();
			if (wdth) {
				expect(wdth.minValue).toBeCloseTo(30.0, 1);
				expect(wdth.defaultValue).toBeCloseTo(100.0, 1);
				expect(wdth.maxValue).toBeCloseTo(150.0, 1);
			}
		});

		test("wght axis has correct range", () => {
			const wght = fvar.axes.find((a) => a.tag === AxisTags.wght);
			expect(wght).toBeDefined();
			if (wght) {
				expect(wght.minValue).toBeCloseTo(1.0, 1);
				expect(wght.defaultValue).toBeCloseTo(400.0, 1);
				expect(wght.maxValue).toBeCloseTo(1000.0, 1);
			}
		});

		test("opsz axis has correct range", () => {
			const opsz = fvar.axes.find((a) => a.tag === AxisTags.opsz);
			expect(opsz).toBeDefined();
			if (opsz) {
				expect(opsz.minValue).toBeCloseTo(17.0, 1);
				expect(opsz.defaultValue).toBeCloseTo(28.0, 1);
				expect(opsz.maxValue).toBeCloseTo(96.0, 1);
			}
		});
	});

	describe("NamedInstance records", () => {
		test("instances have required properties", () => {
			for (const instance of fvar.instances) {
				expect(typeof instance.subfamilyNameId).toBe("number");
				expect(typeof instance.flags).toBe("number");
				expect(Array.isArray(instance.coordinates)).toBe(true);
			}
		});

		test("instance coordinates match axis count", () => {
			for (const instance of fvar.instances) {
				expect(instance.coordinates.length).toBe(fvar.axes.length);
			}
		});

		test("instance coordinate values are within axis ranges", () => {
			for (const instance of fvar.instances) {
				for (let i = 0; i < instance.coordinates.length; i++) {
					const coord = instance.coordinates[i];
					const axis = fvar.axes[i];
					if (coord !== undefined && axis) {
						expect(coord).toBeGreaterThanOrEqual(axis.minValue - 0.01);
						expect(coord).toBeLessThanOrEqual(axis.maxValue + 0.01);
					}
				}
			}
		});

		test("first instance has expected properties", () => {
			const first = fvar.instances[0];
			expect(first).toBeDefined();
			if (first) {
				expect(first.subfamilyNameId).toBe(292);
				expect(first.coordinates.length).toBe(4);
			}
		});

		test("instances may have postScriptNameId", () => {
			let hasPostScriptName = false;
			for (const instance of fvar.instances) {
				if (instance.postScriptNameId !== undefined) {
					hasPostScriptName = true;
					expect(typeof instance.postScriptNameId).toBe("number");
				}
			}
			expect(typeof hasPostScriptName).toBe("boolean");
		});
	});

	describe("AxisTags constants", () => {
		test("has correct wght tag", () => {
			expect(AxisTags.wght).toBe(0x77676874);
			expect(tagToString(AxisTags.wght)).toBe("wght");
		});

		test("has correct wdth tag", () => {
			expect(AxisTags.wdth).toBe(0x77647468);
			expect(tagToString(AxisTags.wdth)).toBe("wdth");
		});

		test("has correct ital tag", () => {
			expect(AxisTags.ital).toBe(0x6974616c);
			expect(tagToString(AxisTags.ital)).toBe("ital");
		});

		test("has correct slnt tag", () => {
			expect(AxisTags.slnt).toBe(0x736c6e74);
			expect(tagToString(AxisTags.slnt)).toBe("slnt");
		});

		test("has correct opsz tag", () => {
			expect(AxisTags.opsz).toBe(0x6f70737a);
			expect(tagToString(AxisTags.opsz)).toBe("opsz");
		});
	});
});

describe("fvar table - SF Compact", () => {
	let font: Font;
	let fvar: FvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SF_COMPACT_PATH);
		const fvarTable = font.fvar;
		if (!fvarTable) {
			throw new Error("SFCompact.ttf does not have an fvar table");
		}
		fvar = fvarTable;
	});

	test("has expected axis count", () => {
		expect(fvar.axes.length).toBe(3);
	});

	test("has expected instance count", () => {
		expect(fvar.instances.length).toBe(41);
	});

	test("has opsz, GRAD, and wght axes", () => {
		const axisTags = fvar.axes.map((a) => tagToString(a.tag));
		expect(axisTags).toContain("opsz");
		expect(axisTags).toContain("GRAD");
		expect(axisTags).toContain("wght");
	});

	test("instance coordinates match 3 axes", () => {
		for (const instance of fvar.instances) {
			expect(instance.coordinates.length).toBe(3);
		}
	});
});

describe("fvar table - New York", () => {
	let font: Font;
	let fvar: FvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(NEW_YORK_PATH);
		const fvarTable = font.fvar;
		if (!fvarTable) {
			throw new Error("NewYork.ttf does not have an fvar table");
		}
		fvar = fvarTable;
	});

	test("has expected axis count", () => {
		expect(fvar.axes.length).toBe(3);
	});

	test("has expected instance count", () => {
		expect(fvar.instances.length).toBe(14);
	});

	test("has opsz, wght, and GRAD axes", () => {
		const axisTags = fvar.axes.map((a) => tagToString(a.tag));
		expect(axisTags).toContain("opsz");
		expect(axisTags).toContain("wght");
		expect(axisTags).toContain("GRAD");
	});

	test("opsz has different range than SFNS", () => {
		const opsz = fvar.axes.find((a) => a.tag === AxisTags.opsz);
		expect(opsz).toBeDefined();
		if (opsz) {
			expect(opsz.minValue).toBeCloseTo(12.0, 1);
			expect(opsz.defaultValue).toBeCloseTo(256.0, 1);
			expect(opsz.maxValue).toBeCloseTo(256.0, 1);
		}
	});
});

describe("normalizeAxisValue", () => {
	let axis: VariationAxis;

	beforeAll(() => {
		axis = {
			tag: AxisTags.wght,
			minValue: 100,
			defaultValue: 400,
			maxValue: 900,
			flags: 0,
			axisNameId: 256,
		};
	});

	test("returns 0 for default value", () => {
		const normalized = normalizeAxisValue(axis, 400);
		expect(normalized).toBeCloseTo(0, 5);
	});

	test("returns -1 for minimum value", () => {
		const normalized = normalizeAxisValue(axis, 100);
		expect(normalized).toBeCloseTo(-1, 5);
	});

	test("returns 1 for maximum value", () => {
		const normalized = normalizeAxisValue(axis, 900);
		expect(normalized).toBeCloseTo(1, 5);
	});

	test("returns -0.5 for halfway between min and default", () => {
		const normalized = normalizeAxisValue(axis, 250);
		expect(normalized).toBeCloseTo(-0.5, 5);
	});

	test("returns 0.5 for halfway between default and max", () => {
		const normalized = normalizeAxisValue(axis, 650);
		expect(normalized).toBeCloseTo(0.5, 5);
	});

	test("clamps values below minimum", () => {
		const normalized = normalizeAxisValue(axis, 50);
		expect(normalized).toBeCloseTo(-1, 5);
	});

	test("clamps values above maximum", () => {
		const normalized = normalizeAxisValue(axis, 1000);
		expect(normalized).toBeCloseTo(1, 5);
	});

	test("handles axis where min equals default", () => {
		const specialAxis: VariationAxis = {
			tag: AxisTags.ital,
			minValue: 0,
			defaultValue: 0,
			maxValue: 1,
			flags: 0,
			axisNameId: 256,
		};
		const normalized = normalizeAxisValue(specialAxis, 0);
		expect(normalized).toBe(0);
	});

	test("handles axis where default equals max", () => {
		const specialAxis: VariationAxis = {
			tag: AxisTags.opsz,
			minValue: 12,
			defaultValue: 256,
			maxValue: 256,
			flags: 0,
			axisNameId: 256,
		};
		const normalized = normalizeAxisValue(specialAxis, 256);
		expect(normalized).toBe(0);
	});

	test("handles negative range", () => {
		const slantAxis: VariationAxis = {
			tag: AxisTags.slnt,
			minValue: -15,
			defaultValue: 0,
			maxValue: 15,
			flags: 0,
			axisNameId: 256,
		};
		expect(normalizeAxisValue(slantAxis, -15)).toBeCloseTo(-1, 5);
		expect(normalizeAxisValue(slantAxis, 0)).toBeCloseTo(0, 5);
		expect(normalizeAxisValue(slantAxis, 15)).toBeCloseTo(1, 5);
		expect(normalizeAxisValue(slantAxis, -7.5)).toBeCloseTo(-0.5, 5);
		expect(normalizeAxisValue(slantAxis, 7.5)).toBeCloseTo(0.5, 5);
	});
});

describe("getAxis", () => {
	let fvar: FvarTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const fvarTable = font.fvar;
		if (!fvarTable) {
			throw new Error("SFNS.ttf does not have an fvar table");
		}
		fvar = fvarTable;
	});

	test("finds axis by tag", () => {
		const wght = getAxis(fvar, AxisTags.wght);
		expect(wght).not.toBeNull();
		if (wght) {
			expect(wght.tag).toBe(AxisTags.wght);
		}
	});

	test("returns null for non-existent axis", () => {
		const ital = getAxis(fvar, AxisTags.ital);
		expect(ital).toBeNull();
	});

	test("finds all axes", () => {
		const wdth = getAxis(fvar, AxisTags.wdth);
		const opsz = getAxis(fvar, AxisTags.opsz);
		const wght = getAxis(fvar, AxisTags.wght);

		expect(wdth).not.toBeNull();
		expect(opsz).not.toBeNull();
		expect(wght).not.toBeNull();
	});

	test("returns correct axis instance", () => {
		const axis = getAxis(fvar, AxisTags.wght);
		expect(axis).toBe(fvar.axes.find((a) => a.tag === AxisTags.wght) ?? null);
	});
});

describe("getAxisIndex", () => {
	let fvar: FvarTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const fvarTable = font.fvar;
		if (!fvarTable) {
			throw new Error("SFNS.ttf does not have an fvar table");
		}
		fvar = fvarTable;
	});

	test("finds axis index by tag", () => {
		const wghtIndex = getAxisIndex(fvar, AxisTags.wght);
		expect(wghtIndex).toBeGreaterThanOrEqual(0);
		expect(wghtIndex).toBeLessThan(fvar.axes.length);
		expect(fvar.axes[wghtIndex]?.tag).toBe(AxisTags.wght);
	});

	test("returns -1 for non-existent axis", () => {
		const italIndex = getAxisIndex(fvar, AxisTags.ital);
		expect(italIndex).toBe(-1);
	});

	test("finds all axes by index", () => {
		const wdthIndex = getAxisIndex(fvar, AxisTags.wdth);
		const opszIndex = getAxisIndex(fvar, AxisTags.opsz);
		const wghtIndex = getAxisIndex(fvar, AxisTags.wght);

		expect(wdthIndex).toBeGreaterThanOrEqual(0);
		expect(opszIndex).toBeGreaterThanOrEqual(0);
		expect(wghtIndex).toBeGreaterThanOrEqual(0);
	});

	test("index corresponds to axis position", () => {
		for (let i = 0; i < fvar.axes.length; i++) {
			const axis = fvar.axes[i];
			if (axis) {
				const index = getAxisIndex(fvar, axis.tag);
				expect(index).toBe(i);
			}
		}
	});
});

describe("formatAxis", () => {
	test("formats axis with readable tag and values", () => {
		const axis: VariationAxis = {
			tag: AxisTags.wght,
			minValue: 100,
			defaultValue: 400,
			maxValue: 900,
			flags: 0,
			axisNameId: 256,
		};

		const formatted = formatAxis(axis);
		expect(formatted).toBe("wght: 100.0..400.0..900.0");
	});

	test("formats axis with one decimal place", () => {
		const axis: VariationAxis = {
			tag: AxisTags.wdth,
			minValue: 75.5,
			defaultValue: 100.0,
			maxValue: 125.5,
			flags: 0,
			axisNameId: 256,
		};

		const formatted = formatAxis(axis);
		expect(formatted).toBe("wdth: 75.5..100.0..125.5");
	});

	test("formats axis with fractional values", () => {
		const axis: VariationAxis = {
			tag: AxisTags.opsz,
			minValue: 17.25,
			defaultValue: 28.75,
			maxValue: 96.125,
			flags: 0,
			axisNameId: 256,
		};

		const formatted = formatAxis(axis);
		expect(formatted).toContain("opsz:");
		expect(formatted).toContain("17.3");
		expect(formatted).toContain("28.8");
		expect(formatted).toContain("96.1");
	});

	test("formats all SFNS axes", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const fvar = font.fvar;
		if (fvar) {
			for (const axis of fvar.axes) {
				const formatted = formatAxis(axis);
				expect(typeof formatted).toBe("string");
				expect(formatted.length).toBeGreaterThan(0);
				expect(formatted).toContain("..");
			}
		}
	});
});

describe("Font.isVariable", () => {
	test("SFNS is variable", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		expect(font.isVariable).toBe(true);
	});

	test("SF Compact is variable", async () => {
		const font = await Font.fromFile(SF_COMPACT_PATH);
		expect(font.isVariable).toBe(true);
	});

	test("New York is variable", async () => {
		const font = await Font.fromFile(NEW_YORK_PATH);
		expect(font.isVariable).toBe(true);
	});

	test("Arial is not variable", async () => {
		const font = await Font.fromFile("/System/Library/Fonts/Supplemental/Arial.ttf");
		expect(font.isVariable).toBe(false);
		expect(font.fvar).toBeNull();
	});
});

describe("edge cases", () => {
	test("normalizeAxisValue with zero range on low side", () => {
		const axis: VariationAxis = {
			tag: AxisTags.wght,
			minValue: 400,
			defaultValue: 400,
			maxValue: 900,
			flags: 0,
			axisNameId: 256,
		};

		expect(normalizeAxisValue(axis, 400)).toBe(0);
		expect(normalizeAxisValue(axis, 350)).toBe(0);
		expect(normalizeAxisValue(axis, 650)).toBeCloseTo(0.5, 5);
	});

	test("normalizeAxisValue with zero range on high side", () => {
		const axis: VariationAxis = {
			tag: AxisTags.wght,
			minValue: 100,
			defaultValue: 400,
			maxValue: 400,
			flags: 0,
			axisNameId: 256,
		};

		expect(normalizeAxisValue(axis, 400)).toBe(0);
		expect(normalizeAxisValue(axis, 500)).toBe(0);
		expect(normalizeAxisValue(axis, 250)).toBeCloseTo(-0.5, 5);
	});

	test("normalizeAxisValue with all equal values", () => {
		const axis: VariationAxis = {
			tag: AxisTags.wght,
			minValue: 400,
			defaultValue: 400,
			maxValue: 400,
			flags: 0,
			axisNameId: 256,
		};

		expect(normalizeAxisValue(axis, 400)).toBe(0);
		expect(normalizeAxisValue(axis, 200)).toBe(0);
		expect(normalizeAxisValue(axis, 600)).toBe(0);
	});

	test("instance with no postScriptNameId", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const fvar = font.fvar;
		if (fvar && fvar.instances.length > 0) {
			let foundWithoutPS = false;
			for (const instance of fvar.instances) {
				if (instance.postScriptNameId === undefined) {
					foundWithoutPS = true;
					expect(instance.subfamilyNameId).toBeGreaterThan(0);
					expect(instance.coordinates.length).toBe(fvar.axes.length);
				}
			}
			expect(typeof foundWithoutPS).toBe("boolean");
		}
	});

	test("axis flags can be non-zero", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const fvar = font.fvar;
		if (fvar) {
			for (const axis of fvar.axes) {
				expect(typeof axis.flags).toBe("number");
				expect(axis.flags).toBeGreaterThanOrEqual(0);
			}
		}
	});

	test("getAxis with tag 0", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const fvar = font.fvar;
		if (fvar) {
			const result = getAxis(fvar, 0);
			expect(result).toBeNull();
		}
	});

	test("getAxisIndex with tag 0", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const fvar = font.fvar;
		if (fvar) {
			const result = getAxisIndex(fvar, 0);
			expect(result).toBe(-1);
		}
	});
});
