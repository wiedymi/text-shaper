/**
 * Bidi embedding levels calculation (UAX #9)
 * Port of bidi-js embeddingLevels.js
 */

import {
	closingToOpeningBracket,
	getCanonicalBracket,
	openingToClosingBracket,
} from "./brackets.ts";
import {
	BN_LIKE_TYPES,
	getBidiCharType,
	ISOLATE_INIT_TYPES,
	NEUTRAL_ISOLATE_TYPES,
	STRONG_TYPES,
	TRAILING_TYPES,
	TYPES,
} from "./char-types.ts";

// Local type aliases
const TYPE_L = TYPES.L ?? 1;
const TYPE_R = TYPES.R ?? 2;
const TYPE_EN = TYPES.EN ?? 4;
const TYPE_ES = TYPES.ES ?? 8;
const TYPE_ET = TYPES.ET ?? 16;
const TYPE_AN = TYPES.AN ?? 32;
const TYPE_CS = TYPES.CS ?? 64;
const TYPE_B = TYPES.B ?? 128;
const TYPE_S = TYPES.S ?? 256;
const TYPE_ON = TYPES.ON ?? 512;
const TYPE_BN = TYPES.BN ?? 1024;
const TYPE_NSM = TYPES.NSM ?? 2048;
const TYPE_AL = TYPES.AL ?? 4096;
const TYPE_LRO = TYPES.LRO ?? 8192;
const TYPE_RLO = TYPES.RLO ?? 16384;
const TYPE_LRE = TYPES.LRE ?? 32768;
const TYPE_RLE = TYPES.RLE ?? 65536;
const TYPE_PDF = TYPES.PDF ?? 131072;
const TYPE_LRI = TYPES.LRI ?? 262144;
const TYPE_RLI = TYPES.RLI ?? 524288;
const TYPE_FSI = TYPES.FSI ?? 1048576;
const TYPE_PDI = TYPES.PDI ?? 2097152;

export interface EmbeddingLevelsResult {
	paragraphs: Array<{ start: number; end: number; level: number }>;
	levels: Uint8Array;
}

interface StatusStackEntry {
	_level: number;
	_override: number;
	_isolate: number;
	_isolInitIndex?: number;
}

interface LevelRun {
	_start: number;
	_end: number;
	_level: number;
	_startsWithPDI: boolean;
	_endsWithIsolInit: boolean;
}

interface IsolatingRunSeq {
	_seqIndices: number[];
	_sosType: number;
	_eosType: number;
}

function getCharType(charTypes: Uint32Array, i: number): number {
	return charTypes[i] ?? 0;
}

function getSeqIndex(seqIndices: number[], i: number): number {
	return seqIndices[i] ?? 0;
}

function getCharAt(s: string, i: number): string {
	return s[i] ?? "";
}

/**
 * This function applies the Bidirectional Algorithm to a string, returning the resolved embedding levels
 * in a single Uint8Array plus a list of objects holding each paragraph's start and end indices and resolved
 * base embedding level.
 */
export function getEmbeddingLevels(
	string: string,
	baseDirection?: "ltr" | "rtl" | "auto",
): EmbeddingLevelsResult {
	const MAX_DEPTH = 125;

	// Start by mapping all characters to their unicode type, as a bitmask integer
	const charTypes = new Uint32Array(string.length);
	for (let i = 0; i < string.length; i++) {
		charTypes[i] = getBidiCharType(getCharAt(string, i));
	}

	const charTypeCounts = new Map<number, number>();

	function changeCharType(i: number, type: number): void {
		const oldType = getCharType(charTypes, i);
		charTypes[i] = type;
		charTypeCounts.set(oldType, (charTypeCounts.get(oldType) ?? 0) - 1);
		if (oldType & NEUTRAL_ISOLATE_TYPES) {
			charTypeCounts.set(
				NEUTRAL_ISOLATE_TYPES,
				(charTypeCounts.get(NEUTRAL_ISOLATE_TYPES) ?? 0) - 1,
			);
		}
		charTypeCounts.set(type, (charTypeCounts.get(type) ?? 0) + 1);
		if (type & NEUTRAL_ISOLATE_TYPES) {
			charTypeCounts.set(
				NEUTRAL_ISOLATE_TYPES,
				(charTypeCounts.get(NEUTRAL_ISOLATE_TYPES) ?? 0) + 1,
			);
		}
	}

	const embedLevels = new Uint8Array(string.length);
	const isolationPairs = new Map<number, number>();

	const paragraphs: Array<{ start: number; end: number; level: number }> = [];
	let paragraph: { start: number; end: number; level: number } | null = null;

	function determineAutoEmbedLevel(start: number, isFSI: boolean): number {
		for (let i = start; i < string.length; i++) {
			const charType = getCharType(charTypes, i);
			if (charType & (TYPE_R | TYPE_AL)) {
				return 1;
			}
			if (charType & (TYPE_B | TYPE_L) || (isFSI && charType === TYPE_PDI)) {
				return 0;
			}
			if (charType & ISOLATE_INIT_TYPES) {
				const pdi = indexOfMatchingPDI(i);
				i = pdi === -1 ? string.length : pdi;
			}
		}
		return 0;
	}

	function indexOfMatchingPDI(isolateStart: number): number {
		let isolationLevel = 1;
		for (let i = isolateStart + 1; i < string.length; i++) {
			const charType = getCharType(charTypes, i);
			if (charType & TYPE_B) {
				break;
			}
			if (charType & TYPE_PDI) {
				if (--isolationLevel === 0) {
					return i;
				}
			} else if (charType & ISOLATE_INIT_TYPES) {
				isolationLevel++;
			}
		}
		return -1;
	}

	for (let i = 0; i < string.length; i++) {
		if (!paragraph) {
			paragraph = {
				start: i,
				end: string.length - 1,
				level:
					baseDirection === "rtl"
						? 1
						: baseDirection === "ltr"
							? 0
							: determineAutoEmbedLevel(i, false),
			};
			paragraphs.push(paragraph);
		}
		if (getCharType(charTypes, i) & TYPE_B) {
			paragraph.end = i;
			paragraph = null;
		}
	}

	const FORMATTING_TYPES =
		TYPE_RLE |
		TYPE_LRE |
		TYPE_RLO |
		TYPE_LRO |
		ISOLATE_INIT_TYPES |
		TYPE_PDI |
		TYPE_PDF |
		TYPE_B;
	const nextEven = (n: number): number => n + (n & 1 ? 1 : 2);
	const nextOdd = (n: number): number => n + (n & 1 ? 2 : 1);

	for (let paraIdx = 0; paraIdx < paragraphs.length; paraIdx++) {
		const para = paragraphs[paraIdx];
		if (!para) continue;
		paragraph = para;

		const statusStack: StatusStackEntry[] = [
			{
				_level: paragraph.level,
				_override: 0,
				_isolate: 0,
			},
		];

		let overflowIsolateCount = 0;
		let overflowEmbeddingCount = 0;
		let validIsolateCount = 0;
		charTypeCounts.clear();

		for (let i = paragraph.start; i <= paragraph.end; i++) {
			let charType = getCharType(charTypes, i);
			let stackTop = statusStack[statusStack.length - 1];
			if (!stackTop) continue;

			charTypeCounts.set(charType, (charTypeCounts.get(charType) ?? 0) + 1);
			if (charType & NEUTRAL_ISOLATE_TYPES) {
				charTypeCounts.set(
					NEUTRAL_ISOLATE_TYPES,
					(charTypeCounts.get(NEUTRAL_ISOLATE_TYPES) ?? 0) + 1,
				);
			}

			if (charType & FORMATTING_TYPES) {
				if (charType & (TYPE_RLE | TYPE_LRE)) {
					embedLevels[i] = stackTop._level;
					const level = (charType === TYPE_RLE ? nextOdd : nextEven)(
						stackTop._level,
					);
					if (
						level <= MAX_DEPTH &&
						!overflowIsolateCount &&
						!overflowEmbeddingCount
					) {
						statusStack.push({
							_level: level,
							_override: 0,
							_isolate: 0,
						});
					} else if (!overflowIsolateCount) {
						overflowEmbeddingCount++;
					}
				} else if (charType & (TYPE_RLO | TYPE_LRO)) {
					embedLevels[i] = stackTop._level;
					const level = (charType === TYPE_RLO ? nextOdd : nextEven)(
						stackTop._level,
					);
					if (
						level <= MAX_DEPTH &&
						!overflowIsolateCount &&
						!overflowEmbeddingCount
					) {
						statusStack.push({
							_level: level,
							_override: charType & TYPE_RLO ? TYPE_R : TYPE_L,
							_isolate: 0,
						});
					} else if (!overflowIsolateCount) {
						overflowEmbeddingCount++;
					}
				} else if (charType & ISOLATE_INIT_TYPES) {
					if (charType & TYPE_FSI) {
						charType =
							determineAutoEmbedLevel(i + 1, true) === 1 ? TYPE_RLI : TYPE_LRI;
					}

					embedLevels[i] = stackTop._level;
					if (stackTop._override) {
						changeCharType(i, stackTop._override);
					}
					const level = (charType === TYPE_RLI ? nextOdd : nextEven)(
						stackTop._level,
					);
					if (
						level <= MAX_DEPTH &&
						overflowIsolateCount === 0 &&
						overflowEmbeddingCount === 0
					) {
						validIsolateCount++;
						statusStack.push({
							_level: level,
							_override: 0,
							_isolate: 1,
							_isolInitIndex: i,
						});
					} else {
						overflowIsolateCount++;
					}
				} else if (charType & TYPE_PDI) {
					if (overflowIsolateCount > 0) {
						overflowIsolateCount--;
					} else if (validIsolateCount > 0) {
						overflowEmbeddingCount = 0;
						while (statusStack.length > 0) {
							const top = statusStack[statusStack.length - 1];
							if (top?._isolate) break;
							statusStack.pop();
						}
						const top = statusStack[statusStack.length - 1];
						const isolInitIndex = top?._isolInitIndex;
						if (isolInitIndex != null) {
							isolationPairs.set(isolInitIndex, i);
							isolationPairs.set(i, isolInitIndex);
						}
						statusStack.pop();
						validIsolateCount--;
					}
					stackTop = statusStack[statusStack.length - 1];
					if (!stackTop) continue;
					embedLevels[i] = stackTop._level;
					if (stackTop._override) {
						changeCharType(i, stackTop._override);
					}
				} else if (charType & TYPE_PDF) {
					if (overflowIsolateCount === 0) {
						if (overflowEmbeddingCount > 0) {
							overflowEmbeddingCount--;
						} else if (!stackTop._isolate && statusStack.length > 1) {
							statusStack.pop();
							stackTop = statusStack[statusStack.length - 1];
							if (!stackTop) continue;
						}
					}
					embedLevels[i] = stackTop._level;
				} else if (charType & TYPE_B) {
					embedLevels[i] = paragraph.level;
				}
			} else {
				embedLevels[i] = stackTop._level;
				if (stackTop._override && charType !== TYPE_BN) {
					changeCharType(i, stackTop._override);
				}
			}
		}

		const levelRuns: LevelRun[] = [];
		let currentRun: LevelRun | null = null;
		for (let i = paragraph.start; i <= paragraph.end; i++) {
			const charType = getCharType(charTypes, i);
			if (!(charType & BN_LIKE_TYPES)) {
				const lvl = embedLevels[i] ?? 0;
				const isIsolInit = !!(charType & ISOLATE_INIT_TYPES);
				const isPDI = charType === TYPE_PDI;
				if (currentRun && lvl === currentRun._level) {
					currentRun._end = i;
					currentRun._endsWithIsolInit = isIsolInit;
				} else {
					currentRun = {
						_start: i,
						_end: i,
						_level: lvl,
						_startsWithPDI: isPDI,
						_endsWithIsolInit: isIsolInit,
					};
					levelRuns.push(currentRun);
				}
			}
		}

		const isolatingRunSeqs: IsolatingRunSeq[] = [];

		for (let runIdx = 0; runIdx < levelRuns.length; runIdx++) {
			const run = levelRuns[runIdx];
			if (!run) continue;
			if (
				!run._startsWithPDI ||
				(run._startsWithPDI && !isolationPairs.has(run._start))
			) {
				currentRun = run;
				const seqRuns: LevelRun[] = [run];

				while (currentRun?._endsWithIsolInit) {
					const pdiIndex = isolationPairs.get(currentRun._end);
					if (pdiIndex == null) break;
					let found = false;
					for (let i = runIdx + 1; i < levelRuns.length; i++) {
						const nextRun = levelRuns[i];
						if (nextRun?._start === pdiIndex) {
							currentRun = nextRun;
							seqRuns.push(nextRun);
							found = true;
							break;
						}
					}
					if (!found) break;
				}

				const seqIndices: number[] = [];
				for (let i = 0; i < seqRuns.length; i++) {
					const seqRun = seqRuns[i]!;
					for (let j = seqRun._start; j <= seqRun._end; j++) {
						seqIndices.push(j);
					}
				}

				const firstIdx = seqIndices[0] ?? 0;
				const firstLevel = embedLevels[firstIdx] ?? 0;
				let prevLevel = paragraph.level;
				for (let i = firstIdx - 1; i >= 0; i--) {
					if (!(getCharType(charTypes, i) & BN_LIKE_TYPES)) {
						prevLevel = embedLevels[i] ?? 0;
						break;
					}
				}
				const lastIndex = seqIndices[seqIndices.length - 1] ?? 0;
				const lastLevel = embedLevels[lastIndex] ?? 0;
				let nextLevel = paragraph.level;
				if (!(getCharType(charTypes, lastIndex) & ISOLATE_INIT_TYPES)) {
					for (let i = lastIndex + 1; i <= paragraph.end; i++) {
						if (!(getCharType(charTypes, i) & BN_LIKE_TYPES)) {
							nextLevel = embedLevels[i] ?? 0;
							break;
						}
					}
				}
				isolatingRunSeqs.push({
					_seqIndices: seqIndices,
					_sosType: Math.max(prevLevel, firstLevel) % 2 ? TYPE_R : TYPE_L,
					_eosType: Math.max(nextLevel, lastLevel) % 2 ? TYPE_R : TYPE_L,
				});
			}
		}

		for (let seqIdx = 0; seqIdx < isolatingRunSeqs.length; seqIdx++) {
			const seq = isolatingRunSeqs[seqIdx]!;
			const {
				_seqIndices: seqIndices,
				_sosType: sosType,
				_eosType: eosType,
			} = seq;
			const firstSeqIdx = seqIndices[0] ?? 0;
			const embedDirection =
				(embedLevels[firstSeqIdx] ?? 0) & 1 ? TYPE_R : TYPE_L;

			// W1
			if (charTypeCounts.get(TYPE_NSM)) {
				for (let si = 0; si < seqIndices.length; si++) {
					const i = getSeqIndex(seqIndices, si);
					if (getCharType(charTypes, i) & TYPE_NSM) {
						let prevType = sosType;
						for (let sj = si - 1; sj >= 0; sj--) {
							const sjIdx = getSeqIndex(seqIndices, sj);
							if (!(getCharType(charTypes, sjIdx) & BN_LIKE_TYPES)) {
								prevType = getCharType(charTypes, sjIdx);
								break;
							}
						}
						changeCharType(
							i,
							prevType & (ISOLATE_INIT_TYPES | TYPE_PDI) ? TYPE_ON : prevType,
						);
					}
				}
			}

			// W2
			if (charTypeCounts.get(TYPE_EN)) {
				for (let si = 0; si < seqIndices.length; si++) {
					const i = getSeqIndex(seqIndices, si);
					if (getCharType(charTypes, i) & TYPE_EN) {
						for (let sj = si - 1; sj >= -1; sj--) {
							const prevCharType =
								sj === -1
									? sosType
									: getCharType(charTypes, getSeqIndex(seqIndices, sj));
							if (prevCharType & STRONG_TYPES) {
								if (prevCharType === TYPE_AL) {
									changeCharType(i, TYPE_AN);
								}
								break;
							}
						}
					}
				}
			}

			// W3
			if (charTypeCounts.get(TYPE_AL)) {
				for (let si = 0; si < seqIndices.length; si++) {
					const i = getSeqIndex(seqIndices, si);
					if (getCharType(charTypes, i) & TYPE_AL) {
						changeCharType(i, TYPE_R);
					}
				}
			}

			// W4
			if (charTypeCounts.get(TYPE_ES) || charTypeCounts.get(TYPE_CS)) {
				for (let si = 1; si < seqIndices.length - 1; si++) {
					const i = getSeqIndex(seqIndices, si);
					if (getCharType(charTypes, i) & (TYPE_ES | TYPE_CS)) {
						let prevType = 0;
						let nextType = 0;
						for (let sj = si - 1; sj >= 0; sj--) {
							prevType = getCharType(charTypes, getSeqIndex(seqIndices, sj));
							if (!(prevType & BN_LIKE_TYPES)) break;
						}
						for (let sj = si + 1; sj < seqIndices.length; sj++) {
							nextType = getCharType(charTypes, getSeqIndex(seqIndices, sj));
							if (!(nextType & BN_LIKE_TYPES)) break;
						}
						if (
							prevType === nextType &&
							(getCharType(charTypes, i) === TYPE_ES
								? prevType === TYPE_EN
								: prevType & (TYPE_EN | TYPE_AN))
						) {
							changeCharType(i, prevType);
						}
					}
				}
			}

			// W5
			if (charTypeCounts.get(TYPE_EN)) {
				for (let si = 0; si < seqIndices.length; si++) {
					const i = getSeqIndex(seqIndices, si);
					if (getCharType(charTypes, i) & TYPE_EN) {
						for (let sj = si - 1; sj >= 0; sj--) {
							const sjIdx = getSeqIndex(seqIndices, sj);
							if (!(getCharType(charTypes, sjIdx) & (TYPE_ET | BN_LIKE_TYPES)))
								break;
							changeCharType(sjIdx, TYPE_EN);
						}
						for (si++; si < seqIndices.length; si++) {
							const siIdx = getSeqIndex(seqIndices, si);
							if (
								!(
									getCharType(charTypes, siIdx) &
									(TYPE_ET | BN_LIKE_TYPES | TYPE_EN)
								)
							)
								break;
							if (getCharType(charTypes, siIdx) !== TYPE_EN) {
								changeCharType(siIdx, TYPE_EN);
							}
						}
					}
				}
			}

			// W6
			if (
				charTypeCounts.get(TYPE_ET) ||
				charTypeCounts.get(TYPE_ES) ||
				charTypeCounts.get(TYPE_CS)
			) {
				for (let si = 0; si < seqIndices.length; si++) {
					const i = getSeqIndex(seqIndices, si);
					if (getCharType(charTypes, i) & (TYPE_ET | TYPE_ES | TYPE_CS)) {
						changeCharType(i, TYPE_ON);
						for (let sj = si - 1; sj >= 0; sj--) {
							const sjIdx = getSeqIndex(seqIndices, sj);
							if (!(getCharType(charTypes, sjIdx) & BN_LIKE_TYPES)) break;
							changeCharType(sjIdx, TYPE_ON);
						}
						for (let sj = si + 1; sj < seqIndices.length; sj++) {
							const sjIdx = getSeqIndex(seqIndices, sj);
							if (!(getCharType(charTypes, sjIdx) & BN_LIKE_TYPES)) break;
							changeCharType(sjIdx, TYPE_ON);
						}
					}
				}
			}

			// W7
			if (charTypeCounts.get(TYPE_EN)) {
				let prevStrongType = sosType;
				for (let si = 0; si < seqIndices.length; si++) {
					const i = getSeqIndex(seqIndices, si);
					const type = getCharType(charTypes, i);
					if (type & TYPE_EN) {
						if (prevStrongType === TYPE_L) {
							changeCharType(i, TYPE_L);
						}
					} else if (type & STRONG_TYPES) {
						prevStrongType = type;
					}
				}
			}

			// N0-N2
			if (charTypeCounts.get(NEUTRAL_ISOLATE_TYPES)) {
				const R_TYPES_FOR_N_STEPS = TYPE_R | TYPE_EN | TYPE_AN;
				const STRONG_TYPES_FOR_N_STEPS = R_TYPES_FOR_N_STEPS | TYPE_L;

				const bracketPairs: Array<[number, number]> = [];
				const openerStack: Array<{ char: string; seqIndex: number }> = [];

				for (let si = 0; si < seqIndices.length; si++) {
					const siIdx = getSeqIndex(seqIndices, si);
					if (getCharType(charTypes, siIdx) & NEUTRAL_ISOLATE_TYPES) {
						const char = getCharAt(string, siIdx);
						const closingBracket = openingToClosingBracket(char);
						if (closingBracket !== null) {
							if (openerStack.length < 63) {
								openerStack.push({ char, seqIndex: si });
							} else {
								break;
							}
						} else {
							const oppositeBracket = closingToOpeningBracket(char);
							if (oppositeBracket !== null) {
								for (
									let stackIdx = openerStack.length - 1;
									stackIdx >= 0;
									stackIdx--
								) {
									const opener = openerStack[stackIdx];
									if (!opener) continue;
									const stackChar = opener.char;
									const canonicalChar = getCanonicalBracket(char);
									const canonicalStack = getCanonicalBracket(stackChar);
									if (
										stackChar === oppositeBracket ||
										(canonicalChar &&
											stackChar === closingToOpeningBracket(canonicalChar)) ||
										(canonicalStack &&
											openingToClosingBracket(canonicalStack) === char)
									) {
										bracketPairs.push([opener.seqIndex, si]);
										openerStack.length = stackIdx;
										break;
									}
								}
							}
						}
					}
				}
				bracketPairs.sort((a, b) => a[0] - b[0]);

				for (let pairIdx = 0; pairIdx < bracketPairs.length; pairIdx++) {
					const pair = bracketPairs[pairIdx]!;
					const [openSeqIdx, closeSeqIdx] = pair;
					let foundStrongType = false;
					let useStrongType = 0;

					for (let si = openSeqIdx + 1; si < closeSeqIdx; si++) {
						const i = getSeqIndex(seqIndices, si);
						const ct = getCharType(charTypes, i);
						if (ct & STRONG_TYPES_FOR_N_STEPS) {
							foundStrongType = true;
							const lr = ct & R_TYPES_FOR_N_STEPS ? TYPE_R : TYPE_L;
							if (lr === embedDirection) {
								useStrongType = lr;
								break;
							}
						}
					}

					if (foundStrongType && !useStrongType) {
						useStrongType = sosType;
						for (let si = openSeqIdx - 1; si >= 0; si--) {
							const i = getSeqIndex(seqIndices, si);
							const ct = getCharType(charTypes, i);
							if (ct & STRONG_TYPES_FOR_N_STEPS) {
								const lr = ct & R_TYPES_FOR_N_STEPS ? TYPE_R : TYPE_L;
								useStrongType = lr !== embedDirection ? lr : embedDirection;
								break;
							}
						}
					}

					if (useStrongType) {
						charTypes[getSeqIndex(seqIndices, openSeqIdx)] = useStrongType;
						charTypes[getSeqIndex(seqIndices, closeSeqIdx)] = useStrongType;

						if (useStrongType !== embedDirection) {
							for (let si = openSeqIdx + 1; si < seqIndices.length; si++) {
								const siIdx = getSeqIndex(seqIndices, si);
								if (!(getCharType(charTypes, siIdx) & BN_LIKE_TYPES)) {
									if (getBidiCharType(getCharAt(string, siIdx)) & TYPE_NSM) {
										charTypes[siIdx] = useStrongType;
									}
									break;
								}
							}
							for (let si = closeSeqIdx + 1; si < seqIndices.length; si++) {
								const siIdx = getSeqIndex(seqIndices, si);
								if (!(getCharType(charTypes, siIdx) & BN_LIKE_TYPES)) {
									if (getBidiCharType(getCharAt(string, siIdx)) & TYPE_NSM) {
										charTypes[siIdx] = useStrongType;
									}
									break;
								}
							}
						}
					}
				}

				// N1/N2
				for (let si = 0; si < seqIndices.length; si++) {
					const siIdx = getSeqIndex(seqIndices, si);
					if (getCharType(charTypes, siIdx) & NEUTRAL_ISOLATE_TYPES) {
						let niRunStart = si;
						let niRunEnd = si;
						let prevType = sosType;

						for (let si2 = si - 1; si2 >= 0; si2--) {
							const si2Idx = getSeqIndex(seqIndices, si2);
							if (getCharType(charTypes, si2Idx) & BN_LIKE_TYPES) {
								niRunStart = si2;
							} else {
								prevType =
									getCharType(charTypes, si2Idx) & R_TYPES_FOR_N_STEPS
										? TYPE_R
										: TYPE_L;
								break;
							}
						}

						let nextType = eosType;
						for (let si2 = si + 1; si2 < seqIndices.length; si2++) {
							const si2Idx = getSeqIndex(seqIndices, si2);
							if (
								getCharType(charTypes, si2Idx) &
								(NEUTRAL_ISOLATE_TYPES | BN_LIKE_TYPES)
							) {
								niRunEnd = si2;
							} else {
								nextType =
									getCharType(charTypes, si2Idx) & R_TYPES_FOR_N_STEPS
										? TYPE_R
										: TYPE_L;
								break;
							}
						}

						for (let sj = niRunStart; sj <= niRunEnd; sj++) {
							charTypes[getSeqIndex(seqIndices, sj)] =
								prevType === nextType ? prevType : embedDirection;
						}
						si = niRunEnd;
					}
				}
			}
		}

		// Resolving Implicit Levels
		for (let i = paragraph.start; i <= paragraph.end; i++) {
			const level = embedLevels[i] ?? 0;
			const type = getCharType(charTypes, i);

			if (level & 1) {
				if (type & (TYPE_L | TYPE_EN | TYPE_AN)) {
					embedLevels[i]++;
				}
			} else {
				if (type & TYPE_R) {
					embedLevels[i]++;
				} else if (type & (TYPE_AN | TYPE_EN)) {
					embedLevels[i] += 2;
				}
			}

			if (type & BN_LIKE_TYPES) {
				embedLevels[i] =
					i === 0 ? paragraph.level : (embedLevels[i - 1] ?? paragraph.level);
			}

			if (
				i === paragraph.end ||
				getBidiCharType(getCharAt(string, i)) & (TYPE_S | TYPE_B)
			) {
				for (
					let j = i;
					j >= 0 && getBidiCharType(getCharAt(string, j)) & TRAILING_TYPES;
					j--
				) {
					embedLevels[j] = paragraph.level;
				}
			}
		}
	}

	return {
		levels: embedLevels,
		paragraphs,
	};
}
