/**
 * Bidi reordering
 * Port of bidi-js reordering.js
 */

import { getBidiCharType, TRAILING_TYPES } from "./char-types.ts";
import type { EmbeddingLevelsResult } from "./embedding-levels.ts";
import { getMirroredCharacter } from "./mirroring.ts";

/**
 * Given a start and end denoting a single line within a string, and a set of precalculated
 * bidi embedding levels, produce a list of segments whose ordering should be flipped, in sequence.
 */
export function getReorderSegments(
	string: string,
	embeddingLevelsResult: EmbeddingLevelsResult,
	start?: number,
	end?: number,
): Array<[number, number]> {
	const strLen = string.length;
	start = Math.max(0, start == null ? 0 : +start);
	end = Math.min(strLen - 1, end == null ? strLen - 1 : +end);

	const segments: Array<[number, number]> = [];
	embeddingLevelsResult.paragraphs.forEach((paragraph) => {
		const lineStart = Math.max(start!, paragraph.start);
		const lineEnd = Math.min(end!, paragraph.end);
		if (lineStart < lineEnd) {
			// Local slice for mutation
			const lineLevels = embeddingLevelsResult.levels.slice(
				lineStart,
				lineEnd + 1,
			);

			// 3.4 L1.4: Reset any sequence of whitespace characters and/or isolate formatting characters at the
			// end of the line to the paragraph level.
			for (
				let i = lineEnd;
				i >= lineStart && getBidiCharType(string[i]!) & TRAILING_TYPES;
				i--
			) {
				lineLevels[i - lineStart] = paragraph.level;
			}

			// L2. From the highest level found in the text to the lowest odd level on each line, including intermediate levels
			// not actually present in the text, reverse any contiguous sequence of characters that are at that level or higher.
			let maxLevel = paragraph.level;
			let minOddLevel = Infinity;
			for (let i = 0; i < lineLevels.length; i++) {
				const level = lineLevels[i]!;
				if (level > maxLevel) maxLevel = level;
				if (level < minOddLevel) minOddLevel = level | 1;
			}
			for (let lvl = maxLevel; lvl >= minOddLevel; lvl--) {
				for (let i = 0; i < lineLevels.length; i++) {
					if (lineLevels[i]! >= lvl) {
						const segStart = i;
						while (i + 1 < lineLevels.length && lineLevels[i + 1]! >= lvl) {
							i++;
						}
						if (i > segStart) {
							segments.push([segStart + lineStart, i + lineStart]);
						}
					}
				}
			}
		}
	});
	return segments;
}

/**
 * Get the reordered string with bidi segments reversed
 */
export function getReorderedString(
	string: string,
	embedLevelsResult: EmbeddingLevelsResult,
	start?: number,
	end?: number,
): string {
	const indices = getReorderedIndices(string, embedLevelsResult, start, end);
	const chars = [...string];
	indices.forEach((charIndex, i) => {
		chars[i] =
			(embedLevelsResult.levels[charIndex]! & 1
				? getMirroredCharacter(string[charIndex]!)
				: null) || string[charIndex]!;
	});
	return chars.join("");
}

/**
 * Get an array with character indices in their new bidi order
 */
export function getReorderedIndices(
	string: string,
	embedLevelsResult: EmbeddingLevelsResult,
	start?: number,
	end?: number,
): number[] {
	const segments = getReorderSegments(string, embedLevelsResult, start, end);
	// Fill an array with indices
	const indices: number[] = [];
	for (let i = 0; i < string.length; i++) {
		indices[i] = i;
	}
	// Reverse each segment in order
	segments.forEach(([start, end]) => {
		const slice = indices.slice(start, end + 1);
		for (let i = slice.length; i--; ) {
			indices[end - i] = slice[i]!;
		}
	});
	return indices;
}
