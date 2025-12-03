import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseHvar,
	calculateRegionScalar,
	getAdvanceWidthDelta,
	getLsbDelta,
	getRsbDelta,
	type HvarTable,
	type ItemVariationStore,
	type VariationRegion,
	type DeltaSetIndexMap,
} from "../../../src/font/tables/hvar.ts";
import { normalizeAxisValue, AxisTags } from "../../../src/font/tables/fvar.ts";

const SFNS_PATH = "/System/Library/Fonts/SFNS.ttf";
const NEW_YORK_PATH = "/System/Library/Fonts/NewYork.ttf";

describe("HVAR table - SFNS", () => {
	let font: Font;
	let hvar: HvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const hvarTable = font.hvar;
		if (!hvarTable) {
			throw new Error("SFNS.ttf does not have an HVAR table");
		}
		hvar = hvarTable;
	});

	describe("parseHvar", () => {
		test("returns HvarTable with version", () => {
			expect(hvar.majorVersion).toBe(1);
			expect(hvar.minorVersion).toBe(0);
		});

		test("has itemVariationStore", () => {
			expect(hvar.itemVariationStore).toBeDefined();
			expect(typeof hvar.itemVariationStore.format).toBe("number");
		});

		test("has advanceWidthMapping", () => {
			expect(hvar.advanceWidthMapping).not.toBeNull();
		});

		test("has lsbMapping or is null", () => {
			if (hvar.lsbMapping) {
				expect(typeof hvar.lsbMapping.format).toBe("number");
			}
		});

		test("has rsbMapping or is null", () => {
			if (hvar.rsbMapping) {
				expect(typeof hvar.rsbMapping.format).toBe("number");
			}
		});
	});

	describe("ItemVariationStore", () => {
		let store: ItemVariationStore;

		beforeAll(() => {
			store = hvar.itemVariationStore;
		});

		test("has valid format", () => {
			expect(store.format).toBe(1);
		});

		test("has variationRegions array", () => {
			expect(Array.isArray(store.variationRegions)).toBe(true);
			expect(store.variationRegions.length).toBeGreaterThan(0);
		});

		test("has itemVariationData array", () => {
			expect(Array.isArray(store.itemVariationData)).toBe(true);
			expect(store.itemVariationData.length).toBeGreaterThan(0);
		});

		test("variation regions have regionAxes", () => {
			for (const region of store.variationRegions) {
				expect(Array.isArray(region.regionAxes)).toBe(true);
				expect(region.regionAxes.length).toBeGreaterThan(0);
			}
		});

		test("region axes have valid coordinates", () => {
			for (const region of store.variationRegions) {
				for (const axis of region.regionAxes) {
					expect(typeof axis.startCoord).toBe("number");
					expect(typeof axis.peakCoord).toBe("number");
					expect(typeof axis.endCoord).toBe("number");
					// Coordinates should be in valid F2DOT14 range (-2 to ~2)
					expect(axis.startCoord).toBeGreaterThanOrEqual(-2);
					expect(axis.startCoord).toBeLessThanOrEqual(2);
					expect(axis.peakCoord).toBeGreaterThanOrEqual(-2);
					expect(axis.peakCoord).toBeLessThanOrEqual(2);
					expect(axis.endCoord).toBeGreaterThanOrEqual(-2);
					expect(axis.endCoord).toBeLessThanOrEqual(2);
				}
			}
		});

		test("region axes are properly ordered", () => {
			for (const region of store.variationRegions) {
				for (const axis of region.regionAxes) {
					expect(axis.startCoord).toBeLessThanOrEqual(axis.peakCoord);
					expect(axis.peakCoord).toBeLessThanOrEqual(axis.endCoord);
				}
			}
		});

		test("itemVariationData has required properties", () => {
			for (const varData of store.itemVariationData) {
				expect(typeof varData.itemCount).toBe("number");
				expect(varData.itemCount).toBeGreaterThan(0);
				expect(Array.isArray(varData.regionIndexes)).toBe(true);
				expect(Array.isArray(varData.deltaSets)).toBe(true);
			}
		});

		test("deltaSets match itemCount", () => {
			for (const varData of store.itemVariationData) {
				expect(varData.deltaSets.length).toBe(varData.itemCount);
			}
		});

		test("each deltaSet has correct length", () => {
			for (const varData of store.itemVariationData) {
				for (const deltaSet of varData.deltaSets) {
					expect(deltaSet.length).toBe(varData.regionIndexes.length);
				}
			}
		});

		test("regionIndexes reference valid regions", () => {
			for (const varData of store.itemVariationData) {
				for (const regionIndex of varData.regionIndexes) {
					expect(regionIndex).toBeGreaterThanOrEqual(0);
					expect(regionIndex).toBeLessThan(store.variationRegions.length);
				}
			}
		});

		test("deltas are numeric values", () => {
			for (const varData of store.itemVariationData) {
				for (const deltaSet of varData.deltaSets) {
					for (const delta of deltaSet) {
						expect(typeof delta).toBe("number");
						expect(Number.isFinite(delta)).toBe(true);
					}
				}
			}
		});
	});

	describe("DeltaSetIndexMap", () => {
		test("advanceWidthMapping has valid format", () => {
			const mapping = hvar.advanceWidthMapping;
			if (mapping) {
				expect(mapping.format).toBeGreaterThanOrEqual(0);
				expect(mapping.format).toBeLessThanOrEqual(1);
			}
		});

		test("advanceWidthMapping has mapCount", () => {
			const mapping = hvar.advanceWidthMapping;
			if (mapping) {
				expect(typeof mapping.mapCount).toBe("number");
				expect(mapping.mapCount).toBeGreaterThan(0);
			}
		});

		test("advanceWidthMapping has entryFormat", () => {
			const mapping = hvar.advanceWidthMapping;
			if (mapping) {
				expect(typeof mapping.entryFormat).toBe("number");
				expect(typeof mapping.innerIndexBitCount).toBe("number");
				expect(mapping.innerIndexBitCount).toBeGreaterThan(0);
			}
		});

		test("mapData has correct length", () => {
			const mapping = hvar.advanceWidthMapping;
			if (mapping) {
				expect(mapping.mapData.length).toBe(mapping.mapCount);
			}
		});

		test("mapData entries have outer and inner indexes", () => {
			const mapping = hvar.advanceWidthMapping;
			if (mapping) {
				for (const entry of mapping.mapData) {
					expect(typeof entry.outer).toBe("number");
					expect(typeof entry.inner).toBe("number");
					expect(entry.outer).toBeGreaterThanOrEqual(0);
					expect(entry.inner).toBeGreaterThanOrEqual(0);
				}
			}
		});

		test("outer indexes reference valid variation data", () => {
			const mapping = hvar.advanceWidthMapping;
			if (mapping) {
				for (const entry of mapping.mapData) {
					expect(entry.outer).toBeLessThan(
						hvar.itemVariationStore.itemVariationData.length,
					);
				}
			}
		});
	});
});

describe("calculateRegionScalar", () => {
	test("returns 1.0 when all coordinates match peak", () => {
		const region: VariationRegion = {
			regionAxes: [
				{ startCoord: -1.0, peakCoord: 0.0, endCoord: 1.0 },
				{ startCoord: -1.0, peakCoord: 0.5, endCoord: 1.0 },
			],
		};
		const coords = [0.0, 0.5];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBeCloseTo(1.0, 5);
	});

	test("returns 0 when coordinate is outside region", () => {
		const region: VariationRegion = {
			regionAxes: [{ startCoord: 0.0, peakCoord: 0.5, endCoord: 1.0 }],
		};
		const coords = [-0.5];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBe(0);
	});

	test("returns 0 when coordinate is above endCoord", () => {
		const region: VariationRegion = {
			regionAxes: [{ startCoord: 0.0, peakCoord: 0.5, endCoord: 1.0 }],
		};
		const coords = [1.5];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBe(0);
	});

	test("interpolates between start and peak", () => {
		const region: VariationRegion = {
			regionAxes: [{ startCoord: 0.0, peakCoord: 1.0, endCoord: 1.0 }],
		};
		const coords = [0.5];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBeCloseTo(0.5, 5);
	});

	test("interpolates between peak and end", () => {
		const region: VariationRegion = {
			regionAxes: [{ startCoord: 0.0, peakCoord: 0.5, endCoord: 1.0 }],
		};
		const coords = [0.75];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBeCloseTo(0.5, 5);
	});

	test("handles multiple axes with multiplication", () => {
		const region: VariationRegion = {
			regionAxes: [
				{ startCoord: 0.0, peakCoord: 1.0, endCoord: 1.0 },
				{ startCoord: 0.0, peakCoord: 1.0, endCoord: 1.0 },
			],
		};
		const coords = [0.5, 0.5];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBeCloseTo(0.25, 5);
	});

	test("returns 0 if any axis is outside range", () => {
		const region: VariationRegion = {
			regionAxes: [
				{ startCoord: 0.0, peakCoord: 1.0, endCoord: 1.0 },
				{ startCoord: 0.0, peakCoord: 1.0, endCoord: 1.0 },
			],
		};
		const coords = [0.5, -0.5];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBe(0);
	});

	test("handles start equals peak", () => {
		const region: VariationRegion = {
			regionAxes: [{ startCoord: 1.0, peakCoord: 1.0, endCoord: 1.0 }],
		};
		const coords = [1.0];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBeCloseTo(1.0, 5);
	});

	test("handles peak equals end", () => {
		const region: VariationRegion = {
			regionAxes: [{ startCoord: 0.0, peakCoord: 1.0, endCoord: 1.0 }],
		};
		const coords = [1.0];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBeCloseTo(1.0, 5);
	});

	test("handles negative coordinates", () => {
		const region: VariationRegion = {
			regionAxes: [{ startCoord: -1.0, peakCoord: -0.5, endCoord: 0.0 }],
		};
		const coords = [-0.75];
		const scalar = calculateRegionScalar(region, coords);
		expect(scalar).toBeCloseTo(0.5, 5);
	});
});

describe("getAdvanceWidthDelta - SFNS", () => {
	let font: Font;
	let hvar: HvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const hvarTable = font.hvar;
		if (!hvarTable) {
			throw new Error("SFNS.ttf does not have an HVAR table");
		}
		hvar = hvarTable;
	});

	test("returns 0 at default coordinates", () => {
		const coords = [0, 0, 0, 0];
		const delta = getAdvanceWidthDelta(hvar, 0, coords);
		expect(delta).toBe(0);
	});

	test("returns numeric delta for glyph 0", () => {
		const coords = [1.0, 0, 0, 0];
		const delta = getAdvanceWidthDelta(hvar, 0, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("delta changes with different coordinates", () => {
		const coords1 = [0, 0, 0, 0];
		const coords2 = [1.0, 0, 0, 0];

		const delta1 = getAdvanceWidthDelta(hvar, 1, coords1);
		const delta2 = getAdvanceWidthDelta(hvar, 1, coords2);

		// At least some glyphs should have different deltas
		const glyphsChecked = 50;
		let foundDifference = false;
		for (let gid = 0; gid < glyphsChecked; gid++) {
			const d1 = getAdvanceWidthDelta(hvar, gid, coords1);
			const d2 = getAdvanceWidthDelta(hvar, gid, coords2);
			if (d1 !== d2) {
				foundDifference = true;
				break;
			}
		}
		expect(foundDifference).toBe(true);
	});

	test("handles out-of-range glyph IDs gracefully", () => {
		const coords = [0, 0, 0, 0];
		const delta = getAdvanceWidthDelta(hvar, 99999, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("delta is reasonable for weight variation", () => {
		if (!font.fvar) {
			throw new Error("Font has no fvar table");
		}

		const wghtAxis = font.fvar.axes.find((a) => a.tag === AxisTags.wght);
		if (!wghtAxis) {
			throw new Error("Font has no wght axis");
		}

		// Test with normalized coordinates for bold weight
		const normalizedBold = normalizeAxisValue(wghtAxis, 700);
		const coords = [0, 0, 0, normalizedBold]; // [wdth, opsz, GRAD, wght]

		const delta = getAdvanceWidthDelta(hvar, 1, coords);
		expect(typeof delta).toBe("number");
		// Delta should be reasonable (not millions)
		expect(Math.abs(delta)).toBeLessThan(1000);
	});

	test("returns integer delta", () => {
		const coords = [0.5, 0, 0, 0.5];
		const delta = getAdvanceWidthDelta(hvar, 5, coords);
		expect(Number.isInteger(delta)).toBe(true);
	});
});

describe("getLsbDelta and getRsbDelta", () => {
	let font: Font;
	let hvar: HvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		const hvarTable = font.hvar;
		if (!hvarTable) {
			throw new Error("SFNS.ttf does not have an HVAR table");
		}
		hvar = hvarTable;
	});

	test("getLsbDelta returns 0 if no lsbMapping", () => {
		if (!hvar.lsbMapping) {
			const coords = [0, 0, 0, 0];
			const delta = getLsbDelta(hvar, 0, coords);
			expect(delta).toBe(0);
		} else {
			const coords = [0, 0, 0, 0];
			const delta = getLsbDelta(hvar, 0, coords);
			expect(typeof delta).toBe("number");
		}
	});

	test("getRsbDelta returns 0 if no rsbMapping", () => {
		if (!hvar.rsbMapping) {
			const coords = [0, 0, 0, 0];
			const delta = getRsbDelta(hvar, 0, coords);
			expect(delta).toBe(0);
		} else {
			const coords = [0, 0, 0, 0];
			const delta = getRsbDelta(hvar, 0, coords);
			expect(typeof delta).toBe("number");
		}
	});

	test("lsb and rsb deltas are numeric", () => {
		const coords = [0.5, 0, 0, 0.5];
		const lsbDelta = getLsbDelta(hvar, 5, coords);
		const rsbDelta = getRsbDelta(hvar, 5, coords);

		expect(typeof lsbDelta).toBe("number");
		expect(typeof rsbDelta).toBe("number");
		expect(Number.isFinite(lsbDelta)).toBe(true);
		expect(Number.isFinite(rsbDelta)).toBe(true);
	});

	test("returns integer deltas", () => {
		const coords = [0.5, 0, 0, 0.5];
		const lsbDelta = getLsbDelta(hvar, 5, coords);
		const rsbDelta = getRsbDelta(hvar, 5, coords);

		expect(Number.isInteger(lsbDelta)).toBe(true);
		expect(Number.isInteger(rsbDelta)).toBe(true);
	});
});

describe("HVAR table - New York", () => {
	let font: Font;
	let hvar: HvarTable;

	beforeAll(async () => {
		font = await Font.fromFile(NEW_YORK_PATH);
		const hvarTable = font.hvar;
		if (!hvarTable) {
			throw new Error("NewYork.ttf does not have an HVAR table");
		}
		hvar = hvarTable;
	});

	test("has valid structure", () => {
		expect(hvar.majorVersion).toBe(1);
		expect(hvar.minorVersion).toBe(0);
		expect(hvar.itemVariationStore).toBeDefined();
		expect(hvar.advanceWidthMapping).not.toBeNull();
	});

	test("itemVariationStore has variation regions", () => {
		const store = hvar.itemVariationStore;
		expect(store.variationRegions.length).toBeGreaterThan(0);
		expect(store.itemVariationData.length).toBeGreaterThan(0);
	});

	test("can calculate deltas for glyphs", () => {
		const coords = [0.5, 0.5, 0];
		const delta = getAdvanceWidthDelta(hvar, 1, coords);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});
});

describe("edge cases", () => {
	let hvar: HvarTable;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		const hvarTable = font.hvar;
		if (!hvarTable) {
			throw new Error("SFNS.ttf does not have an HVAR table");
		}
		hvar = hvarTable;
	});

	test("handles empty coordinate array", () => {
		const delta = getAdvanceWidthDelta(hvar, 0, []);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles coordinate array shorter than axes", () => {
		const delta = getAdvanceWidthDelta(hvar, 0, [0.5]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles coordinate array longer than axes", () => {
		const delta = getAdvanceWidthDelta(hvar, 0, [0, 0, 0, 0, 0, 0, 0, 0]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles glyph ID 0", () => {
		const delta = getAdvanceWidthDelta(hvar, 0, [0, 0, 0, 0]);
		expect(typeof delta).toBe("number");
	});

	test("handles very large coordinate values", () => {
		const delta = getAdvanceWidthDelta(hvar, 1, [10.0, 10.0, 10.0, 10.0]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("handles very small coordinate values", () => {
		const delta = getAdvanceWidthDelta(hvar, 1, [-10.0, -10.0, -10.0, -10.0]);
		expect(typeof delta).toBe("number");
		expect(Number.isFinite(delta)).toBe(true);
	});

	test("calculateRegionScalar with mismatched axes", () => {
		const region: VariationRegion = {
			regionAxes: [
				{ startCoord: 0.0, peakCoord: 0.5, endCoord: 1.0 },
				{ startCoord: 0.0, peakCoord: 0.5, endCoord: 1.0 },
			],
		};
		const coords = [0.5];
		const scalar = calculateRegionScalar(region, coords);
		expect(typeof scalar).toBe("number");
		expect(scalar).toBeGreaterThanOrEqual(0);
		expect(scalar).toBeLessThanOrEqual(1);
	});
});
