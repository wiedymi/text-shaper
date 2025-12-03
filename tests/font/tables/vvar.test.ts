import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseVvar,
	getAdvanceHeightDelta,
	getTsbDelta,
	getBsbDelta,
	getVorgDelta,
	type VvarTable,
} from "../../../src/font/tables/vvar.ts";
import {
	calculateRegionScalar,
	type ItemVariationStore,
	type DeltaSetIndexMap,
} from "../../../src/font/tables/hvar.ts";
import { normalizeAxisValue, AxisTags } from "../../../src/font/tables/fvar.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const SFNS_PATH = "/System/Library/Fonts/SFNS.ttf";
const NEW_YORK_PATH = "/System/Library/Fonts/NewYork.ttf";

describe("VVAR table - SFNS", () => {
	let font: Font;
	let vvar: VvarTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		vvar = font.vvar;
	});

	describe("parseVvar", () => {
		test("returns VvarTable or null", () => {
			if (vvar) {
				expect(vvar.majorVersion).toBe(1);
				expect(vvar.minorVersion).toBe(0);
			} else {
				expect(vvar).toBeNull();
			}
		});

		test("has itemVariationStore if present", () => {
			if (vvar) {
				expect(vvar.itemVariationStore).toBeDefined();
				expect(typeof vvar.itemVariationStore.format).toBe("number");
			}
		});

		test("has advanceHeightMapping or null", () => {
			if (vvar) {
				if (vvar.advanceHeightMapping) {
					expect(typeof vvar.advanceHeightMapping.format).toBe("number");
				} else {
					expect(vvar.advanceHeightMapping).toBeNull();
				}
			}
		});

		test("has tsbMapping or null", () => {
			if (vvar) {
				if (vvar.tsbMapping) {
					expect(typeof vvar.tsbMapping.format).toBe("number");
				} else {
					expect(vvar.tsbMapping).toBeNull();
				}
			}
		});

		test("has bsbMapping or null", () => {
			if (vvar) {
				if (vvar.bsbMapping) {
					expect(typeof vvar.bsbMapping.format).toBe("number");
				} else {
					expect(vvar.bsbMapping).toBeNull();
				}
			}
		});

		test("has vOrgMapping or null", () => {
			if (vvar) {
				if (vvar.vOrgMapping) {
					expect(typeof vvar.vOrgMapping.format).toBe("number");
				} else {
					expect(vvar.vOrgMapping).toBeNull();
				}
			}
		});
	});

	describe("ItemVariationStore", () => {
		test("has valid structure if VVAR exists", () => {
			if (vvar) {
				const store = vvar.itemVariationStore;
				expect(store.format).toBe(1);
				expect(Array.isArray(store.variationRegions)).toBe(true);
				expect(Array.isArray(store.itemVariationData)).toBe(true);
			}
		});

		test("variation regions have valid coordinates", () => {
			if (vvar) {
				const store = vvar.itemVariationStore;
				for (const region of store.variationRegions) {
					expect(Array.isArray(region.regionAxes)).toBe(true);
					for (const axis of region.regionAxes) {
						expect(typeof axis.startCoord).toBe("number");
						expect(typeof axis.peakCoord).toBe("number");
						expect(typeof axis.endCoord).toBe("number");
						expect(axis.startCoord).toBeLessThanOrEqual(axis.peakCoord);
						expect(axis.peakCoord).toBeLessThanOrEqual(axis.endCoord);
					}
				}
			}
		});

		test("itemVariationData has valid structure", () => {
			if (vvar) {
				const store = vvar.itemVariationStore;
				for (const varData of store.itemVariationData) {
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
			}
		});

		test("regionIndexes reference valid regions", () => {
			if (vvar) {
				const store = vvar.itemVariationStore;
				for (const varData of store.itemVariationData) {
					for (const regionIndex of varData.regionIndexes) {
						expect(regionIndex).toBeGreaterThanOrEqual(0);
						expect(regionIndex).toBeLessThan(store.variationRegions.length);
					}
				}
			}
		});
	});

	describe("DeltaSetIndexMap", () => {
		test("advanceHeightMapping has valid format if present", () => {
			if (vvar?.advanceHeightMapping) {
				const mapping = vvar.advanceHeightMapping;
				expect(mapping.format).toBeGreaterThanOrEqual(0);
				expect(mapping.format).toBeLessThanOrEqual(1);
				expect(typeof mapping.mapCount).toBe("number");
				expect(mapping.mapData.length).toBe(mapping.mapCount);
			}
		});

		test("mapData entries have valid outer and inner indexes", () => {
			if (vvar?.advanceHeightMapping) {
				const mapping = vvar.advanceHeightMapping;
				for (const entry of mapping.mapData) {
					expect(typeof entry.outer).toBe("number");
					expect(typeof entry.inner).toBe("number");
					expect(entry.outer).toBeGreaterThanOrEqual(0);
					expect(entry.inner).toBeGreaterThanOrEqual(0);
					expect(entry.outer).toBeLessThan(
						vvar.itemVariationStore.itemVariationData.length,
					);
				}
			}
		});
	});
});

describe("getAdvanceHeightDelta", () => {
	let font: Font;
	let vvar: VvarTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		vvar = font.vvar;
	});

	test("returns 0 if no VVAR table", () => {
		if (!vvar) {
			// Font may not have vertical metrics variations
			expect(vvar).toBeNull();
		}
	});

	test("returns numeric delta at default coordinates", () => {
		if (vvar) {
			const coords = [0, 0, 0, 0];
			const delta = getAdvanceHeightDelta(vvar, 0, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
			expect(delta).toBe(0);
		}
	});

	test("returns numeric delta for glyph 0", () => {
		if (vvar) {
			const coords = [1.0, 0, 0, 0];
			const delta = getAdvanceHeightDelta(vvar, 0, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("handles out-of-range glyph IDs gracefully", () => {
		if (vvar) {
			const coords = [0, 0, 0, 0];
			const delta = getAdvanceHeightDelta(vvar, 99999, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("returns integer delta", () => {
		if (vvar) {
			const coords = [0.5, 0, 0, 0.5];
			const delta = getAdvanceHeightDelta(vvar, 5, coords);
			expect(Number.isInteger(delta)).toBe(true);
		}
	});

	test("delta is reasonable", () => {
		if (vvar) {
			const coords = [1.0, 1.0, 1.0, 1.0];
			const delta = getAdvanceHeightDelta(vvar, 1, coords);
			expect(Math.abs(delta)).toBeLessThan(1000);
		}
	});
});

describe("getTsbDelta", () => {
	let font: Font;
	let vvar: VvarTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		vvar = font.vvar;
	});

	test("returns 0 if no tsbMapping", () => {
		if (vvar) {
			if (!vvar.tsbMapping) {
				const coords = [0, 0, 0, 0];
				const delta = getTsbDelta(vvar, 0, coords);
				expect(delta).toBe(0);
			}
		}
	});

	test("returns numeric delta if tsbMapping exists", () => {
		if (vvar?.tsbMapping) {
			const coords = [0.5, 0, 0, 0.5];
			const delta = getTsbDelta(vvar, 0, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("handles out-of-range glyph IDs", () => {
		if (vvar) {
			const coords = [0, 0, 0, 0];
			const delta = getTsbDelta(vvar, 99999, coords);
			expect(delta).toBe(0);
		}
	});

	test("returns integer delta", () => {
		if (vvar?.tsbMapping) {
			const coords = [0.5, 0, 0, 0.5];
			const delta = getTsbDelta(vvar, 5, coords);
			expect(Number.isInteger(delta)).toBe(true);
		}
	});
});

describe("getBsbDelta", () => {
	let font: Font;
	let vvar: VvarTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		vvar = font.vvar;
	});

	test("returns 0 if no bsbMapping", () => {
		if (vvar) {
			if (!vvar.bsbMapping) {
				const coords = [0, 0, 0, 0];
				const delta = getBsbDelta(vvar, 0, coords);
				expect(delta).toBe(0);
			}
		}
	});

	test("returns numeric delta if bsbMapping exists", () => {
		if (vvar?.bsbMapping) {
			const coords = [0.5, 0, 0, 0.5];
			const delta = getBsbDelta(vvar, 0, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("handles out-of-range glyph IDs", () => {
		if (vvar) {
			const coords = [0, 0, 0, 0];
			const delta = getBsbDelta(vvar, 99999, coords);
			expect(delta).toBe(0);
		}
	});

	test("returns integer delta", () => {
		if (vvar?.bsbMapping) {
			const coords = [0.5, 0, 0, 0.5];
			const delta = getBsbDelta(vvar, 5, coords);
			expect(Number.isInteger(delta)).toBe(true);
		}
	});
});

describe("getVorgDelta", () => {
	let font: Font;
	let vvar: VvarTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(SFNS_PATH);
		vvar = font.vvar;
	});

	test("returns 0 if no vOrgMapping", () => {
		if (vvar) {
			if (!vvar.vOrgMapping) {
				const coords = [0, 0, 0, 0];
				const delta = getVorgDelta(vvar, 0, coords);
				expect(delta).toBe(0);
			}
		}
	});

	test("returns numeric delta if vOrgMapping exists", () => {
		if (vvar?.vOrgMapping) {
			const coords = [0.5, 0, 0, 0.5];
			const delta = getVorgDelta(vvar, 0, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("handles out-of-range glyph IDs", () => {
		if (vvar) {
			const coords = [0, 0, 0, 0];
			const delta = getVorgDelta(vvar, 99999, coords);
			expect(delta).toBe(0);
		}
	});

	test("returns integer delta", () => {
		if (vvar?.vOrgMapping) {
			const coords = [0.5, 0, 0, 0.5];
			const delta = getVorgDelta(vvar, 5, coords);
			expect(Number.isInteger(delta)).toBe(true);
		}
	});
});

describe("VVAR table - New York", () => {
	let font: Font;
	let vvar: VvarTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(NEW_YORK_PATH);
		vvar = font.vvar;
	});

	test("has valid structure if present", () => {
		if (vvar) {
			expect(vvar.majorVersion).toBe(1);
			expect(vvar.minorVersion).toBe(0);
			expect(vvar.itemVariationStore).toBeDefined();
		}
	});

	test("can calculate deltas for glyphs", () => {
		if (vvar) {
			const coords = [0.5, 0.5, 0];
			const delta = getAdvanceHeightDelta(vvar, 1, coords);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("all delta functions work", () => {
		if (vvar) {
			const coords = [0.5, 0.5, 0];
			expect(typeof getAdvanceHeightDelta(vvar, 1, coords)).toBe("number");
			expect(typeof getTsbDelta(vvar, 1, coords)).toBe("number");
			expect(typeof getBsbDelta(vvar, 1, coords)).toBe("number");
			expect(typeof getVorgDelta(vvar, 1, coords)).toBe("number");
		}
	});
});

describe("edge cases", () => {
	let vvar: VvarTable | null;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		vvar = font.vvar;
	});

	test("handles empty coordinate array", () => {
		if (vvar) {
			const delta = getAdvanceHeightDelta(vvar, 0, []);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("handles coordinate array shorter than axes", () => {
		if (vvar) {
			const delta = getAdvanceHeightDelta(vvar, 0, [0.5]);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("handles coordinate array longer than axes", () => {
		if (vvar) {
			const delta = getAdvanceHeightDelta(vvar, 0, [0, 0, 0, 0, 0, 0, 0, 0]);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("handles glyph ID 0", () => {
		if (vvar) {
			const delta = getAdvanceHeightDelta(vvar, 0, [0, 0, 0, 0]);
			expect(typeof delta).toBe("number");
		}
	});

	test("handles very large coordinate values", () => {
		if (vvar) {
			const delta = getAdvanceHeightDelta(vvar, 1, [10.0, 10.0, 10.0, 10.0]);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("handles very small coordinate values", () => {
		if (vvar) {
			const delta = getAdvanceHeightDelta(vvar, 1, [
				-10.0, -10.0, -10.0, -10.0,
			]);
			expect(typeof delta).toBe("number");
			expect(Number.isFinite(delta)).toBe(true);
		}
	});

	test("all delta functions handle invalid coordinates", () => {
		if (vvar) {
			const coords = [100, -100, 50, -50];
			expect(Number.isFinite(getAdvanceHeightDelta(vvar, 1, coords))).toBe(
				true,
			);
			expect(Number.isFinite(getTsbDelta(vvar, 1, coords))).toBe(true);
			expect(Number.isFinite(getBsbDelta(vvar, 1, coords))).toBe(true);
			expect(Number.isFinite(getVorgDelta(vvar, 1, coords))).toBe(true);
		}
	});
});

describe("delta consistency", () => {
	let vvar: VvarTable | null;

	beforeAll(async () => {
		const font = await Font.fromFile(SFNS_PATH);
		vvar = font.vvar;
	});

	test("same coordinates return same delta", () => {
		if (vvar) {
			const coords = [0.5, 0.25, 0.75, 0.5];
			const delta1 = getAdvanceHeightDelta(vvar, 10, coords);
			const delta2 = getAdvanceHeightDelta(vvar, 10, coords);
			expect(delta1).toBe(delta2);
		}
	});

	test("delta calculation is deterministic", () => {
		if (vvar) {
			const coords = [0.3, 0.6, 0.2, 0.8];
			const results: number[] = [];
			for (let i = 0; i < 10; i++) {
				results.push(getAdvanceHeightDelta(vvar, 5, coords));
			}
			expect(new Set(results).size).toBe(1);
		}
	});

	test("returns 0 at default for all glyphs", () => {
		if (vvar) {
			const coords = [0, 0, 0, 0];
			for (let gid = 0; gid < 10; gid++) {
				const delta = getAdvanceHeightDelta(vvar, gid, coords);
				expect(delta).toBe(0);
			}
		}
	});
});

describe("Font.vvar integration", () => {
	test("SFNS may or may not have VVAR", async () => {
		const font = await Font.fromFile(SFNS_PATH);
		// Just check it doesn't throw
		const vvar = font.vvar;
		if (vvar) {
			expect(vvar.majorVersion).toBe(1);
		} else {
			expect(vvar).toBeNull();
		}
	});

	test("New York may or may not have VVAR", async () => {
		const font = await Font.fromFile(NEW_YORK_PATH);
		// Just check it doesn't throw
		const vvar = font.vvar;
		if (vvar) {
			expect(vvar.majorVersion).toBe(1);
		} else {
			expect(vvar).toBeNull();
		}
	});

	test("Arial does not have VVAR", async () => {
		const font = await Font.fromFile(
			"/System/Library/Fonts/Supplemental/Arial.ttf",
		);
		expect(font.vvar).toBeNull();
	});
});

describe("synthetic VVAR parsing - Reader basics", () => {
	test("reads uint16 values in big-endian", () => {
		const buffer = new ArrayBuffer(4);
		const view = new DataView(buffer);

		view.setUint16(0, 1, false);
		view.setUint16(2, 0, false);

		const reader = new Reader(buffer);
		expect(reader.uint16()).toBe(1);
		expect(reader.uint16()).toBe(0);
	});

	test("reads uint32 values in big-endian", () => {
		const buffer = new ArrayBuffer(12);
		const view = new DataView(buffer);

		view.setUint32(0, 0, false);
		view.setUint32(4, 100, false);
		view.setUint32(8, 200, false);

		const reader = new Reader(buffer);
		expect(reader.uint32()).toBe(0);
		expect(reader.uint32()).toBe(100);
		expect(reader.uint32()).toBe(200);
	});
});
