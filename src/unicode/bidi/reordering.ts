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
	const startPos = Math.max(0, start == null ? 0 : +start);
	const endPos = Math.min(strLen - 1, end == null ? strLen - 1 : +end);

	const segments: Array<[number, number]> = [];
	for (let i = 0; i < embeddingLevelsResult.paragraphs.length; i++) {
		const paragraph = embeddingLevelsResult.paragraphs[i]!;
		const lineStart = Math.max(startPos, paragraph.start);
		const lineEnd = Math.min(endPos, paragraph.end);
		if (lineStart < lineEnd) {
			// Local slice for mutation
			const lineLevels = embeddingLevelsResult.levels.slice(
				lineStart,
				lineEnd + 1,
			);

			// 3.4 L1.4: Reset any sequence of whitespace characters and/or isolate formatting characters at the
			// end of the line to the paragraph level.
			for (let i = lineEnd; i >= lineStart; i--) {
				const char = string[i];
				if (char === undefined) break;
				if (!(getBidiCharType(char) & TRAILING_TYPES)) break;
				lineLevels[i - lineStart] = paragraph.level;
			}

			// L2. From the highest level found in the text to the lowest odd level on each line, including intermediate levels
			// not actually present in the text, reverse any contiguous sequence of characters that are at that level or higher.
			let maxLevel = paragraph.level;
			let minOddLevel = Infinity;
			for (let i = 0; i < lineLevels.length; i++) {
				const level = lineLevels[i] ?? 0;
				if (level > maxLevel) maxLevel = level;
				if (level < minOddLevel) minOddLevel = level | 1;
			}
			for (let lvl = maxLevel; lvl >= minOddLevel; lvl--) {
				for (let i = 0; i < lineLevels.length; i++) {
					const level = lineLevels[i] ?? 0;
					if (level >= lvl) {
						const segStart = i;
						while (i + 1 < lineLevels.length) {
							const nextLevel = lineLevels[i + 1] ?? 0;
							if (nextLevel < lvl) break;
							i++;
						}
						if (i > segStart) {
							segments.push([segStart + lineStart, i + lineStart]);
						}
					}
				}
			}
		}
	}
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
	for (let i = 0; i < indices.length; i++) {
		const charIndex = indices[i] ?? 0;
		const level = embedLevelsResult.levels[charIndex] ?? 0;
		const originalChar = string[charIndex] ?? "";
		if (level & 1) {
			const mirrored = getMirroredCharacter(originalChar);
			chars[i] = mirrored ?? originalChar;
		} else {
			chars[i] = originalChar;
		}
	}
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
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i]!;
		const segStart = segment[0];
		const segEnd = segment[1];
		const slice = indices.slice(segStart, segEnd + 1);
		for (let j = slice.length; j--; ) {
			const val = slice[j];
			if (val !== undefined) {
				indices[segEnd - j] = val;
			}
		}
	}
	return indices;
}
