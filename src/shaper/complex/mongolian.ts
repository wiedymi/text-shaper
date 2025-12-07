import type { GlyphInfo } from "../../types.ts";

/**
 * Mongolian shaper
 * Handles Traditional Mongolian, Manchu, and Sibe scripts
 *
 * Mongolian is written vertically (top to bottom, left to right columns).
 * Like Arabic, it has context-sensitive letter forms:
 * - Initial, Medial, Final, and Isolated forms
 *
 * Key characteristics:
 * - Vertical writing
 * - Positional forms (like Arabic joining)
 * - Free variation selectors (FVS1-FVS4)
 * - Vowel separators (MVS, NNBSP)
 */

/**
 * Mongolian character categories
 */
export enum MongolianCategory {
	Other = 0,
	Letter = 1, // Regular letters
	Vowel = 2, // Vowels
	Digit = 3, // Digits
	Punctuation = 4, // Punctuation
	FVS = 5, // Free Variation Selector
	MVS = 6, // Mongolian Vowel Separator (180E)
	NNBSP = 7, // Narrow No-Break Space (202F)
	ZWJ = 8, // Zero Width Joiner
	ZWNJ = 9, // Zero Width Non-Joiner
}

/**
 * Mongolian joining types (like Arabic)
 */
export enum MongolianJoining {
	NonJoining = 0,
	RightJoining = 1, // Joins to right (previous in text order)
	DualJoining = 2, // Joins both sides
	LeftJoining = 3, // Joins to left (next in text order) - rare
	Transparent = 4, // Invisible control characters
	Causing = 5, // Causes join but doesn't join itself
}

/**
 * Get Mongolian category
 */
export function getMongolianCategory(cp: number): MongolianCategory {
	// Control characters
	if (cp === 0x200c) return MongolianCategory.ZWNJ;
	if (cp === 0x200d) return MongolianCategory.ZWJ;

	// Mongolian Vowel Separator
	if (cp === 0x180e) return MongolianCategory.MVS;

	// Narrow No-Break Space (used as vowel separator)
	if (cp === 0x202f) return MongolianCategory.NNBSP;

	// Not Mongolian
	if (cp < 0x1800 || cp > 0x18af) {
		// Check Todo script (additional Mongolian range)
		if (cp >= 0x11660 && cp <= 0x1167f) return MongolianCategory.Letter;
		return MongolianCategory.Other;
	}

	// Free Variation Selectors (180B-180D, 180F)
	if (cp >= 0x180b && cp <= 0x180d) return MongolianCategory.FVS;
	if (cp === 0x180f) return MongolianCategory.FVS;

	// Punctuation (1800-1805, 1807-180A)
	if (cp >= 0x1800 && cp <= 0x1805) return MongolianCategory.Punctuation;
	if (cp >= 0x1807 && cp <= 0x180a) return MongolianCategory.Punctuation;

	// Digits (1810-1819)
	if (cp >= 0x1810 && cp <= 0x1819) return MongolianCategory.Digit;

	// Vowels (specific letters that are vowels)
	// A, E, I, O, U, OE, UE
	if (
		cp === 0x1820 || // A
		cp === 0x1821 || // E
		cp === 0x1822 || // I
		cp === 0x1823 || // O
		cp === 0x1824 || // U
		cp === 0x1825 || // OE
		cp === 0x1826 // UE
	) {
		return MongolianCategory.Vowel;
	}

	// Letters (1820-1878, 1880-18AA)
	if (cp >= 0x1820 && cp <= 0x1878) return MongolianCategory.Letter;
	if (cp >= 0x1880 && cp <= 0x18aa) return MongolianCategory.Letter;

	return MongolianCategory.Other;
}

/**
 * Get Mongolian joining type for a codepoint
 */
export function getMongolianJoining(cp: number): MongolianJoining {
	const cat = getMongolianCategory(cp);

	// Transparent characters
	if (cat === MongolianCategory.FVS) return MongolianJoining.Transparent;
	if (cat === MongolianCategory.ZWJ) return MongolianJoining.Causing;
	if (cat === MongolianCategory.ZWNJ) return MongolianJoining.NonJoining;

	// Vowel separator acts as non-joining
	if (cat === MongolianCategory.MVS || cat === MongolianCategory.NNBSP) {
		return MongolianJoining.NonJoining;
	}

	// Non-joining characters
	if (
		cat === MongolianCategory.Digit ||
		cat === MongolianCategory.Punctuation
	) {
		return MongolianJoining.NonJoining;
	}

	// Most Mongolian letters are dual-joining
	if (cat === MongolianCategory.Letter || cat === MongolianCategory.Vowel) {
		// A few letters are right-joining only
		if (
			cp === 0x1820 || // A (initial form only joins right)
			cp === 0x1821 // E
		) {
			return MongolianJoining.DualJoining; // Actually dual but with special initial forms
		}
		return MongolianJoining.DualJoining;
	}

	return MongolianJoining.NonJoining;
}

/**
 * Mongolian positional forms
 */
export enum MongolianForm {
	Isolated = 0,
	Initial = 1,
	Medial = 2,
	Final = 3,
}

/**
 * Determine positional form for a Mongolian character
 */
export function getMongolianForm(
	prev: MongolianJoining,
	current: MongolianJoining,
	next: MongolianJoining,
): MongolianForm {
	// Transparent chars don't affect form (pass through previous join state)
	if (current === MongolianJoining.Transparent) {
		return MongolianForm.Isolated;
	}

	// Non-joining always isolated
	if (current === MongolianJoining.NonJoining) {
		return MongolianForm.Isolated;
	}

	const joinsLeft =
		current === MongolianJoining.DualJoining ||
		current === MongolianJoining.LeftJoining;
	const joinsRight =
		current === MongolianJoining.DualJoining ||
		current === MongolianJoining.RightJoining;

	const canJoinPrev =
		prev === MongolianJoining.DualJoining ||
		prev === MongolianJoining.LeftJoining ||
		prev === MongolianJoining.Causing;

	const canJoinNext =
		next === MongolianJoining.DualJoining ||
		next === MongolianJoining.RightJoining ||
		next === MongolianJoining.Causing;

	const joinedToPrev = joinsRight && canJoinPrev;
	const joinedToNext = joinsLeft && canJoinNext;

	if (joinedToPrev && joinedToNext) return MongolianForm.Medial;
	if (joinedToPrev) return MongolianForm.Final;
	if (joinedToNext) return MongolianForm.Initial;
	return MongolianForm.Isolated;
}

/**
 * Mongolian feature masks
 */
export const MongolianFeatureMask = {
	ccmp: 0x0001, // Composition/decomposition
	locl: 0x0002, // Localized forms
	isol: 0x0004, // Isolated forms
	init: 0x0008, // Initial forms
	medi: 0x0010, // Medial forms
	fina: 0x0020, // Final forms
	rlig: 0x0040, // Required ligatures
	calt: 0x0080, // Contextual alternates
	liga: 0x0100, // Standard ligatures
	vert: 0x0200, // Vertical writing forms
} as const;

/**
 * Set up masks for Mongolian shaping
 */
export function setupMongolianMasks(infos: GlyphInfo[]): void {
	const n = infos.length;

	// First pass: determine joining types
	const joiningTypes: MongolianJoining[] = [];
	for (let i = 0; i < n; i++) {
		joiningTypes.push(getMongolianJoining(infos[i]?.codepoint ?? 0));
	}

	// Second pass: resolve effective joining considering transparent chars
	const effectiveJoining: MongolianJoining[] = [];
	for (let i = 0; i < joiningTypes.length; i++) {
		const joining = joiningTypes[i]!;
		// For transparent characters, we still need their effective joining for masking
		if (joining === MongolianJoining.Transparent) {
			effectiveJoining.push(joining);
		} else {
			effectiveJoining.push(joining);
		}
	}

	// Third pass: assign forms and masks
	for (let i = 0; i < n; i++) {
		const info = infos[i];
		if (!info) continue;

		const cat = getMongolianCategory(info.codepoint);

		// All characters get ccmp and locl
		info.mask |= MongolianFeatureMask.ccmp | MongolianFeatureMask.locl;

		// Skip non-letters for form assignment
		if (cat !== MongolianCategory.Letter && cat !== MongolianCategory.Vowel) {
			continue;
		}

		// Get neighbors (skip transparent characters)
		let prevJoin = MongolianJoining.NonJoining;
		for (let j = i - 1; j >= 0; j--) {
			const jt = joiningTypes[j];
			if (jt !== MongolianJoining.Transparent) {
				if (jt !== undefined) prevJoin = jt;
				break;
			}
		}

		let nextJoin = MongolianJoining.NonJoining;
		for (let j = i + 1; j < n; j++) {
			const jt = joiningTypes[j];
			if (jt !== MongolianJoining.Transparent) {
				if (jt !== undefined) nextJoin = jt;
				break;
			}
		}

		const effJoin = effectiveJoining[i] ?? MongolianJoining.NonJoining;
		const form = getMongolianForm(prevJoin, effJoin, nextJoin);

		// Apply form-specific mask
		switch (form) {
			case MongolianForm.Isolated:
				info.mask |= MongolianFeatureMask.isol;
				break;
			case MongolianForm.Initial:
				info.mask |= MongolianFeatureMask.init;
				break;
			case MongolianForm.Medial:
				info.mask |= MongolianFeatureMask.medi;
				break;
			case MongolianForm.Final:
				info.mask |= MongolianFeatureMask.fina;
				break;
		}

		// All forms can participate in these
		info.mask |=
			MongolianFeatureMask.rlig |
			MongolianFeatureMask.calt |
			MongolianFeatureMask.liga |
			MongolianFeatureMask.vert;
	}
}

/**
 * Get default Mongolian features in order
 */
export function getMongolianFeatures(): string[] {
	return [
		"ccmp", // Character composition/decomposition
		"locl", // Localized forms
		"isol", // Isolated forms
		"init", // Initial forms
		"medi", // Medial forms
		"fina", // Final forms
		"rlig", // Required ligatures
		"calt", // Contextual alternates
		"liga", // Standard ligatures
		"vert", // Vertical forms (for vertical text)
	];
}

/**
 * Check if script uses Mongolian shaper
 */
export function usesMongolian(script: string): boolean {
	const mongolianScripts = [
		"mong", // Mongolian
		"Mong", // Mongolian (title case)
		"phag", // Phags-pa
		"Phag", // Phags-pa (title case)
	];
	return mongolianScripts.includes(script);
}
