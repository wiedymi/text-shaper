/**
 * Bidi character type detection
 * Port of bidi-js charTypes.js
 */

import DATA from "./char-types.gen.ts";

export const TYPES: Record<string, number> = {};
export const TYPES_TO_NAMES: Record<number, string> = {};
TYPES.L = 1; // L is the default
TYPES_TO_NAMES[1] = "L";

Object.keys(DATA).forEach((type, i) => {
	TYPES[type] = 1 << (i + 1);
	const typeVal = TYPES[type];
	if (typeVal !== undefined) {
		TYPES_TO_NAMES[typeVal] = type;
	}
});

Object.freeze(TYPES);

// Helper to get type value with fallback
function getType(name: string): number {
	return TYPES[name] ?? 0;
}

export const ISOLATE_INIT_TYPES =
	getType("LRI") | getType("RLI") | getType("FSI");
export const STRONG_TYPES = getType("L") | getType("R") | getType("AL");
export const NEUTRAL_ISOLATE_TYPES =
	getType("B") |
	getType("S") |
	getType("WS") |
	getType("ON") |
	getType("FSI") |
	getType("LRI") |
	getType("RLI") |
	getType("PDI");
export const BN_LIKE_TYPES =
	getType("BN") |
	getType("RLE") |
	getType("LRE") |
	getType("RLO") |
	getType("LRO") |
	getType("PDF");
export const TRAILING_TYPES =
	getType("S") |
	getType("WS") |
	getType("B") |
	ISOLATE_INIT_TYPES |
	getType("PDI") |
	BN_LIKE_TYPES;

let map: Map<number, number> | null = null;

function parseData(): void {
	if (!map) {
		map = new Map();
		let start = 0;
		for (const type in DATA) {
			if (Object.hasOwn(DATA, type)) {
				const segments = DATA[type as keyof typeof DATA];
				let temp = "";
				let end = 0;
				let state = false;
				let lastCode = 0; // Reset for each type - data is encoded relative to 0
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
						const typeVal = getType(type);
						for (let j = start; j < end + 1; j += 1) {
							map.set(j, typeVal);
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
	const codepoint = char.codePointAt(0);
	if (codepoint === undefined) return getType("L");
	return map?.get(codepoint) ?? getType("L");
}

/**
 * Get the name of a bidi character type
 */
export function getBidiCharTypeName(char: string): string {
	return TYPES_TO_NAMES[getBidiCharType(char)] ?? "L";
}
