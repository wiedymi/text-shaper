import type { GlyphInfo } from "../../types.ts";

/**
 * Georgian shaper
 * Handles Georgian script (Mkhedruli, Asomtavruli, Nuskhuri)
 *
 * Georgian is relatively simple compared to other complex scripts:
 * - No complex reordering
 * - No joining behavior
 * - Case transformations (Mkhedruli lowercase, Mtavruli uppercase)
 * - Historical scripts (Asomtavruli, Nuskhuri)
 *
 * Main complexity:
 * - Mtavruli (uppercase) added in Unicode 11.0
 * - Stylistic variants between scripts
 * - Small caps via 'smcp' feature
 */

/**
 * Georgian character categories
 */
export enum GeorgianCategory {
	Other = 0,
	Mkhedruli = 1, // Modern lowercase (10D0-10FA, 10FC, 10FD-10FF)
	Mtavruli = 2, // Modern uppercase (1C90-1CBA, 1CBD-1CBF)
	Asomtavruli = 3, // Old Church uppercase (10A0-10C5, 10C7, 10CD)
	Nuskhuri = 4, // Old Church lowercase (2D00-2D25, 2D27, 2D2D)
	Modifier = 5, // Modifiers (10FB)
	Punctuation = 6, // Punctuation (10FB)
	Digit = 7, // Digits (using Latin digits with Georgian)
	Letter = 8, // Generic letter (for extensions)
}

/**
 * Get Georgian category for codepoint
 */
export function getGeorgianCategory(cp: number): GeorgianCategory {
	// Mkhedruli (modern lowercase)
	if (cp >= 0x10d0 && cp <= 0x10fa) return GeorgianCategory.Mkhedruli;
	if (cp === 0x10fc) return GeorgianCategory.Mkhedruli; // Modifier letter
	if (cp >= 0x10fd && cp <= 0x10ff) return GeorgianCategory.Mkhedruli;

	// Mtavruli (modern uppercase, added Unicode 11.0)
	if (cp >= 0x1c90 && cp <= 0x1cba) return GeorgianCategory.Mtavruli;
	if (cp >= 0x1cbd && cp <= 0x1cbf) return GeorgianCategory.Mtavruli;

	// Asomtavruli (old ecclesiastical uppercase)
	if (cp >= 0x10a0 && cp <= 0x10c5) return GeorgianCategory.Asomtavruli;
	if (cp === 0x10c7) return GeorgianCategory.Asomtavruli;
	if (cp === 0x10cd) return GeorgianCategory.Asomtavruli;

	// Nuskhuri (old ecclesiastical lowercase)
	if (cp >= 0x2d00 && cp <= 0x2d25) return GeorgianCategory.Nuskhuri;
	if (cp === 0x2d27) return GeorgianCategory.Nuskhuri;
	if (cp === 0x2d2d) return GeorgianCategory.Nuskhuri;

	// Paragraph separator (also used in Georgian)
	if (cp === 0x10fb) return GeorgianCategory.Punctuation;

	return GeorgianCategory.Other;
}

/**
 * Check if character is a Georgian letter
 */
export function isGeorgianLetter(cp: number): boolean {
	const cat = getGeorgianCategory(cp);
	return (
		cat === GeorgianCategory.Mkhedruli ||
		cat === GeorgianCategory.Mtavruli ||
		cat === GeorgianCategory.Asomtavruli ||
		cat === GeorgianCategory.Nuskhuri
	);
}

/**
 * Georgian case mapping (Mkhedruli <-> Mtavruli)
 * Returns the corresponding uppercase/lowercase codepoint, or 0 if none
 */
export function georgianToUpper(cp: number): number {
	// Mkhedruli to Mtavruli
	if (cp >= 0x10d0 && cp <= 0x10fa) {
		return cp - 0x10d0 + 0x1c90;
	}
	if (cp >= 0x10fd && cp <= 0x10ff) {
		return cp - 0x10fd + 0x1cbd;
	}
	return 0;
}

export function georgianToLower(cp: number): number {
	// Mtavruli to Mkhedruli
	if (cp >= 0x1c90 && cp <= 0x1cba) {
		return cp - 0x1c90 + 0x10d0;
	}
	if (cp >= 0x1cbd && cp <= 0x1cbf) {
		return cp - 0x1cbd + 0x10fd;
	}
	return 0;
}

/**
 * Georgian feature masks
 */
export const GeorgianFeatureMask = {
	ccmp: 0x0001, // Composition/decomposition
	locl: 0x0002, // Localized forms
	calt: 0x0004, // Contextual alternates
	liga: 0x0008, // Standard ligatures
	smcp: 0x0010, // Small capitals
	c2sc: 0x0020, // Capitals to small capitals
	case_: 0x0040, // Case-sensitive forms
	cpsp: 0x0080, // Capital spacing
} as const;

/**
 * Set up masks for Georgian shaping
 */
export function setupGeorgianMasks(infos: GlyphInfo[]): void {
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i];
		if (!info) continue;

		const cat = getGeorgianCategory(info.codepoint);

		// All characters get basic features
		info.mask |= GeorgianFeatureMask.ccmp | GeorgianFeatureMask.locl;

		if (isGeorgianLetter(info.codepoint)) {
			// Letters participate in contextual features
			info.mask |= GeorgianFeatureMask.calt | GeorgianFeatureMask.liga;

			// Uppercase letters get case-related features
			if (
				cat === GeorgianCategory.Mtavruli ||
				cat === GeorgianCategory.Asomtavruli
			) {
				info.mask |= GeorgianFeatureMask.case_ | GeorgianFeatureMask.cpsp;
			}

			// Lowercase letters can get small caps
			if (
				cat === GeorgianCategory.Mkhedruli ||
				cat === GeorgianCategory.Nuskhuri
			) {
				info.mask |= GeorgianFeatureMask.smcp;
			}

			// Uppercase can be converted to small caps
			if (
				cat === GeorgianCategory.Mtavruli ||
				cat === GeorgianCategory.Asomtavruli
			) {
				info.mask |= GeorgianFeatureMask.c2sc;
			}
		}
	}
}

/**
 * Get default Georgian features in order
 */
export function getGeorgianFeatures(): string[] {
	return [
		"ccmp", // Character composition/decomposition
		"locl", // Localized forms
		"calt", // Contextual alternates
		"liga", // Standard ligatures
	];
}

/**
 * Check if script uses Georgian shaper
 */
export function usesGeorgian(script: string): boolean {
	return (
		script === "geor" ||
		script === "Geor" ||
		script === "geok" ||
		script === "Geok"
	);
}
