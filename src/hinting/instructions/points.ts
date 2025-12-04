/**
 * Point movement instructions
 *
 * These are the core hinting operations that actually move glyph points.
 */

import { compensate, round } from "../rounding.ts";
import {
	type ExecContext,
	type F26Dot6,
	type GlyphZone,
	type Point,
	TouchFlag,
} from "../types.ts";

/**
 * Project a point onto the projection vector
 */
export function project(ctx: ExecContext, p: Point): F26Dot6 {
	return (p.x * ctx.GS.projVector.x + p.y * ctx.GS.projVector.y + 0x2000) >> 14;
}

/**
 * Project using dual vector (for original positions)
 */
export function dualProject(ctx: ExecContext, p: Point): F26Dot6 {
	return (p.x * ctx.GS.dualVector.x + p.y * ctx.GS.dualVector.y + 0x2000) >> 14;
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

	// Calculate dot product of freedom and projection vectors
	const dot = (fv.x * pv.x + fv.y * pv.y + 0x2000) >> 14;

	if (dot === 0) {
		// Vectors are perpendicular, can't move
		return;
	}

	// Scale distance by freedom/projection relationship
	const dx = Math.round((distance * fv.x) / dot);
	const dy = Math.round((distance * fv.y) / dot);

	pt.x += dx;
	pt.y += dy;
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
		ctx.error = `MIAP: invalid CVT index ${cvtIndex}`;
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
	// bits 0-1 are distance type (ignored for now)

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
	let distance = getOriginal(ctx, zp1, pointIndex) - getOriginal(ctx, zp0, rp0);

	// Auto-flip if enabled and distance is negative
	if (ctx.GS.autoFlip && distance < 0) {
		distance = -distance;
	}

	if (doRound) {
		const comp = compensate(distance, ctx.GS);
		distance = round(distance, comp, ctx.GS);
	}

	// Apply minimum distance
	if (keepMinDist) {
		if (distance >= 0) {
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
	// bits 0-1 are distance type (ignored for now)

	const zp0 = ctx.zp0;
	const zp1 = ctx.zp1;

	if (pointIndex < 0 || pointIndex >= zp1.nPoints) {
		ctx.error = `MIRP: invalid point ${pointIndex}`;
		return;
	}

	if (cvtIndex < 0 || cvtIndex >= ctx.cvtSize) {
		ctx.error = `MIRP: invalid CVT index ${cvtIndex}`;
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

	// Get CVT distance
	let cvtDist = ctx.cvt[cvtIndex];

	// Auto-flip
	if (ctx.GS.autoFlip) {
		if ((orgDist < 0 && cvtDist > 0) || (orgDist > 0 && cvtDist < 0)) {
			cvtDist = -cvtDist;
		}
	}

	// Check control value cut-in
	const diff = Math.abs(orgDist - cvtDist);
	let distance: F26Dot6;

	if (diff > ctx.GS.controlValueCutIn) {
		// Use original distance
		distance = orgDist;
	} else {
		// Use CVT distance
		distance = cvtDist;
	}

	if (doRound) {
		const comp = compensate(distance, ctx.GS);
		distance = round(distance, comp, ctx.GS);
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
	const orgRef = getOriginal(ctx, refZone, refPoint);
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
	const orgRef = getOriginal(ctx, refZone, refPoint);
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
	const orgRef = getOriginal(ctx, refZone, refPoint);
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

/** SHPIX - Shift Point by Pixel Amount */
export function SHPIX(ctx: ExecContext): void {
	const distance = ctx.stack[--ctx.stackTop];

	const zone = ctx.zp2;
	const count = ctx.GS.loop;
	ctx.GS.loop = 1;

	for (let i = 0; i < count; i++) {
		const pointIndex = ctx.stack[--ctx.stackTop];

		if (pointIndex < 0 || pointIndex >= zone.nPoints) {
			ctx.error = `SHPIX: invalid point ${pointIndex}`;
			return;
		}

		movePoint(ctx, zone, pointIndex, distance);
		touchPoint(ctx, zone, pointIndex);
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

	// Get original and current positions of reference points
	const org1 = getOriginal(ctx, ctx.zp0, rp1);
	const org2 = getOriginal(ctx, ctx.zp1, rp2);
	const cur1 = getCurrent(ctx, ctx.zp0, rp1);
	const cur2 = getCurrent(ctx, ctx.zp1, rp2);

	const orgRange = org2 - org1;
	const curRange = cur2 - cur1;

	const zone = ctx.zp2;
	const count = ctx.GS.loop;
	ctx.GS.loop = 1;

	for (let i = 0; i < count; i++) {
		const pointIndex = ctx.stack[--ctx.stackTop];

		if (pointIndex < 0 || pointIndex >= zone.nPoints) {
			ctx.error = `IP: invalid point ${pointIndex}`;
			return;
		}

		const orgPt = getOriginal(ctx, zone, pointIndex);
		const curPt = getCurrent(ctx, zone, pointIndex);

		let newPos: F26Dot6;

		if (orgRange !== 0) {
			// Interpolate based on relative position
			const t = orgPt - org1;
			newPos = cur1 + Math.round((t * curRange) / orgRange);
		} else {
			// Reference points coincide, just shift
			newPos = curPt + (cur1 - org1);
		}

		movePoint(ctx, zone, pointIndex, newPos - curPt);
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

	// Line A: points a0 to a1 in zp0
	// Line B: points b0 to b1 in zp1
	// Move point in zp2 to intersection

	const zone0 = ctx.zp0;
	const zone1 = ctx.zp1;
	const zone2 = ctx.zp2;

	if (a0 < 0 || a0 >= zone0.nPoints || a1 < 0 || a1 >= zone0.nPoints) {
		ctx.error = `ISECT: invalid line A points`;
		return;
	}
	if (b0 < 0 || b0 >= zone1.nPoints || b1 < 0 || b1 >= zone1.nPoints) {
		ctx.error = `ISECT: invalid line B points`;
		return;
	}
	if (point < 0 || point >= zone2.nPoints) {
		ctx.error = `ISECT: invalid point ${point}`;
		return;
	}

	// Get line endpoints
	const pa0 = zone0.cur[a0];
	const pa1 = zone0.cur[a1];
	const pb0 = zone1.cur[b0];
	const pb1 = zone1.cur[b1];

	// Calculate direction vectors
	const dax = pa1.x - pa0.x;
	const day = pa1.y - pa0.y;
	const dbx = pb1.x - pb0.x;
	const dby = pb1.y - pb0.y;

	// Cross product for denominator
	const denom = dax * dby - day * dbx;

	const pt = zone2.cur[point];

	if (denom === 0) {
		// Lines are parallel, move point to midpoint
		pt.x = (pa0.x + pa1.x + pb0.x + pb1.x) >> 2;
		pt.y = (pa0.y + pa1.y + pb0.y + pb1.y) >> 2;
	} else {
		// Calculate intersection
		const dx = pb0.x - pa0.x;
		const dy = pb0.y - pa0.y;
		const t = (dx * dby - dy * dbx) / denom;

		pt.x = Math.round(pa0.x + t * dax);
		pt.y = Math.round(pa0.y + t * day);
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
		? getOriginal(ctx, zone, pointIndex)
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
