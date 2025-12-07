/**
 * Exact bounding box calculation for paths with bezier curves
 *
 * Bezier curves can extend beyond their control points, so we need to find
 * the actual extrema by solving for where the derivative equals zero.
 */

import type { GlyphPath } from "../render/path.ts";

/**
 * Bounding box in 2D space
 */
export interface BBox {
	xMin: number;
	yMin: number;
	xMax: number;
	yMax: number;
}

/**
 * Calculate exact bounding box for a path
 *
 * For line segments: min/max of endpoints
 * For quadratic bezier: find t where derivative = 0, evaluate curve at those t values
 * For cubic bezier: solve quadratic for extrema, evaluate curve at those t values
 *
 * @param path - Path to calculate bounds for
 * @returns Bounding box or null for empty path
 */
export function getExactBounds(path: GlyphPath): BBox | null {
	if (!path.commands || path.commands.length === 0) {
		return null;
	}

	let xMin = Infinity;
	let yMin = Infinity;
	let xMax = -Infinity;
	let yMax = -Infinity;

	let currentX = 0;
	let currentY = 0;
	let hasPoints = false;

	const updateBounds = (x: number, y: number) => {
		xMin = Math.min(xMin, x);
		yMin = Math.min(yMin, y);
		xMax = Math.max(xMax, x);
		yMax = Math.max(yMax, y);
		hasPoints = true;
	};

	for (let i = 0; i < path.commands.length; i++) {
		const cmd = path.commands[i]!;
		switch (cmd.type) {
			case "M": {
				currentX = cmd.x;
				currentY = cmd.y;
				updateBounds(currentX, currentY);
				break;
			}

			case "L": {
				currentX = cmd.x;
				currentY = cmd.y;
				updateBounds(currentX, currentY);
				break;
			}

			case "Q": {
				// Quadratic bezier from (currentX, currentY) to (cmd.x, cmd.y)
				// with control point (cmd.x1, cmd.y1)

				// Check start point (already in bounds from previous command)
				// Check end point
				updateBounds(cmd.x, cmd.y);

				// Find extrema in X direction
				const xExtrema = getQuadraticExtrema(currentX, cmd.x1, cmd.x);
				for (let j = 0; j < xExtrema.length; j++) {
					const t = xExtrema[j]!;
					const x = evaluateQuadratic(currentX, cmd.x1, cmd.x, t);
					updateBounds(x, currentY); // Use current Y temporarily
				}

				// Find extrema in Y direction
				const yExtrema = getQuadraticExtrema(currentY, cmd.y1, cmd.y);
				for (let j = 0; j < yExtrema.length; j++) {
					const t = yExtrema[j]!;
					const y = evaluateQuadratic(currentY, cmd.y1, cmd.y, t);
					updateBounds(currentX, y); // Use current X temporarily
				}

				// Evaluate both X and Y at extrema points
				const allExtrema = new Set([...xExtrema, ...yExtrema]);
				const extremaArray = Array.from(allExtrema);
				for (let j = 0; j < extremaArray.length; j++) {
					const t = extremaArray[j]!;
					const x = evaluateQuadratic(currentX, cmd.x1, cmd.x, t);
					const y = evaluateQuadratic(currentY, cmd.y1, cmd.y, t);
					updateBounds(x, y);
				}

				currentX = cmd.x;
				currentY = cmd.y;
				break;
			}

			case "C": {
				// Cubic bezier from (currentX, currentY) to (cmd.x, cmd.y)
				// with control points (cmd.x1, cmd.y1) and (cmd.x2, cmd.y2)

				// Check end point
				updateBounds(cmd.x, cmd.y);

				// Find extrema in X direction
				const xExtrema = getCubicExtrema(currentX, cmd.x1, cmd.x2, cmd.x);
				for (let j = 0; j < xExtrema.length; j++) {
					const t = xExtrema[j]!;
					const x = evaluateCubic(currentX, cmd.x1, cmd.x2, cmd.x, t);
					updateBounds(x, currentY); // Use current Y temporarily
				}

				// Find extrema in Y direction
				const yExtrema = getCubicExtrema(currentY, cmd.y1, cmd.y2, cmd.y);
				for (let j = 0; j < yExtrema.length; j++) {
					const t = yExtrema[j]!;
					const y = evaluateCubic(currentY, cmd.y1, cmd.y2, cmd.y, t);
					updateBounds(currentX, y); // Use current X temporarily
				}

				// Evaluate both X and Y at extrema points
				const allExtrema = new Set([...xExtrema, ...yExtrema]);
				const extremaArray = Array.from(allExtrema);
				for (let j = 0; j < extremaArray.length; j++) {
					const t = extremaArray[j]!;
					const x = evaluateCubic(currentX, cmd.x1, cmd.x2, cmd.x, t);
					const y = evaluateCubic(currentY, cmd.y1, cmd.y2, cmd.y, t);
					updateBounds(x, y);
				}

				currentX = cmd.x;
				currentY = cmd.y;
				break;
			}

			case "Z": {
				// Close path - no bounds update needed
				break;
			}
		}
	}

	if (!hasPoints) {
		return null;
	}

	return { xMin, yMin, xMax, yMax };
}

/**
 * Find t values where a quadratic bezier has extrema
 *
 * For quadratic bezier B(t) = (1-t)²p0 + 2(1-t)t*p1 + t²p2
 * Derivative: B'(t) = 2(1-t)(p1-p0) + 2t(p2-p1)
 *                   = 2(p1-p0) + 2t(p0-2p1+p2)
 *                   = 2[(p1-p0) + t(p0-2p1+p2)]
 *
 * Set B'(t) = 0:
 * (p1-p0) + t(p0-2p1+p2) = 0
 * t = -(p1-p0)/(p0-2p1+p2)
 *   = (p0-p1)/(p0-2p1+p2)
 *
 * @param p0 - Start point
 * @param p1 - Control point
 * @param p2 - End point
 * @returns Array of t values in [0,1] where extrema occur
 */
export function getQuadraticExtrema(
	p0: number,
	p1: number,
	p2: number,
): number[] {
	const denominator = p0 - 2 * p1 + p2;

	// If denominator is zero, the curve is linear (no extrema)
	if (Math.abs(denominator) < 1e-10) {
		return [];
	}

	const t = (p0 - p1) / denominator;

	// Only include t values in the valid range [0, 1]
	if (t > 0 && t < 1) {
		return [t];
	}

	return [];
}

/**
 * Find t values where a cubic bezier has extrema
 *
 * For cubic bezier B(t) = (1-t)³p0 + 3(1-t)²t*p1 + 3(1-t)t²p2 + t³p3
 * Derivative: B'(t) = 3(1-t)²(p1-p0) + 6(1-t)t(p2-p1) + 3t²(p3-p2)
 *
 * Simplified: B'(t) = at² + bt + c where:
 * a = 3(p3 - 3p2 + 3p1 - p0)
 * b = 6(p2 - 2p1 + p0)
 * c = 3(p1 - p0)
 *
 * Solve using quadratic formula: t = (-b ± √(b²-4ac)) / 2a
 *
 * @param p0 - Start point
 * @param p1 - First control point
 * @param p2 - Second control point
 * @param p3 - End point
 * @returns Array of t values in [0,1] where extrema occur
 */
export function getCubicExtrema(
	p0: number,
	p1: number,
	p2: number,
	p3: number,
): number[] {
	const a = 3 * (p3 - 3 * p2 + 3 * p1 - p0);
	const b = 6 * (p2 - 2 * p1 + p0);
	const c = 3 * (p1 - p0);

	const extrema: number[] = [];

	// If a is zero, we have a linear or quadratic equation
	if (Math.abs(a) < 1e-10) {
		// If b is also zero, there are no extrema (constant derivative)
		if (Math.abs(b) < 1e-10) {
			return [];
		}
		// Linear equation: bt + c = 0 => t = -c/b
		const t = -c / b;
		if (t > 0 && t < 1) {
			extrema.push(t);
		}
		return extrema;
	}

	// Quadratic formula
	const discriminant = b * b - 4 * a * c;

	// No real solutions
	if (discriminant < 0) {
		return [];
	}

	// One solution (discriminant = 0)
	if (Math.abs(discriminant) < 1e-10) {
		const t = -b / (2 * a);
		if (t > 0 && t < 1) {
			extrema.push(t);
		}
		return extrema;
	}

	// Two solutions
	const sqrtD = Math.sqrt(discriminant);
	const t1 = (-b + sqrtD) / (2 * a);
	const t2 = (-b - sqrtD) / (2 * a);

	if (t1 > 0 && t1 < 1) {
		extrema.push(t1);
	}
	if (t2 > 0 && t2 < 1) {
		extrema.push(t2);
	}

	return extrema;
}

/**
 * Evaluate quadratic bezier at parameter t
 *
 * B(t) = (1-t)²p0 + 2(1-t)t*p1 + t²p2
 *
 * @param p0 - Start point
 * @param p1 - Control point
 * @param p2 - End point
 * @param t - Parameter in [0,1]
 * @returns Value at t
 */
export function evaluateQuadratic(
	p0: number,
	p1: number,
	p2: number,
	t: number,
): number {
	const oneMinusT = 1 - t;
	return oneMinusT * oneMinusT * p0 + 2 * oneMinusT * t * p1 + t * t * p2;
}

/**
 * Evaluate cubic bezier at parameter t
 *
 * B(t) = (1-t)³p0 + 3(1-t)²t*p1 + 3(1-t)t²p2 + t³p3
 *
 * @param p0 - Start point
 * @param p1 - First control point
 * @param p2 - Second control point
 * @param p3 - End point
 * @param t - Parameter in [0,1]
 * @returns Value at t
 */
export function evaluateCubic(
	p0: number,
	p1: number,
	p2: number,
	p3: number,
	t: number,
): number {
	const oneMinusT = 1 - t;
	const oneMinusT2 = oneMinusT * oneMinusT;
	const t2 = t * t;

	return (
		oneMinusT2 * oneMinusT * p0 +
		3 * oneMinusT2 * t * p1 +
		3 * oneMinusT * t2 * p2 +
		t2 * t * p3
	);
}
