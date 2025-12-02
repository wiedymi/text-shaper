import type { GlyphInfo } from "../../types.ts";

/**
 * Indic syllable categories based on Unicode and OpenType spec
 */
export const enum IndicCategory {
	X = 0, // Other/Unknown
	C = 1, // Consonant
	V = 2, // Independent vowel
	N = 3, // Nukta
	H = 4, // Halant/Virama
	ZWNJ = 5, // Zero Width Non-Joiner
	ZWJ = 6, // Zero Width Joiner
	M = 7, // Matra (dependent vowel)
	SM = 8, // Syllable modifier (anusvara, visarga)
	A = 9, // Accent mark
	VD = 10, // Vedic mark
	Placeholder = 11, // Placeholder (dotted circle)
	Dotted_Circle = 12, // Explicit dotted circle
	RS = 13, // Repha form
	Coeng = 14, // Coeng (Khmer virama)
	Ra = 15, // Ra consonant (for repha)
	CM = 16, // Consonant modifier
	Symbol = 17, // Symbol
	CS = 18, // Consonant with stacker
}

/**
 * Indic syllabic position
 */
export const enum IndicPosition {
	Start = 0,
	RaToBecomeReph = 1,
	PreM = 2,
	PreC = 3,
	BaseC = 4,
	AfterMain = 5,
	AboveC = 6,
	BeforeSub = 7,
	BelowC = 8,
	AfterSub = 9,
	BeforePost = 10,
	PostC = 11,
	AfterPost = 12,
	FinalC = 13,
	SMVD = 14,
	End = 15,
}

/**
 * Per-glyph Indic shaping data
 */
export interface IndicGlyphData {
	category: IndicCategory;
	position: IndicPosition;
	syllableIndex: number;
}

/**
 * Determine if codepoint is in Devanagari range
 */
function isDevanagari(cp: number): boolean {
	return cp >= 0x0900 && cp <= 0x097f;
}

/**
 * Determine if codepoint is in Bengali range
 */
function isBengali(cp: number): boolean {
	return cp >= 0x0980 && cp <= 0x09ff;
}

/**
 * Determine if codepoint is in Gurmukhi range
 */
function isGurmukhi(cp: number): boolean {
	return cp >= 0x0a00 && cp <= 0x0a7f;
}

/**
 * Determine if codepoint is in Gujarati range
 */
function isGujarati(cp: number): boolean {
	return cp >= 0x0a80 && cp <= 0x0aff;
}

/**
 * Determine if codepoint is in Oriya range
 */
function isOriya(cp: number): boolean {
	return cp >= 0x0b00 && cp <= 0x0b7f;
}

/**
 * Determine if codepoint is in Tamil range
 */
function isTamil(cp: number): boolean {
	return cp >= 0x0b80 && cp <= 0x0bff;
}

/**
 * Determine if codepoint is in Telugu range
 */
function isTelugu(cp: number): boolean {
	return cp >= 0x0c00 && cp <= 0x0c7f;
}

/**
 * Determine if codepoint is in Kannada range
 */
function isKannada(cp: number): boolean {
	return cp >= 0x0c80 && cp <= 0x0cff;
}

/**
 * Determine if codepoint is in Malayalam range
 */
function isMalayalam(cp: number): boolean {
	return cp >= 0x0d00 && cp <= 0x0d7f;
}

/**
 * Check if a codepoint is an Indic script
 */
export function isIndic(cp: number): boolean {
	return (
		isDevanagari(cp) ||
		isBengali(cp) ||
		isGurmukhi(cp) ||
		isGujarati(cp) ||
		isOriya(cp) ||
		isTamil(cp) ||
		isTelugu(cp) ||
		isKannada(cp) ||
		isMalayalam(cp)
	);
}

/**
 * Get the Indic category for a codepoint
 */
export function getIndicCategory(cp: number): IndicCategory {
	// Zero-width characters
	if (cp === 0x200c) return IndicCategory.ZWNJ;
	if (cp === 0x200d) return IndicCategory.ZWJ;
	if (cp === 0x25cc) return IndicCategory.Dotted_Circle;

	// Devanagari (0900-097F)
	if (isDevanagari(cp)) {
		// Vowel signs (matras)
		if ((cp >= 0x093a && cp <= 0x093b) || (cp >= 0x093e && cp <= 0x094c) ||
			(cp >= 0x094e && cp <= 0x094f) || (cp >= 0x0955 && cp <= 0x0957)) {
			return IndicCategory.M;
		}
		// Virama
		if (cp === 0x094d) return IndicCategory.H;
		// Nukta
		if (cp === 0x093c) return IndicCategory.N;
		// Anusvara, Visarga, Chandrabindu
		if (cp >= 0x0901 && cp <= 0x0903) return IndicCategory.SM;
		// Vedic marks
		if (cp >= 0x0951 && cp <= 0x0954) return IndicCategory.A;
		// Independent vowels
		if ((cp >= 0x0904 && cp <= 0x0914) || cp === 0x0960 || cp === 0x0961 ||
			cp === 0x0972 || (cp >= 0x0976 && cp <= 0x0977)) {
			return IndicCategory.V;
		}
		// Consonants
		if ((cp >= 0x0915 && cp <= 0x0939) || (cp >= 0x0958 && cp <= 0x095f) ||
			cp === 0x0978 || cp === 0x0979 || cp === 0x097a ||
			(cp >= 0x097b && cp <= 0x097c) || (cp >= 0x097e && cp <= 0x097f)) {
			// Ra for repha
			if (cp === 0x0930) return IndicCategory.Ra;
			return IndicCategory.C;
		}
		// Digits and symbols
		if (cp >= 0x0966 && cp <= 0x096f) return IndicCategory.Symbol;
		return IndicCategory.X;
	}

	// Bengali (0980-09FF)
	if (isBengali(cp)) {
		if ((cp >= 0x09be && cp <= 0x09c4) || (cp >= 0x09c7 && cp <= 0x09c8) ||
			(cp >= 0x09cb && cp <= 0x09cc) || cp === 0x09d7) {
			return IndicCategory.M;
		}
		if (cp === 0x09cd) return IndicCategory.H;
		if (cp === 0x09bc) return IndicCategory.N;
		if (cp >= 0x0981 && cp <= 0x0983) return IndicCategory.SM;
		if ((cp >= 0x0985 && cp <= 0x098c) || (cp >= 0x098f && cp <= 0x0990) ||
			(cp >= 0x0993 && cp <= 0x0994) || cp === 0x09e0 || cp === 0x09e1) {
			return IndicCategory.V;
		}
		if ((cp >= 0x0995 && cp <= 0x09a8) || (cp >= 0x09aa && cp <= 0x09b0) ||
			cp === 0x09b2 || (cp >= 0x09b6 && cp <= 0x09b9) ||
			(cp >= 0x09dc && cp <= 0x09dd) || (cp >= 0x09df && cp <= 0x09e1)) {
			if (cp === 0x09b0) return IndicCategory.Ra;
			return IndicCategory.C;
		}
		return IndicCategory.X;
	}

	// Other Indic scripts - simplified handling
	// Tamil, Telugu, Kannada, Malayalam, Gurmukhi, Gujarati, Oriya
	if (isGurmukhi(cp) || isGujarati(cp) || isOriya(cp) ||
		isTamil(cp) || isTelugu(cp) || isKannada(cp) || isMalayalam(cp)) {
		const offset = cp & 0x7f; // Position within the block
		// Common patterns for Indic scripts
		if (offset >= 0x01 && offset <= 0x03) return IndicCategory.SM; // Anusvara etc
		if (offset >= 0x05 && offset <= 0x14) return IndicCategory.V; // Vowels
		if (offset >= 0x15 && offset <= 0x39) return IndicCategory.C; // Consonants
		if (offset === 0x3c) return IndicCategory.N; // Nukta
		if (offset >= 0x3e && offset <= 0x4c) return IndicCategory.M; // Matras
		if (offset === 0x4d) return IndicCategory.H; // Virama
		return IndicCategory.X;
	}

	return IndicCategory.X;
}

/**
 * Syllable structure for Indic scripts
 */
interface Syllable {
	start: number;
	end: number;
	hasReph: boolean;
	baseConsonant: number;
}

/**
 * Find syllable boundaries in the glyph buffer
 */
export function findSyllables(infos: GlyphInfo[]): Syllable[] {
	const syllables: Syllable[] = [];
	const n = infos.length;
	if (n === 0) return syllables;

	let start = 0;

	while (start < n) {
		const syllable = parseSyllable(infos, start);
		syllables.push(syllable);
		start = syllable.end;
	}

	return syllables;
}

/**
 * Parse a single syllable starting at the given position
 */
function parseSyllable(infos: GlyphInfo[], start: number): Syllable {
	const n = infos.length;
	let pos = start;

	// Check for initial consonant cluster with halant
	let baseConsonant = -1;
	let hasReph = false;

	// Look for Ra + H at the start (potential Reph)
	if (pos + 1 < n) {
		const cat1 = getIndicCategory(infos[pos]?.codepoint ?? 0);
		const cat2 = getIndicCategory(infos[pos + 1]?.codepoint ?? 0);
		if (cat1 === IndicCategory.Ra && cat2 === IndicCategory.H) {
			hasReph = true;
			pos += 2;
		}
	}

	// Find base consonant (last consonant before matras/end)
	let lastConsonant = -1;
	while (pos < n) {
		const cp = infos[pos]?.codepoint ?? 0;
		const cat = getIndicCategory(cp);

		if (cat === IndicCategory.C || cat === IndicCategory.Ra) {
			lastConsonant = pos;
			pos++;
			// Check for nukta
			if (pos < n && getIndicCategory(infos[pos]?.codepoint ?? 0) === IndicCategory.N) {
				pos++;
			}
			// Check for halant (may continue consonant cluster)
			if (pos < n && getIndicCategory(infos[pos]?.codepoint ?? 0) === IndicCategory.H) {
				pos++;
				// After halant, might have ZWJ/ZWNJ or another consonant
				if (pos < n) {
					const nextCat = getIndicCategory(infos[pos]?.codepoint ?? 0);
					if (nextCat === IndicCategory.ZWJ || nextCat === IndicCategory.ZWNJ) {
						pos++;
					}
				}
				continue; // Look for more consonants
			}
			break;
		} else if (cat === IndicCategory.V) {
			// Independent vowel as syllable base
			pos++;
			break;
		} else if (cat === IndicCategory.N) {
			// Standalone nukta - skip
			pos++;
		} else {
			// Non-syllable character, end here
			if (lastConsonant === -1) {
				pos++;
			}
			break;
		}
	}

	baseConsonant = lastConsonant >= 0 ? lastConsonant : start;

	// Consume matras, anusvara, visarga
	while (pos < n) {
		const cp = infos[pos]?.codepoint ?? 0;
		const cat = getIndicCategory(cp);

		if (cat === IndicCategory.M || cat === IndicCategory.SM ||
			cat === IndicCategory.A || cat === IndicCategory.N) {
			pos++;
		} else if (cat === IndicCategory.H) {
			// Halant at end (final form)
			pos++;
			break;
		} else {
			break;
		}
	}

	// Ensure we advance at least one position
	if (pos === start) {
		pos = start + 1;
	}

	return {
		start,
		end: pos,
		hasReph,
		baseConsonant,
	};
}

/**
 * Indic feature masks for OpenType features
 */
export const IndicFeatureMask = {
	nukt: 0x0001, // Nukta forms
	akhn: 0x0002, // Akhand forms
	rphf: 0x0004, // Reph forms
	rkrf: 0x0008, // Rakaar forms
	pref: 0x0010, // Pre-base forms
	blwf: 0x0020, // Below-base forms
	abvf: 0x0040, // Above-base forms
	half: 0x0080, // Half forms
	pstf: 0x0100, // Post-base forms
	vatu: 0x0200, // Vattu variants
	cjct: 0x0400, // Conjunct forms
	init: 0x0800, // Initial forms
	pres: 0x1000, // Pre-base substitutions
	abvs: 0x2000, // Above-base substitutions
	blws: 0x4000, // Below-base substitutions
	psts: 0x8000, // Post-base substitutions
} as const;

/**
 * Matra position in syllable
 */
export const enum MatraPosition {
	PreBase = 0,
	AboveBase = 1,
	BelowBase = 2,
	PostBase = 3,
}

/**
 * Get matra position based on codepoint
 */
function getMatraPosition(cp: number): MatraPosition {
	// Devanagari
	if (cp >= 0x0900 && cp <= 0x097f) {
		// Pre-base: ि (093F)
		if (cp === 0x093f) return MatraPosition.PreBase;
		// Above-base: ॅ ॆ े ै (0945-0948)
		if (cp >= 0x0945 && cp <= 0x0948) return MatraPosition.AboveBase;
		// Below-base: ु ू ृ ॄ (0941-0944)
		if (cp >= 0x0941 && cp <= 0x0944) return MatraPosition.BelowBase;
		// Post-base: everything else
		return MatraPosition.PostBase;
	}

	// Bengali
	if (cp >= 0x0980 && cp <= 0x09ff) {
		// Pre-base: ি (09BF)
		if (cp === 0x09bf) return MatraPosition.PreBase;
		// Pre-base split vowels: ে ৈ (09C7-09C8) - left part
		if (cp === 0x09c7 || cp === 0x09c8) return MatraPosition.PreBase;
		// Below-base: ু ূ ৃ ৄ (09C1-09C4)
		if (cp >= 0x09c1 && cp <= 0x09c4) return MatraPosition.BelowBase;
		return MatraPosition.PostBase;
	}

	// Tamil
	if (cp >= 0x0b80 && cp <= 0x0bff) {
		// Pre-base: ெ ே ை (0BC6-0BC8)
		if (cp >= 0x0bc6 && cp <= 0x0bc8) return MatraPosition.PreBase;
		// Above-base: none
		// Below-base: ு ூ (0BC1-0BC2)
		if (cp === 0x0bc1 || cp === 0x0bc2) return MatraPosition.BelowBase;
		return MatraPosition.PostBase;
	}

	// Telugu
	if (cp >= 0x0c00 && cp <= 0x0c7f) {
		// Above-base: ి ీ ె ే ై (0C3E-0C40, 0C46-0C48)
		if ((cp >= 0x0c3e && cp <= 0x0c40) || (cp >= 0x0c46 && cp <= 0x0c48)) {
			return MatraPosition.AboveBase;
		}
		// Below-base: ు ూ ృ ౄ (0C41-0C44)
		if (cp >= 0x0c41 && cp <= 0x0c44) return MatraPosition.BelowBase;
		return MatraPosition.PostBase;
	}

	// Kannada
	if (cp >= 0x0c80 && cp <= 0x0cff) {
		// Above-base: similar to Telugu
		if ((cp >= 0x0cbe && cp <= 0x0cc0) || (cp >= 0x0cc6 && cp <= 0x0cc8)) {
			return MatraPosition.AboveBase;
		}
		if (cp >= 0x0cc1 && cp <= 0x0cc4) return MatraPosition.BelowBase;
		return MatraPosition.PostBase;
	}

	// Malayalam
	if (cp >= 0x0d00 && cp <= 0x0d7f) {
		// Pre-base: െ േ ൈ (0D46-0D48)
		if (cp >= 0x0d46 && cp <= 0x0d48) return MatraPosition.PreBase;
		// Below-base: ു ൂ ൃ (0D41-0D43)
		if (cp >= 0x0d41 && cp <= 0x0d43) return MatraPosition.BelowBase;
		return MatraPosition.PostBase;
	}

	// Gurmukhi
	if (cp >= 0x0a00 && cp <= 0x0a7f) {
		// Pre-base: ਿ (0A3F)
		if (cp === 0x0a3f) return MatraPosition.PreBase;
		// Below-base: ੁ ੂ (0A41-0A42)
		if (cp === 0x0a41 || cp === 0x0a42) return MatraPosition.BelowBase;
		return MatraPosition.PostBase;
	}

	// Gujarati
	if (cp >= 0x0a80 && cp <= 0x0aff) {
		// Pre-base: િ (0ABF)
		if (cp === 0x0abf) return MatraPosition.PreBase;
		// Below-base: ુ ૂ ૃ ૄ (0AC1-0AC4)
		if (cp >= 0x0ac1 && cp <= 0x0ac4) return MatraPosition.BelowBase;
		return MatraPosition.PostBase;
	}

	// Oriya
	if (cp >= 0x0b00 && cp <= 0x0b7f) {
		// Pre-base: ି (0B3F)
		if (cp === 0x0b3f) return MatraPosition.PreBase;
		// Below-base: ୁ ୂ ୃ (0B41-0B43)
		if (cp >= 0x0b41 && cp <= 0x0b43) return MatraPosition.BelowBase;
		return MatraPosition.PostBase;
	}

	return MatraPosition.PostBase;
}

/**
 * Set up masks and syllable indices for Indic shaping
 */
export function setupIndicMasks(infos: GlyphInfo[]): void {
	const syllables = findSyllables(infos);

	for (let i = 0; i < syllables.length; i++) {
		const syllable = syllables[i]!;

		// Mark syllable boundaries in mask
		for (let j = syllable.start; j < syllable.end; j++) {
			const info = infos[j];
			if (info) {
				// Store syllable index in upper bits
				info.mask = (info.mask & 0x0000ffff) | ((i & 0xffff) << 16);

				const cat = getIndicCategory(info.codepoint);

				// Nukta - always apply nukt feature
				if (cat === IndicCategory.N) {
					info.mask |= IndicFeatureMask.nukt;
				}

				// Halant handling
				if (cat === IndicCategory.H) {
					// Check position relative to base
					if (j < syllable.baseConsonant) {
						// Pre-base halant - half forms
						info.mask |= IndicFeatureMask.half;
					} else if (j > syllable.baseConsonant) {
						// Post-base halant - below/post forms
						info.mask |= IndicFeatureMask.blwf | IndicFeatureMask.pstf;
					}
				}

				// Consonant handling
				if (cat === IndicCategory.C || cat === IndicCategory.Ra) {
					if (j < syllable.baseConsonant) {
						// Pre-base consonant
						info.mask |= IndicFeatureMask.half | IndicFeatureMask.cjct;
					} else if (j > syllable.baseConsonant) {
						// Post-base consonant
						info.mask |= IndicFeatureMask.blwf | IndicFeatureMask.pstf | IndicFeatureMask.vatu;
					}
				}

				// Reph handling
				if (syllable.hasReph && j < syllable.start + 2) {
					info.mask |= IndicFeatureMask.rphf;
				}

				// Matra handling
				if (cat === IndicCategory.M) {
					const matraPos = getMatraPosition(info.codepoint);
					switch (matraPos) {
						case MatraPosition.PreBase:
							info.mask |= IndicFeatureMask.pref | IndicFeatureMask.pres;
							break;
						case MatraPosition.AboveBase:
							info.mask |= IndicFeatureMask.abvf | IndicFeatureMask.abvs;
							break;
						case MatraPosition.BelowBase:
							info.mask |= IndicFeatureMask.blwf | IndicFeatureMask.blws;
							break;
						case MatraPosition.PostBase:
							info.mask |= IndicFeatureMask.pstf | IndicFeatureMask.psts;
							break;
					}
				}

				// Syllable modifiers (anusvara, visarga)
				if (cat === IndicCategory.SM) {
					info.mask |= IndicFeatureMask.abvs | IndicFeatureMask.psts;
				}
			}
		}
	}
}

/**
 * Reorder glyphs within a syllable for correct visual display
 * This handles:
 * - Moving pre-base matras before the base consonant
 * - Moving reph to its final position
 */
export function reorderIndic(infos: GlyphInfo[]): void {
	const syllables = findSyllables(infos);

	for (const syllable of syllables) {
		reorderSyllable(infos, syllable);
	}
}

/**
 * Reorder a single syllable
 */
function reorderSyllable(infos: GlyphInfo[], syllable: Syllable): void {
	const { start, end, baseConsonant, hasReph } = syllable;

	// Collect pre-base matras that need to move
	const preBaseMatras: { index: number; info: GlyphInfo }[] = [];

	for (let i = baseConsonant + 1; i < end; i++) {
		const info = infos[i];
		if (!info) continue;

		const cat = getIndicCategory(info.codepoint);
		if (cat === IndicCategory.M) {
			const matraPos = getMatraPosition(info.codepoint);
			if (matraPos === MatraPosition.PreBase) {
				preBaseMatras.push({ index: i, info });
			}
		}
	}

	// Move pre-base matras before the base (or before reph if present)
	if (preBaseMatras.length > 0) {
		// Sort by original index descending to process from right to left
		preBaseMatras.sort((a, b) => b.index - a.index);

		for (const { index, info } of preBaseMatras) {
			// Remove from current position
			infos.splice(index, 1);

			// Insert before base (accounting for reph)
			const insertPos = hasReph ? start + 2 : start;
			infos.splice(insertPos, 0, info);
		}
	}

	// Handle reph movement (Ra + Halant at start moves to end of syllable)
	// Note: In many scripts, reph moves to after the matra
	// This is a simplified implementation - full implementation would check
	// script-specific rules
	if (hasReph && end > start + 2) {
		// Reph is at positions start and start+1 (Ra + Halant)
		// Move to end of syllable, before final consonant markers
		const rephRa = infos[start];
		const rephH = infos[start + 1];

		if (rephRa && rephH) {
			// Find insertion point: after matras, before syllable modifiers
			let rephTarget = end - 1;

			// Adjust for any syllable modifiers at the end
			while (rephTarget > baseConsonant) {
				const targetInfo = infos[rephTarget];
				if (!targetInfo) break;

				const cat = getIndicCategory(targetInfo.codepoint);
				if (cat === IndicCategory.SM || cat === IndicCategory.A) {
					rephTarget--;
				} else {
					break;
				}
			}

			// Only move if target is different from current position
			if (rephTarget > start + 1) {
				// Remove Ra + Halant from start
				infos.splice(start, 2);

				// Insert at new position (adjusted for removal)
				const adjustedTarget = rephTarget - 2;
				infos.splice(adjustedTarget + 1, 0, rephRa, rephH);
			}
		}
	}
}
