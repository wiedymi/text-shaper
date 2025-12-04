/**
 * Delta instructions
 *
 * These instructions allow fine-tuning of point positions and CVT values
 * at specific pixel-per-em (ppem) sizes. This is useful for fixing
 * rendering issues that only appear at certain sizes.
 */

import type { ExecContext } from "../types.ts";
import { movePoint, touchPoint } from "./points.ts";

/**
 * DELTAP1 - Delta exception point (ppem 0-15 + deltaBase)
 */
export function DELTAP1(ctx: ExecContext): void {
	deltaPoint(ctx, 0);
}

/**
 * DELTAP2 - Delta exception point (ppem 16-31 + deltaBase)
 */
export function DELTAP2(ctx: ExecContext): void {
	deltaPoint(ctx, 16);
}

/**
 * DELTAP3 - Delta exception point (ppem 32-47 + deltaBase)
 */
export function DELTAP3(ctx: ExecContext): void {
	deltaPoint(ctx, 32);
}

/**
 * Common logic for DELTAP1/2/3
 */
function deltaPoint(ctx: ExecContext, rangeOffset: number): void {
	const count = ctx.stack[--ctx.stackTop];

	if (count < 0) {
		ctx.error = `DELTAP: invalid count ${count}`;
		return;
	}

	const zone = ctx.zp0;

	for (let i = 0; i < count; i++) {
		const argByte = ctx.stack[--ctx.stackTop];
		const pointIndex = ctx.stack[--ctx.stackTop];

		if (pointIndex < 0 || pointIndex >= zone.nPoints) {
			ctx.error = `DELTAP: invalid point ${pointIndex}`;
			return;
		}

		// Extract ppem delta and magnitude from argByte
		// High nibble: ppem - deltaBase - rangeOffset
		// Low nibble: magnitude (0-15, where 8-15 are negative)
		const ppemDelta = ((argByte >> 4) & 0x0f) + ctx.GS.deltaBase + rangeOffset;
		const magnitude = argByte & 0x0f;

		// Check if we're at the target ppem
		if (ppemDelta !== ctx.ppem) {
			continue;
		}

		// Convert magnitude to actual delta value
		// 0-7: positive 1-8 (shifted by deltaShift)
		// 8-15: negative 1-8 (shifted by deltaShift)
		let delta: number;
		if (magnitude < 8) {
			delta = (magnitude + 1) << (6 - ctx.GS.deltaShift);
		} else {
			delta = -((magnitude - 7) << (6 - ctx.GS.deltaShift));
		}

		movePoint(ctx, zone, pointIndex, delta);
		touchPoint(ctx, zone, pointIndex);
	}
}

/**
 * DELTAC1 - Delta exception CVT (ppem 0-15 + deltaBase)
 */
export function DELTAC1(ctx: ExecContext): void {
	deltaCVT(ctx, 0);
}

/**
 * DELTAC2 - Delta exception CVT (ppem 16-31 + deltaBase)
 */
export function DELTAC2(ctx: ExecContext): void {
	deltaCVT(ctx, 16);
}

/**
 * DELTAC3 - Delta exception CVT (ppem 32-47 + deltaBase)
 */
export function DELTAC3(ctx: ExecContext): void {
	deltaCVT(ctx, 32);
}

/**
 * Common logic for DELTAC1/2/3
 */
function deltaCVT(ctx: ExecContext, rangeOffset: number): void {
	const count = ctx.stack[--ctx.stackTop];

	if (count < 0) {
		ctx.error = `DELTAC: invalid count ${count}`;
		return;
	}

	for (let i = 0; i < count; i++) {
		const argByte = ctx.stack[--ctx.stackTop];
		const cvtIndex = ctx.stack[--ctx.stackTop];

		if (cvtIndex < 0 || cvtIndex >= ctx.cvtSize) {
			ctx.error = `DELTAC: invalid CVT index ${cvtIndex}`;
			return;
		}

		// Extract ppem delta and magnitude
		const ppemDelta = ((argByte >> 4) & 0x0f) + ctx.GS.deltaBase + rangeOffset;
		const magnitude = argByte & 0x0f;

		// Check if we're at the target ppem
		if (ppemDelta !== ctx.ppem) {
			continue;
		}

		// Convert magnitude to actual delta value
		let delta: number;
		if (magnitude < 8) {
			delta = (magnitude + 1) << (6 - ctx.GS.deltaShift);
		} else {
			delta = -((magnitude - 7) << (6 - ctx.GS.deltaShift));
		}

		ctx.cvt[cvtIndex] += delta;
	}
}
