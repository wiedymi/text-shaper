/**
 * Bidi character mirroring
 * Port of bidi-js mirroring.js
 */

import data from "./mirroring.gen.ts";
import { parseCharacterMap } from "./parse-character-map.ts";

let mirrorMap: Map<string, string> | null = null;

function parse(): void {
	if (!mirrorMap) {
		const { map, reverseMap } = parseCharacterMap(data, true);
		// Combine both maps into one
		if (reverseMap) {
			reverseMap.forEach((value, key) => {
				map.set(key, value);
			});
		}
		mirrorMap = map;
	}
}

/**
 * Get the mirrored version of a character for BiDi display
 * @param char Character to mirror
 * @returns Mirrored character, or null if character has no mirror
 */
export function getMirroredCharacter(char: string): string | null {
	parse();
	return mirrorMap?.get(char) || null;
}

/**
 * Given a string and its resolved embedding levels, build a map of indices to replacement chars
 * for any characters in right-to-left segments that have defined mirrored characters.
 * @param string Text string to process
 * @param embeddingLevels Resolved embedding levels from getEmbeddingLevels
 * @param start Start index (defaults to 0)
 * @param end End index (defaults to string length - 1)
 * @returns Map of character indices to their mirrored replacements
 */
export function getMirroredCharactersMap(
	string: string,
	embeddingLevels: Uint8Array,
	start?: number,
	end?: number,
): Map<number, string> {
	const strLen = string.length;
	start = Math.max(0, start == null ? 0 : +start);
	end = Math.min(strLen - 1, end == null ? strLen - 1 : +end);

	const map = new Map<number, string>();
	for (let i = start; i <= end; i++) {
		if (embeddingLevels[i] & 1) {
			// only odd (rtl) levels
			const mirror = getMirroredCharacter(string[i]);
			if (mirror !== null) {
				map.set(i, mirror);
			}
		}
	}
	return map;
}
