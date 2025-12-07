import type { GlyphInfo } from "../../types.ts";

/**
 * Syriac shaper
 * Handles Syriac script (Estrangela, Serto, Eastern)
 *
 * Syriac is a right-to-left script with:
 * - Joining behavior (like Arabic)
 * - Vowel marks (diacritics above/below)
 * - Multiple script styles (Estrangela, Serto, East Syriac)
 * - Dalath/Rish distinction marks
 */

/**
 * Syriac joining types
 */
export enum SyriacJoining {
	NonJoining = 0,
	RightJoining = 1,
	DualJoining = 2,
	LeftJoining = 3,
	Transparent = 4,
	Causing = 5,
}

/**
 * Syriac character categories
 */
export enum SyriacCategory {
	Other = 0,
	Letter = 1,
	Diacritic = 2,
	Punctuation = 3,
	Digit = 4,
}

/**
 * Get Syriac joining type for codepoint
 */
export function getSyriacJoining(cp: number): SyriacJoining {
	// Control characters
	if (cp === 0x200c) return SyriacJoining.NonJoining; // ZWNJ
	if (cp === 0x200d) return SyriacJoining.Causing; // ZWJ

	// Not Syriac
	if (cp < 0x0700 || cp > 0x074f) {
		// Syriac supplement (0860-086A)
		if (cp >= 0x0860 && cp <= 0x086a) {
			// Most supplement letters are dual-joining
			return SyriacJoining.DualJoining;
		}
		return SyriacJoining.NonJoining;
	}

	// Punctuation (0700-070D)
	if (cp >= 0x0700 && cp <= 0x070d) return SyriacJoining.NonJoining;

	// Letters (0710-072F)
	if (cp >= 0x0710 && cp <= 0x072f) {
		// Alaph (0710) - dual joining
		if (cp === 0x0710) return SyriacJoining.DualJoining;

		// Waw (0718) - right joining
		if (cp === 0x0718) return SyriacJoining.RightJoining;

		// Yudh (071D) - right joining
		if (cp === 0x071d) return SyriacJoining.RightJoining;

		// Most letters are dual-joining
		return SyriacJoining.DualJoining;
	}

	// Vowel marks (0730-074A) - transparent
	if (cp >= 0x0730 && cp <= 0x074a) return SyriacJoining.Transparent;

	return SyriacJoining.NonJoining;
}

/**
 * Get Syriac category
 */
export function getSyriacCategory(cp: number): SyriacCategory {
	// Syriac block (0700-074F)
	if (cp >= 0x0700 && cp <= 0x074f) {
		if (cp >= 0x0700 && cp <= 0x070d) return SyriacCategory.Punctuation;
		if (cp >= 0x0710 && cp <= 0x072f) return SyriacCategory.Letter;
		if (cp >= 0x0730 && cp <= 0x074a) return SyriacCategory.Diacritic;
		return SyriacCategory.Other;
	}

	// Syriac supplement (0860-086A)
	if (cp >= 0x0860 && cp <= 0x086a) return SyriacCategory.Letter;

	return SyriacCategory.Other;
}

/**
 * Syriac positional forms
 */
export enum SyriacForm {
	Isolated = 0,
	Initial = 1,
	Medial = 2,
	Final = 3,
}

/**
 * Determine Syriac positional form
 */
export function getSyriacForm(
	prev: SyriacJoining,
	current: SyriacJoining,
	next: SyriacJoining,
): SyriacForm {
	if (current === SyriacJoining.Transparent) return SyriacForm.Isolated;
	if (current === SyriacJoining.NonJoining) return SyriacForm.Isolated;

	const joinsLeft =
		current === SyriacJoining.DualJoining ||
		current === SyriacJoining.LeftJoining;
	const joinsRight =
		current === SyriacJoining.DualJoining ||
		current === SyriacJoining.RightJoining;

	const canJoinPrev =
		prev === SyriacJoining.DualJoining ||
		prev === SyriacJoining.LeftJoining ||
		prev === SyriacJoining.Causing;

	const canJoinNext =
		next === SyriacJoining.DualJoining ||
		next === SyriacJoining.RightJoining ||
		next === SyriacJoining.Causing;

	// Note: Syriac is RTL, so visual left = textual next, visual right = textual prev
	const joinedToPrev = joinsRight && canJoinPrev;
	const joinedToNext = joinsLeft && canJoinNext;

	if (joinedToPrev && joinedToNext) return SyriacForm.Medial;
	if (joinedToPrev) return SyriacForm.Final;
	if (joinedToNext) return SyriacForm.Initial;
	return SyriacForm.Isolated;
}

/**
 * Syriac feature masks
 */
export const SyriacFeatureMask = {
	ccmp: 0x0001,
	locl: 0x0002,
	isol: 0x0004,
	init: 0x0008,
	medi: 0x0010,
	fina: 0x0020,
	rlig: 0x0040,
	calt: 0x0080,
	liga: 0x0100,
	stch: 0x0200, // Stretching glyph decomposition
} as const;

/**
 * Set up masks for Syriac shaping
 */
export function setupSyriacMasks(infos: GlyphInfo[]): void {
	const n = infos.length;

	// Get joining types
	const joiningTypes: SyriacJoining[] = [];
	for (let i = 0; i < n; i++) {
		joiningTypes.push(getSyriacJoining(infos[i]?.codepoint ?? 0));
	}

	// Assign forms and masks
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i]!;
		const cat = getSyriacCategory(info.codepoint);
		const joining = joiningTypes[i] ?? SyriacJoining.NonJoining;

		// Basic features for all
		info.mask |= SyriacFeatureMask.ccmp | SyriacFeatureMask.locl;

		// Skip non-letters for form assignment
		if (cat !== SyriacCategory.Letter) {
			// Diacritics still get some features
			if (cat === SyriacCategory.Diacritic) {
				info.mask |= SyriacFeatureMask.calt;
			}
			continue;
		}

		// Get effective neighbors
		let prevJoin = SyriacJoining.NonJoining;
		for (let j = i - 1; j >= 0; j--) {
			const jt = joiningTypes[j];
			if (jt !== SyriacJoining.Transparent) {
				if (jt !== undefined) prevJoin = jt;
				break;
			}
		}

		let nextJoin = SyriacJoining.NonJoining;
		for (let j = i + 1; j < n; j++) {
			const jt = joiningTypes[j];
			if (jt !== SyriacJoining.Transparent) {
				if (jt !== undefined) nextJoin = jt;
				break;
			}
		}

		const form = getSyriacForm(prevJoin, joining, nextJoin);

		switch (form) {
			case SyriacForm.Isolated:
				info.mask |= SyriacFeatureMask.isol;
				break;
			case SyriacForm.Initial:
				info.mask |= SyriacFeatureMask.init;
				break;
			case SyriacForm.Medial:
				info.mask |= SyriacFeatureMask.medi;
				break;
			case SyriacForm.Final:
				info.mask |= SyriacFeatureMask.fina;
				break;
		}

		info.mask |=
			SyriacFeatureMask.rlig |
			SyriacFeatureMask.calt |
			SyriacFeatureMask.liga |
			SyriacFeatureMask.stch;
	}
}

/**
 * Get default Syriac features in order
 */
export function getSyriacFeatures(): string[] {
	return [
		"ccmp", // Composition/decomposition
		"locl", // Localized forms
		"stch", // Stretching glyph decomposition
		"isol", // Isolated forms
		"init", // Initial forms
		"medi", // Medial forms
		"fina", // Final forms
		"rlig", // Required ligatures
		"calt", // Contextual alternates
		"liga", // Standard ligatures
	];
}

/**
 * Check if script uses Syriac shaper
 */
export function usesSyriac(script: string): boolean {
	return script === "syrc" || script === "Syrc";
}
