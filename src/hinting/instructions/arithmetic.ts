/**
 * Arithmetic and logic instructions
 */

import type { ExecContext } from "../types.ts";

/** ADD - Add top two values */
export function ADD(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a + b;
}

/** SUB - Subtract top two values */
export function SUB(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a - b;
}

/** DIV - Divide (26.6 fixed-point) */
export function DIV(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;

	if (b === 0) {
		ctx.error = "DIV: division by zero";
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}

	// Result is (a * 64) / b for 26.6 precision
	ctx.stack[ctx.stackTop++] = Math.trunc((a * 64) / b);
}

/** MUL - Multiply (26.6 fixed-point) */
export function MUL(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;

	// Result is (a * b) / 64 for 26.6 precision
	ctx.stack[ctx.stackTop++] = Math.trunc((a * b) / 64);
}

/** ABS - Absolute value */
export function ABS(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1]!;
	ctx.stack[ctx.stackTop - 1] = val < 0 ? -val : val;
}

/** NEG - Negate */
export function NEG(ctx: ExecContext): void {
	ctx.stack[ctx.stackTop - 1] = -ctx.stack[ctx.stackTop - 1]!;
}

/** FLOOR - Floor to 26.6 integer (multiple of 64) */
export function FLOOR(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1]!;
	ctx.stack[ctx.stackTop - 1] = val & ~63;
}

/** CEILING - Ceiling to 26.6 integer (multiple of 64) */
export function CEILING(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1]!;
	ctx.stack[ctx.stackTop - 1] = (val + 63) & ~63;
}

/** MAX - Maximum of top two */
export function MAX(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a > b ? a : b;
}

/** MIN - Minimum of top two */
export function MIN(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a < b ? a : b;
}

// Comparison instructions

/** LT - Less than */
export function LT(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a < b ? 1 : 0;
}

/** LTEQ - Less than or equal */
export function LTEQ(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a <= b ? 1 : 0;
}

/** GT - Greater than */
export function GT(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a > b ? 1 : 0;
}

/** GTEQ - Greater than or equal */
export function GTEQ(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a >= b ? 1 : 0;
}

/** EQ - Equal */
export function EQ(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a === b ? 1 : 0;
}

/** NEQ - Not equal */
export function NEQ(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a !== b ? 1 : 0;
}

/** ODD - Test if odd (after rounding to pixels) */
export function ODD(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1]!;
	// Round to nearest pixel and test bit 6
	const rounded = (val + 32) & ~63;
	ctx.stack[ctx.stackTop - 1] = (rounded & 64) ? 1 : 0;
}

/** EVEN - Test if even (after rounding to pixels) */
export function EVEN(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1]!;
	// Round to nearest pixel and test bit 6
	const rounded = (val + 32) & ~63;
	ctx.stack[ctx.stackTop - 1] = (rounded & 64) ? 0 : 1;
}

// Logic instructions

/** AND - Logical AND */
export function AND(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a && b ? 1 : 0;
}

/** OR - Logical OR */
export function OR(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop]!;
	const a = ctx.stack[--ctx.stackTop]!;
	ctx.stack[ctx.stackTop++] = a || b ? 1 : 0;
}

/** NOT - Logical NOT */
export function NOT(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1]!;
	ctx.stack[ctx.stackTop - 1] = val ? 0 : 1;
}
