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

export function openingToClosingBracket(char: string): string | null {
	parse();
	return openToClose?.get(char) || null;
}

export function closingToOpeningBracket(char: string): string | null {
	parse();
	return closeToOpen?.get(char) || null;
}

export function getCanonicalBracket(char: string): string | null {
	parse();
	return canonical?.get(char) || null;
}
