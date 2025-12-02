/**
 * Bidi character type detection
 * Port of bidi-js charTypes.js
 */

import DATA from "./char-types.data.ts";

export const TYPES: Record<string, number> = {};
export const TYPES_TO_NAMES: Record<number, string> = {};
TYPES.L = 1; // L is the default
TYPES_TO_NAMES[1] = "L";

Object.keys(DATA).forEach((type, i) => {
	TYPES[type] = 1 << (i + 1);
	TYPES_TO_NAMES[TYPES[type]!] = type;
});

Object.freeze(TYPES);

export const ISOLATE_INIT_TYPES = TYPES.LRI! | TYPES.RLI! | TYPES.FSI!;
export const STRONG_TYPES = TYPES.L! | TYPES.R! | TYPES.AL!;
export const NEUTRAL_ISOLATE_TYPES =
	TYPES.B! |
	TYPES.S! |
	TYPES.WS! |
	TYPES.ON! |
	TYPES.FSI! |
	TYPES.LRI! |
	TYPES.RLI! |
	TYPES.PDI!;
export const BN_LIKE_TYPES =
	TYPES.BN! | TYPES.RLE! | TYPES.LRE! | TYPES.RLO! | TYPES.LRO! | TYPES.PDF!;
export const TRAILING_TYPES =
	TYPES.S! |
	TYPES.WS! |
	TYPES.B! |
	ISOLATE_INIT_TYPES |
	TYPES.PDI! |
	BN_LIKE_TYPES;

let map: Map<number, number> | null = null;

function parseData(): void {
	if (!map) {
		map = new Map();
		let lastCode = 0;
		for (const type in DATA) {
			if (Object.hasOwn(DATA, type)) {
				const segments = DATA[type as keyof typeof DATA];
				let temp = "";
				let start = 0;
				let end: number;
				let state = false;
				for (let i = 0; i <= segments.length + 1; i += 1) {
					const char = segments[i];
					if (char !== "," && i !== segments.length) {
						if (char === "+") {
							state = true;
							lastCode = start = lastCode + parseInt(temp, 36);
							temp = "";
						} else {
							temp += char;
						}
					} else {
						if (!state) {
							lastCode = start = lastCode + parseInt(temp, 36);
							end = start;
						} else {
							end = start + parseInt(temp, 36);
						}
						state = false;
						temp = "";
						lastCode = end;
						for (let j = start; j < end + 1; j += 1) {
							map.set(j, TYPES[type]!);
						}
					}
				}
			}
		}
	}
}

/**
 * Get the bidi character type for a character
 */
export function getBidiCharType(char: string): number {
	parseData();
	return map?.get(char.codePointAt(0)!) || TYPES.L!;
}

/**
 * Get the name of a bidi character type
 */
export function getBidiCharTypeName(char: string): string {
	return TYPES_TO_NAMES[getBidiCharType(char)]!;
}
