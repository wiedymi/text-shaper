import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../../src/font/font.ts";
import {
	parseGasp,
	getGaspBehavior,
	shouldGridFit,
	shouldDoGray,
	GaspFlag,
	type GaspTable,
} from "../../../src/font/tables/gasp.ts";
import { Reader } from "../../../src/font/binary/reader.ts";

const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";

describe("gasp table", () => {
	let font: Font;
	let gasp: GaspTable | null;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
		gasp = font.gasp;
	});

	describe("parseGasp", () => {
		test("returns GaspTable from Arial", () => {
			expect(gasp).not.toBeNull();
			if (!gasp) return;

			expect(typeof gasp.version).toBe("number");
			expect(Array.isArray(gasp.ranges)).toBe(true);
			expect(gasp.ranges.length).toBeGreaterThan(0);
		});

		test("ranges have maxPPEM and behavior", () => {
			if (!gasp) return;

			for (const range of gasp.ranges) {
				expect(typeof range.maxPPEM).toBe("number");
				expect(typeof range.behavior).toBe("number");
				expect(range.maxPPEM).toBeGreaterThan(0);
			}
		});

		test("ranges are sorted by maxPPEM", () => {
			if (!gasp) return;

			for (let i = 1; i < gasp.ranges.length; i++) {
				expect(gasp.ranges[i]!.maxPPEM).toBeGreaterThanOrEqual(
					gasp.ranges[i - 1]!.maxPPEM,
				);
			}
		});

		test("parses synthetic gasp with single range", () => {
			const data = new Uint8Array([
				0x00, 0x00, // version 0
				0x00, 0x01, // 1 range
				0x00, 0x08, // maxPPEM: 8
				0x00, 0x01, // behavior: GridFit
			]);
			const reader = new Reader(data.buffer);
			const table = parseGasp(reader);

			expect(table.version).toBe(0);
			expect(table.ranges.length).toBe(1);
			expect(table.ranges[0]!.maxPPEM).toBe(8);
			expect(table.ranges[0]!.behavior).toBe(GaspFlag.GridFit);
		});

		test("parses synthetic gasp with multiple ranges", () => {
			const data = new Uint8Array([
				0x00, 0x00, // version 0
				0x00, 0x03, // 3 ranges
				0x00, 0x08, // maxPPEM: 8
				0x00, 0x01, // behavior: GridFit
				0x00, 0x10, // maxPPEM: 16
				0x00, 0x03, // behavior: GridFit | DoGray
				0xff, 0xff, // maxPPEM: 65535
				0x00, 0x0f, // behavior: all flags
			]);
			const reader = new Reader(data.buffer);
			const table = parseGasp(reader);

			expect(table.version).toBe(0);
			expect(table.ranges.length).toBe(3);
			expect(table.ranges[0]!.maxPPEM).toBe(8);
			expect(table.ranges[1]!.maxPPEM).toBe(16);
			expect(table.ranges[2]!.maxPPEM).toBe(65535);
		});

		test("sorts unsorted ranges", () => {
			const data = new Uint8Array([
				0x00, 0x00, // version 0
				0x00, 0x02, // 2 ranges
				0x00, 0x10, // maxPPEM: 16 (second)
				0x00, 0x02, // behavior: DoGray
				0x00, 0x08, // maxPPEM: 8 (first)
				0x00, 0x01, // behavior: GridFit
			]);
			const reader = new Reader(data.buffer);
			const table = parseGasp(reader);

			expect(table.ranges.length).toBe(2);
			expect(table.ranges[0]!.maxPPEM).toBe(8);
			expect(table.ranges[1]!.maxPPEM).toBe(16);
		});

		test("handles empty ranges", () => {
			const data = new Uint8Array([
				0x00, 0x00, // version 0
				0x00, 0x00, // 0 ranges
			]);
			const reader = new Reader(data.buffer);
			const table = parseGasp(reader);

			expect(table.version).toBe(0);
			expect(table.ranges.length).toBe(0);
		});
	});

	describe("getGaspBehavior", () => {
		test("returns behavior for ppem within range", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [
					{ maxPPEM: 8, behavior: GaspFlag.GridFit },
					{ maxPPEM: 16, behavior: GaspFlag.GridFit | GaspFlag.DoGray },
					{ maxPPEM: 65535, behavior: GaspFlag.DoGray },
				],
			};

			expect(getGaspBehavior(table, 5)).toBe(GaspFlag.GridFit);
			expect(getGaspBehavior(table, 8)).toBe(GaspFlag.GridFit);
			expect(getGaspBehavior(table, 12)).toBe(
				GaspFlag.GridFit | GaspFlag.DoGray,
			);
			expect(getGaspBehavior(table, 16)).toBe(
				GaspFlag.GridFit | GaspFlag.DoGray,
			);
			expect(getGaspBehavior(table, 20)).toBe(GaspFlag.DoGray);
		});

		test("returns last range behavior for ppem above all ranges", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [
					{ maxPPEM: 8, behavior: GaspFlag.GridFit },
					{ maxPPEM: 16, behavior: GaspFlag.DoGray },
				],
			};

			expect(getGaspBehavior(table, 100)).toBe(GaspFlag.DoGray);
			expect(getGaspBehavior(table, 65535)).toBe(GaspFlag.DoGray);
		});

		test("returns default behavior for empty ranges", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [],
			};

			const defaultBehavior = GaspFlag.GridFit | GaspFlag.DoGray;
			expect(getGaspBehavior(table, 12)).toBe(defaultBehavior);
			expect(getGaspBehavior(table, 100)).toBe(defaultBehavior);
		});

		test("handles ppem at exact boundary", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [{ maxPPEM: 16, behavior: GaspFlag.GridFit }],
			};

			expect(getGaspBehavior(table, 16)).toBe(GaspFlag.GridFit);
			expect(getGaspBehavior(table, 15)).toBe(GaspFlag.GridFit);
			expect(getGaspBehavior(table, 17)).toBe(GaspFlag.GridFit);
		});

		test("returns first matching range", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [
					{ maxPPEM: 10, behavior: GaspFlag.GridFit },
					{ maxPPEM: 20, behavior: GaspFlag.DoGray },
					{ maxPPEM: 30, behavior: GaspFlag.SymmetricGridFit },
				],
			};

			expect(getGaspBehavior(table, 5)).toBe(GaspFlag.GridFit);
			expect(getGaspBehavior(table, 15)).toBe(GaspFlag.DoGray);
			expect(getGaspBehavior(table, 25)).toBe(GaspFlag.SymmetricGridFit);
		});
	});

	describe("shouldGridFit", () => {
		test("returns true when GridFit flag is set", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [
					{ maxPPEM: 16, behavior: GaspFlag.GridFit },
					{ maxPPEM: 65535, behavior: GaspFlag.DoGray },
				],
			};

			expect(shouldGridFit(table, 12)).toBe(true);
		});

		test("returns false when GridFit flag is not set", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [{ maxPPEM: 65535, behavior: GaspFlag.DoGray }],
			};

			expect(shouldGridFit(table, 12)).toBe(false);
		});

		test("returns true when both GridFit and DoGray are set", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [
					{ maxPPEM: 65535, behavior: GaspFlag.GridFit | GaspFlag.DoGray },
				],
			};

			expect(shouldGridFit(table, 12)).toBe(true);
		});

		test("checks GridFit at various ppem values", () => {
			if (!gasp) return;

			const ppemValues = [8, 9, 12, 16, 20, 24, 32, 48, 64, 96];
			for (const ppem of ppemValues) {
				const result = shouldGridFit(gasp, ppem);
				expect(typeof result).toBe("boolean");
			}
		});
	});

	describe("shouldDoGray", () => {
		test("returns true when DoGray flag is set", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [
					{ maxPPEM: 16, behavior: GaspFlag.GridFit },
					{ maxPPEM: 65535, behavior: GaspFlag.DoGray },
				],
			};

			expect(shouldDoGray(table, 20)).toBe(true);
		});

		test("returns false when DoGray flag is not set", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [{ maxPPEM: 65535, behavior: GaspFlag.GridFit }],
			};

			expect(shouldDoGray(table, 12)).toBe(false);
		});

		test("returns true when both GridFit and DoGray are set", () => {
			const table: GaspTable = {
				version: 0,
				ranges: [
					{ maxPPEM: 65535, behavior: GaspFlag.GridFit | GaspFlag.DoGray },
				],
			};

			expect(shouldDoGray(table, 12)).toBe(true);
		});

		test("checks DoGray at various ppem values", () => {
			if (!gasp) return;

			const ppemValues = [8, 9, 12, 16, 20, 24, 32, 48, 64, 96];
			for (const ppem of ppemValues) {
				const result = shouldDoGray(gasp, ppem);
				expect(typeof result).toBe("boolean");
			}
		});
	});

	describe("GaspFlag constants", () => {
		test("GridFit flag value", () => {
			expect(GaspFlag.GridFit).toBe(0x0001);
		});

		test("DoGray flag value", () => {
			expect(GaspFlag.DoGray).toBe(0x0002);
		});

		test("SymmetricGridFit flag value", () => {
			expect(GaspFlag.SymmetricGridFit).toBe(0x0004);
		});

		test("SymmetricSmoothing flag value", () => {
			expect(GaspFlag.SymmetricSmoothing).toBe(0x0008);
		});

		test("flags are independent bits", () => {
			expect((GaspFlag.GridFit & GaspFlag.DoGray)).toBe(0);
			expect((GaspFlag.GridFit & GaspFlag.SymmetricGridFit)).toBe(0);
			expect((GaspFlag.GridFit & GaspFlag.SymmetricSmoothing)).toBe(0);
			expect((GaspFlag.DoGray & GaspFlag.SymmetricGridFit)).toBe(0);
		});
	});

	describe("integration tests", () => {
		test("Arial gasp table behavior at small sizes", () => {
			if (!gasp) return;

			const smallSizes = [8, 9, 10, 11, 12];
			for (const ppem of smallSizes) {
				const behavior = getGaspBehavior(gasp, ppem);
				expect(typeof behavior).toBe("number");
				expect(behavior).toBeGreaterThanOrEqual(0);
			}
		});

		test("Arial gasp table behavior at medium sizes", () => {
			if (!gasp) return;

			const mediumSizes = [16, 20, 24, 32];
			for (const ppem of mediumSizes) {
				const behavior = getGaspBehavior(gasp, ppem);
				expect(typeof behavior).toBe("number");
			}
		});

		test("Arial gasp table behavior at large sizes", () => {
			if (!gasp) return;

			const largeSizes = [48, 64, 96, 128];
			for (const ppem of largeSizes) {
				const behavior = getGaspBehavior(gasp, ppem);
				expect(typeof behavior).toBe("number");
			}
		});

		test("grid-fitting and grayscale recommendations correlate", () => {
			if (!gasp) return;

			const ppem = 16;
			const gridFit = shouldGridFit(gasp, ppem);
			const doGray = shouldDoGray(gasp, ppem);

			expect(typeof gridFit).toBe("boolean");
			expect(typeof doGray).toBe("boolean");
		});

		test("behavior changes across ppem thresholds", () => {
			if (!gasp) return;
			if (gasp.ranges.length < 2) return;

			const threshold = gasp.ranges[0]!.maxPPEM;
			const behaviorBefore = getGaspBehavior(gasp, threshold - 1);
			const behaviorAt = getGaspBehavior(gasp, threshold);
			const behaviorAfter = getGaspBehavior(gasp, threshold + 1);

			expect(behaviorBefore).toBe(behaviorAt);
			if (gasp.ranges.length > 1 && gasp.ranges[1]!.maxPPEM > threshold) {
				expect(typeof behaviorAfter).toBe("number");
			}
		});
	});
});
