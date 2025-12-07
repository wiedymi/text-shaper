/**
 * Bidi bracket pair functions
 * Port of bidi-js brackets.js
 */

import data from "./brackets.gen.ts";
import { parseCharacterMap } from "./parse-character-map.ts";

let openToClose: Map<string, string> | null = null;
let closeToOpen: Map<string, string> | null = null;
let canonical: Map<string, string> | null = null;

function parse(): void {
	if (!openToClose) {
		const { map, reverseMap } = parseCharacterMap(data.pairs, true);
		openToClose = map;
		closeToOpen = reverseMap;
		canonical = parseCharacterMap(data.canonical, false).map;
	}
}

/**
 * Get the closing bracket character for an opening bracket
 * @param char Opening bracket character
 * @returns Corresponding closing bracket character, or null if not an opening bracket
 */
export function openingToClosingBracket(char: string): string | null {
	parse();
	return openToClose?.get(char) || null;
}

/**
 * Get the opening bracket character for a closing bracket
 * @param char Closing bracket character
 * @returns Corresponding opening bracket character, or null if not a closing bracket
 */
export function closingToOpeningBracket(char: string): string | null {
	parse();
	return closeToOpen?.get(char) || null;
}

/**
 * Get the canonical bracket character for a bracket
 * @param char Bracket character
 * @returns Canonical form of the bracket character, or null if not applicable
 */
export function getCanonicalBracket(char: string): string | null {
	parse();
	return canonical?.get(char) || null;
}
