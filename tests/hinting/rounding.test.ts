import { describe, test, expect } from "bun:test";
import {
	roundToGrid,
	roundToHalfGrid,
	roundToDoubleGrid,
	roundDownToGrid,
	roundUpToGrid,
	roundOff,
	roundSuper,
	roundSuper45,
	round,
	parseSuperRound,
	compensate,
} from "../../src/hinting/rounding.ts";
import {
	createDefaultGraphicsState,
	RoundMode,
	type GraphicsState,
} from "../../src/hinting/types.ts";

describe("TrueType Rounding - roundToGrid", () => {
	test("rounds positive values to nearest pixel", () => {
		expect(roundToGrid(32, 0)).toBe(64); // 0.5 -> 1.0
		expect(roundToGrid(33, 0)).toBe(64); // 0.515625 -> 1.0
		expect(roundToGrid(96, 0)).toBe(128); // 1.5 -> 2.0
		expect(roundToGrid(128, 0)).toBe(128); // 2.0 -> 2.0
		expect(roundToGrid(0, 0)).toBe(0); // 0 -> 0
		expect(roundToGrid(64, 0)).toBe(64); // 1.0 -> 1.0
	});

	test("rounds negative values to nearest pixel", () => {
		expect(roundToGrid(-32, 0)).toBe(-64); // -0.5 -> -1.0
		expect(roundToGrid(-96, 0)).toBe(-128); // -1.5 -> -2.0
		expect(roundToGrid(-128, 0)).toBe(-128); // -2.0 -> -2.0
		// -1 rounds to -0 which is 0 in JavaScript (-((-1 + 32 + 0) & -64) = -(32 & -64) = -0)
		const result = roundToGrid(-1, 0);
		expect(result === 0 || result === -0).toBe(true);
	});

	test("applies compensation", () => {
		expect(roundToGrid(32, 16)).toBe(64); // 0.5 + 0.25 = 0.75 -> 1.0
		expect(roundToGrid(16, 16)).toBe(64); // 0.25 + 0.25 = 0.5 -> 1.0
		expect(roundToGrid(-32, 16)).toBe(-64); // -0.5 + 0.25 = -0.25 -> -1.0
	});
});

describe("TrueType Rounding - roundToHalfGrid", () => {
	test("rounds positive values to half pixels", () => {
		expect(roundToHalfGrid(0, 0)).toBe(32); // 0 -> 0.5
		expect(roundToHalfGrid(64, 0)).toBe(96); // 1.0 -> 1.5
		expect(roundToHalfGrid(96, 0)).toBe(160); // 1.5 -> 2.5
		expect(roundToHalfGrid(128, 0)).toBe(160); // 2.0 -> 2.5
	});

	test("rounds negative values to half pixels", () => {
		expect(roundToHalfGrid(-64, 0)).toBe(-96); // -1.0 -> -1.5
		expect(roundToHalfGrid(-96, 0)).toBe(-160); // -1.5 -> -2.5
		// -1: -(((-(-1) + 32 + 0) & -64) + 32) = -((33 & -64) + 32) = -(0 + 32) = -32
		expect(roundToHalfGrid(-1, 0)).toBe(-32);
	});

	test("applies compensation", () => {
		expect(roundToHalfGrid(32, 16)).toBe(96); // 0.5 + 0.25 = 0.75 -> 1.5
		expect(roundToHalfGrid(-32, 16)).toBe(-96); // -0.5 + 0.25 = -0.25 -> -1.5
	});
});

describe("TrueType Rounding - roundToDoubleGrid", () => {
	test("rounds positive values to half-pixel boundaries", () => {
		expect(roundToDoubleGrid(0, 0)).toBe(0); // 0 -> 0
		expect(roundToDoubleGrid(32, 0)).toBe(32); // 0.5 -> 0.5
		expect(roundToDoubleGrid(64, 0)).toBe(64); // 1.0 -> 1.0
		expect(roundToDoubleGrid(48, 0)).toBe(64); // 0.75 -> 1.0
		expect(roundToDoubleGrid(16, 0)).toBe(32); // 0.25 -> 0.5
	});

	test("rounds negative values to half-pixel boundaries", () => {
		expect(roundToDoubleGrid(-32, 0)).toBe(-32); // -0.5 -> -0.5
		expect(roundToDoubleGrid(-64, 0)).toBe(-64); // -1.0 -> -1.0
		expect(roundToDoubleGrid(-48, 0)).toBe(-64); // -0.75 -> -1.0
		// -1: -((-(-1) + 16 + 0) & -32) = -((17 & -32)) = -0
		const result = roundToDoubleGrid(-1, 0);
		expect(result === 0 || result === -0).toBe(true);
	});

	test("applies compensation", () => {
		expect(roundToDoubleGrid(16, 8)).toBe(32); // 0.25 + 0.125 = 0.375 -> 0.5
		expect(roundToDoubleGrid(-16, 8)).toBe(-32); // -0.25 + 0.125 = -0.125 -> -0.5
	});
});

describe("TrueType Rounding - roundDownToGrid", () => {
	test("rounds positive values down (floor)", () => {
		expect(roundDownToGrid(63, 0)).toBe(0); // 0.984375 -> 0
		expect(roundDownToGrid(64, 0)).toBe(64); // 1.0 -> 1.0
		expect(roundDownToGrid(127, 0)).toBe(64); // 1.984375 -> 1.0
		expect(roundDownToGrid(128, 0)).toBe(128); // 2.0 -> 2.0
		expect(roundDownToGrid(0, 0)).toBe(0); // 0 -> 0
	});

	test("rounds negative values down (floor)", () => {
		// -1: -((0 - (-1)) & -64) = -(1 & -64) = -0
		const result = roundDownToGrid(-1, 0);
		expect(result === 0 || result === -0).toBe(true);
		expect(roundDownToGrid(-64, 0)).toBe(-64); // -1.0 -> -1.0
		expect(roundDownToGrid(-65, 0)).toBe(-64); // -1.015625 -> -1.0
		expect(roundDownToGrid(-128, 0)).toBe(-128); // -2.0 -> -2.0
	});

	test("applies compensation", () => {
		expect(roundDownToGrid(63, 1)).toBe(64); // 0.984375 + 0.015625 = 1.0 -> 1.0
		// -1: -((1 - (-1)) & -64) = -(2 & -64) = -0
		const result = roundDownToGrid(-1, 1);
		expect(result === 0 || result === -0).toBe(true);
	});
});

describe("TrueType Rounding - roundUpToGrid", () => {
	test("rounds positive values up (ceiling)", () => {
		expect(roundUpToGrid(1, 0)).toBe(64); // 0.015625 -> 1.0
		expect(roundUpToGrid(64, 0)).toBe(64); // 1.0 -> 1.0
		expect(roundUpToGrid(65, 0)).toBe(128); // 1.015625 -> 2.0
		// 0: (0 + 63 + 0) & -64 = 63 & -64 = 0
		expect(roundUpToGrid(0, 0)).toBe(0);
		expect(roundUpToGrid(127, 0)).toBe(128); // 1.984375 -> 2.0
	});

	test("rounds negative values up (ceiling)", () => {
		expect(roundUpToGrid(-1, 0)).toBe(-64); // -0.015625 -> -1.0
		expect(roundUpToGrid(-64, 0)).toBe(-64); // -1.0 -> -1.0
		expect(roundUpToGrid(-65, 0)).toBe(-128); // -1.015625 -> -2.0
		expect(roundUpToGrid(-128, 0)).toBe(-128); // -2.0 -> -2.0
	});

	test("applies compensation", () => {
		expect(roundUpToGrid(1, 16)).toBe(64); // 0.015625 + 0.25 = 0.265625 -> 1.0
		expect(roundUpToGrid(-1, 16)).toBe(-64); // -0.015625 + 0.25 = 0.234375 -> -1.0
	});
});

describe("TrueType Rounding - roundOff", () => {
	test("returns distance unchanged", () => {
		expect(roundOff(0, 0)).toBe(0);
		expect(roundOff(64, 0)).toBe(64);
		expect(roundOff(-64, 0)).toBe(-64);
		expect(roundOff(100, 0)).toBe(100);
		expect(roundOff(-100, 0)).toBe(-100);
	});

	test("ignores compensation", () => {
		expect(roundOff(64, 32)).toBe(64);
		expect(roundOff(-64, 32)).toBe(-64);
		expect(roundOff(0, 100)).toBe(0);
	});
});

describe("TrueType Rounding - roundSuper", () => {
	test("rounds positive values with custom period, phase, threshold", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64; // 1 pixel
		GS.phase = 0;
		GS.threshold = 32;

		// 32: (32 + 32 - 0 + 0) & -64 = 64 & -64 = 64; return 64 + 0 = 64
		expect(roundSuper(32, 0, GS)).toBe(64);
		// 64: (64 + 32 - 0 + 0) & -64 = 96 & -64 = 64; return 64 + 0 = 64
		expect(roundSuper(64, 0, GS)).toBe(64);
		// 96: (96 + 32 - 0 + 0) & -64 = 128 & -64 = 128; return 128 + 0 = 128
		expect(roundSuper(96, 0, GS)).toBe(128);
	});

	test("rounds negative values with custom period, phase, threshold", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64; // 1 pixel
		GS.phase = 0;
		GS.threshold = 32;

		// -32: val = (32 + 32 - 0 + 0) & -64 = 64 & -64 = 64; return -(64 + 0) = -64
		expect(roundSuper(-32, 0, GS)).toBe(-64);
		// -64: val = (64 + 32 - 0 + 0) & -64 = 96 & -64 = 64; return -(64 + 0) = -64
		expect(roundSuper(-64, 0, GS)).toBe(-64);
		// -96: val = (96 + 32 - 0 + 0) & -64 = 128 & -64 = 128; return -(128 + 0) = -128
		expect(roundSuper(-96, 0, GS)).toBe(-128);
	});

	test("applies phase offset", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64;
		GS.phase = 16; // 0.25 pixel
		GS.threshold = 32;

		expect(roundSuper(64, 0, GS)).toBe(80); // 1.0 -> 1.0 + 0.25 = 1.25
		expect(roundSuper(-64, 0, GS)).toBe(-80); // -1.0 -> -1.0 - 0.25 = -1.25
	});

	test("applies threshold", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64;
		GS.phase = 0;
		GS.threshold = 16; // Lower threshold

		// 16: (16 + 16 - 0 + 0) & -64 = 32 & -64 = 0; return 0 + 0 = 0
		expect(roundSuper(16, 0, GS)).toBe(0);
		// 48: (48 + 16 - 0 + 0) & -64 = 64 & -64 = 64; return 64 + 0 = 64
		expect(roundSuper(48, 0, GS)).toBe(64);
		// 80: (80 + 16 - 0 + 0) & -64 = 96 & -64 = 64; return 64 + 0 = 64
		expect(roundSuper(80, 0, GS)).toBe(64);
	});

	test("applies compensation", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64;
		GS.phase = 0;
		GS.threshold = 32;

		// 32: (32 + 32 - 0 + 16) & -64 = 80 & -64 = 64; return 64 + 0 = 64
		expect(roundSuper(32, 16, GS)).toBe(64);
		// -32: val = (32 + 32 - 0 + 16) & -64 = 80 & -64 = 64; return -(64 + 0) = -64
		expect(roundSuper(-32, 16, GS)).toBe(-64);
	});

	test("works with different period values", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 32; // Half pixel
		GS.phase = 0;
		GS.threshold = 16;

		// 32: (32 + 16 - 0 + 0) & -32 = 48 & -32 = 32; return 32 + 0 = 32
		expect(roundSuper(32, 0, GS)).toBe(32);
		// 64: (64 + 16 - 0 + 0) & -32 = 80 & -32 = 64; return 64 + 0 = 64
		expect(roundSuper(64, 0, GS)).toBe(64);
		// 48: (48 + 16 - 0 + 0) & -32 = 64 & -32 = 64; return 64 + 0 = 64
		expect(roundSuper(48, 0, GS)).toBe(64);
	});
});

describe("TrueType Rounding - roundSuper45", () => {
	test("rounds positive values with 45-degree adjustment", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64; // 1 pixel
		GS.phase = 0;
		GS.threshold = 32;

		// period45 = Math.round((64 * 46) / 64) = 46
		// Test that it produces some result (covering the code path)
		expect(roundSuper45(32, 0, GS)).toBe(64);
		expect(roundSuper45(64, 0, GS)).toBe(64);
		expect(roundSuper45(96, 0, GS)).toBe(128);
	});

	test("rounds negative values with 45-degree adjustment", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64;
		GS.phase = 0;
		GS.threshold = 32;

		expect(roundSuper45(-32, 0, GS)).toBe(-64);
		expect(roundSuper45(-64, 0, GS)).toBe(-64);
		expect(roundSuper45(-96, 0, GS)).toBe(-128);
	});

	test("applies phase offset with 45-degree adjustment", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64;
		GS.phase = 16; // 0.25 pixel
		GS.threshold = 32;

		// With phase, the result is val + phase
		// 64: (64 + 32 - 16 + 0) & -46 = 80 & -46; then add phase 16
		expect(roundSuper45(64, 0, GS)).toBe(96);
		expect(roundSuper45(-64, 0, GS)).toBe(-96);
	});

	test("applies threshold with 45-degree adjustment", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64;
		GS.phase = 0;
		GS.threshold = 16;

		expect(roundSuper45(16, 0, GS)).toBe(0);
		expect(roundSuper45(48, 0, GS)).toBe(64);
	});

	test("applies compensation with 45-degree adjustment", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 64;
		GS.phase = 0;
		GS.threshold = 32;

		// 32: (32 + 32 - 0 + 16) & -46 = 80 & -46
		expect(roundSuper45(32, 16, GS)).toBe(80);
		expect(roundSuper45(-32, 16, GS)).toBe(-80);
	});

	test("works with different period values", () => {
		const GS = createDefaultGraphicsState();
		GS.period = 128; // 2 pixels
		GS.phase = 0;
		GS.threshold = 64;

		// period45 = Math.round((128 * 46) / 64) = 92
		expect(roundSuper45(64, 0, GS)).toBe(128);
		expect(roundSuper45(128, 0, GS)).toBe(128);
	});
});

describe("TrueType Rounding - round (unified interface)", () => {
	test("applies ToGrid mode", () => {
		const GS = createDefaultGraphicsState();
		GS.roundState = RoundMode.ToGrid;
		expect(round(32, 0, GS)).toBe(64);
		expect(round(-32, 0, GS)).toBe(-64);
	});

	test("applies ToHalfGrid mode", () => {
		const GS = createDefaultGraphicsState();
		GS.roundState = RoundMode.ToHalfGrid;
		expect(round(0, 0, GS)).toBe(32);
		expect(round(64, 0, GS)).toBe(96);
	});

	test("applies ToDoubleGrid mode", () => {
		const GS = createDefaultGraphicsState();
		GS.roundState = RoundMode.ToDoubleGrid;
		expect(round(48, 0, GS)).toBe(64);
		expect(round(-48, 0, GS)).toBe(-64);
	});

	test("applies DownToGrid mode", () => {
		const GS = createDefaultGraphicsState();
		GS.roundState = RoundMode.DownToGrid;
		expect(round(63, 0, GS)).toBe(0);
		const result = round(-1, 0, GS);
		expect(result === 0 || result === -0).toBe(true);
	});

	test("applies UpToGrid mode", () => {
		const GS = createDefaultGraphicsState();
		GS.roundState = RoundMode.UpToGrid;
		expect(round(1, 0, GS)).toBe(64);
		expect(round(-1, 0, GS)).toBe(-64);
	});

	test("applies Off mode", () => {
		const GS = createDefaultGraphicsState();
		GS.roundState = RoundMode.Off;
		expect(round(100, 0, GS)).toBe(100);
		expect(round(-100, 0, GS)).toBe(-100);
	});

	test("applies Super mode", () => {
		const GS = createDefaultGraphicsState();
		GS.roundState = RoundMode.Super;
		GS.period = 64;
		GS.phase = 0;
		GS.threshold = 32;
		expect(round(32, 0, GS)).toBe(64);
		expect(round(-32, 0, GS)).toBe(-64);
	});

	test("applies Super45 mode", () => {
		const GS = createDefaultGraphicsState();
		GS.roundState = RoundMode.Super45;
		GS.period = 64;
		GS.phase = 0;
		GS.threshold = 32;
		expect(round(64, 0, GS)).toBe(64);
		expect(round(-64, 0, GS)).toBe(-64);
	});

	test("defaults to ToGrid for unknown mode", () => {
		const GS = createDefaultGraphicsState();
		// Set an invalid round state by casting
		GS.roundState = 99 as RoundMode;
		expect(round(32, 0, GS)).toBe(64); // Should use roundToGrid
		expect(round(-32, 0, GS)).toBe(-64);
	});
});

describe("TrueType Rounding - parseSuperRound", () => {
	test("parses period selection (bits 6-7)", () => {
		const GS = createDefaultGraphicsState();

		// Case 0: period = 32 (1/2 pixel)
		parseSuperRound(0b00000000, GS);
		expect(GS.period).toBe(32);

		// Case 1: period = 64 (1 pixel)
		parseSuperRound(0b01000000, GS);
		expect(GS.period).toBe(64);

		// Case 2: period = 128 (2 pixels)
		parseSuperRound(0b10000000, GS);
		expect(GS.period).toBe(128);

		// Case 3 (reserved): period = 64 (default)
		parseSuperRound(0b11000000, GS);
		expect(GS.period).toBe(64);
	});

	test("parses phase selection (bits 4-5)", () => {
		const GS = createDefaultGraphicsState();

		// Set period first for phase calculations
		parseSuperRound(0b01000000, GS); // period = 64
		expect(GS.period).toBe(64);

		// Case 0: phase = 0
		parseSuperRound(0b01000000, GS);
		expect(GS.phase).toBe(0);

		// Case 1: phase = period/4
		parseSuperRound(0b01010000, GS);
		expect(GS.phase).toBe(16); // 64 / 4

		// Case 2: phase = period/2
		parseSuperRound(0b01100000, GS);
		expect(GS.phase).toBe(32); // 64 / 2

		// Case 3: phase = 3*period/4
		parseSuperRound(0b01110000, GS);
		expect(GS.phase).toBe(48); // 3 * 64 / 4
	});

	test("parses threshold selection (bits 0-3)", () => {
		const GS = createDefaultGraphicsState();

		// Set period first
		parseSuperRound(0b01000000, GS); // period = 64

		// Threshold = 0 means period - 1
		parseSuperRound(0b01000000, GS);
		expect(GS.threshold).toBe(63); // 64 - 1

		// Threshold = 1
		parseSuperRound(0b01000001, GS);
		expect(GS.threshold).toBe(-24); // ((1 - 4) * 64) >> 3

		// Threshold = 4
		parseSuperRound(0b01000100, GS);
		expect(GS.threshold).toBe(0); // ((4 - 4) * 64) >> 3

		// Threshold = 8
		parseSuperRound(0b01001000, GS);
		expect(GS.threshold).toBe(32); // ((8 - 4) * 64) >> 3

		// Threshold = 15 (max)
		parseSuperRound(0b01001111, GS);
		expect(GS.threshold).toBe(88); // ((15 - 4) * 64) >> 3
	});

	test("parses combined selector bytes", () => {
		const GS = createDefaultGraphicsState();

		// Example: period=128, phase=period/2, threshold=4
		// Bits: 10 (period=128) + 10 (phase=period/2) + 0100 (threshold=4)
		parseSuperRound(0b10100100, GS);
		expect(GS.period).toBe(128);
		expect(GS.phase).toBe(64); // 128 / 2
		expect(GS.threshold).toBe(0); // ((4 - 4) * 128) >> 3

		// Example: period=32, phase=period/4, threshold=8
		// Bits: 00 (period=32) + 01 (phase=period/4) + 1000 (threshold=8)
		parseSuperRound(0b00011000, GS);
		expect(GS.period).toBe(32);
		expect(GS.phase).toBe(8); // 32 / 4
		expect(GS.threshold).toBe(16); // ((8 - 4) * 32) >> 3
	});

	test("handles all phase cases with different periods", () => {
		const GS = createDefaultGraphicsState();

		// With period=32
		parseSuperRound(0b00000000, GS);
		expect(GS.period).toBe(32);
		expect(GS.phase).toBe(0);

		parseSuperRound(0b00010000, GS);
		expect(GS.phase).toBe(8); // 32 / 4

		parseSuperRound(0b00100000, GS);
		expect(GS.phase).toBe(16); // 32 / 2

		parseSuperRound(0b00110000, GS);
		expect(GS.phase).toBe(24); // 3 * 32 / 4
	});
});

describe("TrueType Rounding - compensate", () => {
	test("returns 0 for all inputs", () => {
		const GS = createDefaultGraphicsState();
		expect(compensate(0, GS)).toBe(0);
		expect(compensate(64, GS)).toBe(0);
		expect(compensate(-64, GS)).toBe(0);
		expect(compensate(1000, GS)).toBe(0);
		expect(compensate(-1000, GS)).toBe(0);
	});
});
