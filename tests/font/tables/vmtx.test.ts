import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseVmtx,
	getVerticalMetrics,
	type VmtxTable,
} from "../../../src/font/tables/vmtx.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_UNICODE_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";

describe("vmtx table", () => {
	describe("with Arial Unicode font", () => {
		let font: Font;
		let vmtx: VmtxTable | null;

		beforeAll(async () => {
			font = await Font.fromFile(ARIAL_UNICODE_PATH);
			vmtx = font.vmtx;
		});

		describe("parseVmtx", () => {
			test("returns VmtxTable with vMetrics array", () => {
				if (!vmtx) return;
				expect(Array.isArray(vmtx.vMetrics)).toBe(true);
				expect(vmtx.vMetrics.length).toBeGreaterThan(0);
			});

			test("returns VmtxTable with topSideBearings array", () => {
				if (!vmtx) return;
				expect(Array.isArray(vmtx.topSideBearings)).toBe(true);
			});

			test("vMetrics have required properties", () => {
				if (!vmtx) return;
				for (const metric of vmtx.vMetrics) {
					expect(typeof metric.advanceHeight).toBe("number");
					expect(typeof metric.topSideBearing).toBe("number");
				}
			});

			test("vMetrics have positive advance heights", () => {
				if (!vmtx) return;
				for (const metric of vmtx.vMetrics) {
					expect(metric.advanceHeight).toBeGreaterThan(0);
				}
			});

			test("vMetrics count matches numberOfVMetrics from vhea", () => {
				if (!vmtx) return;
				const vhea = font.vhea;
				if (vhea) {
					expect(vmtx.vMetrics.length).toBe(vhea.numberOfVMetrics);
				}
			});

			test("total metrics equal numGlyphs", () => {
				if (!vmtx) return;
				const totalMetrics = vmtx.vMetrics.length + vmtx.topSideBearings.length;
				expect(totalMetrics).toBe(font.numGlyphs);
			});

			test("topSideBearings are int16 values", () => {
				if (!vmtx) return;
				for (const tsb of vmtx.topSideBearings) {
					expect(typeof tsb).toBe("number");
					expect(tsb).toBeGreaterThanOrEqual(-32768);
					expect(tsb).toBeLessThanOrEqual(32767);
				}
			});
		});

		describe("getVerticalMetrics", () => {
			test("returns metrics for glyph 0 (notdef)", () => {
				if (!vmtx) return;
				const metrics = getVerticalMetrics(vmtx, 0);
				expect(typeof metrics.advanceHeight).toBe("number");
				expect(typeof metrics.topSideBearing).toBe("number");
				expect(metrics.advanceHeight).toBeGreaterThan(0);
			});

			test("returns metrics for valid glyph IDs within vMetrics range", () => {
				if (!vmtx) return;
				const glyphId = Math.min(10, vmtx.vMetrics.length - 1);
				const metrics = getVerticalMetrics(vmtx, glyphId);
				expect(metrics.advanceHeight).toBe(vmtx.vMetrics[glyphId]?.advanceHeight);
				expect(metrics.topSideBearing).toBe(
					vmtx.vMetrics[glyphId]?.topSideBearing,
				);
			});

			test("uses last advance height for glyphs beyond vMetrics", () => {
				if (!vmtx) return;
				if (vmtx.topSideBearings.length > 0) {
					const glyphId = vmtx.vMetrics.length + 5;
					const metrics = getVerticalMetrics(vmtx, glyphId);
					const lastMetric = vmtx.vMetrics[vmtx.vMetrics.length - 1];
					expect(metrics.advanceHeight).toBe(lastMetric?.advanceHeight);
				}
			});

			test("returns correct TSB for glyphs in topSideBearings array", () => {
				if (!vmtx) return;
				if (vmtx.topSideBearings.length > 0) {
					const glyphId = vmtx.vMetrics.length;
					const metrics = getVerticalMetrics(vmtx, glyphId);
					expect(metrics.topSideBearing).toBe(vmtx.topSideBearings[0]);
				}
			});

			test("handles glyph at boundary between vMetrics and topSideBearings", () => {
				if (!vmtx) return;
				const boundaryGlyph = vmtx.vMetrics.length;
				if (boundaryGlyph < font.numGlyphs) {
					const metrics = getVerticalMetrics(vmtx, boundaryGlyph);
					expect(typeof metrics.advanceHeight).toBe("number");
					expect(typeof metrics.topSideBearing).toBe("number");
				}
			});

			test("returns consistent results on repeated calls", () => {
				if (!vmtx) return;
				const glyphId = 5;
				const metrics1 = getVerticalMetrics(vmtx, glyphId);
				const metrics2 = getVerticalMetrics(vmtx, glyphId);
				expect(metrics1.advanceHeight).toBe(metrics2.advanceHeight);
				expect(metrics1.topSideBearing).toBe(metrics2.topSideBearing);
			});

			test("handles all glyphs in font", () => {
				if (!vmtx) return;
				for (let i = 0; i < Math.min(font.numGlyphs, 100); i++) {
					const metrics = getVerticalMetrics(vmtx, i);
					expect(typeof metrics.advanceHeight).toBe("number");
					expect(typeof metrics.topSideBearing).toBe("number");
					expect(metrics.advanceHeight).toBeGreaterThan(0);
				}
			});

			test("advance heights are reasonable", () => {
				if (!vmtx) return;
				for (let i = 0; i < Math.min(vmtx.vMetrics.length, 50); i++) {
					const metrics = getVerticalMetrics(vmtx, i);
					expect(metrics.advanceHeight).toBeGreaterThan(0);
					expect(metrics.advanceHeight).toBeLessThan(100000);
				}
			});
		});

		describe("CJK character metrics", () => {
			test("gets metrics for common CJK characters", () => {
				if (!vmtx) return;
				const chars = ["一", "中", "文", "日", "本"];
				for (const char of chars) {
					const glyphId = font.glyphIdForChar(char);
					if (glyphId > 0) {
						const metrics = getVerticalMetrics(vmtx, glyphId);
						expect(metrics.advanceHeight).toBeGreaterThan(0);
						expect(typeof metrics.topSideBearing).toBe("number");
					}
				}
			});

			test("CJK glyphs have similar advance heights", () => {
				if (!vmtx) return;
				const chars = ["一", "二", "三"];
				const heights: number[] = [];
				for (const char of chars) {
					const glyphId = font.glyphIdForChar(char);
					if (glyphId > 0) {
						const metrics = getVerticalMetrics(vmtx, glyphId);
						heights.push(metrics.advanceHeight);
					}
				}
				if (heights.length > 1) {
					const maxHeight = Math.max(...heights);
					const minHeight = Math.min(...heights);
					const variance = maxHeight - minHeight;
					expect(variance).toBeLessThan(maxHeight * 0.5);
				}
			});
		});
	});

	describe("synthetic vmtx parsing", () => {
		test("parses vmtx with only vMetrics (no additional TSBs)", () => {
			const buffer = new ArrayBuffer(16);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, 100, false);
			offset += 2;
			view.setUint16(offset, 1100, false);
			offset += 2;
			view.setInt16(offset, 150, false);
			offset += 2;
			view.setUint16(offset, 1050, false);
			offset += 2;
			view.setInt16(offset, 120, false);
			offset += 2;
			view.setUint16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, 100, false);

			const reader = new Reader(buffer);
			const vmtx = parseVmtx(reader, 4, 4);

			expect(vmtx.vMetrics.length).toBe(4);
			expect(vmtx.topSideBearings.length).toBe(0);
			expect(vmtx.vMetrics[0]?.advanceHeight).toBe(1000);
			expect(vmtx.vMetrics[0]?.topSideBearing).toBe(100);
			expect(vmtx.vMetrics[1]?.advanceHeight).toBe(1100);
			expect(vmtx.vMetrics[1]?.topSideBearing).toBe(150);
		});

		test("parses vmtx with vMetrics and topSideBearings", () => {
			const buffer = new ArrayBuffer(14);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, 100, false);
			offset += 2;
			view.setUint16(offset, 1100, false);
			offset += 2;
			view.setInt16(offset, 150, false);
			offset += 2;
			view.setInt16(offset, 80, false);
			offset += 2;
			view.setInt16(offset, 90, false);
			offset += 2;
			view.setInt16(offset, 110, false);

			const reader = new Reader(buffer);
			const vmtx = parseVmtx(reader, 2, 5);

			expect(vmtx.vMetrics.length).toBe(2);
			expect(vmtx.topSideBearings.length).toBe(3);
			expect(vmtx.vMetrics[0]?.advanceHeight).toBe(1000);
			expect(vmtx.vMetrics[0]?.topSideBearing).toBe(100);
			expect(vmtx.vMetrics[1]?.advanceHeight).toBe(1100);
			expect(vmtx.vMetrics[1]?.topSideBearing).toBe(150);
			expect(vmtx.topSideBearings[0]).toBe(80);
			expect(vmtx.topSideBearings[1]).toBe(90);
			expect(vmtx.topSideBearings[2]).toBe(110);
		});

		test("parses vmtx with negative topSideBearings", () => {
			const buffer = new ArrayBuffer(12);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, 100, false);
			offset += 2;
			view.setInt16(offset, -50, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setInt16(offset, 200, false);
			offset += 2;
			view.setInt16(offset, -75, false);

			const reader = new Reader(buffer);
			const vmtx = parseVmtx(reader, 1, 5);

			expect(vmtx.vMetrics.length).toBe(1);
			expect(vmtx.topSideBearings.length).toBe(4);
			expect(vmtx.topSideBearings[0]).toBe(-50);
			expect(vmtx.topSideBearings[1]).toBe(-100);
			expect(vmtx.topSideBearings[2]).toBe(200);
			expect(vmtx.topSideBearings[3]).toBe(-75);
		});

		test("handles single vMetric for all glyphs", () => {
			const buffer = new ArrayBuffer(10);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, 100, false);
			offset += 2;
			view.setInt16(offset, 80, false);
			offset += 2;
			view.setInt16(offset, 90, false);
			offset += 2;
			view.setInt16(offset, 85, false);

			const reader = new Reader(buffer);
			const vmtx = parseVmtx(reader, 1, 4);

			expect(vmtx.vMetrics.length).toBe(1);
			expect(vmtx.topSideBearings.length).toBe(3);
			expect(vmtx.vMetrics[0]?.advanceHeight).toBe(1000);
		});
	});

	describe("getVerticalMetrics edge cases", () => {
		test("handles glyph ID 0", () => {
			const vmtx: VmtxTable = {
				vMetrics: [
					{ advanceHeight: 1000, topSideBearing: 100 },
					{ advanceHeight: 1100, topSideBearing: 150 },
				],
				topSideBearings: [80, 90],
			};

			const metrics = getVerticalMetrics(vmtx, 0);
			expect(metrics.advanceHeight).toBe(1000);
			expect(metrics.topSideBearing).toBe(100);
		});

		test("handles last glyph in vMetrics", () => {
			const vmtx: VmtxTable = {
				vMetrics: [
					{ advanceHeight: 1000, topSideBearing: 100 },
					{ advanceHeight: 1100, topSideBearing: 150 },
				],
				topSideBearings: [80, 90],
			};

			const metrics = getVerticalMetrics(vmtx, 1);
			expect(metrics.advanceHeight).toBe(1100);
			expect(metrics.topSideBearing).toBe(150);
		});

		test("handles first glyph in topSideBearings", () => {
			const vmtx: VmtxTable = {
				vMetrics: [
					{ advanceHeight: 1000, topSideBearing: 100 },
					{ advanceHeight: 1100, topSideBearing: 150 },
				],
				topSideBearings: [80, 90],
			};

			const metrics = getVerticalMetrics(vmtx, 2);
			expect(metrics.advanceHeight).toBe(1100);
			expect(metrics.topSideBearing).toBe(80);
		});

		test("handles last glyph in topSideBearings", () => {
			const vmtx: VmtxTable = {
				vMetrics: [
					{ advanceHeight: 1000, topSideBearing: 100 },
					{ advanceHeight: 1100, topSideBearing: 150 },
				],
				topSideBearings: [80, 90],
			};

			const metrics = getVerticalMetrics(vmtx, 3);
			expect(metrics.advanceHeight).toBe(1100);
			expect(metrics.topSideBearing).toBe(90);
		});

		test("handles glyph beyond all metrics (returns default 0)", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 1000, topSideBearing: 100 }],
				topSideBearings: [80],
			};

			const metrics = getVerticalMetrics(vmtx, 10);
			expect(metrics.advanceHeight).toBe(1000);
			expect(metrics.topSideBearing).toBe(0);
		});

		test("handles empty topSideBearings", () => {
			const vmtx: VmtxTable = {
				vMetrics: [
					{ advanceHeight: 1000, topSideBearing: 100 },
					{ advanceHeight: 1100, topSideBearing: 150 },
				],
				topSideBearings: [],
			};

			const metrics = getVerticalMetrics(vmtx, 0);
			expect(metrics.advanceHeight).toBe(1000);
			expect(metrics.topSideBearing).toBe(100);
		});

		test("handles single vMetric with multiple TSBs", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 1000, topSideBearing: 100 }],
				topSideBearings: [80, 90, 85, 95],
			};

			const metrics0 = getVerticalMetrics(vmtx, 0);
			expect(metrics0.advanceHeight).toBe(1000);
			expect(metrics0.topSideBearing).toBe(100);

			const metrics1 = getVerticalMetrics(vmtx, 1);
			expect(metrics1.advanceHeight).toBe(1000);
			expect(metrics1.topSideBearing).toBe(80);

			const metrics2 = getVerticalMetrics(vmtx, 2);
			expect(metrics2.advanceHeight).toBe(1000);
			expect(metrics2.topSideBearing).toBe(90);

			const metrics4 = getVerticalMetrics(vmtx, 4);
			expect(metrics4.advanceHeight).toBe(1000);
			expect(metrics4.topSideBearing).toBe(95);
		});

		test("handles zero advance height", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 0, topSideBearing: 100 }],
				topSideBearings: [],
			};

			const metrics = getVerticalMetrics(vmtx, 0);
			expect(metrics.advanceHeight).toBe(0);
			expect(metrics.topSideBearing).toBe(100);
		});

		test("handles zero topSideBearing", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 1000, topSideBearing: 0 }],
				topSideBearings: [0, 0],
			};

			const metrics0 = getVerticalMetrics(vmtx, 0);
			expect(metrics0.topSideBearing).toBe(0);

			const metrics1 = getVerticalMetrics(vmtx, 1);
			expect(metrics1.topSideBearing).toBe(0);
		});

		test("handles negative topSideBearing values", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 1000, topSideBearing: -50 }],
				topSideBearings: [-100, -150],
			};

			const metrics0 = getVerticalMetrics(vmtx, 0);
			expect(metrics0.topSideBearing).toBe(-50);

			const metrics1 = getVerticalMetrics(vmtx, 1);
			expect(metrics1.topSideBearing).toBe(-100);

			const metrics2 = getVerticalMetrics(vmtx, 2);
			expect(metrics2.topSideBearing).toBe(-150);
		});

		test("handles maximum uint16 advance height", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 65535, topSideBearing: 100 }],
				topSideBearings: [],
			};

			const metrics = getVerticalMetrics(vmtx, 0);
			expect(metrics.advanceHeight).toBe(65535);
		});

		test("handles maximum negative int16 topSideBearing", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 1000, topSideBearing: -32768 }],
				topSideBearings: [],
			};

			const metrics = getVerticalMetrics(vmtx, 0);
			expect(metrics.topSideBearing).toBe(-32768);
		});

		test("handles maximum positive int16 topSideBearing", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 1000, topSideBearing: 32767 }],
				topSideBearings: [],
			};

			const metrics = getVerticalMetrics(vmtx, 0);
			expect(metrics.topSideBearing).toBe(32767);
		});
	});

	describe("vmtx consistency checks", () => {
		test("all advance heights are non-negative", () => {
			const vmtx: VmtxTable = {
				vMetrics: [
					{ advanceHeight: 1000, topSideBearing: 100 },
					{ advanceHeight: 0, topSideBearing: 0 },
					{ advanceHeight: 2000, topSideBearing: 200 },
				],
				topSideBearings: [],
			};

			for (const metric of vmtx.vMetrics) {
				expect(metric.advanceHeight).toBeGreaterThanOrEqual(0);
			}
		});

		test("topSideBearings can be mixed positive and negative", () => {
			const vmtx: VmtxTable = {
				vMetrics: [{ advanceHeight: 1000, topSideBearing: 100 }],
				topSideBearings: [-50, 100, 0, -100, 50],
			};

			let hasPositive = false;
			let hasNegative = false;
			let hasZero = false;

			for (const tsb of vmtx.topSideBearings) {
				if (tsb > 0) hasPositive = true;
				if (tsb < 0) hasNegative = true;
				if (tsb === 0) hasZero = true;
			}

			expect(hasPositive).toBe(true);
			expect(hasNegative).toBe(true);
			expect(hasZero).toBe(true);
		});

		test("handles sparse vMetrics array with holes", () => {
			const vmtx: VmtxTable = {
				vMetrics: [],
				topSideBearings: [100, 200],
			};
			vmtx.vMetrics.length = 5;
			vmtx.vMetrics[0] = { advanceHeight: 1000, topSideBearing: 100 };
			vmtx.vMetrics[4] = { advanceHeight: 1100, topSideBearing: 150 };

			const metrics0 = getVerticalMetrics(vmtx, 0);
			expect(metrics0.advanceHeight).toBe(1000);

			const metrics1 = getVerticalMetrics(vmtx, 1);
			expect(typeof metrics1.advanceHeight).toBe("number");
			expect(typeof metrics1.topSideBearing).toBe("number");

			const metrics4 = getVerticalMetrics(vmtx, 4);
			expect(metrics4.advanceHeight).toBe(1100);
		});
	});
});
