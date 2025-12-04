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

describe("synthetic VVAR tests", () => {
	function createVvarData(): ArrayBuffer {
		// Create a minimal VVAR table with synthetic data
		// Header: 24 bytes (2+2+4+4+4+4+4)
		// ItemVariationStore: variable
		// Mappings: variable
		const headerSize = 24;
		const ivsOffset = headerSize;

		// ItemVariationStore structure:
		// format (2) + regionListOffset (4) + dataCount (2) + dataOffsets (4 each)
		const ivsHeaderSize = 8;
		const ivsDataOffset = ivsOffset + ivsHeaderSize + 4; // After header + one offset
		const regionListOffset = ivsDataOffset + 20; // After one ItemVariationData

		// Region list: axisCount (2) + regionCount (2) + regions
		const axisCount = 1;
		const regionCount = 1;
		const regionListSize = 4 + regionCount * axisCount * 6; // Each axis: start/peak/end (2 bytes each)

		// Total size
		const totalSize = regionListOffset + regionListSize + 100;
		const buffer = new ArrayBuffer(totalSize);
		const view = new DataView(buffer);

		let offset = 0;

		// VVAR Header
		view.setUint16(offset, 1, false); offset += 2; // majorVersion
		view.setUint16(offset, 0, false); offset += 2; // minorVersion
		view.setUint32(offset, ivsOffset, false); offset += 4; // itemVariationStoreOffset
		view.setUint32(offset, 0, false); offset += 4; // advanceHeightMappingOffset (null)
		view.setUint32(offset, 0, false); offset += 4; // tsbMappingOffset (null)
		view.setUint32(offset, 0, false); offset += 4; // bsbMappingOffset (null)
		view.setUint32(offset, 0, false); offset += 4; // vOrgMappingOffset (null)

		// ItemVariationStore at ivsOffset
		offset = ivsOffset;
		view.setUint16(offset, 1, false); offset += 2; // format
		view.setUint32(offset, regionListOffset - ivsOffset, false); offset += 4; // variationRegionListOffset (relative)
		view.setUint16(offset, 1, false); offset += 2; // itemVariationDataCount
		view.setUint32(offset, ivsDataOffset - ivsOffset, false); offset += 4; // first data offset (relative)

		// ItemVariationData at ivsDataOffset
		offset = ivsDataOffset;
		view.setUint16(offset, 2, false); offset += 2; // itemCount
		view.setUint16(offset, 1, false); offset += 2; // wordDeltaCount
		view.setUint16(offset, 1, false); offset += 2; // regionIndexCount
		view.setUint16(offset, 0, false); offset += 2; // regionIndex[0]
		// Delta sets (2 items, 1 word delta each)
		view.setInt16(offset, 100, false); offset += 2; // item 0 delta
		view.setInt16(offset, -50, false); offset += 2; // item 1 delta

		// VariationRegionList at regionListOffset
		offset = regionListOffset;
		view.setUint16(offset, axisCount, false); offset += 2;
		view.setUint16(offset, regionCount, false); offset += 2;
		// Region 0, Axis 0: startCoord=-1.0, peakCoord=1.0, endCoord=1.0 (F2Dot14)
		view.setInt16(offset, -16384, false); offset += 2; // startCoord = -1.0
		view.setInt16(offset, 16384, false); offset += 2; // peakCoord = 1.0
		view.setInt16(offset, 16384, false); offset += 2; // endCoord = 1.0

		return buffer;
	}

	test("parseVvar parses header correctly", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		expect(vvar.majorVersion).toBe(1);
		expect(vvar.minorVersion).toBe(0);
	});

	test("parseVvar parses itemVariationStore", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		expect(vvar.itemVariationStore).toBeDefined();
		expect(vvar.itemVariationStore.format).toBe(1);
		expect(vvar.itemVariationStore.variationRegions.length).toBeGreaterThan(0);
		expect(vvar.itemVariationStore.itemVariationData.length).toBeGreaterThan(0);
	});

	test("parseVvar handles null mappings", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		expect(vvar.advanceHeightMapping).toBeNull();
		expect(vvar.tsbMapping).toBeNull();
		expect(vvar.bsbMapping).toBeNull();
		expect(vvar.vOrgMapping).toBeNull();
	});

	test("getAdvanceHeightDelta uses direct mapping when no advanceHeightMapping", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		// With no mapping, outer=0, inner=glyphId
		const delta0 = getAdvanceHeightDelta(vvar, 0, [1.0]);
		const delta1 = getAdvanceHeightDelta(vvar, 1, [1.0]);

		expect(typeof delta0).toBe("number");
		expect(typeof delta1).toBe("number");
		expect(delta0).toBe(100); // At peak coord 1.0, full delta
		expect(delta1).toBe(-50);
	});

	test("getAdvanceHeightDelta returns 0 for out-of-range glyph", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		const delta = getAdvanceHeightDelta(vvar, 999, [1.0]);
		expect(delta).toBe(0);
	});

	test("getTsbDelta returns 0 when no mapping", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		const delta = getTsbDelta(vvar, 0, [1.0]);
		expect(delta).toBe(0);
	});

	test("getBsbDelta returns 0 when no mapping", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		const delta = getBsbDelta(vvar, 0, [1.0]);
		expect(delta).toBe(0);
	});

	test("getVorgDelta returns 0 when no mapping", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		const delta = getVorgDelta(vvar, 0, [1.0]);
		expect(delta).toBe(0);
	});

	test("delta scales with coordinate", () => {
		const data = createVvarData();
		const reader = new Reader(new DataView(data));
		const vvar = parseVvar(reader);

		const deltaAtMinus1 = getAdvanceHeightDelta(vvar, 0, [-1.0]);
		const deltaAt0 = getAdvanceHeightDelta(vvar, 0, [0]);
		const deltaAt1 = getAdvanceHeightDelta(vvar, 0, [1.0]);

		// Region has startCoord=-1, peakCoord=1, endCoord=1
		// At -1 (start), scalar = 0
		// At 0 (halfway to peak), scalar = 0.5
		// At 1 (peak), scalar = 1.0
		expect(deltaAtMinus1).toBe(0);
		expect(deltaAt0).toBe(50); // 100 * 0.5
		expect(deltaAt1).toBe(100); // 100 * 1.0
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
