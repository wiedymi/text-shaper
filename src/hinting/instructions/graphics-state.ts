/**
 * Graphics state manipulation instructions
 */

import { parseSuperRound } from "../rounding.ts";
import { scaleFUnits } from "../scale.ts";
import {
	type ExecContext,
	CodeRange,
	RoundMode,
	TouchFlag,
	type UnitVector,
} from "../types.ts";

// Vector instructions

/** SVTCA - Set vectors to coordinate axis (both projection and freedom) */
export function SVTCA(ctx: ExecContext, axis: 0 | 1): void {
	if (axis === 0) {
		// Y axis
		ctx.GS.projVector = { x: 0, y: 0x4000 };
		ctx.GS.freeVector = { x: 0, y: 0x4000 };
		ctx.GS.dualVector = { x: 0, y: 0x4000 };
	} else {
		// X axis
		ctx.GS.projVector = { x: 0x4000, y: 0 };
		ctx.GS.freeVector = { x: 0x4000, y: 0 };
		ctx.GS.dualVector = { x: 0x4000, y: 0 };
	}
}

/** SPVTCA - Set projection vector to coordinate axis */
export function SPVTCA(ctx: ExecContext, axis: 0 | 1): void {
	if (axis === 0) {
		ctx.GS.projVector = { x: 0, y: 0x4000 };
		ctx.GS.dualVector = { x: 0, y: 0x4000 };
	} else {
		ctx.GS.projVector = { x: 0x4000, y: 0 };
		ctx.GS.dualVector = { x: 0x4000, y: 0 };
	}
}

/** SFVTCA - Set freedom vector to coordinate axis */
export function SFVTCA(ctx: ExecContext, axis: 0 | 1): void {
	if (axis === 0) {
		ctx.GS.freeVector = { x: 0, y: 0x4000 };
	} else {
		ctx.GS.freeVector = { x: 0x4000, y: 0 };
	}
}

/** Calculate unit vector from two points */
function vectorFromPoints(
	ctx: ExecContext,
	p1: number,
	p2: number,
	zone1: number,
	zone2: number,
	useOriginal: boolean,
): { vec: UnitVector; isZero: boolean } {
	const z1 = zone1 === 0 ? ctx.twilight : ctx.pts;
	const z2 = zone2 === 0 ? ctx.twilight : ctx.pts;

	const pt1 = useOriginal ? z1.org[p1] : z1.cur[p1];
	const pt2 = useOriginal ? z2.org[p2] : z2.cur[p2];

	if (!pt1 || !pt2) {
		return { vec: { x: 0x4000, y: 0 }, isZero: true };
	}

	// Match FreeType: vector is p1 - p2 (zp1 - zp2).
	const dx = pt1.x - pt2.x;
	const dy = pt1.y - pt2.y;

	if (dx === 0 && dy === 0) {
		return { vec: { x: 0x4000, y: 0 }, isZero: true };
	}

	const len = Math.sqrt(dx * dx + dy * dy);
	if (len === 0) {
		return { vec: { x: 0x4000, y: 0 }, isZero: true };
	}

	return {
		vec: {
			x: Math.round((dx / len) * 0x4000),
			y: Math.round((dy / len) * 0x4000),
		},
		isZero: false,
	};
}

/** SPVTL - Set projection vector to line */
export function SPVTL(ctx: ExecContext, perpendicular: boolean): void {
	const p2 = ctx.stack[--ctx.stackTop];
	const p1 = ctx.stack[--ctx.stackTop];

	// FreeType: args[0] from zp1, args[1] from zp2 -> vector = zp1[p2] - zp2[p1]
	const { vec: proj, isZero } = vectorFromPoints(
		ctx,
		p2,
		p1,
		ctx.GS.gep1,
		ctx.GS.gep2,
		false,
	);

	if (perpendicular && !isZero) {
		// Rotate 90 degrees counter-clockwise: (x, y) -> (-y, x)
		const tempProj = proj.x;
		proj.x = -proj.y;
		proj.y = tempProj;
	}

	ctx.GS.projVector = proj;
	ctx.GS.dualVector = { ...proj };
}

/** SFVTL - Set freedom vector to line */
export function SFVTL(ctx: ExecContext, perpendicular: boolean): void {
	const p2 = ctx.stack[--ctx.stackTop];
	const p1 = ctx.stack[--ctx.stackTop];

	const { vec, isZero } = vectorFromPoints(
		ctx,
		p2,
		p1,
		ctx.GS.gep1,
		ctx.GS.gep2,
		false,
	);

	if (perpendicular && !isZero) {
		const temp = vec.x;
		vec.x = -vec.y;
		vec.y = temp;
	}

	ctx.GS.freeVector = vec;
}

/** SDPVTL - Set dual projection vector to line (only sets dualVector, not projVector) */
export function SDPVTL(ctx: ExecContext, perpendicular: boolean): void {
	const p2 = ctx.stack[--ctx.stackTop];
	const p1 = ctx.stack[--ctx.stackTop];

	// SDPVTL uses original points for dual vector and current points for proj.
	const dual = vectorFromPoints(ctx, p2, p1, ctx.GS.gep1, ctx.GS.gep2, true);
	const proj = vectorFromPoints(ctx, p2, p1, ctx.GS.gep1, ctx.GS.gep2, false);

	if (perpendicular && !dual.isZero) {
		const temp = dual.vec.x;
		dual.vec.x = -dual.vec.y;
		dual.vec.y = temp;
	}
	if (perpendicular && !proj.isZero) {
		const temp = proj.vec.x;
		proj.vec.x = -proj.vec.y;
		proj.vec.y = temp;
	}

	ctx.GS.dualVector = dual.vec;
	ctx.GS.projVector = proj.vec;
}

/** SPVFS - Set projection vector from stack */
export function SPVFS(ctx: ExecContext): void {
	const y = ctx.stack[--ctx.stackTop];
	const x = ctx.stack[--ctx.stackTop];

	// Normalize
	const len = Math.sqrt(x * x + y * y);
	if (len === 0) {
		ctx.GS.projVector = { x: 0x4000, y: 0 };
	} else {
		ctx.GS.projVector = {
			x: Math.round((x / len) * 0x4000),
			y: Math.round((y / len) * 0x4000),
		};
	}
	ctx.GS.dualVector = { ...ctx.GS.projVector };
}

/** SFVFS - Set freedom vector from stack */
export function SFVFS(ctx: ExecContext): void {
	const y = ctx.stack[--ctx.stackTop];
	const x = ctx.stack[--ctx.stackTop];

	const len = Math.sqrt(x * x + y * y);
	if (len === 0) {
		ctx.GS.freeVector = { x: 0x4000, y: 0 };
	} else {
		ctx.GS.freeVector = {
			x: Math.round((x / len) * 0x4000),
			y: Math.round((y / len) * 0x4000),
		};
	}
}

/** GPV - Get projection vector */
export function GPV(ctx: ExecContext): void {
	ctx.stack[ctx.stackTop++] = ctx.GS.projVector.x;
	ctx.stack[ctx.stackTop++] = ctx.GS.projVector.y;
}

/** GFV - Get freedom vector */
export function GFV(ctx: ExecContext): void {
	ctx.stack[ctx.stackTop++] = ctx.GS.freeVector.x;
	ctx.stack[ctx.stackTop++] = ctx.GS.freeVector.y;
}

/** SFVTPV - Set freedom vector to projection vector */
export function SFVTPV(ctx: ExecContext): void {
	ctx.GS.freeVector = { ...ctx.GS.projVector };
}

// Reference point instructions

/** SRP0 - Set reference point 0 */
export function SRP0(ctx: ExecContext): void {
	ctx.GS.rp0 = ctx.stack[--ctx.stackTop];
}

/** SRP1 - Set reference point 1 */
export function SRP1(ctx: ExecContext): void {
	ctx.GS.rp1 = ctx.stack[--ctx.stackTop];
}

/** SRP2 - Set reference point 2 */
export function SRP2(ctx: ExecContext): void {
	ctx.GS.rp2 = ctx.stack[--ctx.stackTop];
}

// Zone pointer instructions

/** SZP0 - Set zone pointer 0 */
export function SZP0(ctx: ExecContext): void {
	const zone = ctx.stack[--ctx.stackTop];
	if (zone !== 0 && zone !== 1) {
		ctx.error = `SZP0: invalid zone ${zone}`;
		return;
	}
	ctx.GS.gep0 = zone;
	ctx.zp0 = zone === 0 ? ctx.twilight : ctx.pts;
}

/** SZP1 - Set zone pointer 1 */
export function SZP1(ctx: ExecContext): void {
	const zone = ctx.stack[--ctx.stackTop];
	if (zone !== 0 && zone !== 1) {
		ctx.error = `SZP1: invalid zone ${zone}`;
		return;
	}
	ctx.GS.gep1 = zone;
	ctx.zp1 = zone === 0 ? ctx.twilight : ctx.pts;
}

/** SZP2 - Set zone pointer 2 */
export function SZP2(ctx: ExecContext): void {
	const zone = ctx.stack[--ctx.stackTop];
	if (zone !== 0 && zone !== 1) {
		ctx.error = `SZP2: invalid zone ${zone}`;
		return;
	}
	ctx.GS.gep2 = zone;
	ctx.zp2 = zone === 0 ? ctx.twilight : ctx.pts;
}

/** SZPS - Set all zone pointers */
export function SZPS(ctx: ExecContext): void {
	const zone = ctx.stack[--ctx.stackTop];
	if (zone !== 0 && zone !== 1) {
		ctx.error = `SZPS: invalid zone ${zone}`;
		return;
	}
	ctx.GS.gep0 = zone;
	ctx.GS.gep1 = zone;
	ctx.GS.gep2 = zone;
	const z = zone === 0 ? ctx.twilight : ctx.pts;
	ctx.zp0 = z;
	ctx.zp1 = z;
	ctx.zp2 = z;
}

// Other graphics state

/** SLOOP - Set loop counter */
export function SLOOP(ctx: ExecContext): void {
	const count = ctx.stack[--ctx.stackTop];
	if (count <= 0) {
		// Lenient handling: a non-positive loop count disables looping.
		ctx.GS.loop = 0;
		return;
	}
	ctx.GS.loop = count;
}

/** SMD - Set minimum distance */
export function SMD(ctx: ExecContext): void {
	ctx.GS.minimumDistance = ctx.stack[--ctx.stackTop];
}

/** SCVTCI - Set control value table cut-in */
export function SCVTCI(ctx: ExecContext): void {
	ctx.GS.controlValueCutIn = ctx.stack[--ctx.stackTop];
}

/** SSWCI - Set single width cut-in */
export function SSWCI(ctx: ExecContext): void {
	ctx.GS.singleWidthCutIn = ctx.stack[--ctx.stackTop];
}

/** SSW - Set single width value */
export function SSW(ctx: ExecContext): void {
	const value = ctx.stack[--ctx.stackTop];
	// SSW value is in font units; scale to 26.6 pixels like FreeType.
	ctx.GS.singleWidthValue = scaleFUnits(value, ctx.scaleFix);
}

/** SDB - Set delta base */
export function SDB(ctx: ExecContext): void {
	ctx.GS.deltaBase = ctx.stack[--ctx.stackTop];
}

/** SDS - Set delta shift */
export function SDS(ctx: ExecContext): void {
	ctx.GS.deltaShift = ctx.stack[--ctx.stackTop];
}

// Rounding state

/** RTG - Round to grid */
export function RTG(ctx: ExecContext): void {
	ctx.GS.roundState = RoundMode.ToGrid;
}

/** RTHG - Round to half grid */
export function RTHG(ctx: ExecContext): void {
	ctx.GS.roundState = RoundMode.ToHalfGrid;
}

/** RTDG - Round to double grid */
export function RTDG(ctx: ExecContext): void {
	ctx.GS.roundState = RoundMode.ToDoubleGrid;
}

/** RDTG - Round down to grid */
export function RDTG(ctx: ExecContext): void {
	ctx.GS.roundState = RoundMode.DownToGrid;
}

/** RUTG - Round up to grid */
export function RUTG(ctx: ExecContext): void {
	ctx.GS.roundState = RoundMode.UpToGrid;
}

/** ROFF - Rounding off */
export function ROFF(ctx: ExecContext): void {
	ctx.GS.roundState = RoundMode.Off;
}

/** SROUND - Super round */
export function SROUND(ctx: ExecContext): void {
	const selector = ctx.stack[--ctx.stackTop];
	parseSuperRound(selector, ctx.GS);
	ctx.GS.roundState = RoundMode.Super;
}

/** S45ROUND - Super round 45 degrees */
export function S45ROUND(ctx: ExecContext): void {
	const selector = ctx.stack[--ctx.stackTop];
	parseSuperRound(selector, ctx.GS);
	ctx.GS.roundState = RoundMode.Super45;
}

// Flip auto-flip

/** FLIPON - Turn auto-flip on */
export function FLIPON(ctx: ExecContext): void {
	ctx.GS.autoFlip = true;
}

/** FLIPOFF - Turn auto-flip off */
export function FLIPOFF(ctx: ExecContext): void {
	ctx.GS.autoFlip = false;
}

// Scan and instruction control

/** SCANCTRL - Set scan conversion control */
export function SCANCTRL(ctx: ExecContext): void {
	ctx.GS.scanControl = ctx.stack[--ctx.stackTop];
}

/** SCANTYPE - Set scan type */
export function SCANTYPE(ctx: ExecContext): void {
	ctx.GS.scanType = ctx.stack[--ctx.stackTop];
}

/** INSTCTRL - Set instruction control */
export function INSTCTRL(ctx: ExecContext): void {
	const selector = ctx.stack[--ctx.stackTop];
	const value = ctx.stack[--ctx.stackTop];

	// Bit 0: inhibit grid-fitting
	// Bit 1: ignore CVT values
	if (selector === 1 || selector === 2 || (selector === 3 && ctx.currentRange === CodeRange.CVT)) {
		const flag = 1 << (selector - 1);
		if (value) {
			ctx.GS.instructControl |= flag;
		} else {
			ctx.GS.instructControl &= ~flag;
		}
	}

	// Bit 2 (selector 3): native ClearType mode toggle for glyph programs.
	if (selector === 3 && ctx.currentRange === CodeRange.Glyph && ctx.lightMode) {
		// Mirror FreeType: value is expected to be 0 or flag (4).
		ctx.backwardCompatibility = (value & 4) ^ 4;
	}
}

/** GETINFO - Get font engine info */
export function GETINFO(ctx: ExecContext): void {
	const selector = ctx.stack[--ctx.stackTop];
	let result = 0;
	const mode = ctx.renderMode;
	const isMono = mode === "mono";
	const isLcd = mode === "lcd";
	const isLcdV = mode === "lcd_v";
	const grayscale = ctx.grayscale;
	const subpixelHinting = ctx.lightMode;

	// Bit 0: version (match FreeType's default interpreter version 40)
	if (selector & 1) {
		result |= 40;
	}

	// Bit 1: glyph rotated
	// Bit 2: glyph stretched

	// Bit 5: grayscale rendering
	if ((selector & 32) && grayscale) {
		result |= 1 << 12;
	}

	// Subpixel hinting info is only exposed in v40 mode.
	if (subpixelHinting && !isMono) {
		// Bit 6: subpixel hinting (v40 default)
		if (selector & 64) {
			result |= 1 << 13;
		}

		// Bit 8: vertical LCD subpixels
		if ((selector & 256) && isLcdV) {
			result |= 1 << 15;
		}

		// Bit 10: subpixel positioned (FreeType reports support when queried)
		if (selector & 1024) {
			result |= 1 << 17;
		}

		// Bit 11: symmetrical smoothing
		if ((selector & 2048) && !isMono) {
			result |= 1 << 18;
		}

		// Bit 12: ClearType hinting + grayscale rendering
		if ((selector & 4096) && !isLcd && !isLcdV) {
			result |= 1 << 19;
		}
	}

	ctx.stack[ctx.stackTop++] = result;
}

// Storage and CVT

/** RS - Read storage */
export function RS(ctx: ExecContext): void {
	const index = ctx.stack[--ctx.stackTop];
	if (index < 0 || index >= ctx.storageSize) {
		ctx.error = `RS: invalid index ${index}`;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = ctx.storage[index];
}

/** WS - Write storage */
export function WS(ctx: ExecContext): void {
	const value = ctx.stack[--ctx.stackTop];
	const index = ctx.stack[--ctx.stackTop];
	if (index < 0 || index >= ctx.storageSize) {
		ctx.error = `WS: invalid index ${index}`;
		return;
	}
	ctx.storage[index] = value;
}

/** RCVT - Read CVT value */
export function RCVT(ctx: ExecContext): void {
	const index = ctx.stack[--ctx.stackTop];
	if (index < 0 || index >= ctx.cvtSize) {
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	ctx.stack[ctx.stackTop++] = ctx.cvt[index];
}

/** WCVTP - Write CVT value in pixels */
export function WCVTP(ctx: ExecContext): void {
	const value = ctx.stack[--ctx.stackTop];
	const index = ctx.stack[--ctx.stackTop];
	if (index < 0 || index >= ctx.cvtSize) {
		return;
	}
	ctx.cvt[index] = value;
}

/** WCVTF - Write CVT value in font units */
export function WCVTF(ctx: ExecContext): void {
	const value = ctx.stack[--ctx.stackTop];
	const index = ctx.stack[--ctx.stackTop];
	if (index < 0 || index >= ctx.cvtSize) {
		return;
	}
	// Convert from font units to pixels (26.6)
	ctx.cvt[index] = scaleFUnits(value, ctx.scaleFix);
}

/** UTP - UnTouch Point */
export function UTP(ctx: ExecContext): void {
	const pointIndex = ctx.stack[--ctx.stackTop];
	const zone = ctx.zp0;

	if (pointIndex < 0 || pointIndex >= zone.nPoints) {
		ctx.error = `UTP: invalid point ${pointIndex}`;
		return;
	}

	// Clear touch flags based on freedom vector direction
	const fv = ctx.GS.freeVector;
	if (fv.y !== 0) {
		zone.tags[pointIndex] &= ~TouchFlag.Y;
	}
	if (fv.x !== 0) {
		zone.tags[pointIndex] &= ~TouchFlag.X;
	}
}
