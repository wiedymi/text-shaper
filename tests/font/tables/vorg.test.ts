import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseVorg,
	getVertOriginY,
	hasVertOriginY,
	type VorgTable,
} from "../../../src/font/tables/vorg.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_UNICODE_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";

describe("vorg table", () => {
	describe("with Arial Unicode font", () => {
		let font: Font;
		let vorg: VorgTable | null;

		beforeAll(async () => {
			font = await Font.fromFile(ARIAL_UNICODE_PATH);
			vorg = font.vorg;
		});

		describe("parseVorg", () => {
			test("may have VORG table", () => {
				if (vorg) {
					expect(typeof vorg.majorVersion).toBe("number");
					expect(typeof vorg.minorVersion).toBe("number");
					expect(typeof vorg.defaultVertOriginY).toBe("number");
					expect(Array.isArray(vorg.vertOriginYMetrics)).toBe(true);
				} else {
					expect(vorg).toBeNull();
				}
			});

			test("has valid version if present", () => {
				if (vorg) {
					expect(vorg.majorVersion).toBe(1);
					expect(vorg.minorVersion).toBe(0);
				}
			});

			test("has default vertical origin Y", () => {
				if (vorg) {
					expect(typeof vorg.defaultVertOriginY).toBe("number");
				}
			});

			test("vertOriginYMetrics are sorted by glyph index", () => {
				if (vorg && vorg.vertOriginYMetrics.length > 1) {
					for (let i = 1; i < vorg.vertOriginYMetrics.length; i++) {
						const prev = vorg.vertOriginYMetrics[i - 1];
						const curr = vorg.vertOriginYMetrics[i];
						if (prev && curr) {
							expect(curr.glyphIndex).toBeGreaterThan(prev.glyphIndex);
						}
					}
				}
			});

			test("vertOriginYMetrics have valid structure", () => {
				if (vorg) {
					for (const metric of vorg.vertOriginYMetrics) {
						expect(typeof metric.glyphIndex).toBe("number");
						expect(typeof metric.vertOriginY).toBe("number");
						expect(metric.glyphIndex).toBeGreaterThanOrEqual(0);
						expect(metric.glyphIndex).toBeLessThan(font.numGlyphs);
					}
				}
			});

			test("no duplicate glyph indices", () => {
				if (vorg) {
					const indices = vorg.vertOriginYMetrics.map((m) => m.glyphIndex);
					const uniqueIndices = new Set(indices);
					expect(uniqueIndices.size).toBe(indices.length);
				}
			});
		});

		describe("getVertOriginY", () => {
			test("returns default for glyph not in metrics", () => {
				if (vorg) {
					const glyphId = 99999;
					const originY = getVertOriginY(vorg, glyphId);
					expect(originY).toBe(vorg.defaultVertOriginY);
				}
			});

			test("returns specific value for glyph in metrics", () => {
				if (vorg && vorg.vertOriginYMetrics.length > 0) {
					const metric = vorg.vertOriginYMetrics[0];
					if (metric) {
						const originY = getVertOriginY(vorg, metric.glyphIndex);
						expect(originY).toBe(metric.vertOriginY);
					}
				}
			});

			test("consistent results on repeated calls", () => {
				if (vorg) {
					const glyphId = 10;
					const originY1 = getVertOriginY(vorg, glyphId);
					const originY2 = getVertOriginY(vorg, glyphId);
					expect(originY1).toBe(originY2);
				}
			});

			test("handles glyph ID 0", () => {
				if (vorg) {
					const originY = getVertOriginY(vorg, 0);
					expect(typeof originY).toBe("number");
				}
			});

			test("handles all glyphs in metrics", () => {
				if (vorg) {
					for (const metric of vorg.vertOriginYMetrics) {
						const originY = getVertOriginY(vorg, metric.glyphIndex);
						expect(originY).toBe(metric.vertOriginY);
					}
				}
			});
		});

		describe("hasVertOriginY", () => {
			test("returns false for glyph not in metrics", () => {
				if (vorg) {
					const glyphId = 99999;
					const has = hasVertOriginY(vorg, glyphId);
					expect(has).toBe(false);
				}
			});

			test("returns true for glyph in metrics", () => {
				if (vorg && vorg.vertOriginYMetrics.length > 0) {
					const metric = vorg.vertOriginYMetrics[0];
					if (metric) {
						const has = hasVertOriginY(vorg, metric.glyphIndex);
						expect(has).toBe(true);
					}
				}
			});

			test("consistent with getVertOriginY", () => {
				if (vorg) {
					for (let i = 0; i < Math.min(100, font.numGlyphs); i++) {
						const has = hasVertOriginY(vorg, i);
						const originY = getVertOriginY(vorg, i);

						if (has) {
							expect(originY).not.toBe(vorg.defaultVertOriginY);
						}
					}
				}
			});

			test("returns false for glyph ID 0 if not in metrics", () => {
				if (vorg) {
					const has = hasVertOriginY(vorg, 0);
					const inMetrics = vorg.vertOriginYMetrics.some(
						(m) => m.glyphIndex === 0,
					);
					expect(has).toBe(inMetrics);
				}
			});
		});

		describe("CJK character vertical origins", () => {
			test("gets vertical origin for common CJK characters", () => {
				if (!vorg) return;
				const chars = ["一", "中", "文", "日", "本"];
				for (const char of chars) {
					const glyphId = font.glyphIdForChar(char);
					if (glyphId > 0) {
						const originY = getVertOriginY(vorg, glyphId);
						expect(typeof originY).toBe("number");
					}
				}
			});
		});
	});

	describe("synthetic vorg parsing", () => {
		test("parses minimal VORG table with no metrics", () => {
			const buffer = new ArrayBuffer(8);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 880, false);
			offset += 2;
			view.setUint16(offset, 0, false);

			const reader = new Reader(buffer);
			const vorg = parseVorg(reader);

			expect(vorg.majorVersion).toBe(1);
			expect(vorg.minorVersion).toBe(0);
			expect(vorg.defaultVertOriginY).toBe(880);
			expect(vorg.vertOriginYMetrics.length).toBe(0);
		});

		test("parses VORG table with single metric", () => {
			const buffer = new ArrayBuffer(12);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 880, false);
			offset += 2;
			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 100, false);
			offset += 2;
			view.setInt16(offset, 900, false);

			const reader = new Reader(buffer);
			const vorg = parseVorg(reader);

			expect(vorg.majorVersion).toBe(1);
			expect(vorg.minorVersion).toBe(0);
			expect(vorg.defaultVertOriginY).toBe(880);
			expect(vorg.vertOriginYMetrics.length).toBe(1);
			expect(vorg.vertOriginYMetrics[0]?.glyphIndex).toBe(100);
			expect(vorg.vertOriginYMetrics[0]?.vertOriginY).toBe(900);
		});

		test("parses VORG table with multiple metrics", () => {
			const buffer = new ArrayBuffer(20);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 880, false);
			offset += 2;
			view.setUint16(offset, 3, false);
			offset += 2;
			view.setUint16(offset, 10, false);
			offset += 2;
			view.setInt16(offset, 900, false);
			offset += 2;
			view.setUint16(offset, 20, false);
			offset += 2;
			view.setInt16(offset, 850, false);
			offset += 2;
			view.setUint16(offset, 30, false);
			offset += 2;
			view.setInt16(offset, 920, false);

			const reader = new Reader(buffer);
			const vorg = parseVorg(reader);

			expect(vorg.vertOriginYMetrics.length).toBe(3);
			expect(vorg.vertOriginYMetrics[0]?.glyphIndex).toBe(10);
			expect(vorg.vertOriginYMetrics[0]?.vertOriginY).toBe(900);
			expect(vorg.vertOriginYMetrics[1]?.glyphIndex).toBe(20);
			expect(vorg.vertOriginYMetrics[1]?.vertOriginY).toBe(850);
			expect(vorg.vertOriginYMetrics[2]?.glyphIndex).toBe(30);
			expect(vorg.vertOriginYMetrics[2]?.vertOriginY).toBe(920);
		});

		test("sorts metrics by glyph index during parsing", () => {
			const buffer = new ArrayBuffer(20);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 880, false);
			offset += 2;
			view.setUint16(offset, 3, false);
			offset += 2;
			view.setUint16(offset, 30, false);
			offset += 2;
			view.setInt16(offset, 920, false);
			offset += 2;
			view.setUint16(offset, 10, false);
			offset += 2;
			view.setInt16(offset, 900, false);
			offset += 2;
			view.setUint16(offset, 20, false);
			offset += 2;
			view.setInt16(offset, 850, false);

			const reader = new Reader(buffer);
			const vorg = parseVorg(reader);

			expect(vorg.vertOriginYMetrics[0]?.glyphIndex).toBe(10);
			expect(vorg.vertOriginYMetrics[1]?.glyphIndex).toBe(20);
			expect(vorg.vertOriginYMetrics[2]?.glyphIndex).toBe(30);
		});

		test("handles negative default vertical origin", () => {
			const buffer = new ArrayBuffer(8);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setUint16(offset, 0, false);

			const reader = new Reader(buffer);
			const vorg = parseVorg(reader);

			expect(vorg.defaultVertOriginY).toBe(-100);
		});

		test("handles negative metric vertical origins", () => {
			const buffer = new ArrayBuffer(12);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 880, false);
			offset += 2;
			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 100, false);
			offset += 2;
			view.setInt16(offset, -200, false);

			const reader = new Reader(buffer);
			const vorg = parseVorg(reader);

			expect(vorg.vertOriginYMetrics[0]?.vertOriginY).toBe(-200);
		});
	});

	describe("getVertOriginY binary search", () => {
		test("finds first metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			const originY = getVertOriginY(vorg, 10);
			expect(originY).toBe(900);
		});

		test("finds middle metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			const originY = getVertOriginY(vorg, 20);
			expect(originY).toBe(850);
		});

		test("finds last metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			const originY = getVertOriginY(vorg, 30);
			expect(originY).toBe(920);
		});

		test("returns default for glyph before first metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			const originY = getVertOriginY(vorg, 5);
			expect(originY).toBe(880);
		});

		test("returns default for glyph after last metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			const originY = getVertOriginY(vorg, 40);
			expect(originY).toBe(880);
		});

		test("returns default for glyph between metrics", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			const originY = getVertOriginY(vorg, 20);
			expect(originY).toBe(880);
		});

		test("handles large number of metrics", () => {
			const metrics = [];
			for (let i = 0; i < 1000; i++) {
				metrics.push({ glyphIndex: i * 10, vertOriginY: 900 + i });
			}

			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: metrics,
			};

			const originY = getVertOriginY(vorg, 500 * 10);
			expect(originY).toBe(900 + 500);

			const originYFirst = getVertOriginY(vorg, 0);
			expect(originYFirst).toBe(900);

			const originYLast = getVertOriginY(vorg, 999 * 10);
			expect(originYLast).toBe(900 + 999);
		});

		test("handles single metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [{ glyphIndex: 10, vertOriginY: 900 }],
			};

			const originY = getVertOriginY(vorg, 10);
			expect(originY).toBe(900);

			const originYDefault = getVertOriginY(vorg, 20);
			expect(originYDefault).toBe(880);
		});

		test("handles empty metrics", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [],
			};

			const originY = getVertOriginY(vorg, 10);
			expect(originY).toBe(880);
		});
	});

	describe("hasVertOriginY binary search", () => {
		test("finds first metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			expect(hasVertOriginY(vorg, 10)).toBe(true);
		});

		test("finds middle metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			expect(hasVertOriginY(vorg, 20)).toBe(true);
		});

		test("finds last metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			expect(hasVertOriginY(vorg, 30)).toBe(true);
		});

		test("returns false for missing glyph", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [
					{ glyphIndex: 10, vertOriginY: 900 },
					{ glyphIndex: 20, vertOriginY: 850 },
					{ glyphIndex: 30, vertOriginY: 920 },
				],
			};

			expect(hasVertOriginY(vorg, 15)).toBe(false);
		});

		test("returns false for empty metrics", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [],
			};

			expect(hasVertOriginY(vorg, 10)).toBe(false);
		});

		test("handles single metric", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [{ glyphIndex: 10, vertOriginY: 900 }],
			};

			expect(hasVertOriginY(vorg, 10)).toBe(true);
			expect(hasVertOriginY(vorg, 20)).toBe(false);
		});
	});

	describe("edge cases", () => {
		test("handles glyph ID 0", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [{ glyphIndex: 0, vertOriginY: 900 }],
			};

			expect(getVertOriginY(vorg, 0)).toBe(900);
			expect(hasVertOriginY(vorg, 0)).toBe(true);
		});

		test("handles maximum uint16 glyph index", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 880,
				vertOriginYMetrics: [{ glyphIndex: 65535, vertOriginY: 900 }],
			};

			expect(getVertOriginY(vorg, 65535)).toBe(900);
			expect(hasVertOriginY(vorg, 65535)).toBe(true);
		});

		test("handles zero default vertical origin", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 0,
				vertOriginYMetrics: [],
			};

			expect(getVertOriginY(vorg, 100)).toBe(0);
		});

		test("handles maximum negative int16 vertical origin", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: -32768,
				vertOriginYMetrics: [{ glyphIndex: 10, vertOriginY: -32768 }],
			};

			expect(vorg.defaultVertOriginY).toBe(-32768);
			expect(getVertOriginY(vorg, 10)).toBe(-32768);
		});

		test("handles maximum positive int16 vertical origin", () => {
			const vorg: VorgTable = {
				majorVersion: 1,
				minorVersion: 0,
				defaultVertOriginY: 32767,
				vertOriginYMetrics: [{ glyphIndex: 10, vertOriginY: 32767 }],
			};

			expect(vorg.defaultVertOriginY).toBe(32767);
			expect(getVertOriginY(vorg, 10)).toBe(32767);
		});
	});
});
