import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import { parseVhea, type VheaTable } from "../../../src/font/tables/vhea.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_UNICODE_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";

describe("vhea table", () => {
	describe("with Arial Unicode font", () => {
		let font: Font;
		let vhea: VheaTable | null;

		beforeAll(async () => {
			font = await Font.fromFile(ARIAL_UNICODE_PATH);
			vhea = font.vhea;
		});

		describe("parseVhea", () => {
			test("returns VheaTable with version", () => {
				if (!vhea) return;
				expect(vhea.version).toBeDefined();
				expect(vhea.version.major).toBeDefined();
				expect(vhea.version.minor).toBeDefined();
				expect(typeof vhea.version.major).toBe("number");
				expect(typeof vhea.version.minor).toBe("number");
			});

			test("has valid version (1.0 or 1.1)", () => {
				if (!vhea) return;
				expect(vhea.version.major).toBe(1);
				expect([0, 1]).toContain(vhea.version.minor);
			});

			test("has ascender value", () => {
				if (!vhea) return;
				expect(typeof vhea.ascender).toBe("number");
			});

			test("has descender value", () => {
				if (!vhea) return;
				expect(typeof vhea.descender).toBe("number");
			});

			test("has lineGap value", () => {
				if (!vhea) return;
				expect(typeof vhea.lineGap).toBe("number");
			});

			test("has advanceHeightMax", () => {
				if (!vhea) return;
				expect(typeof vhea.advanceHeightMax).toBe("number");
				expect(vhea.advanceHeightMax).toBeGreaterThan(0);
			});

			test("has minTopSideBearing", () => {
				if (!vhea) return;
				expect(typeof vhea.minTopSideBearing).toBe("number");
			});

			test("has minBottomSideBearing", () => {
				if (!vhea) return;
				expect(typeof vhea.minBottomSideBearing).toBe("number");
			});

			test("has yMaxExtent", () => {
				if (!vhea) return;
				expect(typeof vhea.yMaxExtent).toBe("number");
				expect(vhea.yMaxExtent).toBeGreaterThan(0);
			});

			test("has caretSlopeRise", () => {
				if (!vhea) return;
				expect(typeof vhea.caretSlopeRise).toBe("number");
			});

			test("has caretSlopeRun", () => {
				if (!vhea) return;
				expect(typeof vhea.caretSlopeRun).toBe("number");
			});

			test("has caretOffset", () => {
				if (!vhea) return;
				expect(typeof vhea.caretOffset).toBe("number");
			});

			test("has metricDataFormat", () => {
				if (!vhea) return;
				expect(typeof vhea.metricDataFormat).toBe("number");
				expect(vhea.metricDataFormat).toBe(0);
			});

			test("has numberOfVMetrics", () => {
				if (!vhea) return;
				expect(typeof vhea.numberOfVMetrics).toBe("number");
				expect(vhea.numberOfVMetrics).toBeGreaterThan(0);
			});

			test("numberOfVMetrics is within valid range", () => {
				if (!vhea) return;
				expect(vhea.numberOfVMetrics).toBeGreaterThan(0);
				expect(vhea.numberOfVMetrics).toBeLessThanOrEqual(font.numGlyphs);
			});
		});

		describe("vertical metrics values", () => {
			test("has vertical metrics if vhea present", () => {
				if (!vhea) return;
				expect(typeof vhea.ascender).toBe("number");
				expect(typeof vhea.descender).toBe("number");
			});

			test("advanceHeightMax is reasonable if present", () => {
				if (!vhea) return;
				expect(vhea.advanceHeightMax).toBeGreaterThan(0);
				expect(vhea.advanceHeightMax).toBeLessThan(100000);
			});

			test("yMaxExtent is positive if present", () => {
				if (!vhea) return;
				expect(vhea.yMaxExtent).toBeGreaterThan(0);
			});

			test("caret slope values define vertical caret", () => {
				if (!vhea) return;
				expect(typeof vhea.caretSlopeRise).toBe("number");
				expect(typeof vhea.caretSlopeRun).toBe("number");
			});
		});
	});

	describe("synthetic vhea parsing", () => {
		test("parses minimal valid vhea table", () => {
			const buffer = new ArrayBuffer(36);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, -200, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 2000, false);
			offset += 2;
			view.setInt16(offset, 800, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setInt16(offset, 1800, false);
			offset += 2;
			view.setInt16(offset, 1, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 150, false);
			offset += 2;

			const reader = new Reader(buffer);
			const vhea = parseVhea(reader);

			expect(vhea.version.major).toBe(1);
			expect(vhea.version.minor).toBe(0);
			expect(vhea.ascender).toBe(1000);
			expect(vhea.descender).toBe(-200);
			expect(vhea.lineGap).toBe(0);
			expect(vhea.advanceHeightMax).toBe(2000);
			expect(vhea.minTopSideBearing).toBe(800);
			expect(vhea.minBottomSideBearing).toBe(-100);
			expect(vhea.yMaxExtent).toBe(1800);
			expect(vhea.caretSlopeRise).toBe(1);
			expect(vhea.caretSlopeRun).toBe(0);
			expect(vhea.caretOffset).toBe(0);
			expect(vhea.metricDataFormat).toBe(0);
			expect(vhea.numberOfVMetrics).toBe(150);
		});

		test("parses vhea version 1.1", () => {
			const buffer = new ArrayBuffer(36);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 1, false);
			offset += 2;
			view.setInt16(offset, 900, false);
			offset += 2;
			view.setInt16(offset, -300, false);
			offset += 2;
			view.setInt16(offset, 100, false);
			offset += 2;
			view.setUint16(offset, 1900, false);
			offset += 2;
			view.setInt16(offset, 700, false);
			offset += 2;
			view.setInt16(offset, -200, false);
			offset += 2;
			view.setInt16(offset, 1700, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 1, false);
			offset += 2;
			view.setInt16(offset, 50, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 200, false);
			offset += 2;

			const reader = new Reader(buffer);
			const vhea = parseVhea(reader);

			expect(vhea.version.major).toBe(1);
			expect(vhea.version.minor).toBe(1);
			expect(vhea.caretSlopeRise).toBe(0);
			expect(vhea.caretSlopeRun).toBe(1);
			expect(vhea.caretOffset).toBe(50);
			expect(vhea.numberOfVMetrics).toBe(200);
		});

		test("handles negative bearing values", () => {
			const buffer = new ArrayBuffer(36);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, -500, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 2000, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setInt16(offset, -200, false);
			offset += 2;
			view.setInt16(offset, 1500, false);
			offset += 2;
			view.setInt16(offset, 1, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			offset += 8;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 100, false);

			const reader = new Reader(buffer);
			const vhea = parseVhea(reader);

			expect(vhea.minTopSideBearing).toBe(-100);
			expect(vhea.minBottomSideBearing).toBe(-200);
			expect(vhea.descender).toBe(-500);
		});

		test("handles zero line gap", () => {
			const buffer = new ArrayBuffer(36);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, -200, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 2000, false);
			offset += 2;
			view.setInt16(offset, 800, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setInt16(offset, 1800, false);
			offset += 2;
			view.setInt16(offset, 1, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			offset += 8;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 50, false);

			const reader = new Reader(buffer);
			const vhea = parseVhea(reader);

			expect(vhea.lineGap).toBe(0);
		});

		test("handles positive line gap", () => {
			const buffer = new ArrayBuffer(36);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, -200, false);
			offset += 2;
			view.setInt16(offset, 200, false);
			offset += 2;
			view.setUint16(offset, 2000, false);
			offset += 2;
			view.setInt16(offset, 800, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setInt16(offset, 1800, false);
			offset += 2;
			view.setInt16(offset, 1, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			offset += 8;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 50, false);

			const reader = new Reader(buffer);
			const vhea = parseVhea(reader);

			expect(vhea.lineGap).toBe(200);
		});

		test("handles non-zero caret values", () => {
			const buffer = new ArrayBuffer(36);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, -200, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 2000, false);
			offset += 2;
			view.setInt16(offset, 800, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setInt16(offset, 1800, false);
			offset += 2;
			view.setInt16(offset, 100, false);
			offset += 2;
			view.setInt16(offset, 50, false);
			offset += 2;
			view.setInt16(offset, 25, false);
			offset += 2;
			offset += 8;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 50, false);

			const reader = new Reader(buffer);
			const vhea = parseVhea(reader);

			expect(vhea.caretSlopeRise).toBe(100);
			expect(vhea.caretSlopeRun).toBe(50);
			expect(vhea.caretOffset).toBe(25);
		});
	});

	describe("edge cases", () => {
		test("handles maximum numberOfVMetrics", () => {
			const buffer = new ArrayBuffer(36);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, -200, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 2000, false);
			offset += 2;
			view.setInt16(offset, 800, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setInt16(offset, 1800, false);
			offset += 2;
			view.setInt16(offset, 1, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			offset += 8;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 65535, false);

			const reader = new Reader(buffer);
			const vhea = parseVhea(reader);

			expect(vhea.numberOfVMetrics).toBe(65535);
		});

		test("handles minimum numberOfVMetrics", () => {
			const buffer = new ArrayBuffer(36);
			const view = new DataView(buffer);
			let offset = 0;

			view.setUint16(offset, 1, false);
			offset += 2;
			view.setUint16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 1000, false);
			offset += 2;
			view.setInt16(offset, -200, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 2000, false);
			offset += 2;
			view.setInt16(offset, 800, false);
			offset += 2;
			view.setInt16(offset, -100, false);
			offset += 2;
			view.setInt16(offset, 1800, false);
			offset += 2;
			view.setInt16(offset, 1, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setInt16(offset, 0, false);
			offset += 2;
			offset += 8;
			view.setInt16(offset, 0, false);
			offset += 2;
			view.setUint16(offset, 1, false);

			const reader = new Reader(buffer);
			const vhea = parseVhea(reader);

			expect(vhea.numberOfVMetrics).toBe(1);
		});
	});
});
