import type { GlyphInfo } from "../../types.ts";

/**
 * Hangul shaper for Korean text
 * Handles Jamo composition and syllable block formation
 */

// Hangul Unicode ranges
const HANGUL_BASE = 0xac00; // First precomposed syllable (가)
const HANGUL_END = 0xd7a3; // Last precomposed syllable (힣)

const JAMO_L_BASE = 0x1100; // Leading consonant (choseong) base
const JAMO_V_BASE = 0x1161; // Vowel (jungseong) base
const JAMO_T_BASE = 0x11a7; // Trailing consonant (jongseong) base - 0x11a8 is first real one

const JAMO_L_COUNT = 19; // Number of leading consonants
const JAMO_V_COUNT = 21; // Number of vowels
const JAMO_T_COUNT = 28; // Number of trailing consonants (including none)

const JAMO_VT_COUNT = JAMO_V_COUNT * JAMO_T_COUNT; // 588
const _JAMO_LVT_COUNT = JAMO_L_COUNT * JAMO_VT_COUNT; // 11172

// Compatibility Jamo (for conversion)
const COMPAT_JAMO_START = 0x3131;
const COMPAT_JAMO_END = 0x318e;

// Hangul Jamo Extended-A (old Korean)
const JAMO_EXT_A_START = 0xa960;
const JAMO_EXT_A_END = 0xa97c;

// Hangul Jamo Extended-B (old Korean)
const JAMO_EXT_B_START = 0xd7b0;
const JAMO_EXT_B_END = 0xd7fb;

/**
 * Check if codepoint is a Hangul syllable
 */
export function isHangulSyllable(cp: number): boolean {
	return cp >= HANGUL_BASE && cp <= HANGUL_END;
}

/**
 * Check if codepoint is a Hangul Jamo (conjoining)
 */
export function isHangulJamo(cp: number): boolean {
	return (
		(cp >= JAMO_L_BASE && cp <= 0x11ff) ||
		(cp >= JAMO_EXT_A_START && cp <= JAMO_EXT_A_END) ||
		(cp >= JAMO_EXT_B_START && cp <= JAMO_EXT_B_END)
	);
}

/**
 * Check if codepoint is a leading consonant (L)
 */
export function isJamoL(cp: number): boolean {
	return (
		(cp >= JAMO_L_BASE && cp < JAMO_L_BASE + JAMO_L_COUNT) ||
		(cp >= JAMO_EXT_A_START && cp <= JAMO_EXT_A_END)
	);
}

/**
 * Check if codepoint is a vowel (V)
 */
export function isJamoV(cp: number): boolean {
	return (
		(cp >= JAMO_V_BASE && cp < JAMO_V_BASE + JAMO_V_COUNT) ||
		(cp >= 0xd7b0 && cp <= 0xd7c6)
	);
}

/**
 * Check if codepoint is a trailing consonant (T)
 */
export function isJamoT(cp: number): boolean {
	return (
		(cp > JAMO_T_BASE && cp <= JAMO_T_BASE + JAMO_T_COUNT - 1) ||
		(cp >= 0xd7cb && cp <= 0xd7fb)
	);
}

/**
 * Decompose a precomposed Hangul syllable into Jamo
 */
export function decomposeHangul(cp: number): number[] {
	if (!isHangulSyllable(cp)) return [cp];

	const syllableIndex = cp - HANGUL_BASE;
	const l = Math.floor(syllableIndex / JAMO_VT_COUNT);
	const v = Math.floor((syllableIndex % JAMO_VT_COUNT) / JAMO_T_COUNT);
	const t = syllableIndex % JAMO_T_COUNT;

	const result = [JAMO_L_BASE + l, JAMO_V_BASE + v];
	if (t > 0) {
		result.push(JAMO_T_BASE + t);
	}
	return result;
}

/**
 * Compose Jamo into a precomposed Hangul syllable
 */
export function composeHangul(
	l: number,
	v: number,
	t: number = 0,
): number | null {
	// Normalize indices
	const lIndex = l - JAMO_L_BASE;
	const vIndex = v - JAMO_V_BASE;
	const tIndex = t === 0 ? 0 : t - JAMO_T_BASE;

	if (lIndex < 0 || lIndex >= JAMO_L_COUNT) return null;
	if (vIndex < 0 || vIndex >= JAMO_V_COUNT) return null;
	if (tIndex < 0 || tIndex >= JAMO_T_COUNT) return null;

	return HANGUL_BASE + lIndex * JAMO_VT_COUNT + vIndex * JAMO_T_COUNT + tIndex;
}

/**
 * Hangul syllable types
 */
export enum HangulSyllableType {
	NotApplicable = 0,
	LeadingJamo = 1, // L
	VowelJamo = 2, // V
	TrailingJamo = 3, // T
	LVSyllable = 4, // LV (no trailing)
	LVTSyllable = 5, // LVT (with trailing)
}

/**
 * Get the syllable type of a codepoint
 */
export function getHangulSyllableType(cp: number): HangulSyllableType {
	if (isJamoL(cp)) return HangulSyllableType.LeadingJamo;
	if (isJamoV(cp)) return HangulSyllableType.VowelJamo;
	if (isJamoT(cp)) return HangulSyllableType.TrailingJamo;

	if (isHangulSyllable(cp)) {
		const syllableIndex = cp - HANGUL_BASE;
		const t = syllableIndex % JAMO_T_COUNT;
		return t === 0
			? HangulSyllableType.LVSyllable
			: HangulSyllableType.LVTSyllable;
	}

	return HangulSyllableType.NotApplicable;
}

/**
 * Feature masks for Hangul
 */
export const HangulFeatureMask = {
	ljmo: 0x0001, // Leading jamo forms
	vjmo: 0x0002, // Vowel jamo forms
	tjmo: 0x0004, // Trailing jamo forms
} as const;

/**
 * Setup Hangul masks for feature application
 */
export function setupHangulMasks(infos: GlyphInfo[]): void {
	for (const info of infos) {
		const type = getHangulSyllableType(info.codepoint);

		switch (type) {
			case HangulSyllableType.LeadingJamo:
				info.mask |= HangulFeatureMask.ljmo;
				break;
			case HangulSyllableType.VowelJamo:
				info.mask |= HangulFeatureMask.vjmo;
				break;
			case HangulSyllableType.TrailingJamo:
				info.mask |= HangulFeatureMask.tjmo;
				break;
			case HangulSyllableType.LVSyllable:
			case HangulSyllableType.LVTSyllable:
				// Precomposed syllables don't need special features
				break;
		}
	}
}

/**
 * Normalize Hangul - compose Jamo sequences into syllables where possible
 */
export function normalizeHangul(infos: GlyphInfo[]): GlyphInfo[] {
	const result: GlyphInfo[] = [];
	let i = 0;

	while (i < infos.length) {
		const info = infos[i];
		if (!info) {
			i++;
			continue;
		}
		const type = getHangulSyllableType(info.codepoint);

		// Try to compose L + V [+ T]
		if (type === HangulSyllableType.LeadingJamo && i + 1 < infos.length) {
			const nextInfo = infos[i + 1];
			if (!nextInfo) {
				result.push(info);
				i++;
				continue;
			}
			const nextType = getHangulSyllableType(nextInfo.codepoint);

			if (nextType === HangulSyllableType.VowelJamo) {
				// Check for trailing jamo
				let t = 0;
				let consumed = 2;

				if (i + 2 < infos.length) {
					const thirdInfo = infos[i + 2];
					if (thirdInfo) {
						const thirdType = getHangulSyllableType(thirdInfo.codepoint);

						if (thirdType === HangulSyllableType.TrailingJamo) {
							t = thirdInfo.codepoint;
							consumed = 3;
						}
					}
				}

				const composed = composeHangul(info.codepoint, nextInfo.codepoint, t);
				if (composed !== null) {
					result.push({
						glyphId: info.glyphId, // Will be remapped
						cluster: info.cluster,
						mask: info.mask,
						codepoint: composed,
					});
					i += consumed;
					continue;
				}
			}
		}

		// Try to compose LV + T
		if (type === HangulSyllableType.LVSyllable && i + 1 < infos.length) {
			const nextInfo = infos[i + 1];
			if (!nextInfo) {
				result.push(info);
				i++;
				continue;
			}
			const nextType = getHangulSyllableType(nextInfo.codepoint);

			if (nextType === HangulSyllableType.TrailingJamo) {
				// Decompose LV, add T, recompose
				const decomposed = decomposeHangul(info.codepoint);
				const [firstJamo, secondJamo] = decomposed;
				if (
					decomposed.length === 2 &&
					firstJamo !== undefined &&
					secondJamo !== undefined
				) {
					const composed = composeHangul(
						firstJamo,
						secondJamo,
						nextInfo.codepoint,
					);
					if (composed !== null) {
						result.push({
							glyphId: info.glyphId,
							cluster: info.cluster,
							mask: info.mask,
							codepoint: composed,
						});
						i += 2;
						continue;
					}
				}
			}
		}

		// No composition, keep as-is
		result.push(info);
		i++;
	}

	return result;
}

/**
 * Check if codepoint is Korean (Hangul or Jamo)
 */
export function isKorean(cp: number): boolean {
	return (
		isHangulSyllable(cp) ||
		isHangulJamo(cp) ||
		(cp >= COMPAT_JAMO_START && cp <= COMPAT_JAMO_END)
	);
}
