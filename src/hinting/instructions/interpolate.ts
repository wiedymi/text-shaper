/**
 * IUP - Interpolate Untouched Points
 *
 * This instruction interpolates all points that haven't been touched
 * by previous hinting instructions. It's typically called near the end
 * of glyph hinting to smooth out the positions of all remaining points.
 */

import { type ExecContext, type GlyphZone, TouchFlag } from "../types.ts";

/**
 * Interpolate untouched points in X direction
 */
export function IUP_X(ctx: ExecContext): void {
	interpolateUntouched(ctx, TouchFlag.X, true);
}

/**
 * Interpolate untouched points in Y direction
 */
export function IUP_Y(ctx: ExecContext): void {
	interpolateUntouched(ctx, TouchFlag.Y, false);
}

/**
 * Core interpolation logic
 */
function interpolateUntouched(
	ctx: ExecContext,
	touchFlag: TouchFlag,
	isX: boolean,
): void {
	const zone = ctx.pts;
	const nPoints = zone.nPoints;
	const nContours = zone.nContours;

	if (nPoints === 0 || nContours === 0) return;

	// Process each contour separately
	let contourStart = 0;

	for (let c = 0; c < nContours; c++) {
		const contourEnd = zone.contours[c]!;

		// Find first touched point in this contour
		let firstTouched = -1;
		for (let i = contourStart; i <= contourEnd; i++) {
			if (zone.tags[i]! & touchFlag) {
				firstTouched = i;
				break;
			}
		}

		if (firstTouched < 0) {
			// No touched points in contour, skip
			contourStart = contourEnd + 1;
			continue;
		}

		// Walk through contour interpolating untouched points between touched ones
		let prevTouched = firstTouched;
		let i = firstTouched + 1;
		let wrapped = false;

		while (true) {
			// Find next touched point
			if (i > contourEnd) {
				if (wrapped) break;
				i = contourStart;
				wrapped = true;
			}

			if (i === firstTouched && wrapped) {
				// Back to start, interpolate remaining points
				if (prevTouched !== firstTouched) {
					interpolateRange(
						zone,
						prevTouched,
						firstTouched,
						contourStart,
						contourEnd,
						isX,
					);
				}
				break;
			}

			if (zone.tags[i]! & touchFlag) {
				// Found touched point - interpolate between prevTouched and i
				if (prevTouched !== i) {
					interpolateRange(
						zone,
						prevTouched,
						i,
						contourStart,
						contourEnd,
						isX,
					);
				}
				prevTouched = i;
			}

			i++;
		}

		contourStart = contourEnd + 1;
	}
}

/**
 * Interpolate points between two touched reference points
 */
function interpolateRange(
	zone: GlyphZone,
	p1: number,
	p2: number,
	contourStart: number,
	contourEnd: number,
	isX: boolean,
): void {
	// Get original and current positions of reference points
	const org1 = isX ? zone.org[p1]!.x : zone.org[p1]!.y;
	const org2 = isX ? zone.org[p2]!.x : zone.org[p2]!.y;
	const cur1 = isX ? zone.cur[p1]!.x : zone.cur[p1]!.y;
	const cur2 = isX ? zone.cur[p2]!.x : zone.cur[p2]!.y;

	// Ensure org1 <= org2 for interpolation
	let lo_org: number, hi_org: number;
	let lo_cur: number, hi_cur: number;

	if (org1 <= org2) {
		lo_org = org1;
		hi_org = org2;
		lo_cur = cur1;
		hi_cur = cur2;
	} else {
		lo_org = org2;
		hi_org = org1;
		lo_cur = cur2;
		hi_cur = cur1;
	}

	const orgRange = hi_org - lo_org;
	const curRange = hi_cur - lo_cur;

	// Walk through points between p1 and p2 (wrapping around contour)
	let i = p1 + 1;
	if (i > contourEnd) i = contourStart;

	while (i !== p2) {
		const org = isX ? zone.org[i]!.x : zone.org[i]!.y;
		let newPos: number;

		if (org <= lo_org) {
			// Point is below/left of both references - shift by lo movement
			newPos = (isX ? zone.cur[i]!.x : zone.cur[i]!.y) + (lo_cur - lo_org);
		} else if (org >= hi_org) {
			// Point is above/right of both references - shift by hi movement
			newPos = (isX ? zone.cur[i]!.x : zone.cur[i]!.y) + (hi_cur - hi_org);
		} else {
			// Point is between references - interpolate
			if (orgRange !== 0) {
				const t = org - lo_org;
				newPos = lo_cur + Math.round((t * curRange) / orgRange);
			} else {
				newPos = lo_cur;
			}
		}

		if (isX) {
			zone.cur[i]!.x = newPos;
		} else {
			zone.cur[i]!.y = newPos;
		}

		i++;
		if (i > contourEnd) i = contourStart;
	}
}
