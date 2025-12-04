/**
 * TrueType Bytecode Interpreter
 *
 * Main dispatch loop for executing TrueType hinting instructions.
 */

import {
	ABS,
	ADD,
	AND,
	CEILING,
	DIV,
	EQ,
	EVEN,
	FLOOR,
	GT,
	GTEQ,
	LT,
	LTEQ,
	MAX,
	MIN,
	MUL,
	NEG,
	NEQ,
	NOT,
	ODD,
	OR,
	SUB,
} from "./instructions/arithmetic.ts";
import {
	CALL,
	EIF,
	ELSE,
	ENDF,
	FDEF,
	IDEF,
	IF,
	JMPR,
	JROF,
	JROT,
	LOOPCALL,
} from "./instructions/control-flow.ts";
import {
	DELTAC1,
	DELTAC2,
	DELTAC3,
	DELTAP1,
	DELTAP2,
	DELTAP3,
} from "./instructions/delta.ts";
import {
	FLIPOFF,
	FLIPON,
	GETINFO,
	GFV,
	GPV,
	INSTCTRL,
	RCVT,
	RDTG,
	ROFF,
	RS,
	RTDG,
	RTG,
	RTHG,
	RUTG,
	S45ROUND,
	SCANCTRL,
	SCANTYPE,
	SCVTCI,
	SDB,
	SDPVTL,
	SDS,
	SFVFS,
	SFVTCA,
	SFVTL,
	SFVTPV,
	SLOOP,
	SMD,
	SPVFS,
	SPVTCA,
	SPVTL,
	SROUND,
	SRP0,
	SRP1,
	SRP2,
	SSW,
	SSWCI,
	SVTCA,
	SZP0,
	SZP1,
	SZP2,
	SZPS,
	UTP,
	WCVTF,
	WCVTP,
	WS,
} from "./instructions/graphics-state.ts";
import { IUP_X, IUP_Y } from "./instructions/interpolate.ts";

import {
	ALIGNPTS,
	ALIGNRP,
	FLIPPT,
	FLIPRGOFF,
	FLIPRGON,
	GC,
	IP,
	ISECT,
	MD,
	MDAP,
	MDRP,
	MIAP,
	MIRP,
	MPPEM,
	MPS,
	MSIRP,
	NROUND,
	ROUND,
	SCFS,
	SHC,
	SHP,
	SHPIX,
	SHZ,
} from "./instructions/points.ts";
// Import instruction implementations
import {
	CINDEX,
	CLEAR,
	DEPTH,
	DUP,
	MINDEX,
	NPUSHB,
	NPUSHW,
	POP,
	PUSHB,
	PUSHW,
	ROLL,
	SWAP,
} from "./instructions/stack.ts";
import { CodeRange, type ExecContext, Opcode } from "./types.ts";

/**
 * Execute bytecode from the current instruction pointer
 */
export function execute(ctx: ExecContext): void {
	while (ctx.IP < ctx.codeSize && ctx.error === null) {
		// Check instruction limit
		if (++ctx.instructionCount > ctx.maxInstructions) {
			ctx.error = "Instruction limit exceeded (possible infinite loop)";
			return;
		}

		const opcode = ctx.code[ctx.IP++];
		ctx.opcode = opcode;

		executeOpcode(ctx, opcode);
	}
}

/**
 * Execute a single opcode
 */
function executeOpcode(ctx: ExecContext, opcode: number): void {
	// Handle PUSHB[n] (0xB0-0xB7)
	if (opcode >= 0xb0 && opcode <= 0xb7) {
		PUSHB(ctx, opcode - 0xb0 + 1);
		return;
	}

	// Handle PUSHW[n] (0xB8-0xBF)
	if (opcode >= 0xb8 && opcode <= 0xbf) {
		PUSHW(ctx, opcode - 0xb8 + 1);
		return;
	}

	// Handle MDRP[flags] (0xC0-0xDF)
	if (opcode >= 0xc0 && opcode <= 0xdf) {
		MDRP(ctx, opcode & 0x1f);
		return;
	}

	// Handle MIRP[flags] (0xE0-0xFF)
	if (opcode >= 0xe0 && opcode <= 0xff) {
		MIRP(ctx, opcode & 0x1f);
		return;
	}

	switch (opcode) {
		// Vector setting
		case Opcode.SVTCA_Y:
			SVTCA(ctx, 0);
			break;
		case Opcode.SVTCA_X:
			SVTCA(ctx, 1);
			break;
		case Opcode.SPVTCA_Y:
			SPVTCA(ctx, 0);
			break;
		case Opcode.SPVTCA_X:
			SPVTCA(ctx, 1);
			break;
		case Opcode.SFVTCA_Y:
			SFVTCA(ctx, 0);
			break;
		case Opcode.SFVTCA_X:
			SFVTCA(ctx, 1);
			break;
		case Opcode.SPVTL_0:
			SPVTL(ctx, false);
			break;
		case Opcode.SPVTL_1:
			SPVTL(ctx, true);
			break;
		case Opcode.SFVTL_0:
			SFVTL(ctx, false);
			break;
		case Opcode.SFVTL_1:
			SFVTL(ctx, true);
			break;
		case Opcode.SDPVTL_0:
			SDPVTL(ctx, false);
			break;
		case Opcode.SDPVTL_1:
			SDPVTL(ctx, true);
			break;
		case Opcode.SPVFS:
			SPVFS(ctx);
			break;
		case Opcode.SFVFS:
			SFVFS(ctx);
			break;
		case Opcode.GPV:
			GPV(ctx);
			break;
		case Opcode.GFV:
			GFV(ctx);
			break;
		case Opcode.SFVTPV:
			SFVTPV(ctx);
			break;
		case Opcode.ISECT:
			ISECT(ctx);
			break;

		// Reference points
		case Opcode.SRP0:
			SRP0(ctx);
			break;
		case Opcode.SRP1:
			SRP1(ctx);
			break;
		case Opcode.SRP2:
			SRP2(ctx);
			break;

		// Zone pointers
		case Opcode.SZP0:
			SZP0(ctx);
			break;
		case Opcode.SZP1:
			SZP1(ctx);
			break;
		case Opcode.SZP2:
			SZP2(ctx);
			break;
		case Opcode.SZPS:
			SZPS(ctx);
			break;

		// Loop and other GS
		case Opcode.SLOOP:
			SLOOP(ctx);
			break;
		case Opcode.RTG:
			RTG(ctx);
			break;
		case Opcode.RTHG:
			RTHG(ctx);
			break;
		case Opcode.SMD:
			SMD(ctx);
			break;
		case Opcode.ELSE:
			ELSE(ctx);
			break;
		case Opcode.JMPR:
			JMPR(ctx);
			break;
		case Opcode.SCVTCI:
			SCVTCI(ctx);
			break;
		case Opcode.SSWCI:
			SSWCI(ctx);
			break;
		case Opcode.SSW:
			SSW(ctx);
			break;

		// Stack operations
		case Opcode.DUP:
			DUP(ctx);
			break;
		case Opcode.POP:
			POP(ctx);
			break;
		case Opcode.CLEAR:
			CLEAR(ctx);
			break;
		case Opcode.SWAP:
			SWAP(ctx);
			break;
		case Opcode.DEPTH:
			DEPTH(ctx);
			break;
		case Opcode.CINDEX:
			CINDEX(ctx);
			break;
		case Opcode.MINDEX:
			MINDEX(ctx);
			break;
		case Opcode.ROLL:
			ROLL(ctx);
			break;

		// Functions
		case Opcode.FDEF:
			FDEF(ctx);
			break;
		case Opcode.ENDF:
			ENDF(ctx);
			break;
		case Opcode.CALL:
			CALL(ctx);
			break;
		case Opcode.LOOPCALL:
			LOOPCALL(ctx);
			break;

		// Point movement
		case Opcode.MDAP_0:
			MDAP(ctx, false);
			break;
		case Opcode.MDAP_1:
			MDAP(ctx, true);
			break;
		case Opcode.IUP_Y:
			IUP_Y(ctx);
			break;
		case Opcode.IUP_X:
			IUP_X(ctx);
			break;
		case Opcode.SHP_0:
			SHP(ctx, false);
			break;
		case Opcode.SHP_1:
			SHP(ctx, true);
			break;
		case Opcode.SHC_0:
			SHC(ctx, false);
			break;
		case Opcode.SHC_1:
			SHC(ctx, true);
			break;
		case Opcode.SHZ_0:
			SHZ(ctx, false);
			break;
		case Opcode.SHZ_1:
			SHZ(ctx, true);
			break;
		case Opcode.SHPIX:
			SHPIX(ctx);
			break;
		case Opcode.IP:
			IP(ctx);
			break;
		case Opcode.MSIRP_0:
			MSIRP(ctx, false);
			break;
		case Opcode.MSIRP_1:
			MSIRP(ctx, true);
			break;
		case Opcode.ALIGNRP:
			ALIGNRP(ctx);
			break;
		case Opcode.ALIGNPTS:
			ALIGNPTS(ctx);
			break;
		case Opcode.UTP:
			UTP(ctx);
			break;
		case Opcode.RTDG:
			RTDG(ctx);
			break;
		case Opcode.MIAP_0:
			MIAP(ctx, false);
			break;
		case Opcode.MIAP_1:
			MIAP(ctx, true);
			break;

		// Push instructions
		case Opcode.NPUSHB:
			NPUSHB(ctx);
			break;
		case Opcode.NPUSHW:
			NPUSHW(ctx);
			break;

		// Storage
		case Opcode.WS:
			WS(ctx);
			break;
		case Opcode.RS:
			RS(ctx);
			break;

		// CVT
		case Opcode.WCVTP:
			WCVTP(ctx);
			break;
		case Opcode.RCVT:
			RCVT(ctx);
			break;

		// Point operations
		case Opcode.GC_0:
			GC(ctx, false);
			break;
		case Opcode.GC_1:
			GC(ctx, true);
			break;
		case Opcode.SCFS:
			SCFS(ctx);
			break;
		case Opcode.MD_0:
			MD(ctx, false);
			break;
		case Opcode.MD_1:
			MD(ctx, true);
			break;
		case Opcode.MPPEM:
			MPPEM(ctx);
			break;
		case Opcode.MPS:
			MPS(ctx);
			break;
		case Opcode.FLIPON:
			FLIPON(ctx);
			break;
		case Opcode.FLIPOFF:
			FLIPOFF(ctx);
			break;
		case Opcode.DEBUG:
			// DEBUG is a no-op
			break;

		// Comparison
		case Opcode.LT:
			LT(ctx);
			break;
		case Opcode.LTEQ:
			LTEQ(ctx);
			break;
		case Opcode.GT:
			GT(ctx);
			break;
		case Opcode.GTEQ:
			GTEQ(ctx);
			break;
		case Opcode.EQ:
			EQ(ctx);
			break;
		case Opcode.NEQ:
			NEQ(ctx);
			break;
		case Opcode.ODD:
			ODD(ctx);
			break;
		case Opcode.EVEN:
			EVEN(ctx);
			break;

		// Control flow
		case Opcode.IF:
			IF(ctx);
			break;
		case Opcode.EIF:
			EIF(ctx);
			break;

		// Logic
		case Opcode.AND:
			AND(ctx);
			break;
		case Opcode.OR:
			OR(ctx);
			break;
		case Opcode.NOT:
			NOT(ctx);
			break;

		// Delta instructions
		case Opcode.DELTAP1:
			DELTAP1(ctx);
			break;
		case Opcode.SDB:
			SDB(ctx);
			break;
		case Opcode.SDS:
			SDS(ctx);
			break;

		// Arithmetic
		case Opcode.ADD:
			ADD(ctx);
			break;
		case Opcode.SUB:
			SUB(ctx);
			break;
		case Opcode.DIV:
			DIV(ctx);
			break;
		case Opcode.MUL:
			MUL(ctx);
			break;
		case Opcode.ABS:
			ABS(ctx);
			break;
		case Opcode.NEG:
			NEG(ctx);
			break;
		case Opcode.FLOOR:
			FLOOR(ctx);
			break;
		case Opcode.CEILING:
			CEILING(ctx);
			break;

		// Rounding
		case Opcode.ROUND_0:
			ROUND(ctx, 0);
			break;
		case Opcode.ROUND_1:
			ROUND(ctx, 1);
			break;
		case Opcode.ROUND_2:
			ROUND(ctx, 2);
			break;
		case Opcode.ROUND_3:
			ROUND(ctx, 3);
			break;
		case Opcode.NROUND_0:
			NROUND(ctx, 0);
			break;
		case Opcode.NROUND_1:
			NROUND(ctx, 1);
			break;
		case Opcode.NROUND_2:
			NROUND(ctx, 2);
			break;
		case Opcode.NROUND_3:
			NROUND(ctx, 3);
			break;

		// CVT font units
		case Opcode.WCVTF:
			WCVTF(ctx);
			break;

		// Delta
		case Opcode.DELTAP2:
			DELTAP2(ctx);
			break;
		case Opcode.DELTAP3:
			DELTAP3(ctx);
			break;
		case Opcode.DELTAC1:
			DELTAC1(ctx);
			break;
		case Opcode.DELTAC2:
			DELTAC2(ctx);
			break;
		case Opcode.DELTAC3:
			DELTAC3(ctx);
			break;

		// Super rounding
		case Opcode.SROUND:
			SROUND(ctx);
			break;
		case Opcode.S45ROUND:
			S45ROUND(ctx);
			break;

		// Jump
		case Opcode.JROT:
			JROT(ctx);
			break;
		case Opcode.JROF:
			JROF(ctx);
			break;

		// Rounding modes
		case Opcode.ROFF:
			ROFF(ctx);
			break;
		case Opcode.RUTG:
			RUTG(ctx);
			break;
		case Opcode.RDTG:
			RDTG(ctx);
			break;

		// Other
		case Opcode.SANGW:
			// SANGW is deprecated (set angle weight), ignore
			ctx.stackTop--;
			break;
		case Opcode.AA:
			// AA (adjust angle) is deprecated, ignore
			ctx.stackTop--;
			break;

		// Flip
		case Opcode.FLIPPT:
			FLIPPT(ctx);
			break;
		case Opcode.FLIPRGON:
			FLIPRGON(ctx);
			break;
		case Opcode.FLIPRGOFF:
			FLIPRGOFF(ctx);
			break;

		// Scan
		case Opcode.SCANCTRL:
			SCANCTRL(ctx);
			break;
		case Opcode.SCANTYPE:
			SCANTYPE(ctx);
			break;

		// Min/Max
		case Opcode.MAX:
			MAX(ctx);
			break;
		case Opcode.MIN:
			MIN(ctx);
			break;

		// Getinfo and instctrl
		case Opcode.GETINFO:
			GETINFO(ctx);
			break;
		case Opcode.IDEF:
			IDEF(ctx);
			break;
		case Opcode.INSTCTRL:
			INSTCTRL(ctx);
			break;

		default:
			// Check for user-defined instruction
			if (opcode < ctx.maxIDefs && ctx.IDefs[opcode]?.active) {
				const def = ctx.IDefs[opcode];

				if (ctx.callStackTop >= ctx.maxCallStack) {
					ctx.error = "IDEF call: call stack overflow";
					return;
				}

				// Push call record
				const call = ctx.callStack[ctx.callStackTop++];
				call.callerIP = ctx.IP;
				call.callerRange = ctx.currentRange;
				call.def = {
					id: opcode,
					start: def.start,
					end: def.end,
					active: true,
					range: def.range,
				};
				call.count = 1;

				// Switch to IDEF's code range
				ctx.currentRange = def.range;
				const range = ctx.codeRanges.get(ctx.currentRange);
				if (range) {
					ctx.code = range.code;
					ctx.codeSize = range.size;
				}
				ctx.IP = def.start;
			} else {
				ctx.error = `Unknown opcode 0x${opcode.toString(16)}`;
			}
	}
}

/**
 * Set up execution context with code range
 */
export function setCodeRange(
	ctx: ExecContext,
	range: CodeRange,
	code: Uint8Array,
): void {
	ctx.codeRanges.set(range, { code, size: code.length });
}

/**
 * Run code in a specific range
 */
export function runProgram(ctx: ExecContext, range: CodeRange): void {
	const codeRange = ctx.codeRanges.get(range);
	if (!codeRange) {
		return;
	}

	ctx.currentRange = range;
	ctx.code = codeRange.code;
	ctx.codeSize = codeRange.size;
	ctx.IP = 0;
	ctx.instructionCount = 0;

	execute(ctx);
}

/**
 * Run the font program (fpgm table)
 */
export function runFontProgram(ctx: ExecContext): void {
	runProgram(ctx, CodeRange.Font);
}

/**
 * Run the CVT program (prep table)
 */
export function runCVTProgram(ctx: ExecContext): void {
	// Reset graphics state to default before prep
	ctx.GS = { ...ctx.defaultGS };
	runProgram(ctx, CodeRange.CVT);
	// Save modified GS as new default for glyphs
	ctx.defaultGS = { ...ctx.GS };
}

/**
 * Run glyph instructions
 */
export function runGlyphProgram(
	ctx: ExecContext,
	instructions: Uint8Array,
): void {
	// Reset graphics state to default
	ctx.GS = { ...ctx.defaultGS };

	// Set up glyph zone pointers
	ctx.zp0 = ctx.pts;
	ctx.zp1 = ctx.pts;
	ctx.zp2 = ctx.pts;

	// Set up glyph code range
	setCodeRange(ctx, CodeRange.Glyph, instructions);
	runProgram(ctx, CodeRange.Glyph);
}
