import type {
	ClassTable,
	ContextualEntry,
	InsertionEntry,
	LigatureEntry,
	MorxContextualSubtable,
	MorxInsertionSubtable,
	MorxLigatureSubtable,
	MorxRearrangementSubtable,
} from "../font/tables/morx.ts";
import type { GlyphId, GlyphInfo } from "../types.ts";

/**
 * State machine driver for AAT processing
 */
export interface StateMachineContext {
	/** Current position in buffer */
	pos: number;
	/** Mark position (for some operations) */
	mark: number;
	/** Glyph stack for ligatures */
	stack: number[];
}

/**
 * Special class values
 */
const CLASS_END_OF_TEXT = 0;
const CLASS_OUT_OF_BOUNDS = 1;
const _CLASS_DELETED_GLYPH = 2;
const _CLASS_END_OF_LINE = 3;

/**
 * Get the class value for a glyph from the class table
 * @param classTable - The class lookup table
 * @param glyphId - The glyph ID to look up
 * @returns The class value, or CLASS_OUT_OF_BOUNDS if the glyph is not in the table
 */
export function getGlyphClass(
	classTable: ClassTable,
	glyphId: GlyphId,
): number {
	if (glyphId < 0 || glyphId >= classTable.classArray.length) {
		return CLASS_OUT_OF_BOUNDS;
	}
	return classTable.classArray[glyphId] ?? CLASS_OUT_OF_BOUNDS;
}

/**
 * Process rearrangement subtable to reorder glyphs based on state machine rules
 * @param subtable - The rearrangement subtable containing state machine and rules
 * @param infos - Array of glyph infos to be reordered in place
 */
export function processRearrangement(
	subtable: MorxRearrangementSubtable,
	infos: GlyphInfo[],
): void {
	const { stateTable } = subtable;
	let state = 0;
	let markFirst = 0;
	let markLast = 0;

	for (let i = 0; i <= infos.length; i++) {
		const isEnd = i >= infos.length;
		const glyphClass = isEnd
			? CLASS_END_OF_TEXT
			: getGlyphClass(stateTable.classTable, infos[i]?.glyphId);

		const stateRow = stateTable.stateArray[state];
		if (!stateRow) break;

		const entry = stateRow[glyphClass];
		if (!entry) break;

		const flags = entry.flags;

		// Set mark first
		if (flags & 0x8000) {
			markFirst = i;
		}

		// Set mark last
		if (flags & 0x2000) {
			markLast = i;
		}

		// Perform rearrangement
		const verb = flags & 0x000f;
		if (verb !== 0 && markFirst <= markLast && markLast < infos.length) {
			rearrangeGlyphs(infos, markFirst, markLast, verb);
		}

		// Don't advance if flag set
		if (!(flags & 0x4000)) {
			// Stay at current position
		}

		state = entry.newState;
	}
}

/**
 * Rearrangement verbs
 */
function rearrangeGlyphs(
	infos: GlyphInfo[],
	first: number,
	last: number,
	verb: number,
): void {
	if (first >= last || first >= infos.length || last >= infos.length) return;

	const a = infos[first];
	const b = infos[first + 1];
	const c = infos[last - 1];
	const d = infos[last];

	if (!a || !d) return;

	switch (verb) {
		case 1: // Ax => xA
			if (b) {
				infos[first] = b;
				infos[first + 1] = a;
			}
			break;
		case 2: // xD => Dx
			if (c) {
				infos[last] = c;
				infos[last - 1] = d;
			}
			break;
		case 3: // AxD => DxA
			infos[first] = d;
			infos[last] = a;
			break;
		case 4: // ABx => xAB
			if (b && c) {
				const temp = infos.slice(first, first + 2);
				const [tempFirst, tempSecond] = temp;
				const thirdItem = infos[first + 2];
				if (tempFirst && tempSecond && thirdItem) {
					infos[first] = thirdItem;
					infos[first + 1] = tempFirst;
					infos[first + 2] = tempSecond;
				}
			}
			break;
		case 5: // ABx => xBA
			if (b && c) {
				const temp = infos.slice(first, first + 2);
				const [tempFirst, tempSecond] = temp;
				const thirdItem = infos[first + 2];
				if (tempFirst && tempSecond && thirdItem) {
					infos[first] = thirdItem;
					infos[first + 1] = tempSecond;
					infos[first + 2] = tempFirst;
				}
			}
			break;
		case 6: // xCD => CDx
			if (c && b) {
				const temp = infos.slice(last - 1, last + 1);
				const [tempFirst, tempSecond] = temp;
				const prevItem = infos[last - 2];
				if (tempFirst && tempSecond && prevItem) {
					infos[last] = prevItem;
					infos[last - 1] = tempSecond;
					infos[last - 2] = tempFirst;
				}
			}
			break;
		case 7: // xCD => DCx
			if (c && b) {
				const temp = infos.slice(last - 1, last + 1);
				const [tempFirst, tempSecond] = temp;
				const prevItem = infos[last - 2];
				if (tempFirst && tempSecond && prevItem) {
					infos[last] = prevItem;
					infos[last - 1] = tempFirst;
					infos[last - 2] = tempSecond;
				}
			}
			break;
		case 8: // AxCD => CDxA
			if (c) {
				const tempA = a;
				infos[first] = c;
				infos[last - 1] = d;
				infos[last] = tempA;
			}
			break;
		case 9: // AxCD => DCxA
			if (c) {
				const tempA = a;
				infos[first] = d;
				infos[last - 1] = c;
				infos[last] = tempA;
			}
			break;
		case 10: // ABxD => DxAB
			if (b && c) {
				const tempA = a;
				const tempB = b;
				const tempC = c;
				infos[first] = d;
				infos[first + 1] = tempC;
				infos[last - 1] = tempA;
				infos[last] = tempB;
			}
			break;
		case 11: // ABxD => DxBA
			if (b && c) {
				const tempA = a;
				const tempB = b;
				const tempC = c;
				infos[first] = d;
				infos[first + 1] = tempC;
				infos[last - 1] = tempB;
				infos[last] = tempA;
			}
			break;
		case 12: // ABxCD => CDxAB
			if (b && c) {
				const tempAB = [a, b];
				infos[first] = c;
				infos[first + 1] = d;
				infos[last - 1] = tempAB[0];
				infos[last] = tempAB[1];
			}
			break;
		case 13: // ABxCD => CDxBA
			if (b && c) {
				const tempAB = [a, b];
				infos[first] = c;
				infos[first + 1] = d;
				infos[last - 1] = tempAB[1];
				infos[last] = tempAB[0];
			}
			break;
		case 14: // ABxCD => DCxAB
			if (b && c) {
				const tempAB = [a, b];
				infos[first] = d;
				infos[first + 1] = c;
				infos[last - 1] = tempAB[0];
				infos[last] = tempAB[1];
			}
			break;
		case 15: // ABxCD => DCxBA
			if (b && c) {
				const tempAB = [a, b];
				infos[first] = d;
				infos[first + 1] = c;
				infos[last - 1] = tempAB[1];
				infos[last] = tempAB[0];
			}
			break;
	}
}

/**
 * Process contextual substitution subtable to replace glyphs based on context
 * @param subtable - The contextual subtable containing state machine and substitution tables
 * @param infos - Array of glyph infos to be modified in place with contextual substitutions
 */
export function processContextual(
	subtable: MorxContextualSubtable,
	infos: GlyphInfo[],
): void {
	const { stateTable, substitutionTable } = subtable;
	let state = 0;
	let markIndex = -1;

	for (let i = 0; i <= infos.length; i++) {
		const isEnd = i >= infos.length;
		const glyphClass = isEnd
			? CLASS_END_OF_TEXT
			: getGlyphClass(stateTable.classTable, infos[i]?.glyphId);

		const stateRow = stateTable.stateArray[state];
		if (!stateRow) break;

		const entry = stateRow[glyphClass] as ContextualEntry | undefined;
		if (!entry) break;

		// Set mark
		if (entry.flags & 0x8000) {
			markIndex = i;
		}

		// Apply substitution at mark
		if (
			entry.markIndex !== 0xffff &&
			markIndex >= 0 &&
			markIndex < infos.length
		) {
			const substTable = substitutionTable[entry.markIndex];
			if (substTable) {
				const markedInfo = infos[markIndex];
				if (markedInfo) {
					const replacement = substTable.get(markedInfo.glyphId);
					if (replacement !== undefined) {
						markedInfo.glyphId = replacement;
					}
				}
			}
		}

		// Apply substitution at current
		if (!isEnd && entry.currentIndex !== 0xffff) {
			const substTable = substitutionTable[entry.currentIndex];
			if (substTable) {
				const currentInfo = infos[i];
				if (currentInfo) {
					const replacement = substTable.get(currentInfo.glyphId);
					if (replacement !== undefined) {
						currentInfo.glyphId = replacement;
					}
				}
			}
		}

		// Don't advance
		if (!(entry.flags & 0x4000)) {
			// Stay
		}

		state = entry.newState;
	}
}

/**
 * Process ligature subtable to combine multiple glyphs into ligatures
 * @param subtable - The ligature subtable containing state machine, actions, and component tables
 * @param infos - Array of glyph infos to process
 * @returns New array of glyph infos with ligatures applied and component glyphs removed
 */
export function processLigature(
	subtable: MorxLigatureSubtable,
	infos: GlyphInfo[],
): GlyphInfo[] {
	const { stateTable, ligatureActions, components, ligatures } = subtable;
	let state = 0;
	const stack: number[] = [];
	const result: GlyphInfo[] = [];
	const deleted = new Set<number>();

	for (let i = 0; i <= infos.length; i++) {
		const isEnd = i >= infos.length;
		const glyphClass = isEnd
			? CLASS_END_OF_TEXT
			: getGlyphClass(stateTable.classTable, infos[i]?.glyphId);

		const stateRow = stateTable.stateArray[state];
		if (!stateRow) break;

		const entry = stateRow[glyphClass] as LigatureEntry | undefined;
		if (!entry) break;

		// Push to stack
		if (entry.flags & 0x8000) {
			stack.push(i);
		}

		// Perform ligature action
		if (entry.flags & 0x2000 && entry.ligActionIndex < ligatureActions.length) {
			let actionIndex = entry.ligActionIndex;
			let ligatureGlyph: GlyphId = 0;
			const componentIndices: number[] = [];

			// Process action chain
			while (actionIndex < ligatureActions.length) {
				const action = ligatureActions[actionIndex];
				if (action === undefined) break;

				const last = (action & 0x80000000) !== 0;
				const store = (action & 0x40000000) !== 0;
				const componentOffset = ((action & 0x3fffffff) << 2) >> 2; // Sign extend

				const stackIdx = stack.pop();
				if (stackIdx !== undefined && stackIdx < infos.length) {
					componentIndices.push(stackIdx);
					const info = infos[stackIdx];
					if (info) {
						const componentIdx = componentOffset;

						if (componentIdx >= 0 && componentIdx < components.length) {
							const component = components[componentIdx];
							if (component !== undefined) {
								ligatureGlyph = ligatureGlyph + component;
							}
						}
					}
				}

				if (store && ligatureGlyph < ligatures.length) {
					// Replace first component with ligature
					const firstIdx = componentIndices[componentIndices.length - 1];
					if (firstIdx !== undefined && firstIdx < infos.length) {
						const firstInfo = infos[firstIdx];
						const ligature = ligatures[ligatureGlyph];
						if (firstInfo && ligature !== undefined) {
							firstInfo.glyphId = ligature;
							// Mark other components for deletion
							for (let j = 0; j < componentIndices.length; j++) {
								if (j < componentIndices.length - 1) {
									const idx = componentIndices[j]!;
									deleted.add(idx);
								}
							}
						}
					}
					ligatureGlyph = 0;
				}

				if (last) break;
				actionIndex++;
			}
		}

		// Don't advance
		if (!(entry.flags & 0x4000)) {
			// Stay
		}

		state = entry.newState;
	}

	// Build result without deleted glyphs
	for (let i = 0; i < infos.length; i++) {
		if (!deleted.has(i)) {
			const info = infos[i]!;
			result.push(info);
		}
	}

	return result;
}

/**
 * Process insertion subtable to insert additional glyphs before or after existing glyphs
 * @param subtable - The insertion subtable containing state machine and insertion glyph table
 * @param infos - Array of glyph infos to process
 * @returns New array of glyph infos with inserted glyphs added at specified positions
 */
export function processInsertion(
	subtable: MorxInsertionSubtable,
	infos: GlyphInfo[],
): GlyphInfo[] {
	const { stateTable, insertionGlyphs } = subtable;
	let state = 0;
	let markIndex = -1;
	const result: GlyphInfo[] = [];
	const insertions: Map<number, { before: GlyphId[]; after: GlyphId[] }> =
		new Map();

	for (let i = 0; i <= infos.length; i++) {
		const isEnd = i >= infos.length;
		const glyphClass = isEnd
			? CLASS_END_OF_TEXT
			: getGlyphClass(stateTable.classTable, infos[i]?.glyphId);

		const stateRow = stateTable.stateArray[state];
		if (!stateRow) break;

		const entry = stateRow[glyphClass] as InsertionEntry | undefined;
		if (!entry) break;

		// Set mark
		if (entry.flags & 0x8000) {
			markIndex = i;
		}

		// Insert at marked position
		if (entry.markedInsertIndex !== 0xffff && markIndex >= 0) {
			const count = (entry.flags >> 5) & 0x1f;
			const insertBefore = (entry.flags & 0x0800) !== 0;
			const glyphs = insertionGlyphs.slice(
				entry.markedInsertIndex,
				entry.markedInsertIndex + count,
			);

			let ins = insertions.get(markIndex);
			if (!ins) {
				ins = { before: [], after: [] };
				insertions.set(markIndex, ins);
			}
			if (insertBefore) {
				ins.before.push(...glyphs);
			} else {
				ins.after.push(...glyphs);
			}
		}

		// Insert at current position
		if (!isEnd && entry.currentInsertIndex !== 0xffff) {
			const count = entry.flags & 0x1f;
			const insertBefore = (entry.flags & 0x0020) !== 0;
			const glyphs = insertionGlyphs.slice(
				entry.currentInsertIndex,
				entry.currentInsertIndex + count,
			);

			let ins = insertions.get(i);
			if (!ins) {
				ins = { before: [], after: [] };
				insertions.set(i, ins);
			}
			if (insertBefore) {
				ins.before.push(...glyphs);
			} else {
				ins.after.push(...glyphs);
			}
		}

		// Don't advance
		if (!(entry.flags & 0x4000)) {
			// Stay
		}

		state = entry.newState;
	}

	// Build result with insertions
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i]!;
		const ins = insertions.get(i);

		if (ins) {
			// Insert before
			for (let j = 0; j < ins.before.length; j++) {
				const glyph = ins.before[j]!;
				result.push({
					glyphId: glyph,
					cluster: info.cluster,
					mask: info.mask,
					codepoint: 0,
				});
			}
		}

		result.push(info);

		if (ins) {
			// Insert after
			for (let j = 0; j < ins.after.length; j++) {
				const glyph = ins.after[j]!;
				result.push({
					glyphId: glyph,
					cluster: info.cluster,
					mask: info.mask,
					codepoint: 0,
				});
			}
		}
	}

	return result;
}
