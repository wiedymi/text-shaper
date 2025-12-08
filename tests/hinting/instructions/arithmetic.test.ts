import { describe, test, expect } from "bun:test";
import {
	createExecContext,
	createGlyphZone,
	type ExecContext,
} from "../../../src/hinting/types.ts";
import {
	ADD,
	SUB,
	DIV,
	MUL,
	ABS,
	NEG,
	FLOOR,
	CEILING,
	MAX,
	MIN,
	LT,
	LTEQ,
	GT,
	GTEQ,
	EQ,
	NEQ,
	ODD,
	EVEN,
	AND,
	OR,
	NOT,
} from "../../../src/hinting/instructions/arithmetic.ts";

describe("Arithmetic Instructions", () => {
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

	describe("ADD", () => {
		test("adds two positive values", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 50;

			ADD(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(150);
			expect(ctx.error).toBeNull();
		});

		test("adds positive and negative values", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = -50;

			ADD(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(50);
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			ADD(ctx);

			expect(ctx.error).toBe("ADD: stack underflow");
			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[1]).toBe(0);
		});

		test("handles empty stack", () => {
			const ctx = createTestContext();

			ADD(ctx);

			expect(ctx.error).toBe("ADD: stack underflow");
			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("SUB", () => {
		test("subtracts two positive values", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 50;

			SUB(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(50);
			expect(ctx.error).toBeNull();
		});

		test("subtracts negative from positive", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = -50;

			SUB(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(150);
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			SUB(ctx);

			expect(ctx.error).toBe("SUB: stack underflow");
			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[1]).toBe(0);
		});

		test("handles empty stack", () => {
			const ctx = createTestContext();

			SUB(ctx);

			expect(ctx.error).toBe("SUB: stack underflow");
			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("DIV", () => {
		test("divides two positive values (26.6 fixed-point)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 128; // 2.0 in 26.6 format
			ctx.stack[ctx.stackTop++] = 64; // 1.0 in 26.6 format

			DIV(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(128); // (128 * 64) / 64 = 128
			expect(ctx.error).toBeNull();
		});

		test("divides with fractional result", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 64; // 1.0
			ctx.stack[ctx.stackTop++] = 128; // 2.0

			DIV(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(32); // (64 * 64) / 128 = 32 (0.5 in 26.6)
			expect(ctx.error).toBeNull();
		});

		test("handles division by zero", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 0;

			DIV(ctx);

			expect(ctx.error).toBe("DIV: division by zero");
			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0);
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			DIV(ctx);

			expect(ctx.error).toBe("DIV: stack underflow");
			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[1]).toBe(0);
		});

		test("handles empty stack", () => {
			const ctx = createTestContext();

			DIV(ctx);

			expect(ctx.error).toBe("DIV: stack underflow");
			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("MUL", () => {
		test("multiplies two values (26.6 fixed-point)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 64; // 1.0 in 26.6 format
			ctx.stack[ctx.stackTop++] = 128; // 2.0 in 26.6 format

			MUL(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(128); // (64 * 128) / 64 = 128 (2.0)
			expect(ctx.error).toBeNull();
		});

		test("multiplies fractional values", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 32; // 0.5 in 26.6
			ctx.stack[ctx.stackTop++] = 128; // 2.0 in 26.6

			MUL(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(64); // (32 * 128) / 64 = 64 (1.0)
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			MUL(ctx);

			expect(ctx.error).toBe("MUL: stack underflow");
			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[1]).toBe(0);
		});

		test("handles empty stack", () => {
			const ctx = createTestContext();

			MUL(ctx);

			expect(ctx.error).toBe("MUL: stack underflow");
			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("ABS", () => {
		test("returns absolute value of positive number", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			ABS(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.error).toBeNull();
		});

		test("returns absolute value of negative number", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = -100;

			ABS(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();

			ABS(ctx);

			expect(ctx.error).toBe("ABS: stack underflow");
			expect(ctx.stackTop).toBe(0);
		});
	});

	describe("NEG", () => {
		test("negates positive number", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			NEG(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(-100);
			expect(ctx.error).toBeNull();
		});

		test("negates negative number", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = -100;

			NEG(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();

			NEG(ctx);

			expect(ctx.error).toBe("NEG: stack underflow");
			expect(ctx.stackTop).toBe(0);
		});
	});

	describe("FLOOR", () => {
		test("floors value to 26.6 integer (multiple of 64)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100; // 1.5625 in 26.6 format

			FLOOR(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(64); // Floor to nearest 64 = 64 (1.0)
			expect(ctx.error).toBeNull();
		});

		test("floors already aligned value", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 128; // 2.0 exactly

			FLOOR(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(128);
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();

			FLOOR(ctx);

			expect(ctx.error).toBe("FLOOR: stack underflow");
			expect(ctx.stackTop).toBe(0);
		});
	});

	describe("CEILING", () => {
		test("ceils value to 26.6 integer (multiple of 64)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 65; // Just over 1.0

			CEILING(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(128); // Ceil to 2.0
			expect(ctx.error).toBeNull();
		});

		test("ceils already aligned value", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 64; // 1.0 exactly

			CEILING(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(64);
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();

			CEILING(ctx);

			expect(ctx.error).toBe("CEILING: stack underflow");
			expect(ctx.stackTop).toBe(0);
		});
	});

	describe("MAX", () => {
		test("returns maximum of two values (a > b)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 50;

			MAX(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.error).toBeNull();
		});

		test("returns maximum of two values (b > a)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 50;
			ctx.stack[ctx.stackTop++] = 100;

			MAX(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.error).toBeNull();
		});

		test("handles equal values", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 100;

			MAX(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			MAX(ctx);

			expect(ctx.error).toBe("MAX: stack underflow");
			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[1]).toBe(0);
		});

		test("handles empty stack", () => {
			const ctx = createTestContext();

			MAX(ctx);

			expect(ctx.error).toBe("MAX: stack underflow");
			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("MIN", () => {
		test("returns minimum of two values (a < b)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 50;
			ctx.stack[ctx.stackTop++] = 100;

			MIN(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(50);
			expect(ctx.error).toBeNull();
		});

		test("returns minimum of two values (b < a)", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 50;

			MIN(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(50);
			expect(ctx.error).toBeNull();
		});

		test("handles equal values", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;
			ctx.stack[ctx.stackTop++] = 100;

			MIN(ctx);

			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(100);
			expect(ctx.error).toBeNull();
		});

		test("handles stack underflow", () => {
			const ctx = createTestContext();
			ctx.stack[ctx.stackTop++] = 100;

			MIN(ctx);

			expect(ctx.error).toBe("MIN: stack underflow");
			expect(ctx.stackTop).toBe(2);
			expect(ctx.stack[1]).toBe(0);
		});

		test("handles empty stack", () => {
			const ctx = createTestContext();

			MIN(ctx);

			expect(ctx.error).toBe("MIN: stack underflow");
			expect(ctx.stackTop).toBe(1);
			expect(ctx.stack[0]).toBe(0);
		});
	});

	describe("Comparison Instructions", () => {
		describe("LT", () => {
			test("returns 1 when a < b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 50;
				ctx.stack[ctx.stackTop++] = 100;

				LT(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when a >= b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 50;

				LT(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;

				LT(ctx);

				expect(ctx.error).toBe("LT: stack underflow");
				expect(ctx.stackTop).toBe(2);
				expect(ctx.stack[1]).toBe(0);
			});

			test("handles empty stack", () => {
				const ctx = createTestContext();

				LT(ctx);

				expect(ctx.error).toBe("LT: stack underflow");
				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
			});
		});

		describe("LTEQ", () => {
			test("returns 1 when a < b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 50;
				ctx.stack[ctx.stackTop++] = 100;

				LTEQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 1 when a == b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 100;

				LTEQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when a > b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 50;

				LTEQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;

				LTEQ(ctx);

				expect(ctx.error).toBe("LTEQ: stack underflow");
				expect(ctx.stackTop).toBe(2);
				expect(ctx.stack[1]).toBe(0);
			});

			test("handles empty stack", () => {
				const ctx = createTestContext();

				LTEQ(ctx);

				expect(ctx.error).toBe("LTEQ: stack underflow");
				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
			});
		});

		describe("GT", () => {
			test("returns 1 when a > b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 50;

				GT(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when a <= b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 50;
				ctx.stack[ctx.stackTop++] = 100;

				GT(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;

				GT(ctx);

				expect(ctx.error).toBe("GT: stack underflow");
				expect(ctx.stackTop).toBe(2);
				expect(ctx.stack[1]).toBe(0);
			});

			test("handles empty stack", () => {
				const ctx = createTestContext();

				GT(ctx);

				expect(ctx.error).toBe("GT: stack underflow");
				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
			});
		});

		describe("GTEQ", () => {
			test("returns 1 when a > b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 50;

				GTEQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 1 when a == b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 100;

				GTEQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when a < b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 50;
				ctx.stack[ctx.stackTop++] = 100;

				GTEQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;

				GTEQ(ctx);

				expect(ctx.error).toBe("GTEQ: stack underflow");
				expect(ctx.stackTop).toBe(2);
				expect(ctx.stack[1]).toBe(0);
			});

			test("handles empty stack", () => {
				const ctx = createTestContext();

				GTEQ(ctx);

				expect(ctx.error).toBe("GTEQ: stack underflow");
				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
			});
		});

		describe("EQ", () => {
			test("returns 1 when a == b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 100;

				EQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when a != b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 50;

				EQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;

				EQ(ctx);

				expect(ctx.error).toBe("EQ: stack underflow");
				expect(ctx.stackTop).toBe(2);
				expect(ctx.stack[1]).toBe(0);
			});

			test("handles empty stack", () => {
				const ctx = createTestContext();

				EQ(ctx);

				expect(ctx.error).toBe("EQ: stack underflow");
				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
			});
		});

		describe("NEQ", () => {
			test("returns 1 when a != b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 50;

				NEQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when a == b", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;
				ctx.stack[ctx.stackTop++] = 100;

				NEQ(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;

				NEQ(ctx);

				expect(ctx.error).toBe("NEQ: stack underflow");
				expect(ctx.stackTop).toBe(2);
				expect(ctx.stack[1]).toBe(0);
			});

			test("handles empty stack", () => {
				const ctx = createTestContext();

				NEQ(ctx);

				expect(ctx.error).toBe("NEQ: stack underflow");
				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
			});
		});

		describe("ODD", () => {
			test("returns 1 for odd value after rounding", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 32; // Rounds to 64, which has bit 6 set

				ODD(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 for even value after rounding", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 96; // Rounds to 128, which doesn't have bit 6 set

				ODD(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();

				ODD(ctx);

				expect(ctx.error).toBe("ODD: stack underflow");
				expect(ctx.stackTop).toBe(0);
			});
		});

		describe("EVEN", () => {
			test("returns 1 for even value after rounding", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 96; // Rounds to 128, which doesn't have bit 6 set

				EVEN(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 for odd value after rounding", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 32; // Rounds to 64, which has bit 6 set

				EVEN(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();

				EVEN(ctx);

				expect(ctx.error).toBe("EVEN: stack underflow");
				expect(ctx.stackTop).toBe(0);
			});
		});
	});

	describe("Logic Instructions", () => {
		describe("AND", () => {
			test("returns 1 when both values are truthy", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 1;
				ctx.stack[ctx.stackTop++] = 5;

				AND(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when first value is falsy", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 5;

				AND(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when second value is falsy", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 5;
				ctx.stack[ctx.stackTop++] = 0;

				AND(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when both values are falsy", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 0;

				AND(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;

				AND(ctx);

				expect(ctx.error).toBe("AND: stack underflow");
				expect(ctx.stackTop).toBe(2);
				expect(ctx.stack[1]).toBe(0);
			});

			test("handles empty stack", () => {
				const ctx = createTestContext();

				AND(ctx);

				expect(ctx.error).toBe("AND: stack underflow");
				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
			});
		});

		describe("OR", () => {
			test("returns 1 when both values are truthy", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 1;
				ctx.stack[ctx.stackTop++] = 5;

				OR(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 1 when first value is truthy", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 5;
				ctx.stack[ctx.stackTop++] = 0;

				OR(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 1 when second value is truthy", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 5;

				OR(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("returns 0 when both values are falsy", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 0;
				ctx.stack[ctx.stackTop++] = 0;

				OR(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 100;

				OR(ctx);

				expect(ctx.error).toBe("OR: stack underflow");
				expect(ctx.stackTop).toBe(2);
				expect(ctx.stack[1]).toBe(0);
			});

			test("handles empty stack", () => {
				const ctx = createTestContext();

				OR(ctx);

				expect(ctx.error).toBe("OR: stack underflow");
				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
			});
		});

		describe("NOT", () => {
			test("returns 0 for truthy value", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 5;

				NOT(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(0);
				expect(ctx.error).toBeNull();
			});

			test("returns 1 for falsy value", () => {
				const ctx = createTestContext();
				ctx.stack[ctx.stackTop++] = 0;

				NOT(ctx);

				expect(ctx.stackTop).toBe(1);
				expect(ctx.stack[0]).toBe(1);
				expect(ctx.error).toBeNull();
			});

			test("handles stack underflow", () => {
				const ctx = createTestContext();

				NOT(ctx);

				expect(ctx.error).toBe("NOT: stack underflow");
				expect(ctx.stackTop).toBe(0);
			});
		});
	});
});
