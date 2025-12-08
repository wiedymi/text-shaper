import { describe, test, expect } from "bun:test";
import {
	createExecContext,
	createGlyphZone,
	type ExecContext,
} from "../../../src/hinting/types.ts";
import {
	DUP,
	POP,
	CLEAR,
	SWAP,
	DEPTH,
	CINDEX,
	MINDEX,
	ROLL,
	PUSHB,
	PUSHW,
	NPUSHB,
	NPUSHW,
} from "../../../src/hinting/instructions/stack.ts";

describe("Stack Instructions", () => {
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

	describe("DUP", () => {
		test("duplicates top of stack", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 42;

			DUP(ctx);

			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[0]).toBe(42);
			expect(ctx.stack[1]).toBe(42);
		});

		test("duplicates with multiple values on stack", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 20;
			ctx.stack[ctx.stackTop++] = 30;

			DUP(ctx);

			expect(ctx.stackTop).toBe(4);
			expect(ctx.stack[0]).toBe(10);
			expect(ctx.stack[1]).toBe(20);
			expect(ctx.stack[2]).toBe(30);
			expect(ctx.stack[3]).toBe(30);
		});
	});

	describe("POP", () => {
		test("removes top of stack", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 42;
			ctx.stack[ctx.stackTop++] = 99;

			POP(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(42);
		});

		test("decrements stack pointer", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 20;
			ctx.stack[ctx.stackTop++] = 30;

			POP(ctx);

			expect(ctx.stackTop).toBe(2);
		});
	});

	describe("CLEAR", () => {
		test("clears empty stack", () => {
			const ctx = createTestContext();

			CLEAR(ctx);

			expect(ctx.stackTop).toBe(0);
		});

		test("clears stack with values", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 20;
			ctx.stack[ctx.stackTop++] = 30;

			CLEAR(ctx);

			expect(ctx.stackTop).toBe(0);
		});
	});

	describe("SWAP", () => {
		test("swaps top two elements", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;

			SWAP(ctx);

			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[0]).toBe(200);
			expect(ctx.stack[1]).toBe(100);
		});

		test("swaps with more elements on stack", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 20;
			ctx.stack[ctx.stackTop++] = 30;
			ctx.stack[ctx.stackTop++] = 40;

			SWAP(ctx);

			expect(ctx.stackTop).toBe(4);
			expect(ctx.stack[0]).toBe(10);
			expect(ctx.stack[1]).toBe(20);
			expect(ctx.stack[2]).toBe(40);
			expect(ctx.stack[3]).toBe(30);
		});
	});

	describe("DEPTH", () => {
		test("pushes depth of empty stack", () => {
			const ctx = createTestContext();

			DEPTH(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0);
		});

		test("pushes depth of non-empty stack", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 20;
			ctx.stack[ctx.stackTop++] = 30;

			DEPTH(ctx);

			expect(ctx.stackTop).toBe(4);
			expect(ctx.stack[3]).toBe(3);
		});
	});

	describe("CINDEX", () => {
		test("copies indexed element to top (index 1 = top element)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 300;
			ctx.stack[ctx.stackTop++] = 1;

			CINDEX(ctx);

			expect(ctx.stackTop).toBe(4);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.stack[1]).toBe(200);
			expect(ctx.stack[2]).toBe(300);
			expect(ctx.stack[3]).toBe(300);
		});

		test("copies second element with index 2", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 300;
			ctx.stack[ctx.stackTop++] = 2;

			CINDEX(ctx);

			expect(ctx.stackTop).toBe(4);
			expect(ctx.stack[3]).toBe(200);
		});

		test("copies third element with index 3", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 300;
			ctx.stack[ctx.stackTop++] = 3;

			CINDEX(ctx);

			expect(ctx.stackTop).toBe(4);
			expect(ctx.stack[3]).toBe(100);
		});

		test("sets error on invalid index (zero)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 0;

			CINDEX(ctx);

			expect(ctx.error).toBe("CINDEX: invalid index 0");
		});

		test("sets error on invalid index (negative)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = -1;

			CINDEX(ctx);

			expect(ctx.error).toBe("CINDEX: invalid index -1");
		});

		test("sets error on index too large", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 5;

			CINDEX(ctx);

			expect(ctx.error).toBe("CINDEX: invalid index 5");
		});
	});

	describe("MINDEX", () => {
		test("moves indexed element to top", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 300;
			ctx.stack[ctx.stackTop++] = 1;

			MINDEX(ctx);

			expect(ctx.stackTop).toBe(3);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.stack[1]).toBe(200);
			expect(ctx.stack[2]).toBe(300);
		});

		test("moves second element to top with index 2", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 300;
			ctx.stack[ctx.stackTop++] = 2;

			MINDEX(ctx);

			expect(ctx.stackTop).toBe(3);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.stack[1]).toBe(300);
			expect(ctx.stack[2]).toBe(200);
		});

		test("moves third element to top with index 3", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 300;
			ctx.stack[ctx.stackTop++] = 3;

			MINDEX(ctx);

			expect(ctx.stackTop).toBe(3);
			expect(ctx.stack[0]).toBe(200);
			expect(ctx.stack[1]).toBe(300);
			expect(ctx.stack[2]).toBe(100);
		});

		test("moves fourth element to top", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 20;
			ctx.stack[ctx.stackTop++] = 30;
			ctx.stack[ctx.stackTop++] = 40;
			ctx.stack[ctx.stackTop++] = 4;

			MINDEX(ctx);

			expect(ctx.stackTop).toBe(4);
			expect(ctx.stack[0]).toBe(20);
			expect(ctx.stack[1]).toBe(30);
			expect(ctx.stack[2]).toBe(40);
			expect(ctx.stack[3]).toBe(10);
		});

		test("sets error on invalid index (zero)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 0;

			MINDEX(ctx);

			expect(ctx.error).toBe("MINDEX: invalid index 0");
		});

		test("sets error on invalid index (negative)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = -1;

			MINDEX(ctx);

			expect(ctx.error).toBe("MINDEX: invalid index -1");
		});

		test("sets error on index too large", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 5;

			MINDEX(ctx);

			expect(ctx.error).toBe("MINDEX: invalid index 5");
		});
	});

	describe("ROLL", () => {
		test("rolls top three elements", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 200;
			ctx.stack[ctx.stackTop++] = 300;

			ROLL(ctx);

			expect(ctx.stackTop).toBe(3);
			expect(ctx.stack[0]).toBe(200);
			expect(ctx.stack[1]).toBe(300);
			expect(ctx.stack[2]).toBe(100);
		});

		test("rolls with more elements on stack", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 10;
			ctx.stack[ctx.stackTop++] = 20;
			ctx.stack[ctx.stackTop++] = 30;
			ctx.stack[ctx.stackTop++] = 40;
			ctx.stack[ctx.stackTop++] = 50;

			ROLL(ctx);

			expect(ctx.stackTop).toBe(5);
			expect(ctx.stack[0]).toBe(10);
			expect(ctx.stack[1]).toBe(20);
			expect(ctx.stack[2]).toBe(40);
			expect(ctx.stack[3]).toBe(50);
			expect(ctx.stack[4]).toBe(30);
		});
	});

	describe("PUSHB", () => {
		test("pushes single byte", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([42]);
			ctx.IP = 0;

			PUSHB(ctx, 1);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(42);
			expect(ctx.IP).toBe(1);
		});

		test("pushes multiple bytes", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([10, 20, 30, 40]);
			ctx.IP = 0;

			PUSHB(ctx, 4);

			expect(ctx.stackTop).toBe(4);
			expect(ctx.stack[0]).toBe(10);
			expect(ctx.stack[1]).toBe(20);
			expect(ctx.stack[2]).toBe(30);
			expect(ctx.stack[3]).toBe(40);
			expect(ctx.IP).toBe(4);
		});

		test("pushes zero bytes", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([42]);
			ctx.IP = 0;

			PUSHB(ctx, 0);

			expect(ctx.stackTop).toBe(0);
			expect(ctx.IP).toBe(0);
		});
	});

	describe("PUSHW", () => {
		test("pushes single word (positive)", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x12, 0x34]);
			ctx.IP = 0;

			PUSHW(ctx, 1);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0x1234);
			expect(ctx.IP).toBe(2);
		});

		test("pushes single word (negative)", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0xFF, 0xFF]);
			ctx.IP = 0;

			PUSHW(ctx, 1);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(-1);
			expect(ctx.IP).toBe(2);
		});

		test("pushes word at sign extend boundary", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x80, 0x00]);
			ctx.IP = 0;

			PUSHW(ctx, 1);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(-32768);
			expect(ctx.IP).toBe(2);
		});

		test("pushes multiple words", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x00, 0x10, 0x00, 0x20, 0xFF, 0xF0]);
			ctx.IP = 0;

			PUSHW(ctx, 3);

			expect(ctx.stackTop).toBe(3);
			expect(ctx.stack[0]).toBe(16);
			expect(ctx.stack[1]).toBe(32);
			expect(ctx.stack[2]).toBe(-16);
			expect(ctx.IP).toBe(6);
		});

		test("pushes zero words", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0x12, 0x34]);
			ctx.IP = 0;

			PUSHW(ctx, 0);

			expect(ctx.stackTop).toBe(0);
			expect(ctx.IP).toBe(0);
		});
	});

	describe("NPUSHB", () => {
		test("pushes N bytes from instruction stream", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([3, 10, 20, 30]);
			ctx.IP = 0;

			NPUSHB(ctx);

			expect(ctx.stackTop).toBe(3);
			expect(ctx.stack[0]).toBe(10);
			expect(ctx.stack[1]).toBe(20);
			expect(ctx.stack[2]).toBe(30);
			expect(ctx.IP).toBe(4);
		});

		test("pushes zero bytes", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0, 42]);
			ctx.IP = 0;

			NPUSHB(ctx);

			expect(ctx.stackTop).toBe(0);
			expect(ctx.IP).toBe(1);
		});

		test("pushes single byte", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([1, 99]);
			ctx.IP = 0;

			NPUSHB(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(99);
			expect(ctx.IP).toBe(2);
		});
	});

	describe("NPUSHW", () => {
		test("pushes N words from instruction stream", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([2, 0x12, 0x34, 0xFF, 0xFF]);
			ctx.IP = 0;

			NPUSHW(ctx);

			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[0]).toBe(0x1234);
			expect(ctx.stack[1]).toBe(-1);
			expect(ctx.IP).toBe(5);
		});

		test("pushes zero words", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([0, 0x12, 0x34]);
			ctx.IP = 0;

			NPUSHW(ctx);

			expect(ctx.stackTop).toBe(0);
			expect(ctx.IP).toBe(1);
		});

		test("pushes single word", () => {
			const ctx = createTestContext();
			ctx.code = new Uint8Array([1, 0x00, 0x42]);
			ctx.IP = 0;

			NPUSHW(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(66);
			expect(ctx.IP).toBe(3);
		});
	});
});
