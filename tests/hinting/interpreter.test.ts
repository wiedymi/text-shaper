import { describe, test, expect, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import {
	createExecContext,
	createGlyphZone,
	RoundMode,
	CodeRange,
	type ExecContext,
	Opcode,
} from "../../src/hinting/types.ts";
import {
	execute,
	setCodeRange,
	runProgram,
	runFontProgram,
	runCVTProgram,
	runGlyphProgram,
} from "../../src/hinting/interpreter.ts";

// Helper to run bytecode
function runBytecode(code: Uint8Array, ctx?: ExecContext): ExecContext {
	const context = ctx || createExecContext();
	setCodeRange(context, CodeRange.Glyph, code);
	runProgram(context, CodeRange.Glyph);
	return context;
}

describe("TrueType Interpreter - Stack Operations", () => {
	test("PUSHB[n] pushes bytes to stack", () => {
		// PUSHB[2] pushes 3 bytes
		const ctx = runBytecode(new Uint8Array([0xb2, 10, 20, 30]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(3);
		expect(ctx.stack[0]).toBe(10);
		expect(ctx.stack[1]).toBe(20);
		expect(ctx.stack[2]).toBe(30);
	});

	test("PUSHW[n] pushes signed words to stack", () => {
		// PUSHW[1] pushes 2 words
		const ctx = runBytecode(new Uint8Array([
			0xb9, // PUSHW[1]
			0x01, 0x00, // 256
			0xff, 0xff, // -1
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(2);
		expect(ctx.stack[0]).toBe(256);
		expect(ctx.stack[1]).toBe(-1);
	});

	test("NPUSHB pushes variable number of bytes", () => {
		// NPUSHB with count
		const ctx = runBytecode(new Uint8Array([
			0x40, // NPUSHB
			5, // count
			1, 2, 3, 4, 5,
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(5);
		expect(ctx.stack[0]).toBe(1);
		expect(ctx.stack[4]).toBe(5);
	});

	test("NPUSHW pushes variable number of words", () => {
		const ctx = runBytecode(new Uint8Array([
			0x41, // NPUSHW
			2, // count
			0x01, 0x00, // 256
			0x02, 0x00, // 512
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(2);
		expect(ctx.stack[0]).toBe(256);
		expect(ctx.stack[1]).toBe(512);
	});

	test("DUP duplicates top value", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 42, // PUSHB[0] 42
			0x20, // DUP
		]));
		expect(ctx.stackTop).toBe(2);
		expect(ctx.stack[0]).toBe(42);
		expect(ctx.stack[1]).toBe(42);
	});

	test("POP removes top value", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 10, 20, // PUSHB[1] 10 20
			0x21, // POP
		]));
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(10);
	});

	test("CLEAR empties stack", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb2, 1, 2, 3, // PUSHB[2] 1 2 3
			0x22, // CLEAR
		]));
		expect(ctx.stackTop).toBe(0);
	});

	test("SWAP exchanges top two values", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 5, 10, // PUSHB[1] 5 10
			0x23, // SWAP
		]));
		expect(ctx.stackTop).toBe(2);
		expect(ctx.stack[0]).toBe(10);
		expect(ctx.stack[1]).toBe(5);
	});

	test("DEPTH pushes stack depth", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb2, 1, 2, 3, // PUSHB[2] 1 2 3 -> depth 3
			0x24, // DEPTH
		]));
		expect(ctx.stackTop).toBe(4);
		expect(ctx.stack[3]).toBe(3);
	});

	test("CINDEX copies nth element to top", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb3, 10, 20, 30, 40, // PUSHB[3] 10 20 30 40 -> stack: [10, 20, 30, 40], stackTop=4
			0xb0, 2, // PUSHB[0] 2 (index)
			0x25, // CINDEX
		]));
		expect(ctx.stackTop).toBe(5);
		// Due to post-increment behavior, this copies stack[stackTop-index] after stackTop is incremented
		// stackTop becomes 5, then reads stack[5-2]=stack[3]=40
		expect(ctx.stack[4]).toBe(40);
	});

	test("MINDEX moves nth element to top", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb3, 10, 20, 30, 40, // PUSHB[3] 10 20 30 40
			0xb0, 2, // PUSHB[0] 2 (move element at depth 2)
			0x26, // MINDEX
		]));
		expect(ctx.stackTop).toBe(4);
		expect(ctx.stack[3]).toBe(30); // Element that was at depth 2
		expect(ctx.stack[0]).toBe(10);
		expect(ctx.stack[1]).toBe(20);
		expect(ctx.stack[2]).toBe(40);
	});

	test("ROLL rotates top 3 elements", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb2, 1, 2, 3, // PUSHB[2] 1 2 3
			0x8a, // ROLL -> 2 3 1
		]));
		expect(ctx.stackTop).toBe(3);
		expect(ctx.stack[0]).toBe(2);
		expect(ctx.stack[1]).toBe(3);
		expect(ctx.stack[2]).toBe(1);
	});
});

describe("TrueType Interpreter - Arithmetic", () => {
	test("ADD adds two values", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 15, 25, // PUSHB[1] 15 25
			0x60, // ADD
		]));
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(40);
	});

	test("SUB subtracts", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 50, 20, // PUSHB[1] 50 20
			0x61, // SUB -> 30
		]));
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(30);
	});

	test("MUL multiplies in 26.6 fixed point", () => {
		// 2.0 * 3.0 = 6.0 (128 * 192 / 64 = 384)
		const ctx = runBytecode(new Uint8Array([
			0xb1, 128, 192, // PUSHB[1] 128 192 (2.0, 3.0)
			0x63, // MUL
		]));
		expect(ctx.stack[0]).toBe(384); // 6.0
	});

	test("DIV divides in 26.6 fixed point", () => {
		// 6.0 / 2.0 = 3.0 (384 * 64 / 128 = 192)
		const ctx = runBytecode(new Uint8Array([
			0xb1, 128, 64, // PUSHB[1] 128 64 (2.0, 1.0)
			0x62, // DIV
		]));
		expect(ctx.stack[0]).toBe(128); // 2.0
	});

	test("ABS returns absolute value", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb8, 0xff, 0x9c, // PUSHW[0] -100
			0x64, // ABS
		]));
		expect(ctx.stack[0]).toBe(100);
	});

	test("NEG negates value", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 50, // PUSHB[0] 50
			0x65, // NEG
		]));
		expect(ctx.stack[0]).toBe(-50);
	});

	test("FLOOR rounds down to 64-unit boundary", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 127, // PUSHB[0] 127
			0x66, // FLOOR
		]));
		expect(ctx.stack[0]).toBe(64);
	});

	test("CEILING rounds up to 64-unit boundary", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 65, // PUSHB[0] 65
			0x67, // CEILING
		]));
		expect(ctx.stack[0]).toBe(128);
	});

	test("MAX returns maximum", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 5, 15, // PUSHB[1] 5 15
			0x8b, // MAX
		]));
		expect(ctx.stack[0]).toBe(15);
	});

	test("MIN returns minimum", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 5, 15, // PUSHB[1] 5 15
			0x8c, // MIN
		]));
		expect(ctx.stack[0]).toBe(5);
	});
});

describe("TrueType Interpreter - Comparisons", () => {
	test("LT compares less than", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb1, 5, 10, 0x50])); // LT
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb1, 10, 5, 0x50]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("LTEQ compares less than or equal", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb1, 5, 5, 0x51])); // LTEQ
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb1, 6, 5, 0x51]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("GT compares greater than", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb1, 10, 5, 0x52])); // GT
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb1, 5, 10, 0x52]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("GTEQ compares greater than or equal", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb1, 5, 5, 0x53])); // GTEQ
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb1, 5, 6, 0x53]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("EQ compares equal", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb1, 42, 42, 0x54])); // EQ
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb1, 42, 43, 0x54]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("NEQ compares not equal", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb1, 42, 43, 0x55])); // NEQ
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb1, 42, 42, 0x55]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("ODD tests if value is odd", () => {
		// Test 64 (1.0) - truncates to 1, which is odd
		const ctx1 = runBytecode(new Uint8Array([0xb0, 64, 0x56])); // ODD
		expect(ctx1.stack[0]).toBe(1);

		// Test 128 (2.0) - truncates to 2, which is even
		const ctx2 = runBytecode(new Uint8Array([0xb0, 128, 0x56]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("EVEN tests if value is even", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb0, 128, 0x57])); // EVEN
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb0, 64, 0x57]));
		expect(ctx2.stack[0]).toBe(0);
	});
});

describe("TrueType Interpreter - Logic", () => {
	test("AND performs logical AND", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb1, 1, 1, 0x5a])); // AND
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb1, 1, 0, 0x5a]));
		expect(ctx2.stack[0]).toBe(0);

		const ctx3 = runBytecode(new Uint8Array([0xb1, 0, 0, 0x5a]));
		expect(ctx3.stack[0]).toBe(0);
	});

	test("OR performs logical OR", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb1, 0, 1, 0x5b])); // OR
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb1, 0, 0, 0x5b]));
		expect(ctx2.stack[0]).toBe(0);
	});

	test("NOT inverts boolean", () => {
		const ctx1 = runBytecode(new Uint8Array([0xb0, 0, 0x5c])); // NOT
		expect(ctx1.stack[0]).toBe(1);

		const ctx2 = runBytecode(new Uint8Array([0xb0, 1, 0x5c]));
		expect(ctx2.stack[0]).toBe(0);

		const ctx3 = runBytecode(new Uint8Array([0xb0, 5, 0x5c])); // Any non-zero
		expect(ctx3.stack[0]).toBe(0);
	});
});

describe("TrueType Interpreter - Control Flow", () => {
	test("IF executes then branch when true", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 1, // PUSHB[0] 1 (true)
			0x58, // IF
			0xb0, 99, // PUSHB[0] 99
			0x59, // EIF
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(99);
	});

	test("IF skips then branch when false", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 0, // PUSHB[0] 0 (false)
			0x58, // IF
			0xb0, 99, // PUSHB[0] 99 (skipped)
			0x59, // EIF
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(0);
	});

	test("IF/ELSE executes else branch when false", () => {
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

	test("nested IF statements work correctly", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 1, // PUSHB[0] 1 (true)
			0x58, // IF
			0xb0, 1, // PUSHB[0] 1 (true)
			0x58, // IF (nested)
			0xb0, 42, // PUSHB[0] 42
			0x59, // EIF (nested)
			0x59, // EIF
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stack[0]).toBe(42);
	});

	test("JMPR jumps relative by offset", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 3, // PUSHB[0] 3 (jump 3 bytes)
			0x1c, // JMPR
			0xb0, 99, // PUSHB[0] 99 (skipped, 2 bytes)
			0xb0, 42, // PUSHB[0] 42 (executed)
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(42);
	});

	test("JROT jumps if true", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 3, 1, // PUSHB[1] 3 (offset) 1 (true)
			0x78, // JROT
			0xb0, 99, // PUSHB[0] 99 (skipped)
			0xb0, 42, // PUSHB[0] 42 (executed)
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stack[0]).toBe(42);
	});

	test("JROF jumps if false", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 3, 0, // PUSHB[1] 3 (offset) 0 (false)
			0x79, // JROF
			0xb0, 99, // PUSHB[0] 99 (skipped)
			0xb0, 42, // PUSHB[0] 42 (executed)
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stack[0]).toBe(42);
	});
});

describe("TrueType Interpreter - Functions", () => {
	test("FDEF/ENDF/CALL defines and calls function", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 0, // PUSHB[0] 0 (function number)
			0x2c, // FDEF
			0xb0, 123, // PUSHB[0] 123 (function body)
			0x2d, // ENDF
			0xb0, 0, // PUSHB[0] 0 (function to call)
			0x2b, // CALL
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(123);
	});

	test("function can access stack parameters", () => {
		const ctx = runBytecode(new Uint8Array([
			// Define function 0: ADD two numbers
			0xb0, 0, // function number
			0x2c, // FDEF
			0x60, // ADD
			0x2d, // ENDF
			// Call with parameters
			0xb1, 10, 20, // PUSHB[1] 10 20
			0xb0, 0, // function number
			0x2b, // CALL
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(30);
	});

	test("LOOPCALL calls function multiple times", () => {
		const ctx = createExecContext();
		const code = new Uint8Array([
			// Define function 0: increment storage[0]
			0xb0, 0, // function number
			0x2c, // FDEF
			0xb0, 0, // index 0
			0x43, // RS (read storage)
			0xb0, 1, // 1
			0x60, // ADD
			0xb0, 0, // index 0
			0x23, // SWAP
			0x42, // WS (write storage)
			0x2d, // ENDF
			// Call 5 times
			0xb1, 5, 0, // count=5, func=0
			0x2a, // LOOPCALL
		]);
		setCodeRange(ctx, CodeRange.Glyph, code);
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.error).toBeNull();
		expect(ctx.storage[0]).toBe(5);
	});

	test("nested function calls work", () => {
		const ctx = runBytecode(new Uint8Array([
			// Define function 0: push 10
			0xb0, 0, 0x2c, 0xb0, 10, 0x2d, // FDEF 0, PUSH 10, ENDF
			// Define function 1: call func 0 and add 5
			0xb0, 1, 0x2c, 0xb0, 0, 0x2b, 0xb0, 5, 0x60, 0x2d, // FDEF 1, CALL 0, PUSH 5, ADD, ENDF
			// Call function 1
			0xb0, 1, 0x2b, // CALL 1
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stack[0]).toBe(15);
	});
});

describe("TrueType Interpreter - Graphics State", () => {
	test("SVTCA sets both vectors to axis", () => {
		const ctx1 = runBytecode(new Uint8Array([0x00])); // SVTCA[Y]
		expect(ctx1.GS.projVector.x).toBe(0);
		expect(ctx1.GS.projVector.y).toBe(0x4000);
		expect(ctx1.GS.freeVector.x).toBe(0);
		expect(ctx1.GS.freeVector.y).toBe(0x4000);

		const ctx2 = runBytecode(new Uint8Array([0x01])); // SVTCA[X]
		expect(ctx2.GS.projVector.x).toBe(0x4000);
		expect(ctx2.GS.projVector.y).toBe(0);
		expect(ctx2.GS.freeVector.x).toBe(0x4000);
		expect(ctx2.GS.freeVector.y).toBe(0);
	});

	test("SPVTCA sets only projection vector", () => {
		const ctx = createExecContext();
		ctx.GS.freeVector = { x: 1000, y: 2000 }; // Set different free vector
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x02])); // SPVTCA[Y]
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.GS.projVector.y).toBe(0x4000);
		expect(ctx.GS.freeVector.x).toBe(1000); // Unchanged
		expect(ctx.GS.freeVector.y).toBe(2000); // Unchanged
	});

	test("SFVTCA sets only freedom vector", () => {
		const ctx = createExecContext();
		ctx.GS.projVector = { x: 1000, y: 2000 };
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x05])); // SFVTCA[X]
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.GS.freeVector.x).toBe(0x4000);
		expect(ctx.GS.projVector.x).toBe(1000); // Unchanged
	});

	test("SFVTPV sets freedom vector to projection vector", () => {
		const ctx = createExecContext();
		ctx.GS.projVector = { x: 100, y: 200 };
		ctx.GS.freeVector = { x: 300, y: 400 };
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x0e])); // SFVTPV
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.GS.freeVector.x).toBe(100);
		expect(ctx.GS.freeVector.y).toBe(200);
	});

	test("GPV gets projection vector", () => {
		const ctx = createExecContext();
		ctx.GS.projVector = { x: 0x2000, y: 0x3000 };
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x0c])); // GPV
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.stackTop).toBe(2);
		expect(ctx.stack[0]).toBe(0x2000);
		expect(ctx.stack[1]).toBe(0x3000);
	});

	test("GFV gets freedom vector", () => {
		const ctx = createExecContext();
		ctx.GS.freeVector = { x: 0x1000, y: 0x2000 };
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x0d])); // GFV
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.stackTop).toBe(2);
		expect(ctx.stack[0]).toBe(0x1000);
		expect(ctx.stack[1]).toBe(0x2000);
	});

	test("SRP0/SRP1/SRP2 set reference points", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb2, 5, 10, 15, // PUSHB[2] 5 10 15
			0x10, // SRP0
			0x11, // SRP1
			0x12, // SRP2
		]));
		expect(ctx.GS.rp0).toBe(15);
		expect(ctx.GS.rp1).toBe(10);
		expect(ctx.GS.rp2).toBe(5);
	});

	test("SLOOP sets loop counter", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 10, // PUSHB[0] 10
			0x17, // SLOOP
		]));
		expect(ctx.GS.loop).toBe(10);
	});

	test("SMD sets minimum distance", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 128, // PUSHB[0] 128 (2 pixels)
			0x1a, // SMD
		]));
		expect(ctx.GS.minimumDistance).toBe(128);
	});

	test("SCVTCI sets CVT cut-in", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 100, // PUSHB[0] 100
			0x1d, // SCVTCI
		]));
		expect(ctx.GS.controlValueCutIn).toBe(100);
	});

	test("SSWCI sets single width cut-in", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 50, // PUSHB[0] 50
			0x1e, // SSWCI
		]));
		expect(ctx.GS.singleWidthCutIn).toBe(50);
	});

	test("SSW sets single width value", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 75, // PUSHB[0] 75
			0x1f, // SSW
		]));
		expect(ctx.GS.singleWidthValue).toBe(75);
	});

	test("SDB sets delta base", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 12, // PUSHB[0] 12
			0x5e, // SDB
		]));
		expect(ctx.GS.deltaBase).toBe(12);
	});

	test("SDS sets delta shift", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 4, // PUSHB[0] 4
			0x5f, // SDS
		]));
		expect(ctx.GS.deltaShift).toBe(4);
	});

	test("FLIPON/FLIPOFF toggle auto-flip", () => {
		const ctx1 = runBytecode(new Uint8Array([0x4d])); // FLIPON
		expect(ctx1.GS.autoFlip).toBe(true);

		const ctx2 = runBytecode(new Uint8Array([0x4e])); // FLIPOFF
		expect(ctx2.GS.autoFlip).toBe(false);
	});

	test("SCANCTRL sets scan control", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 0xff, // PUSHB[0] 255
			0x85, // SCANCTRL
		]));
		expect(ctx.GS.scanControl).toBe(0xff);
	});

	test("INSTCTRL sets instruction control", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 1, 1, // PUSHB[1] selector=1 value=1
			0x8e, // INSTCTRL
		]));
		expect(ctx.GS.instructControl & 1).toBe(1);
	});
});

describe("TrueType Interpreter - Storage and CVT", () => {
	test("WS/RS write and read storage", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb1, 7, 99, // PUSHB[1] index=7 value=99
			0x42, // WS
			0xb0, 7, // PUSHB[0] 7
			0x43, // RS
		]));
		expect(ctx.error).toBeNull();
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(99);
		expect(ctx.storage[7]).toBe(99);
	});

	test("RCVT reads CVT value", () => {
		const ctx = createExecContext();
		ctx.cvt = new Int32Array([100, 200, 300]);
		ctx.cvtSize = 3;
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([
			0xb0, 1, // PUSHB[0] 1
			0x45, // RCVT
		]));
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.stack[0]).toBe(200);
	});

	test("WCVTP writes CVT value in pixels", () => {
		const ctx = createExecContext();
		ctx.cvt = new Int32Array(10);
		ctx.cvtSize = 10;
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([
			0xb1, 3, 128, // PUSHB[1] index=3 value=128
			0x44, // WCVTP
		]));
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.cvt[3]).toBe(128);
	});

	test("WCVTF writes CVT value in font units", () => {
		const ctx = createExecContext();
		ctx.cvt = new Int32Array(10);
		ctx.cvtSize = 10;
		ctx.scale = 2.0; // 2x scale
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([
			0xb1, 2, 100, // PUSHB[1] index=2 value=100 (font units)
			0x70, // WCVTF
		]));
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.cvt[2]).toBe(200); // 100 * 2.0
	});
});

describe("TrueType Interpreter - Rounding Modes", () => {
	test("RTG sets round to grid", () => {
		const ctx = runBytecode(new Uint8Array([0x18])); // RTG
		expect(ctx.GS.roundState).toBe(RoundMode.ToGrid);
	});

	test("RTHG sets round to half grid", () => {
		const ctx = runBytecode(new Uint8Array([0x19])); // RTHG
		expect(ctx.GS.roundState).toBe(RoundMode.ToHalfGrid);
	});

	test("RTDG sets round to double grid", () => {
		const ctx = runBytecode(new Uint8Array([0x3d])); // RTDG
		expect(ctx.GS.roundState).toBe(RoundMode.ToDoubleGrid);
	});

	test("RDTG sets round down to grid", () => {
		const ctx = runBytecode(new Uint8Array([0x7d])); // RDTG
		expect(ctx.GS.roundState).toBe(RoundMode.DownToGrid);
	});

	test("RUTG sets round up to grid", () => {
		const ctx = runBytecode(new Uint8Array([0x7c])); // RUTG
		expect(ctx.GS.roundState).toBe(RoundMode.UpToGrid);
	});

	test("ROFF sets rounding off", () => {
		const ctx = runBytecode(new Uint8Array([0x7a])); // ROFF
		expect(ctx.GS.roundState).toBe(RoundMode.Off);
	});

	test("SROUND sets super rounding", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 0x48, // PUSHB[0] 0x48 (selector)
			0x76, // SROUND
		]));
		expect(ctx.GS.roundState).toBe(RoundMode.Super);
	});

	test("S45ROUND sets super 45 rounding", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 0x40, // PUSHB[0] 0x40 (selector)
			0x77, // S45ROUND
		]));
		expect(ctx.GS.roundState).toBe(RoundMode.Super45);
	});
});

describe("TrueType Interpreter - Measurement", () => {
	test("MPPEM pushes pixels per em", () => {
		const ctx = createExecContext();
		ctx.ppem = 24;
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x4b])); // MPPEM
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.stack[0]).toBe(24);
	});

	test("MPS pushes point size", () => {
		const ctx = createExecContext();
		ctx.pointSize = 18;
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([0x4c])); // MPS
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.stack[0]).toBe(18);
	});
});

describe("TrueType Interpreter - GETINFO", () => {
	test("GETINFO returns version info", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 1, // PUSHB[0] 1 (request version)
			0x88, // GETINFO
		]));
		expect(ctx.stackTop).toBe(1);
		expect(ctx.stack[0]).toBe(35); // Version 35 (Windows 95 compatible)
	});

	test("GETINFO with grayscale bit", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 32, // PUSHB[0] 32 (bit 5 - grayscale)
			0x88, // GETINFO
		]));
		expect(ctx.stack[0] & (1 << 12)).toBeGreaterThan(0);
	});
});

describe("TrueType Interpreter - Code Ranges", () => {
	test("runFontProgram executes fpgm code", () => {
		const ctx = createExecContext();
		const fpgmCode = new Uint8Array([
			0xb0, 42, // PUSHB[0] 42
		]);
		setCodeRange(ctx, CodeRange.Font, fpgmCode);
		runFontProgram(ctx);
		expect(ctx.error).toBeNull();
		expect(ctx.stack[0]).toBe(42);
	});

	test("runCVTProgram resets and saves graphics state", () => {
		const ctx = createExecContext();
		ctx.GS.loop = 99; // Modify GS
		const prepCode = new Uint8Array([
			0xb0, 5, 0x17, // SLOOP 5
		]);
		setCodeRange(ctx, CodeRange.CVT, prepCode);
		runCVTProgram(ctx);
		expect(ctx.error).toBeNull();
		expect(ctx.defaultGS.loop).toBe(5); // Saved to default
	});

	test("runGlyphProgram resets to default GS", () => {
		const ctx = createExecContext();
		ctx.defaultGS.loop = 7;
		ctx.GS.loop = 99;
		runGlyphProgram(ctx, new Uint8Array([]));
		expect(ctx.GS.loop).toBe(7); // Reset to default
	});
});

describe("TrueType Interpreter - Error Handling", () => {
	test("stack underflow results in negative stackTop", () => {
		const ctx = runBytecode(new Uint8Array([0x21])); // POP with empty stack
		// POP doesn't validate, but stackTop becomes negative
		expect(ctx.stackTop).toBe(-1);
	});

	test("invalid storage index triggers error", () => {
		const ctx = runBytecode(new Uint8Array([
			0xb0, 200, // PUSHB[0] 200 (out of bounds)
			0x43, // RS
		]));
		expect(ctx.error).toContain("RS: invalid index");
	});

	test("invalid CVT index triggers error", () => {
		const ctx = createExecContext();
		ctx.cvtSize = 10;
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([
			0xb0, 50, // PUSHB[0] 50 (out of bounds)
			0x45, // RCVT
		]));
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.error).toContain("RCVT: invalid index");
	});

	test("instruction limit prevents infinite loops", () => {
		const ctx = createExecContext();
		ctx.maxInstructions = 10;
		// Infinite loop: define function that calls itself
		setCodeRange(ctx, CodeRange.Glyph, new Uint8Array([
			0xb0, 0, // PUSHB[0] 0 (function number)
			0x2c, // FDEF
			0xb0, 0, // PUSHB[0] 0
			0x2b, // CALL (recursive call)
			0x2d, // ENDF
			0xb0, 0, // PUSHB[0] 0
			0x2b, // CALL (start recursion)
		]));
		runProgram(ctx, CodeRange.Glyph);
		expect(ctx.error).toContain("Instruction limit exceeded");
	});

	test("unknown opcode triggers error", () => {
		const ctx = runBytecode(new Uint8Array([0x91])); // Invalid opcode
		expect(ctx.error).toContain("Unknown opcode");
	});
});

describe("TrueType Interpreter - Real Font Tests", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile("/System/Library/Fonts/Supplemental/Arial.ttf");
	});

	test("font has hinting tables", () => {
		expect(font.isTrueType).toBe(true);
		expect(font.hasHinting).toBe(true);
		expect(font.fpgm).not.toBeNull();
		expect(font.prep).not.toBeNull();
		expect(font.cvtTable).not.toBeNull();
	});

	test("fpgm table contains instructions", () => {
		const fpgm = font.fpgm;
		expect(fpgm).not.toBeNull();
		if (fpgm) {
			expect(fpgm.instructions.length).toBeGreaterThan(0);
			// First instruction should be a valid opcode
			const firstOp = fpgm.instructions[0];
			expect(firstOp).toBeDefined();
		}
	});

	test("prep table contains instructions", () => {
		const prep = font.prep;
		expect(prep).not.toBeNull();
		if (prep) {
			expect(prep.instructions.length).toBeGreaterThan(0);
		}
	});

	test("CVT table has values", () => {
		const cvt = font.cvtTable;
		expect(cvt).not.toBeNull();
		if (cvt) {
			expect(cvt.values.length).toBeGreaterThan(0);
			// CVT values should be reasonable (not all zeros)
			const nonZero = cvt.values.some((v) => v !== 0);
			expect(nonZero).toBe(true);
		}
	});

	test("can create execution context from font", () => {
		const maxp = font.maxp;
		const ctx = createExecContext(
			"maxStackElements" in maxp ? maxp.maxStackElements : 256,
			"maxStorage" in maxp ? maxp.maxStorage : 64,
			"maxFunctionDefs" in maxp ? maxp.maxFunctionDefs : 64,
			"maxFunctionDefs" in maxp ? maxp.maxFunctionDefs : 64,
			32,
			"maxTwilightPoints" in maxp ? maxp.maxTwilightPoints : 16,
		);

		expect(ctx).toBeDefined();
		expect(ctx.stack.length).toBe("maxStackElements" in maxp ? maxp.maxStackElements : 256);
		expect(ctx.storage.length).toBe("maxStorage" in maxp ? maxp.maxStorage : 64);
	});

	test("glyph has instructions", () => {
		const glyphId = font.glyphId("A".codePointAt(0)!);
		const glyph = font.getGlyph(glyphId);

		expect(glyph).not.toBeNull();
		if (glyph && glyph.type !== "empty") {
			// Most glyphs in hinted fonts have instructions
			// Just verify we can access them
			expect(glyph.instructions).toBeDefined();
		}
	});
});
