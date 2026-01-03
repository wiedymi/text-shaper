/**
 * Arithmetic and logic instructions
 */

import type { ExecContext } from "../types.ts";

function mulDiv(a: number, b: number, c: number): number {
	if (c === 0) return a ^ b < 0 ? -0x7fffffff : 0x7fffffff;

	let sign = 1;
	if (a < 0) {
		a = -a;
		sign = -sign;
	}
	if (b < 0) {
		b = -b;
		sign = -sign;
	}
	if (c < 0) {
		c = -c;
		sign = -sign;
	}

	const result = Math.floor((a * b + (c >> 1)) / c);
	return sign < 0 ? -result : result;
}

function mulDivNoRound(a: number, b: number, c: number): number {
	if (c === 0) return a ^ b < 0 ? -0x7fffffff : 0x7fffffff;

	let sign = 1;
	if (a < 0) {
		a = -a;
		sign = -sign;
	}
	if (b < 0) {
		b = -b;
		sign = -sign;
	}
	if (c < 0) {
		c = -c;
		sign = -sign;
	}

	const result = Math.floor((a * b) / c);
	return sign < 0 ? -result : result;
}

/** ADD - Add top two values */
export function ADD(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "ADD: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a + b;
}

/** SUB - Subtract top two values */
export function SUB(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "SUB: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a - b;
}

/** DIV - Divide (26.6 fixed-point) */
export function DIV(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "DIV: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}

	if (b === 0) {
		ctx.error = "DIV: division by zero";
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}

	// Result is (a * 64) / b for 26.6 precision (rounded)
	ctx.stack[ctx.stackTop++] = mulDiv(a, 64, b);
}

/** MUL - Multiply (26.6 fixed-point) */
export function MUL(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "MUL: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}

	// Result is (a * b) / 64 for 26.6 precision (rounded)
	ctx.stack[ctx.stackTop++] = mulDiv(a, b, 64);
}

/** ABS - Absolute value */
export function ABS(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1];
	if (val === undefined) {
		ctx.error = "ABS: stack underflow";
		return;
	}
	ctx.stack[ctx.stackTop - 1] = val < 0 ? -val : val;
}

/** NEG - Negate */
export function NEG(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1];
	if (val === undefined) {
		ctx.error = "NEG: stack underflow";
		return;
	}
	ctx.stack[ctx.stackTop - 1] = -val;
}

/** FLOOR - Floor to 26.6 integer (multiple of 64) */
export function FLOOR(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1];
	if (val === undefined) {
		ctx.error = "FLOOR: stack underflow";
		return;
	}
	ctx.stack[ctx.stackTop - 1] = val & ~63;
}

/** CEILING - Ceiling to 26.6 integer (multiple of 64) */
export function CEILING(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1];
	if (val === undefined) {
		ctx.error = "CEILING: stack underflow";
		return;
	}
	ctx.stack[ctx.stackTop - 1] = (val + 63) & ~63;
}

/** MAX - Maximum of top two */
export function MAX(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "MAX: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a > b ? a : b;
}

/** MIN - Minimum of top two */
export function MIN(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "MIN: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a < b ? a : b;
}

// Comparison instructions

/** LT - Less than */
export function LT(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "LT: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a < b ? 1 : 0;
}

/** LTEQ - Less than or equal */
export function LTEQ(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "LTEQ: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a <= b ? 1 : 0;
}

/** GT - Greater than */
export function GT(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "GT: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a > b ? 1 : 0;
}

/** GTEQ - Greater than or equal */
export function GTEQ(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "GTEQ: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a >= b ? 1 : 0;
}

/** EQ - Equal */
export function EQ(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "EQ: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a === b ? 1 : 0;
}

/** NEQ - Not equal */
export function NEQ(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "NEQ: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a !== b ? 1 : 0;
}

/** ODD - Test if odd (after rounding to pixels) */
export function ODD(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1];
	if (val === undefined) {
		ctx.error = "ODD: stack underflow";
		return;
	}
	// Round to nearest pixel and test bit 6
	const rounded = (val + 32) & ~63;
	ctx.stack[ctx.stackTop - 1] = rounded & 64 ? 1 : 0;
}

/** EVEN - Test if even (after rounding to pixels) */
export function EVEN(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1];
	if (val === undefined) {
		ctx.error = "EVEN: stack underflow";
		return;
	}
	// Round to nearest pixel and test bit 6
	const rounded = (val + 32) & ~63;
	ctx.stack[ctx.stackTop - 1] = rounded & 64 ? 0 : 1;
}

// Logic instructions

/** AND - Logical AND */
export function AND(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "AND: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a && b ? 1 : 0;
}

/** OR - Logical OR */
export function OR(ctx: ExecContext): void {
	const b = ctx.stack[--ctx.stackTop];
	const a = ctx.stack[--ctx.stackTop];
	if (a === undefined || b === undefined) {
		ctx.error = "OR: stack underflow";
		ctx.stackTop += 2;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = a || b ? 1 : 0;
}

/** NOT - Logical NOT */
export function NOT(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1];
	if (val === undefined) {
		ctx.error = "NOT: stack underflow";
		return;
	}
	ctx.stack[ctx.stackTop - 1] = val ? 0 : 1;
}
