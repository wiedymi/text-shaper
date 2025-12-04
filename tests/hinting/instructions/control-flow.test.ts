import { describe, test, expect } from "bun:test";
import {
	createExecContext,
	createGlyphZone,
	CodeRange,
	type ExecContext,
} from "../../../src/hinting/types.ts";
import {
	IF,
	ELSE,
	EIF,
	JMPR,
	JROT,
	JROF,
	FDEF,
	ENDF,
	CALL,
	LOOPCALL,
	IDEF,
} from "../../../src/hinting/instructions/control-flow.ts";

describe("Control Flow Instructions", () => {
	function createTestContext(): ExecContext {
		const ctx = createExecContext();
		const zone = createGlyphZone(10, 2);
		zone.nPoints = 10;
		zone.nContours = 2;

		ctx.pts = zone;
		ctx.zp0 = zone;
		ctx.zp1 = zone;
		ctx.zp2 = zone;

		return ctx;
	}

	describe("IF/ELSE/EIF", () => {
		test("IF executes true branch", () => {
			const ctx = createTestContext();
			// IF TRUE (0x58) + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0xb0, 0x01, 0x59]);
			ctx.codeSize = 4;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 1; // True condition

			IF(ctx);

			expect(ctx.IP).toBe(1); // Continues from after IF
			expect(ctx.error).toBeNull();
		});

		test("IF skips to EIF when false", () => {
			const ctx = createTestContext();
			// IF (0x58) + PUSHB[0] (0xb0) + data + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0xb0, 0x05, 0x59]);
			ctx.codeSize = 4;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0; // False condition

			IF(ctx);

			expect(ctx.IP).toBe(4); // After EIF
			expect(ctx.error).toBeNull();
		});

		test("IF skips to ELSE when false", () => {
			const ctx = createTestContext();
			// IF (0x58) + PUSHB[0] (0xb0) + data + ELSE (0x1b) + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0xb0, 0x05, 0x1b, 0x59]);
			ctx.codeSize = 5;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0;

			IF(ctx);

			expect(ctx.IP).toBe(4); // At ELSE instruction
		});

		test("IF handles nested IFs (true outer)", () => {
			const ctx = createTestContext();
			// IF (0x58) + IF (0x58) + EIF (0x59) + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0x58, 0x59, 0x59]);
			ctx.codeSize = 4;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 1; // True

			IF(ctx);

			expect(ctx.IP).toBe(1); // Continue
		});

		test("IF handles nested IFs (false outer)", () => {
			const ctx = createTestContext();
			// IF (0x58) + IF (0x58) + EIF (0x59) + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0x58, 0x59, 0x59]);
			ctx.codeSize = 4;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0; // False

			IF(ctx);

			expect(ctx.IP).toBe(4); // After outer EIF
		});

		test("IF handles NPUSHB instruction", () => {
			const ctx = createTestContext();
			// IF (0x58) + NPUSHB (0x40) + count + data + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0x40, 0x02, 0x01, 0x02, 0x59]);
			ctx.codeSize = 6;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0;

			IF(ctx);

			expect(ctx.IP).toBe(6); // After EIF
		});

		test("IF handles NPUSHW instruction", () => {
			const ctx = createTestContext();
			// IF (0x58) + NPUSHW (0x41) + count + data + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0x41, 0x01, 0x00, 0x01, 0x59]);
			ctx.codeSize = 6;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0;

			IF(ctx);

			expect(ctx.IP).toBe(6);
		});

		test("IF handles PUSHB[n] variants", () => {
			const ctx = createTestContext();
			// IF (0x58) + PUSHB[2] (0xb2) + 3 bytes + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0xb2, 0x01, 0x02, 0x03, 0x59]);
			ctx.codeSize = 6;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0;

			IF(ctx);

			expect(ctx.IP).toBe(6);
		});

		test("IF handles PUSHW[n] variants", () => {
			const ctx = createTestContext();
			// IF (0x58) + PUSHW[1] (0xb9) + 4 bytes + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0xb9, 0x00, 0x01, 0x00, 0x02, 0x59]);
			ctx.codeSize = 7;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0;

			IF(ctx);

			expect(ctx.IP).toBe(7);
		});

		test("IF handles nested ELSE", () => {
			const ctx = createTestContext();
			// IF (0x58) + IF (0x58) + ELSE (0x1b) + EIF (0x59) + EIF (0x59)
			ctx.code = new Uint8Array([0x58, 0x58, 0x1b, 0x59, 0x59]);
			ctx.codeSize = 5;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0;

			IF(ctx);

			expect(ctx.IP).toBe(5);
		});

		test("IF errors on missing EIF", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x58]);
			ctx.codeSize = 1;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0;

			IF(ctx);

			expect(ctx.error).toContain("missing EIF");
		});

		test("ELSE skips to EIF", () => {
			const ctx = createTestContext();
			// ELSE (0x1b) + PUSHB[0] (0xb0) + data + EIF (0x59)
			ctx.code = new Uint8Array([0x1b, 0xb0, 0x05, 0x59]);
			ctx.codeSize = 4;
			ctx.IP = 1;

			ELSE(ctx);

			expect(ctx.IP).toBe(4); // After EIF
		});

		test("ELSE handles nested IF", () => {
			const ctx = createTestContext();
			// ELSE (0x1b) + IF (0x58) + EIF (0x59) + EIF (0x59)
			ctx.code = new Uint8Array([0x1b, 0x58, 0x59, 0x59]);
			ctx.codeSize = 4;
			ctx.IP = 1;

			ELSE(ctx);

			expect(ctx.IP).toBe(4);
		});

		test("ELSE handles NPUSHB", () => {
			const ctx = createTestContext();
			// ELSE (0x1b) + NPUSHB (0x40) + count + data + EIF (0x59)
			ctx.code = new Uint8Array([0x1b, 0x40, 0x02, 0x01, 0x02, 0x59]);
			ctx.codeSize = 6;
			ctx.IP = 1;

			ELSE(ctx);

			expect(ctx.IP).toBe(6);
		});

		test("ELSE handles NPUSHW", () => {
			const ctx = createTestContext();
			// ELSE (0x1b) + NPUSHW (0x41) + count + data + EIF (0x59)
			ctx.code = new Uint8Array([0x1b, 0x41, 0x01, 0x00, 0x01, 0x59]);
			ctx.codeSize = 6;
			ctx.IP = 1;

			ELSE(ctx);

			expect(ctx.IP).toBe(6);
		});

		test("ELSE handles PUSHB[n]", () => {
			const ctx = createTestContext();
			// ELSE (0x1b) + PUSHB[1] (0xb1) + 2 bytes + EIF (0x59)
			ctx.code = new Uint8Array([0x1b, 0xb1, 0x01, 0x02, 0x59]);
			ctx.codeSize = 5;
			ctx.IP = 1;

			ELSE(ctx);

			expect(ctx.IP).toBe(5);
		});

		test("ELSE handles PUSHW[n]", () => {
			const ctx = createTestContext();
			// ELSE (0x1b) + PUSHW[0] (0xb8) + 2 bytes + EIF (0x59)
			ctx.code = new Uint8Array([0x1b, 0xb8, 0x00, 0x01, 0x59]);
			ctx.codeSize = 5;
			ctx.IP = 1;

			ELSE(ctx);

			expect(ctx.IP).toBe(5);
		});

		test("ELSE errors on missing EIF", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x1b]);
			ctx.codeSize = 1;
			ctx.IP = 1;

			ELSE(ctx);

			expect(ctx.error).toContain("missing EIF");
		});

		test("EIF does nothing", () => {
			const ctx = createTestContext();
			const originalIP = ctx.IP;

			EIF(ctx);

			expect(ctx.IP).toBe(originalIP);
			expect(ctx.error).toBeNull();
		});
	});

	describe("Jump Instructions", () => {
		test("JMPR jumps forward", () => {
			const ctx = createTestContext();
			ctx.IP = 10;
			ctx.stack[ctx.stackTop++] = 5;

			JMPR(ctx);

			expect(ctx.IP).toBe(14); // 10 + 5 - 1
		});

		test("JMPR jumps backward", () => {
			const ctx = createTestContext();
			ctx.IP = 10;
			ctx.stack[ctx.stackTop++] = -3;

			JMPR(ctx);

			expect(ctx.IP).toBe(6); // 10 + (-3) - 1
		});

		test("JROT jumps when condition is true", () => {
			const ctx = createTestContext();
			ctx.IP = 5;
			ctx.stack[ctx.stackTop++] = 10; // Offset
			ctx.stack[ctx.stackTop++] = 1; // True

			JROT(ctx);

			expect(ctx.IP).toBe(14); // 5 + 10 - 1
		});

		test("JROT does not jump when condition is false", () => {
			const ctx = createTestContext();
			ctx.IP = 5;
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 0; // False

			JROT(ctx);

			expect(ctx.IP).toBe(5);
		});

		test("JROF jumps when condition is false", () => {
			const ctx = createTestContext();
			ctx.IP = 8;
			ctx.stack[ctx.stackTop++] = 4;
			ctx.stack[ctx.stackTop++] = 0; // False

			JROF(ctx);

			expect(ctx.IP).toBe(11); // 8 + 4 - 1
		});

		test("JROF does not jump when condition is true", () => {
			const ctx = createTestContext();
			ctx.IP = 8;
			ctx.stack[ctx.stackTop++] = 4;
			ctx.stack[ctx.stackTop++] = 1; // True

			JROF(ctx);

			expect(ctx.IP).toBe(8);
		});
	});

	describe("Function Definition and Calls", () => {
		test("FDEF defines function", () => {
			const ctx = createTestContext();
			// FDEF (0x2c) + instruction + ENDF (0x2d)
			ctx.code = new Uint8Array([0x2c, 0xb0, 0x01, 0x2d]);
			ctx.codeSize = 4;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.Font;
			ctx.stack[ctx.stackTop++] = 5;

			FDEF(ctx);

			expect(ctx.FDefs[5]!.active).toBe(true);
			expect(ctx.FDefs[5]!.start).toBe(1);
			expect(ctx.FDefs[5]!.end).toBe(4);
			expect(ctx.FDefs[5]!.range).toBe(CodeRange.Font);
			expect(ctx.IP).toBe(4);
		});

		test("FDEF handles nested push instructions", () => {
			const ctx = createTestContext();
			// FDEF (0x2c) + NPUSHB (0x40) + count + data + ENDF (0x2d)
			ctx.code = new Uint8Array([0x2c, 0x40, 0x02, 0x01, 0x02, 0x2d]);
			ctx.codeSize = 6;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.CVT;
			ctx.stack[ctx.stackTop++] = 3;

			FDEF(ctx);

			expect(ctx.FDefs[3]!.active).toBe(true);
			expect(ctx.IP).toBe(6);
		});

		test("FDEF handles NPUSHW", () => {
			const ctx = createTestContext();
			// FDEF (0x2c) + NPUSHW (0x41) + count + data + ENDF (0x2d)
			ctx.code = new Uint8Array([0x2c, 0x41, 0x01, 0x00, 0x01, 0x2d]);
			ctx.codeSize = 6;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.Font;
			ctx.stack[ctx.stackTop++] = 4;

			FDEF(ctx);

			expect(ctx.FDefs[4]!.active).toBe(true);
			expect(ctx.IP).toBe(6);
		});

		test("FDEF handles PUSHB[n]", () => {
			const ctx = createTestContext();
			// FDEF (0x2c) + PUSHB[2] (0xb2) + 3 bytes + ENDF (0x2d)
			ctx.code = new Uint8Array([0x2c, 0xb2, 0x01, 0x02, 0x03, 0x2d]);
			ctx.codeSize = 6;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.Font;
			ctx.stack[ctx.stackTop++] = 5;

			FDEF(ctx);

			expect(ctx.FDefs[5]!.active).toBe(true);
			expect(ctx.IP).toBe(6);
		});

		test("FDEF handles PUSHW[n]", () => {
			const ctx = createTestContext();
			// FDEF (0x2c) + PUSHW[0] (0xb8) + 2 bytes + ENDF (0x2d)
			ctx.code = new Uint8Array([0x2c, 0xb8, 0x00, 0x01, 0x2d]);
			ctx.codeSize = 5;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.Font;
			ctx.stack[ctx.stackTop++] = 6;

			FDEF(ctx);

			expect(ctx.FDefs[6]!.active).toBe(true);
			expect(ctx.IP).toBe(5);
		});

		test("FDEF errors on invalid function number", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x2c, 0x2d]);
			ctx.codeSize = 2;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 999;

			FDEF(ctx);

			expect(ctx.error).toContain("invalid function number");
		});

		test("FDEF errors on negative function number", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x2c, 0x2d]);
			ctx.codeSize = 2;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = -1;

			FDEF(ctx);

			expect(ctx.error).toContain("invalid function number");
		});

		test("FDEF errors on missing ENDF", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x2c]);
			ctx.codeSize = 1;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0;

			FDEF(ctx);

			expect(ctx.error).toContain("missing ENDF");
		});

		test("CALL calls function", () => {
			const ctx = createTestContext();
			ctx.currentRange = CodeRange.Glyph;
			ctx.codeRanges.set(CodeRange.Glyph, {
				code: new Uint8Array([0x2b]),
				size: 1,
			});

			// Define function
			const funcCode = new Uint8Array([0xb0, 0x01, 0x2d]);
			ctx.codeRanges.set(CodeRange.Font, { code: funcCode, size: 3 });
			ctx.FDefs[2]!.active = true;
			ctx.FDefs[2]!.start = 0;
			ctx.FDefs[2]!.end = 3;
			ctx.FDefs[2]!.range = CodeRange.Font;

			ctx.code = new Uint8Array([0x2b]);
			ctx.codeSize = 1;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 2;

			CALL(ctx);

			expect(ctx.callStackTop).toBe(1);
			expect(ctx.callStack[0]!.callerIP).toBe(1);
			expect(ctx.callStack[0]!.callerRange).toBe(CodeRange.Glyph); // Caller was in Glyph range
			expect(ctx.IP).toBe(0);
			expect(ctx.currentRange).toBe(CodeRange.Font); // Function is in Font range
		});

		test("CALL errors on invalid function number", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 999;

			CALL(ctx);

			expect(ctx.error).toContain("invalid function number");
		});

		test("CALL errors on undefined function", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 5;

			CALL(ctx);

			expect(ctx.error).toContain("not defined");
		});

		test("CALL errors on stack overflow", () => {
			const ctx = createTestContext();
			ctx.callStackTop = ctx.maxCallStack;
			ctx.FDefs[0]!.active = true;
			ctx.stack[ctx.stackTop++] = 0;

			CALL(ctx);

			expect(ctx.error).toContain("call stack overflow");
		});

		test("ENDF returns from function", () => {
			const ctx = createTestContext();
			ctx.currentRange = CodeRange.Font;
			ctx.codeRanges.set(CodeRange.Font, {
				code: new Uint8Array([0x2d]),
				size: 1,
			});
			ctx.codeRanges.set(CodeRange.Glyph, {
				code: new Uint8Array([0x00]),
				size: 1,
			});

			ctx.callStack[0] = {
				callerIP: 10,
				callerRange: CodeRange.Glyph,
				def: ctx.FDefs[0]!,
				count: 1,
			};
			ctx.callStackTop = 1;
			ctx.IP = 5;

			ENDF(ctx);

			expect(ctx.callStackTop).toBe(0);
			expect(ctx.IP).toBe(10);
			expect(ctx.currentRange).toBe(CodeRange.Glyph); // Restored to caller's range
		});

		test("ENDF errors when not in function", () => {
			const ctx = createTestContext();
			ctx.callStackTop = 0;

			ENDF(ctx);

			expect(ctx.error).toContain("not in function call");
		});

		test("ENDF loops for LOOPCALL", () => {
			const ctx = createTestContext();
			ctx.currentRange = CodeRange.Font;
			ctx.codeRanges.set(CodeRange.Font, {
				code: new Uint8Array([0x2d]),
				size: 1,
			});

			ctx.FDefs[1]!.start = 5;
			ctx.callStack[0] = {
				callerIP: 20,
				callerRange: CodeRange.Glyph,
				def: ctx.FDefs[1]!,
				count: 3, // More loops remaining
			};
			ctx.callStackTop = 1;
			ctx.IP = 10;

			ENDF(ctx);

			expect(ctx.callStackTop).toBe(1); // Still in function
			expect(ctx.callStack[0]!.count).toBe(2); // Decremented
			expect(ctx.IP).toBe(5); // Restart function
		});

		test("LOOPCALL calls function multiple times", () => {
			const ctx = createTestContext();
			ctx.currentRange = CodeRange.Glyph;
			ctx.codeRanges.set(CodeRange.Glyph, {
				code: new Uint8Array([0x2a]),
				size: 1,
			});
			ctx.codeRanges.set(CodeRange.Font, {
				code: new Uint8Array([0x2d]),
				size: 1,
			});

			ctx.FDefs[3]!.active = true;
			ctx.FDefs[3]!.start = 0;
			ctx.FDefs[3]!.end = 1;
			ctx.FDefs[3]!.range = CodeRange.Font;

			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 5; // Count
			ctx.stack[ctx.stackTop++] = 3; // Function

			LOOPCALL(ctx);

			expect(ctx.callStackTop).toBe(1);
			expect(ctx.callStack[0]!.count).toBe(5);
			expect(ctx.IP).toBe(0);
		});

		test("LOOPCALL with zero count does nothing", () => {
			const ctx = createTestContext();
			ctx.FDefs[1]!.active = true;
			ctx.IP = 5;

			ctx.stack[ctx.stackTop++] = 0; // Zero count
			ctx.stack[ctx.stackTop++] = 1;

			LOOPCALL(ctx);

			expect(ctx.callStackTop).toBe(0);
			expect(ctx.IP).toBe(5);
		});

		test("LOOPCALL with negative count does nothing", () => {
			const ctx = createTestContext();
			ctx.FDefs[1]!.active = true;
			ctx.IP = 5;

			ctx.stack[ctx.stackTop++] = -3;
			ctx.stack[ctx.stackTop++] = 1;

			LOOPCALL(ctx);

			expect(ctx.callStackTop).toBe(0);
		});

		test("LOOPCALL errors on invalid function", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 999;

			LOOPCALL(ctx);

			expect(ctx.error).toContain("invalid function number");
		});

		test("LOOPCALL errors on undefined function", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 5;

			LOOPCALL(ctx);

			expect(ctx.error).toContain("not defined");
		});

		test("LOOPCALL errors on stack overflow", () => {
			const ctx = createTestContext();
			ctx.callStackTop = ctx.maxCallStack;
			ctx.FDefs[0]!.active = true;
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = 0;

			LOOPCALL(ctx);

			expect(ctx.error).toContain("call stack overflow");
		});
	});

	describe("Instruction Definition", () => {
		test("IDEF defines instruction", () => {
			const ctx = createTestContext();
			// IDEF (0x89) + instruction + ENDF (0x2d)
			ctx.code = new Uint8Array([0x89, 0xb0, 0x01, 0x2d]);
			ctx.codeSize = 4;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.Font;
			ctx.stack[ctx.stackTop++] = 0x20;

			IDEF(ctx);

			expect(ctx.IDefs[0x20]!.active).toBe(true);
			expect(ctx.IDefs[0x20]!.start).toBe(1);
			expect(ctx.IDefs[0x20]!.end).toBe(4);
			expect(ctx.IDefs[0x20]!.range).toBe(CodeRange.Font);
			expect(ctx.IP).toBe(4);
		});

		test("IDEF handles push instructions", () => {
			const ctx = createTestContext();
			// IDEF (0x89) + NPUSHB (0x40) + count + data + ENDF (0x2d)
			ctx.code = new Uint8Array([0x89, 0x40, 0x03, 0x01, 0x02, 0x03, 0x2d]);
			ctx.codeSize = 7;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.CVT;
			ctx.stack[ctx.stackTop++] = 0x30;

			IDEF(ctx);

			expect(ctx.IDefs[0x30]!.active).toBe(true);
			expect(ctx.IP).toBe(7);
		});

		test("IDEF handles PUSHB[n] variants", () => {
			const ctx = createTestContext();
			// IDEF (0x89) + PUSHB[3] (0xb3) + 4 bytes + ENDF (0x2d)
			ctx.code = new Uint8Array([0x89, 0xb3, 0x01, 0x02, 0x03, 0x04, 0x2d]);
			ctx.codeSize = 7;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.Font;
			ctx.stack[ctx.stackTop++] = 0x25;

			IDEF(ctx);

			expect(ctx.IDefs[0x25]!.active).toBe(true);
		});

		test("IDEF handles PUSHW[n] variants", () => {
			const ctx = createTestContext();
			// IDEF (0x89) + PUSHW[0] (0xb8) + 2 bytes + ENDF (0x2d)
			ctx.code = new Uint8Array([0x89, 0xb8, 0x00, 0x01, 0x2d]);
			ctx.codeSize = 5;
			ctx.IP = 1;
			ctx.currentRange = CodeRange.Font;
			ctx.stack[ctx.stackTop++] = 0x28;

			IDEF(ctx);

			expect(ctx.IDefs[0x28]!.active).toBe(true);
		});

		test("IDEF errors on invalid opcode", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x89, 0x2d]);
			ctx.codeSize = 2;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 999;

			IDEF(ctx);

			expect(ctx.error).toContain("invalid opcode");
		});

		test("IDEF errors on negative opcode", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x89, 0x2d]);
			ctx.codeSize = 2;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = -1;

			IDEF(ctx);

			expect(ctx.error).toContain("invalid opcode");
		});

		test("IDEF errors on missing ENDF", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x89, 0xb0, 0x01]);
			ctx.codeSize = 3;
			ctx.IP = 1;
			ctx.stack[ctx.stackTop++] = 0x20;

			IDEF(ctx);

			expect(ctx.error).toContain("missing ENDF");
		});
	});
});
