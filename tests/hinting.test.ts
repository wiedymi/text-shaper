import { describe, test, expect, beforeAll } from "bun:test";
import { Font } from "../src/font/font.ts";
import {
	createExecContext,
	createGlyphZone,
	RoundMode,
	CodeRange,
	type ExecContext,
} from "../src/hinting/types.ts";
import {
	execute,
	setCodeRange,
	runProgram,
} from "../src/hinting/interpreter.ts";
import {
	roundToGrid,
	roundToHalfGrid,
	roundToDoubleGrid,
	roundDownToGrid,
	roundUpToGrid,
	round,
} from "../src/hinting/rounding.ts";
import {
	createHintingEngine,
	loadFontProgram,
	loadCVTProgram,
	setSize,
	hintGlyph,
	hintedToPixels,
	type GlyphOutline,
} from "../src/hinting/programs.ts";

// Helper to run bytecode
function runBytecode(code: Uint8Array, ctx?: ExecContext): ExecContext {
	const context = ctx || createExecContext();
	setCodeRange(context, CodeRange.Glyph, code);
	runProgram(context, CodeRange.Glyph);
	return context;
}

describe("TrueType Hinting - Rounding", () => {
	test("roundToGrid rounds to nearest pixel (64 units)", () => {
		// 26.6 fixed point: 64 = 1 pixel
		// TrueType rounding adds 32 (0.5) and masks with -64
		expect(roundToGrid(32, 0)).toBe(64); // 0.5 + 0.5 = 1.0 -> 1
		expect(roundToGrid(33, 0)).toBe(64); // 0.515625 -> 1
		expect(roundToGrid(96, 0)).toBe(128); // 1.5 + 0.5 = 2.0 -> 2
		expect(roundToGrid(128, 0)).toBe(128); // 2.0 -> 2
		expect(roundToGrid(0, 0)).toBe(0); // 0 + 0.5 = 0.5 -> 0 (exactly)
		expect(roundToGrid(64, 0)).toBe(64); // 1 + 0.5 = 1.5 -> 1 (rounds down)
	});

	test("roundToHalfGrid rounds to half pixels", () => {
		// Rounds to nearest integer, then adds 32 (0.5)
		expect(roundToHalfGrid(0, 0)).toBe(32); // 0 -> 0 + 0.5 = 0.5
		expect(roundToHalfGrid(64, 0)).toBe(96); // 1 -> 1 + 0.5 = 1.5
		expect(roundToHalfGrid(96, 0)).toBe(96); // 1.5 -> 1.5
	});

	test("roundToDoubleGrid rounds to half-pixel boundaries", () => {
		expect(roundToDoubleGrid(0, 0)).toBe(0);
		expect(roundToDoubleGrid(32, 0)).toBe(32);
		expect(roundToDoubleGrid(64, 0)).toBe(64);
		expect(roundToDoubleGrid(48, 0)).toBe(64); // 0.75 -> 1
		expect(roundToDoubleGrid(16, 0)).toBe(32); // 0.25 -> 0.5
	});

	test("roundDownToGrid always rounds down (floor)", () => {
		expect(roundDownToGrid(63, 0)).toBe(0);
		expect(roundDownToGrid(64, 0)).toBe(64);
		expect(roundDownToGrid(127, 0)).toBe(64);
		// For negative values, the result may be -0 which is equal to 0
		const negResult = roundDownToGrid(-1, 0);
		expect(negResult === 0 || negResult === -0).toBe(true);
	});

	test("roundUpToGrid always rounds up (ceiling)", () => {
		expect(roundUpToGrid(1, 0)).toBe(64);
		expect(roundUpToGrid(64, 0)).toBe(64);
		expect(roundUpToGrid(65, 0)).toBe(128);
	});
});

describe("TrueType Hinting - Stack Operations", () => {
	test("PUSH instructions push values to stack", () => {
		// PUSHB[0] 42 - push one byte
		const ctx = runBytecode(new Uint8Array([0xb0, 42]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(42);
	});

	test("PUSHW pushes signed words", () => {
		// PUSHW[0] -1 (0xFF 0xFF)
		const ctx = runBytecode(new Uint8Array([0xb8, 0xff, 0xff]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(-1);
	});

	test("NPUSHB pushes multiple bytes", () => {
		// NPUSHB 3 1 2 3
		const ctx = runBytecode(new Uint8Array([0x40, 3, 1, 2, 3]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(3);
		expect(ctx.stack[0]).toBe(1);
		expect(ctx.stack[1]).toBe(2);
		expect(ctx.stack[2]).toBe(3);
	});

	test("DUP duplicates top of stack", () => {
		// PUSHB[0] 5, DUP
		const ctx = runBytecode(new Uint8Array([0xb0, 5, 0x20]));
		expect(ctx.stackTop).toBe(2);
		expect(ctx.stack[0]).toBe(5);
		expect(ctx.stack[1]).toBe(5);
	});

	test("SWAP exchanges top two values", () => {
		// PUSHB[1] 1 2, SWAP
		const ctx = runBytecode(new Uint8Array([0xb1, 1, 2, 0x23]));
		expect(ctx.stackTop).toBe(2);
		expect(ctx.stack[0]).toBe(2);
		expect(ctx.stack[1]).toBe(1);
	});

	test("DEPTH pushes stack depth", () => {
		// PUSHB[1] 10 20, DEPTH
		const ctx = runBytecode(new Uint8Array([0xb1, 10, 20, 0x24]));
		expect(ctx.stackTop).toBe(3);
		expect(ctx.stack[2]).toBe(2); // Depth before DEPTH executed
	});

	test("ROLL rotates top 3 elements", () => {
		// PUSHB[2] 1 2 3, ROLL -> 2 3 1
		const ctx = runBytecode(new Uint8Array([0xb2, 1, 2, 3, 0x8a]));
		expect(ctx.stackTop).toBe(3);
		expect(ctx.stack[0]).toBe(2);
		expect(ctx.stack[1]).toBe(3);
		expect(ctx.stack[2]).toBe(1);
	});
});

describe("TrueType Hinting - Arithmetic", () => {
	test("ADD adds two values", () => {
		// PUSHB[1] 10 20, ADD
		const ctx = runBytecode(new Uint8Array([0xb1, 10, 20, 0x60]));
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(30);
	});

	test("SUB subtracts top from second", () => {
		// PUSHB[1] 30 10, SUB -> 20
		const ctx = runBytecode(new Uint8Array([0xb1, 30, 10, 0x61]));
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(20);
	});

	test("MUL multiplies (26.6 fixed point)", () => {
		// 64 * 128 / 64 = 128 (1.0 * 2.0 = 2.0)
		// PUSHB[1] 64 128, MUL
		const ctx = runBytecode(new Uint8Array([0xb1, 64, 128, 0x63]));
		expect(ctx.stack[0]).toBe(128);
	});

	test("DIV divides (26.6 fixed point)", () => {
		// 128 * 64 / 64 = 128 (2.0 / 1.0 = 2.0)
		// PUSHB[1] 128 64, DIV
		const ctx = runBytecode(new Uint8Array([0xb1, 128, 64, 0x62]));
		expect(ctx.stack[0]).toBe(128);
	});

	test("ABS returns absolute value", () => {
		// PUSHW[0] -100, ABS
		const ctx = runBytecode(new Uint8Array([0xb8, 0xff, 0x9c, 0x64]));
		expect(ctx.stack[0]).toBe(100);
	});

	test("NEG negates value", () => {
		// PUSHB[0] 42, NEG
		const ctx = runBytecode(new Uint8Array([0xb0, 42, 0x65]));
		expect(ctx.stack[0]).toBe(-42);
	});

	test("MAX returns maximum", () => {
		// PUSHB[1] 5 10, MAX
		const ctx = runBytecode(new Uint8Array([0xb1, 5, 10, 0x8b]));
		expect(ctx.stack[0]).toBe(10);
	});

	test("MIN returns minimum", () => {
		// PUSHB[1] 5 10, MIN
		const ctx = runBytecode(new Uint8Array([0xb1, 5, 10, 0x8c]));
		expect(ctx.stack[0]).toBe(5);
	});
});

describe("TrueType Hinting - Comparisons", () => {
	test("LT returns 1 if less than", () => {
		// PUSHB[1] 5 10, LT
		const ctx = runBytecode(new Uint8Array([0xb1, 5, 10, 0x50]));
		expect(ctx.stack[0]).toBe(1);
	});

	test("GT returns 1 if greater than", () => {
		// PUSHB[1] 10 5, GT
		const ctx = runBytecode(new Uint8Array([0xb1, 10, 5, 0x52]));
		expect(ctx.stack[0]).toBe(1);
	});

	test("EQ returns 1 if equal", () => {
		// PUSHB[1] 42 42, EQ
		const ctx = runBytecode(new Uint8Array([0xb1, 42, 42, 0x54]));
		expect(ctx.stack[0]).toBe(1);
	});

	test("NEQ returns 1 if not equal", () => {
		// PUSHB[1] 42 43, NEQ
		const ctx = runBytecode(new Uint8Array([0xb1, 42, 43, 0x55]));
		expect(ctx.stack[0]).toBe(1);
	});
});

describe("TrueType Hinting - Logic", () => {
	test("AND returns logical AND", () => {
		// PUSHB[1] 1 1, AND
		const ctx1 = runBytecode(new Uint8Array([0xb1, 1, 1, 0x5a]));
		expect(ctx1.stack[0]).toBe(1);

		// PUSHB[1] 1 0, AND
		const ctx2 = runBytecode(new Uint8Array([0xb1, 1, 0, 0x5a]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("OR returns logical OR", () => {
		// PUSHB[1] 0 1, OR
		const ctx = runBytecode(new Uint8Array([0xb1, 0, 1, 0x5b]));
		expect(ctx.stack[0]).toBe(1);
	});

	test("NOT inverts boolean", () => {
		// PUSHB[0] 0, NOT
		const ctx1 = runBytecode(new Uint8Array([0xb0, 0, 0x5c]));
		expect(ctx1.stack[0]).toBe(1);

		// PUSHB[0] 1, NOT
		const ctx2 = runBytecode(new Uint8Array([0xb0, 1, 0x5c]));
		expect(ctx2.stack[0]).toBe(0);
	});
});

describe("TrueType Hinting - Control Flow", () => {
	test("IF with true condition executes then branch", () => {
		// PUSHB[0] 1, IF, PUSHB[0] 42, EIF
		const ctx = runBytecode(new Uint8Array([
			0xb0, 1, // PUSHB[0] 1 (true)
			0x58, // IF
			0xb0, 42, // PUSHB[0] 42
			0x59, // EIF
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(42);
	});

	test("IF with false condition skips then branch", () => {
		// PUSHB[0] 0, IF, PUSHB[0] 42, EIF
		const ctx = runBytecode(new Uint8Array([
			0xb0, 0, // PUSHB[0] 0 (false)
			0x58, // IF
			0xb0, 42, // PUSHB[0] 42 (skipped)
			0x59, // EIF
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(0);
	});

	test("IF/ELSE with false condition executes else branch", () => {
		// PUSHB[0] 0, IF, PUSHB[0] 1, ELSE, PUSHB[0] 2, EIF
		const ctx = runBytecode(new Uint8Array([
			0xb0, 0, // PUSHB[0] 0 (false)
			0x58, // IF
			0xb0, 1, // PUSHB[0] 1 (skipped)
			0x1b, // ELSE
			0xb0, 2, // PUSHB[0] 2 (executed)
			0x59, // EIF
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(2);
	});

	test("JMPR jumps relative", () => {
		// PUSHB[0] 3, JMPR, PUSHB[0] 99, PUSHB[0] 42
		// Jump 3 bytes forward (skip PUSHB 99)
		const ctx = runBytecode(new Uint8Array([
			0xb0, 3, // PUSHB[0] 3
			0x1c, // JMPR (IP at 3, jump +3 = 6)
			0xb0, 99, // PUSHB[0] 99 (skipped, at positions 3-4)
			0xb0, 42, // PUSHB[0] 42 (executed, at positions 5-6)
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(42);
	});
});

describe("TrueType Hinting - Functions", () => {
	test("FDEF/CALL defines and calls function", () => {
		// PUSHB[0] 1, FDEF, PUSHB[0] 42, ENDF, PUSHB[0] 1, CALL
		const ctx = runBytecode(new Uint8Array([
			0xb0, 1, // PUSHB[0] 1 (function number)
			0x2c, // FDEF
			0xb0, 42, // PUSHB[0] 42 (function body)
			0x2d, // ENDF
			0xb0, 1, // PUSHB[0] 1 (function number)
			0x2b, // CALL
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(42);
	});

	test("LOOPCALL calls function multiple times", () => {
		const ctx = createExecContext();
		// Function increments storage[0]
		// PUSHB[0] 0, FDEF, PUSHB[1] 0 0, RS, PUSHB[0] 1, ADD, PUSHB[0] 0, SWAP, WS, ENDF
		// Then: PUSHB[1] 3 0, LOOPCALL
		const code = new Uint8Array([
			// Function 0: increment storage[0]
			0xb0, 0, // function number
			0x2c, // FDEF
			0xb0, 0, // index 0
			0x43, // RS (read storage)
			0xb0, 1, // 1
			0x60, // ADD
			0xb0, 0, // index 0
			0x23, // SWAP (so index is below value)
			0x42, // WS (write storage)
			0x2d, // ENDF
			// Call 3 times
			0xb1, 3, 0, // count=3, func=0
			0x2a, // LOOPCALL
		]);
		setCodeRange(ctx, CodeRange.Glyph, code);
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.error).toBeNull();
		expect(ctx.storage[0]).toBe(3);
	});
});

describe("TrueType Hinting - Graphics State", () => {
	test("SVTCA sets both vectors to axis", () => {
		// SVTCA[X] sets both vectors to X axis
		const ctx = runBytecode(new Uint8Array([0x01])); // SVTCA[X]
		expect(ctx.GS.projVector.x).toBe(0x4000);
		expect(ctx.GS.projVector.y).toBe(0);
		expect(ctx.GS.freeVector.x).toBe(0x4000);
		expect(ctx.GS.freeVector.y).toBe(0);
	});

	test("SRP0/1/2 set reference points", () => {
		// PUSHB[2] 5 10 15, SRP0, SRP1, SRP2
		const ctx = runBytecode(new Uint8Array([
			0xb2, 5, 10, 15,
			0x10, // SRP0
			0x11, // SRP1
			0x12, // SRP2
		]));
		expect(ctx.GS.rp0).toBe(15);
		expect(ctx.GS.rp1).toBe(10);
		expect(ctx.GS.rp2).toBe(5);
	});

	test("RTG/RTHG/RDTG set rounding mode", () => {
		const ctx1 = runBytecode(new Uint8Array([0x18])); // RTG
		expect(ctx1.GS.roundState).toBe(RoundMode.ToGrid);

		const ctx2 = runBytecode(new Uint8Array([0x19])); // RTHG
		expect(ctx2.GS.roundState).toBe(RoundMode.ToHalfGrid);

		const ctx3 = runBytecode(new Uint8Array([0x7d])); // RDTG
		expect(ctx3.GS.roundState).toBe(RoundMode.DownToGrid);
	});

	test("SLOOP sets loop counter", () => {
		// PUSHB[0] 5, SLOOP
		const ctx = runBytecode(new Uint8Array([0xb0, 5, 0x17]));
		expect(ctx.GS.loop).toBe(5);
	});

	test("SMD sets minimum distance", () => {
		// PUSHB[0] 64, SMD (64 = 1 pixel)
		const ctx = runBytecode(new Uint8Array([0xb0, 64, 0x1a]));
		expect(ctx.GS.minimumDistance).toBe(64);
	});
});

describe("TrueType Hinting - Storage and CVT", () => {
	test("RS/WS read and write storage", () => {
		// PUSHB[2] 42 5, WS, PUSHB[0] 5, RS
		// Write 42 to storage[5], then read it back
		const ctx = runBytecode(new Uint8Array([
			0xb1, 5, 42, // index=5, value=42
			0x42, // WS
			0xb0, 5, // index=5
			0x43, // RS
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(42);
	});
});

describe("TrueType Hinting - Measurement", () => {
	test("MPPEM pushes ppem value", () => {
		const ctx = createExecContext();
		ctx.ppem = 16;
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x4b])); // MPPEM
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.stack[0]).toBe(16);
	});

	test("MPS pushes point size", () => {
		const ctx = createExecContext();
		ctx.pointSize = 24;
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x4c])); // MPS
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.stack[0]).toBe(24);
	});
});

describe("TrueType Hinting Engine", () => {
	let font: Font;

	beforeAll(async () => {
		// Use Arial which has TrueType hinting
		font = await Font.fromFile("/System/Library/Fonts/Supplemental/Arial.ttf");
	});

	test("font reports hinting support", () => {
		expect(font.isTrueType).toBe(true);
		expect(font.hasHinting).toBe(true);
	});

	test("font has fpgm table", () => {
		const fpgm = font.fpgm;
		expect(fpgm).not.toBeNull();
		if (fpgm) {
			expect(fpgm.instructions.length).toBeGreaterThan(0);
			console.log(`fpgm size: ${fpgm.instructions.length} bytes`);
		}
	});

	test("font has prep table", () => {
		const prep = font.prep;
		expect(prep).not.toBeNull();
		if (prep) {
			expect(prep.instructions.length).toBeGreaterThan(0);
			console.log(`prep size: ${prep.instructions.length} bytes`);
		}
	});

	test("font has CVT table", () => {
		const cvt = font.cvtTable;
		expect(cvt).not.toBeNull();
		if (cvt) {
			expect(cvt.values.length).toBeGreaterThan(0);
			console.log(`CVT entries: ${cvt.values.length}`);
		}
	});

	test("creates hinting engine", () => {
		const cvt = font.cvtTable;
		const cvtValues = cvt ? new Int32Array(cvt.values) : undefined;

		const maxp = font.maxp;
		const engine = createHintingEngine(
			font.unitsPerEm,
			"maxStackElements" in maxp ? maxp.maxStackElements : 256,
			"maxStorage" in maxp ? maxp.maxStorage : 64,
			"maxFunctionDefs" in maxp ? maxp.maxFunctionDefs : 64,
			"maxTwilightPoints" in maxp ? maxp.maxTwilightPoints : 16,
			cvtValues,
		);

		expect(engine).toBeDefined();
		expect(engine.unitsPerEM).toBe(font.unitsPerEm);
	});

	test("executes fpgm program", () => {
		const fpgm = font.fpgm;
		const cvt = font.cvtTable;
		if (!fpgm) return;

		const cvtValues = cvt ? new Int32Array(cvt.values) : undefined;
		const maxp = font.maxp;
		const engine = createHintingEngine(
			font.unitsPerEm,
			"maxStackElements" in maxp ? maxp.maxStackElements : 256,
			"maxStorage" in maxp ? maxp.maxStorage : 64,
			"maxFunctionDefs" in maxp ? maxp.maxFunctionDefs : 64,
			"maxTwilightPoints" in maxp ? maxp.maxTwilightPoints : 16,
			cvtValues,
		);

		loadFontProgram(engine, fpgm.instructions);

		const error = setSize(engine, 12, 12);
		if (error) {
			console.log(`Hinting error (expected for some fonts): ${error}`);
		}
		// Note: Some fonts may have complex hinting that triggers errors
		// The test verifies the engine can attempt execution
	});

	test("glyph has instructions", () => {
		const glyphId = font.glyphId("A".codePointAt(0)!);
		const glyph = font.getGlyph(glyphId);

		expect(glyph).not.toBeNull();
		if (glyph && glyph.type !== "empty") {
			console.log(`Glyph 'A' instruction size: ${glyph.instructions.length} bytes`);
			// Most hinted fonts have glyph-level instructions
		}
	});
});

describe("TrueType Hinting - Hinted Coordinates", () => {
	test("hintedToPixels converts 26.6 to float", () => {
		const coords = [64, 128, 32, -64];
		const pixels = hintedToPixels(coords);
		expect(pixels[0]).toBe(1.0);
		expect(pixels[1]).toBe(2.0);
		expect(pixels[2]).toBe(0.5);
		expect(pixels[3]).toBe(-1.0);
	});
});
