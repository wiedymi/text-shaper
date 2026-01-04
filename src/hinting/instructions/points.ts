/**
 * Point movement instructions
 *
 * These are the core hinting operations that actually move glyph points.
 */

import { compensate, round } from "../rounding.ts";
import { scaleFUnits } from "../scale.ts";
import {
	CodeRange,
	type ExecContext,
	type F26Dot6,
	type GlyphZone,
	type Point,
	RoundMode,
	TouchFlag,
} from "../types.ts";

function dotFix14(
	ax: F26Dot6,
	ay: F26Dot6,
	bx: number,
	by: number,
): F26Dot6 {
	const c = ax * bx + ay * by;
	const rounded = c + 0x2000 + (c < 0 ? -1 : 0);
	return Math.floor(rounded / 0x4000);
}

function mulFix14(a: F26Dot6, b: number): F26Dot6 {
	const c = a * b;
	const rounded = c + 0x2000 + (c < 0 ? -1 : 0);
	return Math.floor(rounded / 0x4000);
}

function dotFix14Vectors(ax: number, ay: number, bx: number, by: number): number {
	const c = ax * bx + ay * by;
	const rounded = c + 0x2000 + (c < 0 ? -1 : 0);
	return Math.floor(rounded / 0x4000);
}

function dualProjectOrusDelta(
	ctx: ExecContext,
	zone1: GlyphZone,
	p1: number,
	zone2: GlyphZone,
	p2: number,
): F26Dot6 {
	const pt1 = zone1.orus[p1];
	const pt2 = zone2.orus[p2];
	if (!pt1 || !pt2) return 0;

	const dx = pt1.x - pt2.x;
	const dy = pt1.y - pt2.y;
	const dist = dotFix14(dx, dy, ctx.GS.dualVector.x, ctx.GS.dualVector.y);
	return scaleFUnits(dist, ctx.scaleFix);
}

function mulDiv(a: number, b: number, c: number): number {
	if (c === 0) return (a ^ b) < 0 ? -0x7fffffff : 0x7fffffff;

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

/**
 * Project a point onto the projection vector
 */
export function project(ctx: ExecContext, p: Point): F26Dot6 {
	return dotFix14(p.x, p.y, ctx.GS.projVector.x, ctx.GS.projVector.y);
}

/**
 * Project using dual vector (for original positions)
 */
export function dualProject(ctx: ExecContext, p: Point): F26Dot6 {
	return dotFix14(p.x, p.y, ctx.GS.dualVector.x, ctx.GS.dualVector.y);
}

/**
 * Move a point along the freedom vector
 */
export function movePoint(
	ctx: ExecContext,
	zone: GlyphZone,
	pointIndex: number,
	distance: F26Dot6,
): void {
	const pt = zone.cur[pointIndex];

	// Calculate movement along freedom vector
	// freedom vector is in 2.14 format, so divide by 0x4000
	const fv = ctx.GS.freeVector;
	const pv = ctx.GS.projVector;

	// Calculate dot product of freedom and projection vectors (F2Dot14)
	const dot = dotFix14Vectors(fv.x, fv.y, pv.x, pv.y);

	if (dot === 0) {
		// Vectors are perpendicular, can't move
		return;
	}

	// Scale distance by freedom/projection relationship
	const dx = mulDiv(distance, fv.x, dot);
	const dy = mulDiv(distance, fv.y, dot);
	let moveX = dx;
	let moveY = dy;

	// Backward compatibility (light hinting): ignore X moves, and block
	// all moves after both IUP[x] and IUP[y] have run.
	if (ctx.backwardCompatibility) {
		if (fv.x !== 0) moveX = 0;
		if (fv.y !== 0 && ctx.backwardCompatibility === 0x7) moveY = 0;
	}

	pt.x += moveX;
	pt.y += moveY;

	// Twilight points have no true original positions; keep org in sync.
	if (zone === ctx.twilight) {
		const orgPt = zone.org[pointIndex];
		orgPt.x += moveX;
		orgPt.y += moveY;
	}
}

/**
 * Get current position of a point projected onto projection vector
 */
export function getCurrent(
	ctx: ExecContext,
	zone: GlyphZone,
	pointIndex: number,
): F26Dot6 {
	const pt = zone.cur[pointIndex];
	if (!pt) return 0;
	return project(ctx, pt);
}

/**
 * Get original position of a point projected onto dual vector
 */
export function getOriginal(
	ctx: ExecContext,
	zone: GlyphZone,
	pointIndex: number,
): F26Dot6 {
	const pt = zone.org[pointIndex];
	if (!pt) return 0;
	return dualProject(ctx, pt);
}

/**
 * Mark point as touched in the current direction
 */
export function touchPoint(
	ctx: ExecContext,
	zone: GlyphZone,
	pointIndex: number,
): void {
	// Set touch flag based on freedom vector direction
	const fv = ctx.GS.freeVector;
	if (fv.y !== 0) {
		zone.tags[pointIndex] |= TouchFlag.Y;
	}
	if (fv.x !== 0) {
		zone.tags[pointIndex] |= TouchFlag.X;
	}
}

// =============================================================================
// MDAP - Move Direct Absolute Point
// =============================================================================

/** MDAP - Move Direct Absolute Point */
export function MDAP(ctx: ExecContext, doRound: boolean): void {
	const pointIndex = ctx.stack[--ctx.stackTop];

	const zone = ctx.zp0;
	if (pointIndex < 0 || pointIndex >= zone.nPoints) {
		ctx.error = `MDAP: invalid point ${pointIndex}`;
		return;
	}

	let distance = getCurrent(ctx, zone, pointIndex);

	if (doRound) {
		const comp = compensate(distance, ctx.GS);
		distance = round(distance, comp, ctx.GS) - distance;
	} else {
		distance = 0;
	}

	movePoint(ctx, zone, pointIndex, distance);
	touchPoint(ctx, zone, pointIndex);

	ctx.GS.rp0 = pointIndex;
	ctx.GS.rp1 = pointIndex;
}

// =============================================================================
// MIAP - Move Indirect Absolute Point
// =============================================================================

/** MIAP - Move Indirect Absolute Point (uses CVT) */
export function MIAP(ctx: ExecContext, doRound: boolean): void {
	const cvtIndex = ctx.stack[--ctx.stackTop];
	const pointIndex = ctx.stack[--ctx.stackTop];

	const zone = ctx.zp0;
	if (pointIndex < 0 || pointIndex >= zone.nPoints) {
		ctx.error = `MIAP: invalid point ${pointIndex}`;
		return;
	}

	if (cvtIndex < 0 || cvtIndex >= ctx.cvtSize) {
		return;
	}

	let cvtDistance = ctx.cvt[cvtIndex];
	const currentPos = getCurrent(ctx, zone, pointIndex);

	if (doRound) {
		// Check if we should use CVT value or current position
		const diff = Math.abs(cvtDistance - currentPos);

		if (diff > ctx.GS.controlValueCutIn) {
			// Difference too large, use current position
			cvtDistance = currentPos;
		}

		const comp = compensate(cvtDistance, ctx.GS);
		cvtDistance = round(cvtDistance, comp, ctx.GS);
	}

	const distance = cvtDistance - currentPos;
	movePoint(ctx, zone, pointIndex, distance);
	touchPoint(ctx, zone, pointIndex);

	ctx.GS.rp0 = pointIndex;
	ctx.GS.rp1 = pointIndex;
}

// =============================================================================
// MDRP - Move Direct Relative Point
// =============================================================================

/** MDRP - Move Direct Relative Point */
export function MDRP(ctx: ExecContext, flags: number): void {
	const pointIndex = ctx.stack[--ctx.stackTop];

	const setRp0 = (flags & 0x10) !== 0;
	const keepMinDist = (flags & 0x08) !== 0;
	const doRound = (flags & 0x04) !== 0;
	const distanceType = flags & 0x03;
	let roundState = ctx.GS.roundState;
	if (distanceType === 1) {
		roundState = RoundMode.ToGrid;
	} else if (distanceType === 2) {
		roundState = RoundMode.ToHalfGrid;
	} else if (distanceType === 3) {
		roundState = RoundMode.ToDoubleGrid;
	}

	const zp0 = ctx.zp0;
	const zp1 = ctx.zp1;

	if (pointIndex < 0 || pointIndex >= zp1.nPoints) {
		ctx.error = `MDRP: invalid point ${pointIndex}`;
		return;
	}

	const rp0 = ctx.GS.rp0;
	if (rp0 < 0 || rp0 >= zp0.nPoints) {
		ctx.error = `MDRP: invalid rp0 ${rp0}`;
		return;
	}

	// Get original distance (using dual projection vector)
	let orgDist =
		getOriginal(ctx, zp1, pointIndex) - getOriginal(ctx, zp0, rp0);

	// Single width cut-in test
	if (
		ctx.GS.singleWidthCutIn > 0 &&
		Math.abs(orgDist - ctx.GS.singleWidthValue) < ctx.GS.singleWidthCutIn
	) {
		orgDist = orgDist >= 0 ? ctx.GS.singleWidthValue : -ctx.GS.singleWidthValue;
	}

	const comp = compensate(orgDist, ctx.GS);
	let distance: F26Dot6;
	if (doRound) {
		const savedRound = ctx.GS.roundState;
		ctx.GS.roundState = roundState;
		distance = round(orgDist, comp, ctx.GS);
		ctx.GS.roundState = savedRound;
	} else {
		distance = orgDist + comp;
	}

	// Apply minimum distance
	if (keepMinDist) {
		if (orgDist >= 0) {
			if (distance < ctx.GS.minimumDistance) {
				distance = ctx.GS.minimumDistance;
			}
		} else {
			if (distance > -ctx.GS.minimumDistance) {
				distance = -ctx.GS.minimumDistance;
			}
		}
	}

	// Calculate actual movement needed
	const currentDist =
		getCurrent(ctx, zp1, pointIndex) - getCurrent(ctx, zp0, rp0);
	const move = distance - currentDist;
	movePoint(ctx, zp1, pointIndex, move);
	touchPoint(ctx, zp1, pointIndex);

	ctx.GS.rp1 = ctx.GS.rp0;
	ctx.GS.rp2 = pointIndex;
	if (setRp0) {
		ctx.GS.rp0 = pointIndex;
	}
}

// =============================================================================
// MIRP - Move Indirect Relative Point
// =============================================================================

/** MIRP - Move Indirect Relative Point (uses CVT) */
export function MIRP(ctx: ExecContext, flags: number): void {
	const cvtIndex = ctx.stack[--ctx.stackTop];
	const pointIndex = ctx.stack[--ctx.stackTop];

	const setRp0 = (flags & 0x10) !== 0;
	const keepMinDist = (flags & 0x08) !== 0;
	const doRound = (flags & 0x04) !== 0;
	const distanceType = flags & 0x03;
	let roundState = ctx.GS.roundState;
	if (distanceType === 1) {
		roundState = RoundMode.ToGrid;
	} else if (distanceType === 2) {
		roundState = RoundMode.ToHalfGrid;
	} else if (distanceType === 3) {
		roundState = RoundMode.ToDoubleGrid;
	}

	const zp0 = ctx.zp0;
	const zp1 = ctx.zp1;

	if (pointIndex < 0 || pointIndex >= zp1.nPoints) {
		ctx.error = `MIRP: invalid point ${pointIndex}`;
		return;
	}

	if (cvtIndex < -1 || cvtIndex >= ctx.cvtSize) {
		return;
	}

	const rp0 = ctx.GS.rp0;
	if (rp0 < 0 || rp0 >= zp0.nPoints) {
		ctx.error = `MIRP: invalid rp0 ${rp0}`;
		return;
	}

	// Get original distance for comparison
	const orgDist =
		getOriginal(ctx, zp1, pointIndex) - getOriginal(ctx, zp0, rp0);

	// Get CVT distance (cvt[-1] = 0)
	let cvtDist = cvtIndex === -1 ? 0 : ctx.cvt[cvtIndex];

	// Single width test
	if (
		ctx.GS.singleWidthCutIn > 0 &&
		Math.abs(cvtDist - ctx.GS.singleWidthValue) < ctx.GS.singleWidthCutIn
	) {
		cvtDist = cvtDist >= 0 ? ctx.GS.singleWidthValue : -ctx.GS.singleWidthValue;
	}

	// Twilight points special case: update org/cur from CVT + free vector
	if (ctx.GS.gep1 === 0) {
		const orgRp0 = ctx.zp0.org[rp0];
		const dx = mulFix14(cvtDist, ctx.GS.freeVector.x);
		const dy = mulFix14(cvtDist, ctx.GS.freeVector.y);
		ctx.zp1.org[pointIndex].x = orgRp0.x + dx;
		ctx.zp1.org[pointIndex].y = orgRp0.y + dy;
		ctx.zp1.cur[pointIndex].x = ctx.zp1.org[pointIndex].x;
		ctx.zp1.cur[pointIndex].y = ctx.zp1.org[pointIndex].y;
	}

	// Auto-flip test.
	if (ctx.GS.autoFlip) {
		if ((orgDist ^ cvtDist) < 0) {
			cvtDist = -cvtDist;
		}
	}

	let distance: F26Dot6 = cvtDist;
	const comp = compensate(cvtDist, ctx.GS);

	if (doRound) {
		// Cut-in test only if both points are in the same zone.
		if (ctx.GS.gep0 === ctx.GS.gep1) {
			const diff = Math.abs(cvtDist - orgDist);
			if (diff > ctx.GS.controlValueCutIn) {
				distance = orgDist;
			}
		}
		const savedRound = ctx.GS.roundState;
		ctx.GS.roundState = roundState;
		distance = round(distance, comp, ctx.GS);
		ctx.GS.roundState = savedRound;
	} else {
		distance = distance + comp;
	}

	// Apply minimum distance
	if (keepMinDist) {
		if (orgDist >= 0) {
			if (distance < ctx.GS.minimumDistance) {
				distance = ctx.GS.minimumDistance;
			}
		} else {
			if (distance > -ctx.GS.minimumDistance) {
				distance = -ctx.GS.minimumDistance;
			}
		}
	}

	// Calculate actual movement needed
	const currentDist =
		getCurrent(ctx, zp1, pointIndex) - getCurrent(ctx, zp0, rp0);
	const move = distance - currentDist;
	movePoint(ctx, zp1, pointIndex, move);
	touchPoint(ctx, zp1, pointIndex);

	ctx.GS.rp1 = ctx.GS.rp0;
	ctx.GS.rp2 = pointIndex;
	if (setRp0) {
		ctx.GS.rp0 = pointIndex;
	}
}

// =============================================================================
// SHP - Shift Point
// =============================================================================

/** SHP - Shift Point using reference point */
export function SHP(ctx: ExecContext, useRp1: boolean): void {
	const refZone = useRp1 ? ctx.zp0 : ctx.zp1;
	const refPoint = useRp1 ? ctx.GS.rp1 : ctx.GS.rp2;

	if (refPoint < 0 || refPoint >= refZone.nPoints) {
		ctx.error = `SHP: invalid reference point ${refPoint}`;
		return;
	}

	// Calculate shift amount from reference point movement
	const orgRef = project(ctx, refZone.org[refPoint]);
	const curRef = getCurrent(ctx, refZone, refPoint);
	const shift = curRef - orgRef;

	// Apply to loop count points
	const zone = ctx.zp2;
	const count = ctx.GS.loop;
	ctx.GS.loop = 1;

	for (let i = 0; i < count; i++) {
		const pointIndex = ctx.stack[--ctx.stackTop];

		if (pointIndex < 0 || pointIndex >= zone.nPoints) {
			ctx.error = `SHP: invalid point ${pointIndex}`;
			return;
		}

		movePoint(ctx, zone, pointIndex, shift);
		touchPoint(ctx, zone, pointIndex);
	}
}

// =============================================================================
// SHC - Shift Contour
// =============================================================================

/** SHC - Shift Contour using reference point */
export function SHC(ctx: ExecContext, useRp1: boolean): void {
	const contourIndex = ctx.stack[--ctx.stackTop];

	const refZone = useRp1 ? ctx.zp0 : ctx.zp1;
	const refPoint = useRp1 ? ctx.GS.rp1 : ctx.GS.rp2;

	if (refPoint < 0 || refPoint >= refZone.nPoints) {
		ctx.error = `SHC: invalid reference point ${refPoint}`;
		return;
	}

	const zone = ctx.zp2;
	if (contourIndex < 0 || contourIndex >= zone.nContours) {
		ctx.error = `SHC: invalid contour ${contourIndex}`;
		return;
	}

	// Calculate shift amount
	const orgRef = project(ctx, refZone.org[refPoint]);
	const curRef = getCurrent(ctx, refZone, refPoint);
	const shift = curRef - orgRef;

	// Get contour bounds
	const start = contourIndex === 0 ? 0 : zone.contours[contourIndex - 1] + 1;
	const end = zone.contours[contourIndex];

	// Shift all points in contour (except reference point if in same zone)
	for (let i = start; i <= end; i++) {
		if (zone === refZone && i === refPoint) continue;
		movePoint(ctx, zone, i, shift);
		touchPoint(ctx, zone, i);
	}
}

// =============================================================================
// SHZ - Shift Zone
// =============================================================================

/** SHZ - Shift Zone using reference point */
export function SHZ(ctx: ExecContext, useRp1: boolean): void {
	const zoneIndex = ctx.stack[--ctx.stackTop];

	const refZone = useRp1 ? ctx.zp0 : ctx.zp1;
	const refPoint = useRp1 ? ctx.GS.rp1 : ctx.GS.rp2;

	if (refPoint < 0 || refPoint >= refZone.nPoints) {
		ctx.error = `SHZ: invalid reference point ${refPoint}`;
		return;
	}

	const zone = zoneIndex === 0 ? ctx.twilight : ctx.pts;

	// Calculate shift amount
	const orgRef = project(ctx, refZone.org[refPoint]);
	const curRef = getCurrent(ctx, refZone, refPoint);
	const shift = curRef - orgRef;

	// Shift all points in zone (except reference point if in same zone)
	for (let i = 0; i < zone.nPoints; i++) {
		if (zone === refZone && i === refPoint) continue;
		movePoint(ctx, zone, i, shift);
		// Note: SHZ doesn't set touch flags
	}
}

// =============================================================================
// SHPIX - Shift Point by Pixel Amount
// =============================================================================

function movePointFree(
	ctx: ExecContext,
	zone: GlyphZone,
	pointIndex: number,
	dx: F26Dot6,
	dy: F26Dot6,
): void {
	const fv = ctx.GS.freeVector;
	if (fv.x !== 0) {
		if (!ctx.backwardCompatibility) {
			zone.cur[pointIndex].x += dx;
		}
	}
	if (fv.y !== 0) {
		if (ctx.backwardCompatibility !== 0x7) {
			zone.cur[pointIndex].y += dy;
		}
	}
	if (zone === ctx.twilight) {
		const orgPt = zone.org[pointIndex];
		if (fv.x !== 0 && !ctx.backwardCompatibility) orgPt.x += dx;
		if (fv.y !== 0 && ctx.backwardCompatibility !== 0x7) orgPt.y += dy;
	}
}

/** SHPIX - Shift Point by Pixel Amount */
export function SHPIX(ctx: ExecContext): void {
	const distance = ctx.stack[--ctx.stackTop];

	const zone = ctx.zp2;
	const count = ctx.GS.loop;
	ctx.GS.loop = 1;
	const inTwilight =
		ctx.GS.gep0 === 0 || ctx.GS.gep1 === 0 || ctx.GS.gep2 === 0;
	const dx = mulFix14(distance, ctx.GS.freeVector.x);
	const dy = mulFix14(distance, ctx.GS.freeVector.y);

	for (let i = 0; i < count; i++) {
		const pointIndex = ctx.stack[--ctx.stackTop];

		if (pointIndex < 0 || pointIndex >= zone.nPoints) {
			ctx.error = `SHPIX: invalid point ${pointIndex}`;
			return;
		}

		if (ctx.backwardCompatibility) {
			if (
				inTwilight ||
				(ctx.backwardCompatibility !== 0x7 &&
					((ctx.isComposite && ctx.GS.freeVector.y !== 0) ||
						(zone.tags[pointIndex] & TouchFlag.Y)))
			) {
				movePointFree(ctx, zone, pointIndex, 0, dy);
				touchPoint(ctx, zone, pointIndex);
			}
		} else {
			movePointFree(ctx, zone, pointIndex, dx, dy);
			touchPoint(ctx, zone, pointIndex);
		}
	}
}

// =============================================================================
// IP - Interpolate Point
// =============================================================================

/** IP - Interpolate Point */
export function IP(ctx: ExecContext): void {
	const rp1 = ctx.GS.rp1;
	const rp2 = ctx.GS.rp2;

	if (rp1 < 0 || rp1 >= ctx.zp0.nPoints) {
		ctx.error = `IP: invalid rp1 ${rp1}`;
		return;
	}
	if (rp2 < 0 || rp2 >= ctx.zp1.nPoints) {
		ctx.error = `IP: invalid rp2 ${rp2}`;
		return;
	}

	// Get original and current ranges between reference points.
	const orgRange =
		getOriginal(ctx, ctx.zp1, rp2) - getOriginal(ctx, ctx.zp0, rp1);
	const curRange =
		getCurrent(ctx, ctx.zp1, rp2) - getCurrent(ctx, ctx.zp0, rp1);
	const orgBase = getOriginal(ctx, ctx.zp0, rp1);
	const curBase = getCurrent(ctx, ctx.zp0, rp1);

	const zone = ctx.zp2;
	const count = ctx.GS.loop;
	ctx.GS.loop = 1;

	for (let i = 0; i < count; i++) {
		const pointIndex = ctx.stack[--ctx.stackTop];

		if (pointIndex < 0 || pointIndex >= zone.nPoints) {
			ctx.error = `IP: invalid point ${pointIndex}`;
			return;
		}

		const orgDist = getOriginal(ctx, zone, pointIndex) - orgBase;
		const curDist = getCurrent(ctx, zone, pointIndex) - curBase;

		let newDist: F26Dot6;
		if (orgDist !== 0) {
			if (orgRange !== 0) {
				newDist = mulDiv(orgDist, curRange, orgRange);
			} else {
				newDist = orgDist;
			}
		} else {
			newDist = 0;
		}

		movePoint(ctx, zone, pointIndex, newDist - curDist);
		touchPoint(ctx, zone, pointIndex);
	}
}

// =============================================================================
// ALIGNRP - Align Reference Point
// =============================================================================

/** ALIGNRP - Align to Reference Point */
export function ALIGNRP(ctx: ExecContext): void {
	const rp0 = ctx.GS.rp0;

	if (rp0 < 0 || rp0 >= ctx.zp0.nPoints) {
		ctx.error = `ALIGNRP: invalid rp0 ${rp0}`;
		return;
	}

	const refPos = getCurrent(ctx, ctx.zp0, rp0);

	const zone = ctx.zp1;
	const count = ctx.GS.loop;
	ctx.GS.loop = 1;

	for (let i = 0; i < count; i++) {
		const pointIndex = ctx.stack[--ctx.stackTop];

		if (pointIndex < 0 || pointIndex >= zone.nPoints) {
			ctx.error = `ALIGNRP: invalid point ${pointIndex}`;
			return;
		}

		const curPos = getCurrent(ctx, zone, pointIndex);
		const distance = refPos - curPos;

		movePoint(ctx, zone, pointIndex, distance);
		touchPoint(ctx, zone, pointIndex);
	}
}

// =============================================================================
// MSIRP - Move Stack Indirect Relative Point
// =============================================================================

/** MSIRP - Move Stack Indirect Relative Point */
export function MSIRP(ctx: ExecContext, setRp0: boolean): void {
	const distance = ctx.stack[--ctx.stackTop];
	const pointIndex = ctx.stack[--ctx.stackTop];

	const zp0 = ctx.zp0;
	const zp1 = ctx.zp1;

	if (pointIndex < 0 || pointIndex >= zp1.nPoints) {
		ctx.error = `MSIRP: invalid point ${pointIndex}`;
		return;
	}

	const rp0 = ctx.GS.rp0;
	if (rp0 < 0 || rp0 >= zp0.nPoints) {
		ctx.error = `MSIRP: invalid rp0 ${rp0}`;
		return;
	}

	// Calculate current distance and move to achieve desired distance
	const currentDist =
		getCurrent(ctx, zp1, pointIndex) - getCurrent(ctx, zp0, rp0);
	const move = distance - currentDist;

	movePoint(ctx, zp1, pointIndex, move);
	touchPoint(ctx, zp1, pointIndex);

	ctx.GS.rp1 = ctx.GS.rp0;
	ctx.GS.rp2 = pointIndex;
	if (setRp0) {
		ctx.GS.rp0 = pointIndex;
	}
}

// =============================================================================
// ISECT - Move Point to Intersection
// =============================================================================

/** ISECT - Move Point to Intersection of two lines */
export function ISECT(ctx: ExecContext): void {
	const b1 = ctx.stack[--ctx.stackTop];
	const b0 = ctx.stack[--ctx.stackTop];
	const a1 = ctx.stack[--ctx.stackTop];
	const a0 = ctx.stack[--ctx.stackTop];
	const point = ctx.stack[--ctx.stackTop];

	// Line A: points a0 to a1 in zp1
	// Line B: points b0 to b1 in zp0
	// Move point in zp2 to intersection (FreeType-style)

	const zone0 = ctx.zp0;
	const zone1 = ctx.zp1;
	const zone2 = ctx.zp2;

	if (a0 < 0 || a0 >= zone1.nPoints || a1 < 0 || a1 >= zone1.nPoints) {
		ctx.error = `ISECT: invalid line A points`;
		return;
	}
	if (b0 < 0 || b0 >= zone0.nPoints || b1 < 0 || b1 >= zone0.nPoints) {
		ctx.error = `ISECT: invalid line B points`;
		return;
	}
	if (point < 0 || point >= zone2.nPoints) {
		ctx.error = `ISECT: invalid point ${point}`;
		return;
	}

	const pa0 = zone1.cur[a0];
	const pa1 = zone1.cur[a1];
	const pb0 = zone0.cur[b0];
	const pb1 = zone0.cur[b1];

	const dbx = pb1.x - pb0.x;
	const dby = pb1.y - pb0.y;
	const dax = pa1.x - pa0.x;
	const day = pa1.y - pa0.y;
	const dx = pb0.x - pa0.x;
	const dy = pb0.y - pa0.y;

	// Cross/dot products (scaled by 0x40 like FreeType)
	const discriminant = mulDiv(dax, -dby, 0x40) + mulDiv(day, dbx, 0x40);
	const dotproduct = mulDiv(dax, dbx, 0x40) + mulDiv(day, dby, 0x40);

	const pt = zone2.cur[point];
	if (Math.abs(discriminant) * 19 > Math.abs(dotproduct) && discriminant !== 0) {
		const val = mulDiv(dx, -dby, 0x40) + mulDiv(dy, dbx, 0x40);
		const rx = mulDiv(val, dax, discriminant);
		const ry = mulDiv(val, day, discriminant);
		pt.x = pa0.x + rx;
		pt.y = pa0.y + ry;
	} else {
		// Fallback: average of endpoints
		pt.x = (pa0.x + pa1.x + pb0.x + pb1.x) >> 2;
		pt.y = (pa0.y + pa1.y + pb0.y + pb1.y) >> 2;
	}

	zone2.tags[point] |= TouchFlag.Both;
}

// =============================================================================
// ALIGNPTS - Align Points
// =============================================================================

/** ALIGNPTS - Align two points */
export function ALIGNPTS(ctx: ExecContext): void {
	const p2 = ctx.stack[--ctx.stackTop];
	const p1 = ctx.stack[--ctx.stackTop];

	const zone1 = ctx.zp0;
	const zone2 = ctx.zp1;

	if (p1 < 0 || p1 >= zone1.nPoints) {
		ctx.error = `ALIGNPTS: invalid point ${p1}`;
		return;
	}
	if (p2 < 0 || p2 >= zone2.nPoints) {
		ctx.error = `ALIGNPTS: invalid point ${p2}`;
		return;
	}

	// Get current positions projected
	const pos1 = getCurrent(ctx, zone1, p1);
	const pos2 = getCurrent(ctx, zone2, p2);

	// Move both to midpoint
	const mid = (pos1 + pos2) >> 1;

	movePoint(ctx, zone1, p1, mid - pos1);
	movePoint(ctx, zone2, p2, mid - pos2);

	touchPoint(ctx, zone1, p1);
	touchPoint(ctx, zone2, p2);
}

// =============================================================================
// GC - Get Coordinate
// =============================================================================

/** GC - Get Coordinate projected onto projection vector */
export function GC(ctx: ExecContext, useOriginal: boolean): void {
	const pointIndex = ctx.stack[--ctx.stackTop];
	const zone = ctx.zp2;

	if (pointIndex < 0 || pointIndex >= zone.nPoints) {
		ctx.error = `GC: invalid point ${pointIndex}`;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}

	const coord = useOriginal
		? dualProject(ctx, zone.org[pointIndex])
		: getCurrent(ctx, zone, pointIndex);

	ctx.stack[ctx.stackTop++] = coord;
}

// =============================================================================
// SCFS - Set Coordinate From Stack
// =============================================================================

/** SCFS - Set Coordinate From Stack */
export function SCFS(ctx: ExecContext): void {
	const coord = ctx.stack[--ctx.stackTop];
	const pointIndex = ctx.stack[--ctx.stackTop];

	const zone = ctx.zp2;

	if (pointIndex < 0 || pointIndex >= zone.nPoints) {
		ctx.error = `SCFS: invalid point ${pointIndex}`;
		return;
	}

	const current = getCurrent(ctx, zone, pointIndex);
	movePoint(ctx, zone, pointIndex, coord - current);
	touchPoint(ctx, zone, pointIndex);
}

// =============================================================================
// MD - Measure Distance
// =============================================================================

/** MD - Measure Distance between two points */
export function MD(ctx: ExecContext, useOriginal: boolean): void {
	const p2 = ctx.stack[--ctx.stackTop];
	const p1 = ctx.stack[--ctx.stackTop];

	const zone0 = ctx.zp0;
	const zone1 = ctx.zp1;

	if (p1 < 0 || p1 >= zone0.nPoints) {
		ctx.error = `MD: invalid point ${p1}`;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}
	if (p2 < 0 || p2 >= zone1.nPoints) {
		ctx.error = `MD: invalid point ${p2}`;
		ctx.stack[ctx.stackTop++] = 0;
		return;
	}

	let distance: F26Dot6;

	if (useOriginal) {
		distance = getOriginal(ctx, zone1, p2) - getOriginal(ctx, zone0, p1);
	} else {
		distance = getCurrent(ctx, zone1, p2) - getCurrent(ctx, zone0, p1);
	}

	ctx.stack[ctx.stackTop++] = distance;
}

// =============================================================================
// MPPEM / MPS - Get Pixels Per EM / Point Size
// =============================================================================

/** MPPEM - Measure Pixels Per EM */
export function MPPEM(ctx: ExecContext): void {
	ctx.stack[ctx.stackTop++] = ctx.ppem;
}

/** MPS - Measure Point Size */
export function MPS(ctx: ExecContext): void {
	ctx.stack[ctx.stackTop++] = ctx.pointSize;
}

// =============================================================================
// FLIPPT - Flip Point
// =============================================================================

/** FLIPPT - Flip on-curve/off-curve flag */
export function FLIPPT(ctx: ExecContext): void {
	if (ctx.backwardCompatibility === 0x7) return;
	const zone = ctx.pts;
	const count = ctx.GS.loop;
	ctx.GS.loop = 1;

	for (let i = 0; i < count; i++) {
		const pointIndex = ctx.stack[--ctx.stackTop];

		if (pointIndex < 0 || pointIndex >= zone.nPoints) {
			ctx.error = `FLIPPT: invalid point ${pointIndex}`;
			return;
		}

		// Toggle bit 0 (on-curve flag)
		zone.tags[pointIndex] ^= 0x01;
	}
}

// =============================================================================
// FLIPRGON / FLIPRGOFF - Flip Range On/Off
// =============================================================================

/** FLIPRGON - Set on-curve flag for range */
export function FLIPRGON(ctx: ExecContext): void {
	if (ctx.backwardCompatibility === 0x7) return;
	const endPoint = ctx.stack[--ctx.stackTop];
	const startPoint = ctx.stack[--ctx.stackTop];

	const zone = ctx.pts;

	if (startPoint < 0 || endPoint >= zone.nPoints || startPoint > endPoint) {
		ctx.error = `FLIPRGON: invalid range ${startPoint}-${endPoint}`;
		return;
	}

	for (let i = startPoint; i <= endPoint; i++) {
		zone.tags[i] |= 0x01; // Set on-curve
	}
}

/** FLIPRGOFF - Clear on-curve flag for range */
export function FLIPRGOFF(ctx: ExecContext): void {
	if (ctx.backwardCompatibility === 0x7) return;
	const endPoint = ctx.stack[--ctx.stackTop];
	const startPoint = ctx.stack[--ctx.stackTop];

	const zone = ctx.pts;

	if (startPoint < 0 || endPoint >= zone.nPoints || startPoint > endPoint) {
		ctx.error = `FLIPRGOFF: invalid range ${startPoint}-${endPoint}`;
		return;
	}

	for (let i = startPoint; i <= endPoint; i++) {
		zone.tags[i] &= ~0x01; // Clear on-curve
	}
}

// =============================================================================
// ROUND / NROUND - Round Value
// =============================================================================

/** ROUND - Round value */
export function ROUND(ctx: ExecContext, _colorIndex: number): void {
	const value = ctx.stack[--ctx.stackTop];
	const comp = compensate(value, ctx.GS);
	ctx.stack[ctx.stackTop++] = round(value, comp, ctx.GS);
}

/** NROUND - No-round (just applies engine compensation) */
export function NROUND(ctx: ExecContext, _colorIndex: number): void {
	const value = ctx.stack[--ctx.stackTop];
	const comp = compensate(value, ctx.GS);
	ctx.stack[ctx.stackTop++] = value + comp;
}
