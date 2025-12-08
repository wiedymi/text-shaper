import { describe, expect, test } from "bun:test";
import {
	CellBuffer,
	PoolOverflowError,
	coverageToGray,
	applyNonZeroRule,
	applyEvenOddRule,
	type Cell,
} from "../../src/raster/cell.ts";
import { PIXEL_BITS, floatToPixel } from "../../src/raster/fixed-point.ts";

describe("raster/cell", () => {
	describe("PoolOverflowError", () => {
		test("creates error with correct name and message", () => {
			const error = new PoolOverflowError();
			expect(error.name).toBe("PoolOverflowError");
			expect(error.message).toBe("Cell pool overflow");
			expect(error instanceof Error).toBe(true);
		});

		test("can be caught as Error", () => {
			try {
				throw new PoolOverflowError();
			} catch (e) {
				expect(e instanceof Error).toBe(true);
				expect(e instanceof PoolOverflowError).toBe(true);
			}
		});
	});

	describe("CellBuffer", () => {
		describe("constructor", () => {
			test("creates buffer with default pool size", () => {
				const buffer = new CellBuffer();
				expect(buffer.minY).toBe(Infinity);
				expect(buffer.maxY).toBe(-Infinity);
				expect(buffer.minX).toBe(Infinity);
				expect(buffer.maxX).toBe(-Infinity);
			});

			test("creates buffer with custom pool size", () => {
				const buffer = new CellBuffer(100);
				expect(buffer.getCellCount()).toBe(0);
			});
		});

		describe("setClip", () => {
			test("sets clipping bounds", () => {
				const buffer = new CellBuffer();
				buffer.setClip(0, 0, 100, 100);
				buffer.setBandBounds(0, 200);

				buffer.setCurrentCell(floatToPixel(50, 1), floatToPixel(50, 1));
				expect(buffer.minX).toBe(50);
				expect(buffer.minY).toBe(50);
			});

			test("clips cells outside bounds", () => {
				const buffer = new CellBuffer();
				buffer.setClip(10, 10, 20, 20);
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(5, 1), floatToPixel(5, 1));
				expect(buffer.minX).toBe(Infinity);
				expect(buffer.minY).toBe(Infinity);
			});
		});

		describe("setBandBounds", () => {
			test("sets band bounds and initializes ycells", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);
				expect(buffer.getBandMinY()).toBe(0);
			});

			test("resizes ycells array for band height", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(10, 50);
				const ycells = buffer.getYCells();
				expect(ycells.length).toBe(40);
			});
		});

		describe("reset", () => {
			test("clears cells after adding data", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				buffer.addArea(100, 50);

				buffer.reset();
				expect(buffer.minY).toBe(Infinity);
				expect(buffer.maxY).toBe(-Infinity);
				expect(buffer.getCellCount()).toBe(0);
			});

			test("resets without band bounds set", () => {
				const buffer = new CellBuffer();
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				buffer.addArea(100, 50);

				buffer.reset();
				expect(buffer.getCellCount()).toBe(0);
				expect(buffer.getYCells().length).toBe(0);
			});
		});

		describe("setCurrentCell", () => {
			test("creates new cell at position", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				const x = floatToPixel(10, 1);
				const y = floatToPixel(20, 1);
				buffer.setCurrentCell(x, y);

				expect(buffer.minX).toBe(10);
				expect(buffer.minY).toBe(20);
			});

			test("reuses same cell for same position", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				const x = floatToPixel(10, 1);
				const y = floatToPixel(20, 1);
				buffer.setCurrentCell(x, y);
				const count1 = buffer.getCellCount();

				buffer.setCurrentCell(x, y);
				const count2 = buffer.getCellCount();

				expect(count2).toBe(count1);
			});

			test("clips cells outside band bounds", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(10, 20);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(5, 1));
				expect(buffer.minY).toBe(Infinity);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(25, 1));
				expect(buffer.minY).toBe(Infinity);
			});

			test("clips cells outside clip bounds", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);
				buffer.setClip(10, 10, 20, 20);

				buffer.setCurrentCell(floatToPixel(5, 1), floatToPixel(15, 1));
				expect(buffer.minX).toBe(Infinity);

				buffer.setCurrentCell(floatToPixel(25, 1), floatToPixel(15, 1));
				expect(buffer.minX).toBe(Infinity);
			});

			test("auto-expands band when not set", () => {
				const buffer = new CellBuffer();
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(50, 1));
				expect(buffer.minY).toBe(50);
			});

			test("initializes band with negative Y", () => {
				const buffer = new CellBuffer();
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(-50, 1));
				expect(buffer.minY).toBe(-50);
				expect(buffer.getBandMinY()).toBe(-50);
				const ycells = buffer.getYCells();
				expect(ycells.length).toBeGreaterThan(256);
			});

			test("initializes band for Y above 256", () => {
				const buffer = new CellBuffer();
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(300, 1));
				expect(buffer.minY).toBe(300);
				expect(buffer.maxY).toBe(300);
				const ycells = buffer.getYCells();
				expect(ycells.length).toBe(301);
			});
		});

		describe("addArea", () => {
			test("adds area and cover to current cell", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				buffer.addArea(1000, 50);
				buffer.addArea(500, 25);

				expect(buffer.getArea()).toBe(1500);
				expect(buffer.getCover()).toBe(75);
			});

			test("does nothing when current cell is null", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 10);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(100, 1));
				const prevCount = buffer.getCellCount();
				buffer.addArea(1000, 50);

				expect(buffer.getCellCount()).toBe(prevCount);
			});
		});

		describe("getArea", () => {
			test("returns current cell area", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(5, 1), floatToPixel(5, 1));
				buffer.addArea(2000, 100);

				expect(buffer.getArea()).toBe(2000);
			});

			test("returns 0 when no current cell", () => {
				const buffer = new CellBuffer();
				expect(buffer.getArea()).toBe(0);
			});
		});

		describe("getCover", () => {
			test("returns current cell cover", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(5, 1), floatToPixel(5, 1));
				buffer.addArea(2000, 100);

				expect(buffer.getCover()).toBe(100);
			});

			test("returns 0 when no current cell", () => {
				const buffer = new CellBuffer();
				expect(buffer.getCover()).toBe(0);
			});
		});

		describe("getCellsForRow", () => {
			test("returns cells for a given row", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(20, 1));
				buffer.addArea(100, 50);
				buffer.setCurrentCell(floatToPixel(15, 1), floatToPixel(20, 1));
				buffer.addArea(200, 75);

				const cells = buffer.getCellsForRow(20);
				expect(cells.length).toBe(2);
				expect(cells[0].x).toBe(10);
				expect(cells[1].x).toBe(15);
			});

			test("returns empty array for row outside band", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 10);

				const cells = buffer.getCellsForRow(20);
				expect(cells.length).toBe(0);
			});

			test("returns empty array for row with no cells", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				const cells = buffer.getCellsForRow(50);
				expect(cells.length).toBe(0);
			});

			test("returns cells sorted by X", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(30, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(20, 1), floatToPixel(10, 1));

				const cells = buffer.getCellsForRow(10);
				expect(cells[0].x).toBe(10);
				expect(cells[1].x).toBe(20);
				expect(cells[2].x).toBe(30);
			});
		});

		describe("iterateCells", () => {
			test("iterates over all cells in scanline order", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(20, 1));
				buffer.addArea(100, 50);
				buffer.setCurrentCell(floatToPixel(15, 1), floatToPixel(30, 1));
				buffer.addArea(200, 75);

				const rows: Array<{ y: number; cells: Cell[] }> = [];
				for (const row of buffer.iterateCells()) {
					rows.push(row);
				}

				expect(rows.length).toBe(2);
				expect(rows[0].y).toBe(20);
				expect(rows[0].cells.length).toBe(1);
				expect(rows[1].y).toBe(30);
				expect(rows[1].cells.length).toBe(1);
			});

			test("skips empty rows", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(50, 1));

				const rows: Array<{ y: number; cells: Cell[] }> = [];
				for (const row of buffer.iterateCells()) {
					rows.push(row);
				}

				expect(rows.length).toBe(2);
				expect(rows[0].y).toBe(10);
				expect(rows[1].y).toBe(50);
			});

			test("returns empty for buffer with no cells", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				const rows: Array<{ y: number; cells: Cell[] }> = [];
				for (const row of buffer.iterateCells()) {
					rows.push(row);
				}

				expect(rows.length).toBe(0);
			});
		});

		describe("iterateScanlines", () => {
			test("iterates scanlines without allocating arrays", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(20, 1));
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(30, 1));

				const scanlines: Array<{ y: number; firstCellIndex: number }> = [];
				for (const scanline of buffer.iterateScanlines()) {
					scanlines.push(scanline);
				}

				expect(scanlines.length).toBe(2);
				expect(scanlines[0].y).toBe(20);
				expect(scanlines[0].firstCellIndex).toBeGreaterThanOrEqual(0);
				expect(scanlines[1].y).toBe(30);
			});

			test("skips rows without cells", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(90, 1));

				const scanlines: Array<{ y: number; firstCellIndex: number }> = [];
				for (const scanline of buffer.iterateScanlines()) {
					scanlines.push(scanline);
				}

				expect(scanlines.length).toBe(2);
			});
		});

		describe("iterateRowCells", () => {
			test("iterates cells for a single row", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(20, 1));
				buffer.addArea(100, 50);
				buffer.setCurrentCell(floatToPixel(20, 1), floatToPixel(20, 1));
				buffer.addArea(200, 75);

				const cells: Cell[] = [];
				for (const cell of buffer.iterateRowCells(20)) {
					cells.push(cell);
				}

				expect(cells.length).toBe(2);
				expect(cells[0].x).toBe(10);
				expect(cells[1].x).toBe(20);
			});

			test("returns empty for row outside band", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 10);

				const cells: Cell[] = [];
				for (const cell of buffer.iterateRowCells(50)) {
					cells.push(cell);
				}

				expect(cells.length).toBe(0);
			});
		});

		describe("pool management", () => {
			test("throws PoolOverflowError when pool exhausted", () => {
				const buffer = new CellBuffer(10);
				buffer.setBandBounds(0, 100);

				expect(() => {
					for (let i = 0; i < 20; i++) {
						buffer.setCurrentCell(floatToPixel(i, 1), floatToPixel(i, 1));
					}
				}).toThrow(PoolOverflowError);
			});

			test("getCellCount returns number of allocated cells", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				expect(buffer.getCellCount()).toBe(0);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				expect(buffer.getCellCount()).toBe(1);

				buffer.setCurrentCell(floatToPixel(20, 1), floatToPixel(10, 1));
				expect(buffer.getCellCount()).toBe(2);
			});

			test("isNearCapacity returns true when pool almost full", () => {
				const buffer = new CellBuffer(20);
				buffer.setBandBounds(0, 100);

				expect(buffer.isNearCapacity()).toBe(false);

				for (let i = 0; i < 19; i++) {
					buffer.setCurrentCell(floatToPixel(i, 1), floatToPixel(0, 1));
				}

				expect(buffer.isNearCapacity()).toBe(true);
			});

			test("isNearCapacity returns false when pool has space", () => {
				const buffer = new CellBuffer(100);
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				expect(buffer.isNearCapacity()).toBe(false);
			});
		});

		describe("getPool and getNullIndex", () => {
			test("getPool returns cell pool array", () => {
				const buffer = new CellBuffer(100);
				const pool = buffer.getPool();
				expect(pool.length).toBe(100);
			});

			test("getNullIndex returns sentinel value", () => {
				const buffer = new CellBuffer(100);
				const nullIndex = buffer.getNullIndex();
				expect(nullIndex).toBe(99);
			});
		});

		describe("linked list ordering", () => {
			test("inserts cells in sorted X order", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(30, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(20, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(5, 1), floatToPixel(10, 1));

				const cells = buffer.getCellsForRow(10);
				expect(cells[0].x).toBe(5);
				expect(cells[1].x).toBe(10);
				expect(cells[2].x).toBe(20);
				expect(cells[3].x).toBe(30);
			});

			test("finds existing cell in middle of list", () => {
				const buffer = new CellBuffer();
				buffer.setBandBounds(0, 100);

				buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(20, 1), floatToPixel(10, 1));
				buffer.setCurrentCell(floatToPixel(30, 1), floatToPixel(10, 1));

				const countBefore = buffer.getCellCount();
				buffer.setCurrentCell(floatToPixel(20, 1), floatToPixel(10, 1));
				const countAfter = buffer.getCellCount();

				expect(countAfter).toBe(countBefore);
			});
		});
	});

	describe("coverageToGray", () => {
		test("converts zero area to zero", () => {
			expect(coverageToGray(0)).toBe(0);
		});

		test("converts full coverage to 255", () => {
			const fullArea = 255 << (PIXEL_BITS * 2 - 8);
			expect(coverageToGray(fullArea)).toBe(255);
		});

		test("converts partial coverage", () => {
			const halfArea = 128 << (PIXEL_BITS * 2 - 8);
			expect(coverageToGray(halfArea)).toBe(128);
		});

		test("clamps negative values to positive", () => {
			const negativeArea = -100 << (PIXEL_BITS * 2 - 8);
			expect(coverageToGray(negativeArea)).toBe(100);
		});

		test("clamps values above 255", () => {
			const largeArea = 300 << (PIXEL_BITS * 2 - 8);
			expect(coverageToGray(largeArea)).toBe(255);
		});

		test("handles small positive values", () => {
			const smallArea = 10 << (PIXEL_BITS * 2 - 8);
			expect(coverageToGray(smallArea)).toBe(10);
		});
	});

	describe("applyNonZeroRule", () => {
		test("returns positive cover as-is", () => {
			expect(applyNonZeroRule(100)).toBe(100);
		});

		test("converts negative cover to positive", () => {
			expect(applyNonZeroRule(-100)).toBe(100);
		});

		test("clamps values above 255", () => {
			expect(applyNonZeroRule(300)).toBe(255);
			expect(applyNonZeroRule(-300)).toBe(255);
		});

		test("handles zero", () => {
			expect(applyNonZeroRule(0)).toBe(0);
		});
	});

	describe("applyEvenOddRule", () => {
		test("handles zero", () => {
			expect(applyEvenOddRule(0)).toBe(0);
		});

		test("handles positive values in first period", () => {
			expect(applyEvenOddRule(100)).toBe(100);
		});

		test("handles negative values", () => {
			expect(applyEvenOddRule(-100)).toBe(100);
		});

		test("wraps values above 256", () => {
			expect(applyEvenOddRule(300)).toBe(212);
		});

		test("wraps values in second period", () => {
			expect(applyEvenOddRule(400)).toBe(112);
		});

		test("clamps to 255", () => {
			expect(applyEvenOddRule(256)).toBe(255);
		});

		test("handles negative wrapped values", () => {
			expect(applyEvenOddRule(-300)).toBe(212);
		});

		test("applies modulo 512", () => {
			expect(applyEvenOddRule(512)).toBe(0);
			expect(applyEvenOddRule(600)).toBe(88);
		});

		test("inverts after 256", () => {
			expect(applyEvenOddRule(257)).toBe(255);
			expect(applyEvenOddRule(350)).toBe(162);
		});
	});

	describe("integration tests", () => {
		test("accumulates area and cover across multiple cells", () => {
			const buffer = new CellBuffer();
			buffer.setBandBounds(0, 100);

			const cells: Array<{ x: number; y: number; area: number; cover: number }> = [
				{ x: 10, y: 20, area: 1000, cover: 100 },
				{ x: 11, y: 20, area: 2000, cover: 150 },
				{ x: 10, y: 21, area: 500, cover: 50 },
			];

			for (const { x, y, area, cover } of cells) {
				buffer.setCurrentCell(floatToPixel(x, 1), floatToPixel(y, 1));
				buffer.addArea(area, cover);
			}

			const row20 = buffer.getCellsForRow(20);
			expect(row20.length).toBe(2);
			expect(row20[0].area).toBe(1000);
			expect(row20[1].area).toBe(2000);

			const row21 = buffer.getCellsForRow(21);
			expect(row21.length).toBe(1);
			expect(row21[0].area).toBe(500);
		});

		test("handles Y values within auto-expanded band", () => {
			const buffer = new CellBuffer();

			buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(300, 1));
			expect(buffer.minY).toBe(300);
			expect(buffer.maxY).toBe(300);

			buffer.setCurrentCell(floatToPixel(20, 1), floatToPixel(50, 1));
			expect(buffer.minY).toBe(50);
			expect(buffer.maxY).toBe(300);

			buffer.setCurrentCell(floatToPixel(30, 1), floatToPixel(200, 1));
			expect(buffer.minY).toBe(50);
			expect(buffer.maxY).toBe(300);
		});

		test("coverage conversion pipeline", () => {
			const area = 200 << (PIXEL_BITS * 2 - 8);
			const gray = coverageToGray(area);
			expect(gray).toBe(200);

			const nonZero = applyNonZeroRule(-gray);
			expect(nonZero).toBe(200);

			const evenOdd = applyEvenOddRule(gray);
			expect(evenOdd).toBe(200);
		});

		test("cell iteration matches direct access", () => {
			const buffer = new CellBuffer();
			buffer.setBandBounds(0, 100);

			buffer.setCurrentCell(floatToPixel(10, 1), floatToPixel(20, 1));
			buffer.addArea(1000, 100);
			buffer.setCurrentCell(floatToPixel(20, 1), floatToPixel(20, 1));
			buffer.addArea(2000, 200);

			const directCells = buffer.getCellsForRow(20);
			const iteratedCells: Cell[] = [];
			for (const cell of buffer.iterateRowCells(20)) {
				iteratedCells.push(cell);
			}

			expect(directCells.length).toBe(iteratedCells.length);
			for (let i = 0; i < directCells.length; i++) {
				expect(directCells[i].x).toBe(iteratedCells[i].x);
				expect(directCells[i].area).toBe(iteratedCells[i].area);
			}
		});
	});
});
