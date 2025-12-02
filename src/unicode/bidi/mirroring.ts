/**
 * Bidi character mirroring
 * Port of bidi-js mirroring.js
 */

import data from "./mirroring.data.ts";
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

export function getMirroredCharacter(char: string): string | null {
	parse();
	return mirrorMap?.get(char) || null;
}

/**
 * Given a string and its resolved embedding levels, build a map of indices to replacement chars
 * for any characters in right-to-left segments that have defined mirrored characters.
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
		if (embeddingLevels[i]! & 1) {
			// only odd (rtl) levels
			const mirror = getMirroredCharacter(string[i]!);
			if (mirror !== null) {
				map.set(i, mirror);
			}
		}
	}
	return map;
}
