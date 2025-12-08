/**
 * Stack manipulation instructions
 */

import type { ExecContext } from "../types.ts";

/** DUP - Duplicate top of stack */
export function DUP(ctx: ExecContext): void {
	const val = ctx.stack[ctx.stackTop - 1];
	ctx.stack[ctx.stackTop++] = val;
}

/** POP - Pop top of stack */
export function POP(ctx: ExecContext): void {
	ctx.stackTop--;
}

/** CLEAR - Clear the entire stack */
export function CLEAR(ctx: ExecContext): void {
	ctx.stackTop = 0;
}

/** SWAP - Swap top two elements */
export function SWAP(ctx: ExecContext): void {
	const a = ctx.stack[ctx.stackTop - 1];
	const b = ctx.stack[ctx.stackTop - 2];
	ctx.stack[ctx.stackTop - 1] = b;
	ctx.stack[ctx.stackTop - 2] = a;
}

/** DEPTH - Push stack depth */
export function DEPTH(ctx: ExecContext): void {
	const depth = ctx.stackTop;
	ctx.stack[ctx.stackTop++] = depth;
}

/** CINDEX - Copy indexed element to top */
export function CINDEX(ctx: ExecContext): void {
	const index = ctx.stack[--ctx.stackTop];
	if (index <= 0 || index > ctx.stackTop) {
		ctx.error = `CINDEX: invalid index ${index}`;
		return;
	}
	const val = ctx.stack[ctx.stackTop - index];
	ctx.stack[ctx.stackTop++] = val;
}

/** MINDEX - Move indexed element to top */
export function MINDEX(ctx: ExecContext): void {
	const index = ctx.stack[--ctx.stackTop];
	if (index <= 0 || index > ctx.stackTop) {
		ctx.error = `MINDEX: invalid index ${index}`;
		return;
	}

	const val = ctx.stack[ctx.stackTop - index];

	// Shift elements down
	for (let i = ctx.stackTop - index; i < ctx.stackTop - 1; i++) {
		ctx.stack[i] = ctx.stack[i + 1];
	}

	ctx.stack[ctx.stackTop - 1] = val;
}

/** ROLL - Roll top three elements */
export function ROLL(ctx: ExecContext): void {
	const a = ctx.stack[ctx.stackTop - 1];
	const b = ctx.stack[ctx.stackTop - 2];
	const c = ctx.stack[ctx.stackTop - 3];

	ctx.stack[ctx.stackTop - 1] = c;
	ctx.stack[ctx.stackTop - 2] = a;
	ctx.stack[ctx.stackTop - 3] = b;
}

/** Push byte(s) from instruction stream */
export function PUSHB(ctx: ExecContext, count: number): void {
	for (let i = 0; i < count; i++) {
		ctx.stack[ctx.stackTop++] = ctx.code[ctx.IP++];
	}
}

/** Push word(s) from instruction stream */
export function PUSHW(ctx: ExecContext, count: number): void {
	for (let i = 0; i < count; i++) {
		const hi = ctx.code[ctx.IP++];
		const lo = ctx.code[ctx.IP++];
		// Sign extend
		let val = (hi << 8) | lo;
		if (val >= 0x8000) val -= 0x10000;
		ctx.stack[ctx.stackTop++] = val;
	}
}

/** NPUSHB - Push N bytes */
export function NPUSHB(ctx: ExecContext): void {
	const n = ctx.code[ctx.IP++];
	PUSHB(ctx, n);
}

/** NPUSHW - Push N words */
export function NPUSHW(ctx: ExecContext): void {
	const n = ctx.code[ctx.IP++];
	PUSHW(ctx, n);
}
