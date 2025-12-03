/**
 * Control flow instructions
 */

import { type ExecContext, type FunctionDef, CodeRange } from "../types.ts";

/** IF - Conditional branch */
export function IF(ctx: ExecContext): void {
	const condition = ctx.stack[--ctx.stackTop]!;

	if (condition) {
		// Continue execution (true branch)
		return;
	}

	// Skip to ELSE or EIF
	let depth = 1;

	while (ctx.IP < ctx.codeSize) {
		const opcode = ctx.code[ctx.IP++]!;

		switch (opcode) {
			case 0x58: // IF
				depth++;
				break;
			case 0x1b: // ELSE
				if (depth === 1) {
					// Found matching ELSE, continue from here
					return;
				}
				break;
			case 0x59: // EIF
				depth--;
				if (depth === 0) {
					return;
				}
				break;
			// Skip push instructions
			case 0x40: // NPUSHB
				ctx.IP += 1 + ctx.code[ctx.IP]!;
				break;
			case 0x41: // NPUSHW
				ctx.IP += 1 + ctx.code[ctx.IP]! * 2;
				break;
			default:
				if (opcode >= 0xb0 && opcode <= 0xb7) {
					// PUSHB[n]
					ctx.IP += (opcode - 0xb0) + 1;
				} else if (opcode >= 0xb8 && opcode <= 0xbf) {
					// PUSHW[n]
					ctx.IP += ((opcode - 0xb8) + 1) * 2;
				}
		}
	}

	ctx.error = "IF: missing EIF";
}

/** ELSE - Alternative branch */
export function ELSE(ctx: ExecContext): void {
	// We're in the true branch and hit ELSE, skip to EIF
	let depth = 1;

	while (ctx.IP < ctx.codeSize) {
		const opcode = ctx.code[ctx.IP++]!;

		switch (opcode) {
			case 0x58: // IF
				depth++;
				break;
			case 0x59: // EIF
				depth--;
				if (depth === 0) {
					return;
				}
				break;
			case 0x40: // NPUSHB
				ctx.IP += 1 + ctx.code[ctx.IP]!;
				break;
			case 0x41: // NPUSHW
				ctx.IP += 1 + ctx.code[ctx.IP]! * 2;
				break;
			default:
				if (opcode >= 0xb0 && opcode <= 0xb7) {
					ctx.IP += (opcode - 0xb0) + 1;
				} else if (opcode >= 0xb8 && opcode <= 0xbf) {
					ctx.IP += ((opcode - 0xb8) + 1) * 2;
				}
		}
	}

	ctx.error = "ELSE: missing EIF";
}

/** EIF - End IF */
export function EIF(_ctx: ExecContext): void {
	// Nothing to do - just a marker
}

/** JMPR - Jump relative */
export function JMPR(ctx: ExecContext): void {
	const offset = ctx.stack[--ctx.stackTop]!;
	ctx.IP += offset - 1; // -1 because IP was already incremented
}

/** JROT - Jump relative on true */
export function JROT(ctx: ExecContext): void {
	const condition = ctx.stack[--ctx.stackTop]!;
	const offset = ctx.stack[--ctx.stackTop]!;

	if (condition) {
		ctx.IP += offset - 1;
	}
}

/** JROF - Jump relative on false */
export function JROF(ctx: ExecContext): void {
	const condition = ctx.stack[--ctx.stackTop]!;
	const offset = ctx.stack[--ctx.stackTop]!;

	if (!condition) {
		ctx.IP += offset - 1;
	}
}

/** FDEF - Define function */
export function FDEF(ctx: ExecContext): void {
	const funcNum = ctx.stack[--ctx.stackTop]!;

	if (funcNum < 0 || funcNum >= ctx.maxFDefs) {
		ctx.error = `FDEF: invalid function number ${funcNum}`;
		return;
	}

	const def = ctx.FDefs[funcNum]!;
	def.id = funcNum;
	def.start = ctx.IP;
	def.active = true;
	def.range = ctx.currentRange;

	// Skip to ENDF
	while (ctx.IP < ctx.codeSize) {
		const opcode = ctx.code[ctx.IP++]!;

		if (opcode === 0x2d) {
			// ENDF
			def.end = ctx.IP;
			return;
		}

		// Skip push instructions
		if (opcode === 0x40) {
			ctx.IP += 1 + ctx.code[ctx.IP]!;
		} else if (opcode === 0x41) {
			ctx.IP += 1 + ctx.code[ctx.IP]! * 2;
		} else if (opcode >= 0xb0 && opcode <= 0xb7) {
			ctx.IP += (opcode - 0xb0) + 1;
		} else if (opcode >= 0xb8 && opcode <= 0xbf) {
			ctx.IP += ((opcode - 0xb8) + 1) * 2;
		}
	}

	ctx.error = "FDEF: missing ENDF";
}

/** ENDF - End function definition */
export function ENDF(ctx: ExecContext): void {
	// Called when returning from function call
	if (ctx.callStackTop <= 0) {
		ctx.error = "ENDF: not in function call";
		return;
	}

	const call = ctx.callStack[ctx.callStackTop - 1]!;

	// Decrement loop count for LOOPCALL
	call.count--;

	if (call.count > 0) {
		// Loop again
		ctx.IP = call.def.start;
	} else {
		// Return to caller
		ctx.callStackTop--;
		ctx.IP = call.callerIP;
		ctx.currentRange = call.callerRange;

		// Restore code pointer
		const range = ctx.codeRanges.get(ctx.currentRange);
		if (range) {
			ctx.code = range.code;
			ctx.codeSize = range.size;
		}
	}
}

/** CALL - Call function */
export function CALL(ctx: ExecContext): void {
	const funcNum = ctx.stack[--ctx.stackTop]!;

	if (funcNum < 0 || funcNum >= ctx.maxFDefs) {
		ctx.error = `CALL: invalid function number ${funcNum}`;
		return;
	}

	const def = ctx.FDefs[funcNum]!;
	if (!def.active) {
		ctx.error = `CALL: function ${funcNum} not defined`;
		return;
	}

	if (ctx.callStackTop >= ctx.maxCallStack) {
		ctx.error = "CALL: call stack overflow";
		return;
	}

	// Push call record
	const call = ctx.callStack[ctx.callStackTop++]!;
	call.callerIP = ctx.IP;
	call.callerRange = ctx.currentRange;
	call.def = def;
	call.count = 1;

	// Switch to function's code range
	ctx.currentRange = def.range;
	const range = ctx.codeRanges.get(ctx.currentRange);
	if (range) {
		ctx.code = range.code;
		ctx.codeSize = range.size;
	}
	ctx.IP = def.start;
}

/** LOOPCALL - Call function with loop count */
export function LOOPCALL(ctx: ExecContext): void {
	const funcNum = ctx.stack[--ctx.stackTop]!;
	const count = ctx.stack[--ctx.stackTop]!;

	if (funcNum < 0 || funcNum >= ctx.maxFDefs) {
		ctx.error = `LOOPCALL: invalid function number ${funcNum}`;
		return;
	}

	const def = ctx.FDefs[funcNum]!;
	if (!def.active) {
		ctx.error = `LOOPCALL: function ${funcNum} not defined`;
		return;
	}

	if (count <= 0) {
		return; // Nothing to do
	}

	if (ctx.callStackTop >= ctx.maxCallStack) {
		ctx.error = "LOOPCALL: call stack overflow";
		return;
	}

	// Push call record
	const call = ctx.callStack[ctx.callStackTop++]!;
	call.callerIP = ctx.IP;
	call.callerRange = ctx.currentRange;
	call.def = def;
	call.count = count;

	// Switch to function's code range
	ctx.currentRange = def.range;
	const range = ctx.codeRanges.get(ctx.currentRange);
	if (range) {
		ctx.code = range.code;
		ctx.codeSize = range.size;
	}
	ctx.IP = def.start;
}

/** IDEF - Define instruction */
export function IDEF(ctx: ExecContext): void {
	const opcode = ctx.stack[--ctx.stackTop]!;

	if (opcode < 0 || opcode >= ctx.maxIDefs) {
		ctx.error = `IDEF: invalid opcode ${opcode}`;
		return;
	}

	const def = ctx.IDefs[opcode]!;
	def.opcode = opcode;
	def.start = ctx.IP;
	def.active = true;
	def.range = ctx.currentRange;

	// Skip to ENDF
	while (ctx.IP < ctx.codeSize) {
		const op = ctx.code[ctx.IP++]!;

		if (op === 0x2d) {
			// ENDF
			def.end = ctx.IP;
			return;
		}

		// Skip push instructions
		if (op === 0x40) {
			ctx.IP += 1 + ctx.code[ctx.IP]!;
		} else if (op === 0x41) {
			ctx.IP += 1 + ctx.code[ctx.IP]! * 2;
		} else if (op >= 0xb0 && op <= 0xb7) {
			ctx.IP += (op - 0xb0) + 1;
		} else if (op >= 0xb8 && op <= 0xbf) {
			ctx.IP += ((op - 0xb8) + 1) * 2;
		}
	}

	ctx.error = "IDEF: missing ENDF";
}
