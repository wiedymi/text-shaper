/**
 * IUP - Interpolate Untouched Points
 *
 * This instruction interpolates all points that haven't been touched
 * by previous hinting instructions. It's typically called near the end
 * of glyph hinting to smooth out the positions of all remaining points.
 */

import { divFix, mulFix } from "../scale.ts";
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
		const contourEnd = zone.contours[c];

		// Find first touched point in this contour
		let firstTouched = -1;
		for (let i = contourStart; i <= contourEnd; i++) {
			if (zone.tags[i] & touchFlag) {
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
				} else {
					shiftContour(zone, contourStart, contourEnd, firstTouched, isX);
				}
				break;
			}

			if (zone.tags[i] & touchFlag) {
				// Found touched point - interpolate between prevTouched and i
				if (prevTouched !== i) {
					interpolateRange(zone, prevTouched, i, contourStart, contourEnd, isX);
				}
				prevTouched = i;
			}

			i++;
		}

		contourStart = contourEnd + 1;
	}
}

function shiftContour(
	zone: GlyphZone,
	start: number,
	end: number,
	touched: number,
	isX: boolean,
): void {
	const orgTouched = isX ? zone.org[touched]?.x : zone.org[touched]?.y;
	const curTouched = isX ? zone.cur[touched]?.x : zone.cur[touched]?.y;
	const delta = curTouched - orgTouched;
	if (delta === 0) return;

	for (let i = start; i <= end; i++) {
		if (i === touched) continue;
		if (isX) {
			zone.cur[i].x += delta;
		} else {
			zone.cur[i].y += delta;
		}
	}
}

/**
 * Interpolate points between two touched reference points (FreeType-style)
 */
function interpolateRange(
	zone: GlyphZone,
	p1: number,
	p2: number,
	contourStart: number,
	contourEnd: number,
	isX: boolean,
): void {
	let ref1 = p1;
	let ref2 = p2;

	let orus1 = isX ? zone.orus[ref1]?.x : zone.orus[ref1]?.y;
	let orus2 = isX ? zone.orus[ref2]?.x : zone.orus[ref2]?.y;
	if (orus1 > orus2) {
		const tmpO = orus1;
		orus1 = orus2;
		orus2 = tmpO;
		const tmpR = ref1;
		ref1 = ref2;
		ref2 = tmpR;
	}

	const org1 = isX ? zone.org[ref1]?.x : zone.org[ref1]?.y;
	const org2 = isX ? zone.org[ref2]?.x : zone.org[ref2]?.y;
	const cur1 = isX ? zone.cur[ref1]?.x : zone.cur[ref1]?.y;
	const cur2 = isX ? zone.cur[ref2]?.x : zone.cur[ref2]?.y;
	const delta1 = cur1 - org1;
	const delta2 = cur2 - org2;

	const useTrivial = cur1 === cur2 || orus1 === orus2;
	const scale = useTrivial ? 0 : divFix(cur2 - cur1, orus2 - orus1);

	let i = p1 + 1;
	if (i > contourEnd) i = contourStart;

	while (i !== p2) {
		let org = isX ? zone.org[i]?.x : zone.org[i]?.y;
		let newPos: number;

		if (org <= org1) {
			newPos = org + delta1;
		} else if (org >= org2) {
			newPos = org + delta2;
		} else if (useTrivial) {
			newPos = cur1;
		} else {
			const orus = isX ? zone.orus[i]?.x : zone.orus[i]?.y;
			newPos = cur1 + mulFix(orus - orus1, scale);
		}

		if (isX) {
			zone.cur[i].x = newPos;
		} else {
			zone.cur[i].y = newPos;
		}

		i++;
		if (i > contourEnd) i = contourStart;
	}
}
