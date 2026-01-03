/**
 * Fixed-point scaling helpers (match FreeType rounding behavior).
 */

// Multiply by 16.16 fixed-point with rounding, ties away from zero.
export function mulFix(value: number, scaleFix: number): number {
	if (value === 0 || scaleFix === 0) return 0;
	let sign = 1;
	let a = value;
	let b = scaleFix;
	if (a < 0) {
		a = -a;
		sign = -sign;
	}
	if (b < 0) {
		b = -b;
		sign = -sign;
	}
	const result = Math.floor((a * b + 0x8000) / 0x10000);
	return sign < 0 ? -result : result;
}

// Divide with 16.16 fixed-point result, rounding to nearest.
export function divFix(value: number, divisor: number): number {
	if (divisor === 0) return value < 0 ? -0x7fffffff : 0x7fffffff;
	let sign = 1;
	let a = value;
	let b = divisor;
	if (a < 0) {
		a = -a;
		sign = -sign;
	}
	if (b < 0) {
		b = -b;
		sign = -sign;
	}
	const result = Math.floor((a * 0x10000 + (b >> 1)) / b);
	return sign < 0 ? -result : result;
}

// Scale font units to 26.6 using a 16.16 scale factor.
export function scaleFUnits(value: number, scaleFix: number): number {
	return mulFix(value, scaleFix);
}
