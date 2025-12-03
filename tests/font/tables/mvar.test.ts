import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseMvar,
	getMetricDelta,
	getHAscenderDelta,
	getHDescenderDelta,
	getHLineGapDelta,
	getXHeightDelta,
	getCapHeightDelta,
	getUnderlineOffsetDelta,
	getUnderlineSizeDelta,
	getStrikeoutOffsetDelta,
	getStrikeoutSizeDelta,
	MvarTags,
	type MvarTable,
	type MvarValueRecord,
} from "../../../src/font/tables/mvar.ts";
import { tagToString, tag } from "../../../src/types.ts";
import { normalizeAxisValue, AxisTags } from "../../../src/font/tables/fvar.ts";

const SFNS_PATH = "/System/Library/Fonts/SFNS.ttf";
const NEW_YORK_PATH = "/System/Library/Fonts/NewYork.ttf";

describe("MVAR table - SFNS", () => {
	let font: Font;
	let mvar: MvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const mvarTable = font.mvar;
		if (!mvarTable) {
			throw new Error("SFNS.ttf does not have an MVAR table");
		}
		mvar = mvarTable;
	});

	describe("parseMvar", () => {
		test("returns MvarTable with version", () => {
			expect(mvar.majorVersion).toBe(1);
			expect(mvar.minorVersion).toBe(0);
		});

		test("has itemVariationStore", () => {
			expect(mvar.itemVariationStore).toBeDefined();
			expect(typeof mvar.itemVariationStore.format).toBe("number");
		});

		test("has valueRecords array", () => {
			expect(Array.isArray(mvar.valueRecords)).toBe(true);
			expect(mvar.valueRecords.length).toBeGreaterThan(0);
		});
	});

	describe("ItemVariationStore", () => {
		test("has valid format", () => {
			expect(mvar.itemVariationStore.format).toBe(1);
		});

		test("has variationRegions", () => {
			expect(Array.isArray(mvar.itemVariationStore.variationRegions)).toBe(
				true,
			);
			expect(mvar.itemVariationStore.variationRegions.length).toBeGreaterThan(
				0,
			);
		});

		test("has itemVariationData", () => {
			expect(Array.isArray(mvar.itemVariationStore.itemVariationData)).toBe(
				true,
			);
			expect(mvar.itemVariationStore.itemVariationData.length).toBeGreaterThan(
				0,
			);
		});

		test("variation regions have valid structure", () => {
			for (const region of mvar.itemVariationStore.variationRegions) {
				expect(Array.isArray(region.regionAxes)).toBe(true);
				expect(region.regionAxes.length).toBeGreaterThan(0);

				for (const axis of region.regionAxes) {
					expect(typeof axis.startCoord).toBe("number");
					expect(typeof axis.peakCoord).toBe("number");
					expect(typeof axis.endCoord).toBe("number");
					expect(axis.startCoord).toBeLessThanOrEqual(axis.peakCoord);
					expect(axis.peakCoord).toBeLessThanOrEqual(axis.endCoord);
				}
			}
		});

		test("itemVariationData has valid structure", () => {
			for (const varData of mvar.itemVariationStore.itemVariationData) {
				expect(typeof varData.itemCount).toBe("number");
				expect(varData.itemCount).toBeGreaterThan(0);
				expect(Array.isArray(varData.regionIndexes)).toBe(true);
				expect(Array.isArray(varData.deltaSets)).toBe(true);
				expect(varData.deltaSets.length).toBe(varData.itemCount);

				for (const deltaSet of varData.deltaSets) {
					expect(deltaSet.length).toBe(varData.regionIndexes.length);
					for (const delta of deltaSet) {
						expect(typeof delta).toBe("number");
						expect(Number.isFinite(delta)).toBe(true);
					}
				}
			}
		});
	});

	describe("MvarValueRecord", () => {
		test("all records have required properties", () => {
			for (const record of mvar.valueRecords) {
				expect(typeof record.valueTag).toBe("number");
				expect(typeof record.deltaSetOuterIndex).toBe("number");
				expect(typeof record.deltaSetInnerIndex).toBe("number");
			}
		});

		test("valueTag is readable", () => {
			for (const record of mvar.valueRecords) {
				const tagStr = tagToString(record.valueTag);
				expect(typeof tagStr).toBe("string");
				expect(tagStr.length).toBe(4);
			}
		});

		test("deltaSetOuterIndex references valid data", () => {
			for (const record of mvar.valueRecords) {
				expect(record.deltaSetOuterIndex).toBeGreaterThanOrEqual(0);
				expect(record.deltaSetOuterIndex).toBeLessThan(
					mvar.itemVariationStore.itemVariationData.length,
				);
			}
		});

		test("deltaSetInnerIndex is within itemCount", () => {
			for (const record of mvar.valueRecords) {
				const varData =
					mvar.itemVariationStore.itemVariationData[record.deltaSetOuterIndex];
				if (varData) {
					expect(record.deltaSetInnerIndex).toBeGreaterThanOrEqual(0);
					expect(record.deltaSetInnerIndex).toBeLessThan(varData.itemCount);
				}
			}
		});

		test("has common metric tags", () => {
			const tags = mvar.valueRecords.map((r) => r.valueTag);
			const tagStrings = tags.map((t) => tagToString(t));

			// Check for some expected metric tags
			const expectedTags = ["hasc", "hdsc", "hlgp", "cpht", "xhgt"];
			let foundCount = 0;
			for (const expected of expectedTags) {
				if (tagStrings.includes(expected)) {
					foundCount++;
				}
			}
			expect(foundCount).toBeGreaterThan(0);
		});
	});
});

describe("MvarTags constants", () => {
	test("hasc tag is correct", () => {
		expect(MvarTags.hasc).toBe(tag("hasc"));
		expect(tagToString(MvarTags.hasc)).toBe("hasc");
	});

	test("hdsc tag is correct", () => {
		expect(MvarTags.hdsc).toBe(tag("hdsc"));
		expect(tagToString(MvarTags.hdsc)).toBe("hdsc");
	});

	test("hlgp tag is correct", () => {
		expect(MvarTags.hlgp).toBe(tag("hlgp"));
		expect(tagToString(MvarTags.hlgp)).toBe("hlgp");
	});

	test("xhgt tag is correct", () => {
		expect(MvarTags.xhgt).toBe(tag("xhgt"));
		expect(tagToString(MvarTags.xhgt)).toBe("xhgt");
	});

	test("cpht tag is correct", () => {
		expect(MvarTags.cpht).toBe(tag("cpht"));
		expect(tagToString(MvarTags.cpht)).toBe("cpht");
	});

	test("all horizontal metric tags exist", () => {
		expect(MvarTags.hasc).toBeDefined();
		expect(MvarTags.hdsc).toBeDefined();
		expect(MvarTags.hlgp).toBeDefined();
		expect(MvarTags.hcla).toBeDefined();
		expect(MvarTags.hcld).toBeDefined();
		expect(MvarTags.hcof).toBeDefined();
		expect(MvarTags.hcrn).toBeDefined();
		expect(MvarTags.hcrs).toBeDefined();
	});

	test("all vertical metric tags exist", () => {
		expect(MvarTags.vasc).toBeDefined();
		expect(MvarTags.vdsc).toBeDefined();
		expect(MvarTags.vlgp).toBeDefined();
		expect(MvarTags.vcof).toBeDefined();
		expect(MvarTags.vcrn).toBeDefined();
		expect(MvarTags.vcrs).toBeDefined();
	});

	test("all OS/2 metric tags exist", () => {
		expect(MvarTags.xhgt).toBeDefined();
		expect(MvarTags.cpht).toBeDefined();
		expect(MvarTags.sbxs).toBeDefined();
		expect(MvarTags.sbys).toBeDefined();
		expect(MvarTags.sbxo).toBeDefined();
		expect(MvarTags.sbyo).toBeDefined();
		expect(MvarTags.spxs).toBeDefined();
		expect(MvarTags.spys).toBeDefined();
		expect(MvarTags.spxo).toBeDefined();
		expect(MvarTags.spyo).toBeDefined();
		expect(MvarTags.strs).toBeDefined();
		expect(MvarTags.stro).toBeDefined();
		expect(MvarTags.undo).toBeDefined();
		expect(MvarTags.unds).toBeDefined();
	});

	test("all glyph bound tags exist", () => {
		expect(MvarTags.gsp0).toBeDefined();
		expect(MvarTags.gsp1).toBeDefined();
		expect(MvarTags.gsp2).toBeDefined();
		expect(MvarTags.gsp3).toBeDefined();
	});
});

describe("getMetricDelta - SFNS", () => {
	let font: Font;
	let mvar: MvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const mvarTable = font.mvar;
		if (!mvarTable) {
			throw new Error("SFNS.ttf does not have an MVAR table");
		}
		mvar = mvarTable;
	});

	test("returns 0 for non-existent tag", () => {
		const coords = [0, 0, 0, 0];
		const delta = getMetricDelta(mvar, tag("FAKE"), coords);
		expect(delta).toBe(0);
	});

	test("returns 0 at default coordinates", () => {
		const coords = [0, 0, 0, 0];
		for (const record of mvar.valueRecords) {
			const delta = getMetricDelta(mvar, record.valueTag, coords);
			expect(delta).toBe(0);
		}
	});

	test("returns numeric delta for existing tags", () => {
		const coords = [0.5, 0, 0, 0.5];
		for (const record of mvar.valueRecords) {
			const delta = getMetricDelta(mvar, record.valueTag, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("returns integer delta", () => {
		const coords = [0.5, 0, 0, 0.5];
		for (const record of mvar.valueRecords) {
			const delta = getMetricDelta(mvar, record.valueTag, coords);
			expect(Number.isInteger(delta)).toBe(true);
		}
	});

	test("delta changes with different coordinates", () => {
		const coords1 = [0, 0, 0, 0];
		const coords2 = [1.0, 0, 0, 0];

		let foundDifference = false;
		for (const record of mvar.valueRecords) {
			const delta1 = getMetricDelta(mvar, record.valueTag, coords1);
			const delta2 = getMetricDelta(mvar, record.valueTag, coords2);
			if (delta1 !== delta2) {
				foundDifference = true;
				break;
			}
		}
		expect(foundDifference).toBe(true);
	});

	test("deltas are reasonable", () => {
		const coords = [1.0, 1.0, 1.0, 1.0];
		for (const record of mvar.valueRecords) {
			const delta = getMetricDelta(mvar, record.valueTag, coords);
			// Metric deltas should be reasonable (not millions)
			expect(Math.abs(delta)).toBeLessThan(10000);
		}
	});
});

describe("specific metric delta functions", () => {
	let font: Font;
	let mvar: MvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const mvarTable = font.mvar;
		if (!mvarTable) {
			throw new Error("SFNS.ttf does not have an MVAR table");
		}
		mvar = mvarTable;
	});

	test("getHAscenderDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getHAscenderDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("getHDescenderDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getHDescenderDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("getHLineGapDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getHLineGapDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("getXHeightDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getXHeightDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("getCapHeightDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getCapHeightDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("getUnderlineOffsetDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getUnderlineOffsetDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("getUnderlineSizeDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getUnderlineSizeDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("getStrikeoutOffsetDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getStrikeoutOffsetDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("getStrikeoutSizeDelta returns numeric value", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getStrikeoutSizeDelta(mvar, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
		expect(Number.isInteger(delta)).toBe(true);
	});

	test("metrics return 0 at default coordinates", () => {
		const coords = [0, 0, 0, 0];
		expect(getHAscenderDelta(mvar, coords)).toBe(0);
		expect(getHDescenderDelta(mvar, coords)).toBe(0);
		expect(getHLineGapDelta(mvar, coords)).toBe(0);
		expect(getXHeightDelta(mvar, coords)).toBe(0);
		expect(getCapHeightDelta(mvar, coords)).toBe(0);
		expect(getUnderlineOffsetDelta(mvar, coords)).toBe(0);
		expect(getUnderlineSizeDelta(mvar, coords)).toBe(0);
		expect(getStrikeoutOffsetDelta(mvar, coords)).toBe(0);
		expect(getStrikeoutSizeDelta(mvar, coords)).toBe(0);
	});

	test("at least some metrics vary with weight", () => {
		if (!font.fvar) {
			throw new Error("Font has no fvar table");
		}

		const wghtAxis = font.fvar.axes.find((a) => a.tag === AxisTags.wght);
		if (!wghtAxis) {
			throw new Error("Font has no wght axis");
		}

		const normalizedBold = normalizeAxisValue(wghtAxis, 700);
		const coords = [0, 0, 0, normalizedBold];

		const metrics = [
			getHAscenderDelta(mvar, coords),
			getHDescenderDelta(mvar, coords),
			getXHeightDelta(mvar, coords),
			getCapHeightDelta(mvar, coords),
			getUnderlineOffsetDelta(mvar, coords),
			getUnderlineSizeDelta(mvar, coords),
		];

		const hasNonZero = metrics.some((m) => m !== 0);
		expect(hasNonZero).toBe(true);
	});
});

describe("MVAR table - New York", () => {
	let font: Font;
	let mvar: MvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(NEW_YORK_PATH);
		const mvarTable = font.mvar;
		if (!mvarTable) {
			throw new Error("NewYork.ttf does not have an MVAR table");
		}
		mvar = mvarTable;
	});

	test("has valid structure", () => {
		expect(mvar.majorVersion).toBe(1);
		expect(mvar.minorVersion).toBe(0);
		expect(mvar.itemVariationStore).toBeDefined();
		expect(mvar.valueRecords.length).toBeGreaterThan(0);
	});

	test("can calculate metric deltas", () => {
		const coords = [0.5, 0.5, 0];
		for (const record of mvar.valueRecords) {
			const delta = getMetricDelta(mvar, record.valueTag, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("all metric functions work", () => {
		const coords = [0.5, 0.5, 0];
		expect(typeof getHAscenderDelta(mvar, coords)).toBe("number");
		expect(typeof getHDescenderDelta(mvar, coords)).toBe("number");
		expect(typeof getHLineGapDelta(mvar, coords)).toBe("number");
		expect(typeof getXHeightDelta(mvar, coords)).toBe("number");
		expect(typeof getCapHeightDelta(mvar, coords)).toBe("number");
	});
});

describe("edge cases", () => {
	let mvar: MvarTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const mvarTable = font.mvar;
		if (!mvarTable) {
			throw new Error("SFNS.ttf does not have an MVAR table");
		}
		mvar = mvarTable;
	});

	test("handles empty coordinate array", () => {
		const delta = getHAscenderDelta(mvar, []);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles coordinate array shorter than axes", () => {
		const delta = getHAscenderDelta(mvar, [0.5]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles coordinate array longer than axes", () => {
		const delta = getHAscenderDelta(mvar, [0, 0, 0, 0, 0, 0, 0, 0]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles very large coordinate values", () => {
		const delta = getXHeightDelta(mvar, [10.0, 10.0, 10.0, 10.0]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles very small coordinate values", () => {
		const delta = getXHeightDelta(mvar, [-10.0, -10.0, -10.0, -10.0]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles mixed positive and negative coordinates", () => {
		const delta = getCapHeightDelta(mvar, [-0.5, 0.5, -0.5, 0.5]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("all metric functions handle invalid coordinates", () => {
		const coords = [100, -100, 50, -50];
		expect(Number.isFinite(getHAscenderDelta(mvar, coords))).toBe(true);
		expect(Number.isFinite(getHDescenderDelta(mvar, coords))).toBe(true);
		expect(Number.isFinite(getHLineGapDelta(mvar, coords))).toBe(true);
		expect(Number.isFinite(getXHeightDelta(mvar, coords))).toBe(true);
		expect(Number.isFinite(getCapHeightDelta(mvar, coords))).toBe(true);
		expect(Number.isFinite(getUnderlineOffsetDelta(mvar, coords))).toBe(true);
		expect(Number.isFinite(getUnderlineSizeDelta(mvar, coords))).toBe(true);
		expect(Number.isFinite(getStrikeoutOffsetDelta(mvar, coords))).toBe(true);
		expect(Number.isFinite(getStrikeoutSizeDelta(mvar, coords))).toBe(true);
	});
});

describe("metric delta consistency", () => {
	let mvar: MvarTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const mvarTable = font.mvar;
		if (!mvarTable) {
			throw new Error("SFNS.ttf does not have an MVAR table");
		}
		mvar = mvarTable;
	});

	test("same coordinates return same delta", () => {
		const coords = [0.5, 0.25, 0.75, 0.5];
		const delta1 = getHAscenderDelta(mvar, coords);
		const delta2 = getHAscenderDelta(mvar, coords);
		expect(delta1).toBe(delta2);
	});

	test("metric delta is deterministic", () => {
		const coords = [0.3, 0.6, 0.2, 0.8];
		const results: number[] = [];
		for (let i = 0; i < 10; i++) {
			results.push(getCapHeightDelta(mvar, coords));
		}
		expect(new Set(results).size).toBe(1);
	});

	test("all metrics use same ItemVariationStore", () => {
		const coords = [0.5, 0.5, 0.5, 0.5];

		// Get all metric deltas
		const deltas = mvar.valueRecords.map((record) =>
			getMetricDelta(mvar, record.valueTag, coords),
		);

		// Check that we got results for all records
		expect(deltas.length).toBe(mvar.valueRecords.length);

		// All should be numbers
		for (const delta of deltas) {
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});
});
