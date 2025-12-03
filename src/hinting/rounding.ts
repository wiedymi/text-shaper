/**
 * TrueType rounding functions
 *
 * These implement the various rounding modes used by the interpreter.
 */

import { type F26Dot6, RoundMode, type GraphicsState } from "./types.ts";

/**
 * Round to grid (nearest integer pixel)
 */
export function roundToGrid(distance: F26Dot6, compensation: F26Dot6): F26Dot6 {
	if (distance >= 0) {
		return ((distance + 32 + compensation) & -64);
	} else {
		return -(((-distance + 32 + compensation) & -64));
	}
}

/**
 * Round to half grid (nearest half pixel)
 */
export function roundToHalfGrid(distance: F26Dot6, compensation: F26Dot6): F26Dot6 {
	if (distance >= 0) {
		return ((distance + 32 + compensation) & -64) + 32;
	} else {
		return -((((-distance + 32 + compensation) & -64) + 32));
	}
}

/**
 * Round to double grid (nearest half pixel boundary)
 */
export function roundToDoubleGrid(distance: F26Dot6, compensation: F26Dot6): F26Dot6 {
	if (distance >= 0) {
		return ((distance + 16 + compensation) & -32);
	} else {
		return -(((-distance + 16 + compensation) & -32));
	}
}

/**
 * Round down to grid (floor to pixel)
 */
export function roundDownToGrid(distance: F26Dot6, compensation: F26Dot6): F26Dot6 {
	if (distance >= 0) {
		return ((distance + compensation) & -64);
	} else {
		return -(((compensation - distance) & -64));
	}
}

/**
 * Round up to grid (ceiling to pixel)
 */
export function roundUpToGrid(distance: F26Dot6, compensation: F26Dot6): F26Dot6 {
	if (distance >= 0) {
		return ((distance + 63 + compensation) & -64);
	} else {
		return -(((63 + compensation - distance) & -64));
	}
}

/**
 * No rounding
 */
export function roundOff(distance: F26Dot6, _compensation: F26Dot6): F26Dot6 {
	return distance;
}

/**
 * Super rounding (parametric rounding)
 */
export function roundSuper(
	distance: F26Dot6,
	compensation: F26Dot6,
	GS: GraphicsState,
): F26Dot6 {
	const { period, phase, threshold } = GS;

	if (distance >= 0) {
		const val = (distance + threshold - phase + compensation) & -period;
		return val + phase;
	} else {
		const val = ((-distance + threshold - phase + compensation) & -period);
		return -(val + phase);
	}
}

/**
 * Super rounding 45 degrees (for diagonal lines)
 */
export function roundSuper45(
	distance: F26Dot6,
	compensation: F26Dot6,
	GS: GraphicsState,
): F26Dot6 {
	// Same as super rounding but with 45-degree adjusted period
	// Period is multiplied by sqrt(2)/2 ≈ 0.707
	const { period, phase, threshold } = GS;
	const period45 = Math.round(period * 46 / 64); // sqrt(2)/2 ≈ 46/64

	if (distance >= 0) {
		const val = (distance + threshold - phase + compensation) & -period45;
		return val + phase;
	} else {
		const val = ((-distance + threshold - phase + compensation) & -period45);
		return -(val + phase);
	}
}

/**
 * Apply current rounding mode
 */
export function round(
	distance: F26Dot6,
	compensation: F26Dot6,
	GS: GraphicsState,
): F26Dot6 {
	switch (GS.roundState) {
		case RoundMode.ToGrid:
			return roundToGrid(distance, compensation);
		case RoundMode.ToHalfGrid:
			return roundToHalfGrid(distance, compensation);
		case RoundMode.ToDoubleGrid:
			return roundToDoubleGrid(distance, compensation);
		case RoundMode.DownToGrid:
			return roundDownToGrid(distance, compensation);
		case RoundMode.UpToGrid:
			return roundUpToGrid(distance, compensation);
		case RoundMode.Off:
			return roundOff(distance, compensation);
		case RoundMode.Super:
			return roundSuper(distance, compensation, GS);
		case RoundMode.Super45:
			return roundSuper45(distance, compensation, GS);
		default:
			return roundToGrid(distance, compensation);
	}
}

/**
 * Parse SROUND/S45ROUND selector byte
 */
export function parseSuperRound(selector: number, GS: GraphicsState): void {
	// Period selection (bits 6-7)
	switch ((selector >> 6) & 0x03) {
		case 0:
			GS.period = 32; // 1/2 pixel
			break;
		case 1:
			GS.period = 64; // 1 pixel
			break;
		case 2:
			GS.period = 128; // 2 pixels
			break;
		default:
			// Reserved
			GS.period = 64;
	}

	// Phase selection (bits 4-5)
	switch ((selector >> 4) & 0x03) {
		case 0:
			GS.phase = 0;
			break;
		case 1:
			GS.phase = GS.period >> 2; // period/4
			break;
		case 2:
			GS.phase = GS.period >> 1; // period/2
			break;
		case 3:
			GS.phase = (GS.period * 3) >> 2; // 3*period/4
			break;
	}

	// Threshold selection (bits 0-3)
	const thresholdBits = selector & 0x0f;
	if (thresholdBits === 0) {
		GS.threshold = GS.period - 1;
	} else {
		GS.threshold = ((thresholdBits - 4) * GS.period) >> 3;
	}
}

/**
 * Compensate distance for engine characteristics
 * Used with ROUND and movement instructions
 */
export function compensate(distance: F26Dot6, GS: GraphicsState): F26Dot6 {
	// Engine compensation is typically 0 for modern displays
	// But some fonts depend on it for grid-fitting
	return 0;
}
