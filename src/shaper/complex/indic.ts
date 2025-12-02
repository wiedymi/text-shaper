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

				// Set feature masks based on position
				const cat = getIndicCategory(info.codepoint);
				if (cat === IndicCategory.H) {
					// Halant - enable blwf, half, pstf features
					info.mask |= 0x1;
				}
				if (j === syllable.baseConsonant) {
					// Base consonant marker
					info.mask |= 0x2;
				}
				if (syllable.hasReph && j < syllable.start + 2) {
					// Part of reph
					info.mask |= 0x4;
				}
			}
		}
	}
}
