import { describe, test, expect } from "bun:test";
import {
	createExecContext,
	createGlyphZone,
	TouchFlag,
	type ExecContext,
} from "../../../src/hinting/types.ts";
import {
	DELTAP1,
	DELTAP2,
	DELTAP3,
	DELTAC1,
	DELTAC2,
	DELTAC3,
} from "../../../src/hinting/instructions/delta.ts";

describe("Delta Instructions", () => {
	function createTestContext(): ExecContext {
		const ctx = createExecContext();
		const zone = createGlyphZone(10, 1);
		zone.nPoints = 10;
		zone.nContours = 1;
		zone.contours[0] = 9;

		for (let i = 0; i < 10; i++) {
			zone.org[i] = { x: i * 64, y: i * 64 };
			zone.cur[i] = { x: i * 64, y: i * 64 };
			zone.tags[i] = 0;
		}

		ctx.pts = zone;
		ctx.zp0 = zone;
		ctx.zp1 = zone;
		ctx.zp2 = zone;

		return ctx;
	}

	describe("DELTAP1 - Delta exception point (ppem 0-15 + deltaBase)", () => {
		test("applies delta at matching ppem", () => {
			const ctx = createTestContext();
			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const originalX = ctx.pts.cur[2]!.x;

			// ArgByte encoding:
			// High nibble: ppem - deltaBase = 12 - 9 = 3
			// Low nibble: magnitude = 0 (which means +1 step)
			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 2; // Point index
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1; // Count

			DELTAP1(ctx);

			// Delta = (0 + 1) << (6 - 3) = 1 << 3 = 8
			expect(ctx.pts.cur[2]!.x).toBe(originalX + 8);
			expect(ctx.pts.tags[2]! & TouchFlag.X).toBeTruthy();
		});

		test("skips delta at non-matching ppem", () => {
			const ctx = createTestContext();
			ctx.ppem = 16;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const originalX = ctx.pts.cur[2]!.x;

			// Target ppem = (3 << 4) + 9 = 12, but current is 16
			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAP1(ctx);

			expect(ctx.pts.cur[2]!.x).toBe(originalX); // Unchanged
		});

		test("applies negative delta", () => {
			const ctx = createTestContext();
			ctx.ppem = 10;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const originalX = ctx.pts.cur[3]!.x;

			// Low nibble 8-15 means negative
			// magnitude = 8 means -1 step
			const argByte = (1 << 4) | 8;

			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAP1(ctx);

			// Delta = -((8 - 7) << (6 - 3)) = -(1 << 3) = -8
			expect(ctx.pts.cur[3]!.x).toBe(originalX - 8);
		});

		test("processes multiple deltas", () => {
			const ctx = createTestContext();
			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const original1 = ctx.pts.cur[1]!.x;
			const original2 = ctx.pts.cur[2]!.x;
			const original3 = ctx.pts.cur[3]!.x;

			// ppem - deltaBase = 3
			const argByte1 = (3 << 4) | 0; // +8
			const argByte2 = (3 << 4) | 1; // +16
			const argByte3 = (3 << 4) | 8; // -8

			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = argByte1;
			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = argByte2;
			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = argByte3;
			ctx.stack[ctx.stackTop++] = 3; // Count

			DELTAP1(ctx);

			expect(ctx.pts.cur[1]!.x).toBe(original1 + 8);
			expect(ctx.pts.cur[2]!.x).toBe(original2 + 16);
			expect(ctx.pts.cur[3]!.x).toBe(original3 - 8);
		});

		test("respects deltaShift parameter", () => {
			const ctx = createTestContext();
			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 2; // Larger steps

			const originalX = ctx.pts.cur[2]!.x;

			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAP1(ctx);

			// Delta = 1 << (6 - 2) = 1 << 4 = 16
			expect(ctx.pts.cur[2]!.x).toBe(originalX + 16);
		});

		test("handles all magnitude values", () => {
			const ctx = createTestContext();
			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const testCases = [
				{ magnitude: 0, expected: 8 },   // (0+1) << 3 = 8
				{ magnitude: 1, expected: 16 },  // (1+1) << 3 = 16
				{ magnitude: 2, expected: 24 },  // (2+1) << 3 = 24
				{ magnitude: 3, expected: 32 },  // (3+1) << 3 = 32
				{ magnitude: 4, expected: 40 },  // (4+1) << 3 = 40
				{ magnitude: 5, expected: 48 },  // (5+1) << 3 = 48
				{ magnitude: 6, expected: 56 },  // (6+1) << 3 = 56
				{ magnitude: 7, expected: 64 },  // (7+1) << 3 = 64
				{ magnitude: 8, expected: -8 },  // -((8-7) << 3) = -8
				{ magnitude: 9, expected: -16 }, // -((9-7) << 3) = -16
				{ magnitude: 15, expected: -64 }, // -((15-7) << 3) = -64
			];

			for (const { magnitude, expected } of testCases) {
				const freshCtx = createTestContext();
				freshCtx.ppem = 12;
				freshCtx.GS.deltaBase = 9;
				freshCtx.GS.deltaShift = 3;

				const originalX = freshCtx.pts.cur[2]!.x;
				const argByte = (3 << 4) | magnitude;

				freshCtx.stack[freshCtx.stackTop++] = 2;
				freshCtx.stack[freshCtx.stackTop++] = argByte;
				freshCtx.stack[freshCtx.stackTop++] = 1;

				DELTAP1(freshCtx);

				expect(freshCtx.pts.cur[2]!.x).toBe(originalX + expected);
			}
		});

		test("sets error for invalid point index", () => {
			const ctx = createTestContext();
			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;

			ctx.stack[ctx.stackTop++] = 999; // Invalid point
			ctx.stack[ctx.stackTop++] = (3 << 4) | 0;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAP1(ctx);

			expect(ctx.error).toContain("invalid point");
		});

		test("sets error for negative count", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = -1; // Negative count

			DELTAP1(ctx);

			expect(ctx.error).toContain("invalid count");
		});

		test("handles zero count gracefully", () => {
			const ctx = createTestContext();

			ctx.stack[ctx.stackTop++] = 0; // Zero count

			DELTAP1(ctx);

			expect(ctx.error).toBeNull();
		});
	});

	describe("DELTAP2 - Delta exception point (ppem 16-31 + deltaBase)", () => {
		test("applies delta at offset range", () => {
			const ctx = createTestContext();
			ctx.ppem = 28; // 28 = 9 (deltaBase) + 16 (offset) + 3 (high nibble)
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const originalX = ctx.pts.cur[2]!.x;

			// High nibble = 3 (ppem - deltaBase - 16 = 28 - 9 - 16 = 3)
			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAP2(ctx);

			expect(ctx.pts.cur[2]!.x).toBe(originalX + 8);
		});

		test("covers ppem range 16-31", () => {
			// Test edge of range
			const ctx = createTestContext();
			ctx.ppem = 40; // 40 = 9 + 16 + 15 (max high nibble)
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const originalX = ctx.pts.cur[2]!.x;

			const argByte = (15 << 4) | 0; // Max high nibble

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAP2(ctx);

			expect(ctx.pts.cur[2]!.x).toBe(originalX + 8);
		});
	});

	describe("DELTAP3 - Delta exception point (ppem 32-47 + deltaBase)", () => {
		test("applies delta at higher offset range", () => {
			const ctx = createTestContext();
			ctx.ppem = 44; // 44 = 9 + 32 + 3
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const originalX = ctx.pts.cur[2]!.x;

			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAP3(ctx);

			expect(ctx.pts.cur[2]!.x).toBe(originalX + 8);
		});

		test("covers ppem range 32-47", () => {
			const ctx = createTestContext();
			ctx.ppem = 56; // 56 = 9 + 32 + 15
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const originalX = ctx.pts.cur[2]!.x;

			const argByte = (15 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAP3(ctx);

			expect(ctx.pts.cur[2]!.x).toBe(originalX + 8);
		});
	});

	describe("DELTAC1 - Delta exception CVT (ppem 0-15 + deltaBase)", () => {
		test("applies delta to CVT value", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.cvt[3] = 1000;

			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 3; // CVT index
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAC1(ctx);

			expect(ctx.cvt[3]).toBe(1008); // 1000 + 8
		});

		test("applies negative delta to CVT", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.cvt[3] = 1000;

			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const argByte = (3 << 4) | 8; // -8

			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAC1(ctx);

			expect(ctx.cvt[3]).toBe(992); // 1000 - 8
		});

		test("processes multiple CVT deltas", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.cvt[1] = 100;
			ctx.cvt[2] = 200;
			ctx.cvt[3] = 300;

			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 2;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 3; // Count

			DELTAC1(ctx);

			expect(ctx.cvt[1]).toBe(108);
			expect(ctx.cvt[2]).toBe(208);
			expect(ctx.cvt[3]).toBe(308);
		});

		test("skips at non-matching ppem", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.cvt[3] = 1000;

			ctx.ppem = 16; // Doesn't match target
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const argByte = (3 << 4) | 0; // Target ppem = 12

			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAC1(ctx);

			expect(ctx.cvt[3]).toBe(1000); // Unchanged
		});

		test("sets error for invalid CVT index", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;

			ctx.stack[ctx.stackTop++] = 999; // Invalid CVT index
			ctx.stack[ctx.stackTop++] = (3 << 4) | 0;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAC1(ctx);

			expect(ctx.error).toContain("invalid CVT index");
		});

		test("handles edge CVT indices", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.cvt[0] = 500;
			ctx.cvt[9] = 900;

			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const argByte = (3 << 4) | 0;

			// Test first CVT entry
			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAC1(ctx);

			expect(ctx.cvt[0]).toBe(508);

			// Test last CVT entry
			ctx.stackTop = 0;
			ctx.stack[ctx.stackTop++] = 9;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAC1(ctx);

			expect(ctx.cvt[9]).toBe(908);
		});
	});

	describe("DELTAC2 - Delta exception CVT (ppem 16-31 + deltaBase)", () => {
		test("applies delta to CVT at offset range", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.cvt[3] = 1000;

			ctx.ppem = 28; // 28 = 9 + 16 + 3
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAC2(ctx);

			expect(ctx.cvt[3]).toBe(1008);
		});
	});

	describe("DELTAC3 - Delta exception CVT (ppem 32-47 + deltaBase)", () => {
		test("applies delta to CVT at higher offset range", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array(10);
			ctx.cvtSize = 10;
			ctx.cvt[3] = 1000;

			ctx.ppem = 44; // 44 = 9 + 32 + 3
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			const argByte = (3 << 4) | 0;

			ctx.stack[ctx.stackTop++] = 3;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;

			DELTAC3(ctx);

			expect(ctx.cvt[3]).toBe(1008);
		});
	});

	describe("practical scenarios", () => {
		test("combined DELTAP for specific sizes", () => {
			// Common pattern: adjust stem width at specific sizes
			const ctx = createTestContext();
			ctx.ppem = 12;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			// Stem points
			ctx.pts.cur[0] = { x: 100, y: 0 };
			ctx.pts.cur[1] = { x: 164, y: 0 }; // 1 pixel wide stem

			// Adjust both sides to make stem slightly wider
			const argByte = (3 << 4) | 0; // +8 (1/8 pixel)

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = argByte | 8; // -8
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = argByte; // +8
			ctx.stack[ctx.stackTop++] = 2;

			DELTAP1(ctx);

			expect(ctx.pts.cur[0]!.x).toBe(92);  // Moved left
			expect(ctx.pts.cur[1]!.x).toBe(172); // Moved right
		});

		test("CVT fine-tuning for specific sizes", () => {
			const ctx = createTestContext();
			ctx.cvt = new Int32Array([100, 200, 300, 400]);
			ctx.cvtSize = 4;

			ctx.ppem = 16;
			ctx.GS.deltaBase = 9;
			ctx.GS.deltaShift = 3;

			// Adjust multiple CVT values for this size
			// ppem 16 = deltaBase 9 + offset 16 + nibble -9 = error, use DELTAP1 with nibble 7
			ctx.ppem = 16; // Use 16 = 9 + 0 + 7 for DELTAP1

			const argByte = (7 << 4) | 1; // +16

			ctx.stack[ctx.stackTop++] = 0;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 1;
			ctx.stack[ctx.stackTop++] = argByte;
			ctx.stack[ctx.stackTop++] = 2;

			DELTAC1(ctx);

			expect(ctx.cvt[0]).toBe(116);
			expect(ctx.cvt[1]).toBe(216);
		});
	});
});
