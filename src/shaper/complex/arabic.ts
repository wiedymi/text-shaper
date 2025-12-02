import type { GlyphInfo } from "../../types.ts";

/**
 * Arabic joining types from Unicode
 */
export enum ArabicJoiningType {
	NonJoining = "U", // Non_Joining
	RightJoining = "R", // Right_Joining (joins on the right)
	DualJoining = "D", // Dual_Joining (joins on both sides)
	JoinCausing = "C", // Join_Causing (like TATWEEL)
	LeftJoining = "L", // Left_Joining (rare)
	Transparent = "T", // Transparent (marks, etc.)
}

/**
 * Action to take for each glyph based on context
 */
export enum JoiningAction {
	None = 0,
	Isol = 1, // Isolated form
	Fina = 2, // Final form
	Medi = 3, // Medial form
	Init = 4, // Initial form
}

/**
 * Arabic joining group for specific shaping behavior
 */
export enum ArabicJoiningGroup {
	None = 0,
	Alaph = 1,
	DalathRish = 2,
	// Add more as needed for Syriac, etc.
}

/**
 * Per-glyph info for Arabic shaping
 */
export interface ArabicGlyphData {
	joiningType: ArabicJoiningType;
	joiningGroup: ArabicJoiningGroup;
	action: JoiningAction;
}

// Unicode ranges for Arabic characters
const ARABIC_START = 0x0600;
const ARABIC_END = 0x06ff;
const ARABIC_SUPPLEMENT_START = 0x0750;
const ARABIC_SUPPLEMENT_END = 0x077f;
const ARABIC_EXTENDED_A_START = 0x08a0;
const ARABIC_EXTENDED_A_END = 0x08ff;
const ARABIC_PRESENTATION_A_START = 0xfb50;
const ARABIC_PRESENTATION_A_END = 0xfdff;
const ARABIC_PRESENTATION_B_START = 0xfe70;
const ARABIC_PRESENTATION_B_END = 0xfeff;

/**
 * Check if a codepoint is in Arabic script range
 */
export function isArabic(cp: number): boolean {
	return (
		(cp >= ARABIC_START && cp <= ARABIC_END) ||
		(cp >= ARABIC_SUPPLEMENT_START && cp <= ARABIC_SUPPLEMENT_END) ||
		(cp >= ARABIC_EXTENDED_A_START && cp <= ARABIC_EXTENDED_A_END) ||
		(cp >= ARABIC_PRESENTATION_A_START && cp <= ARABIC_PRESENTATION_A_END) ||
		(cp >= ARABIC_PRESENTATION_B_START && cp <= ARABIC_PRESENTATION_B_END)
	);
}

/**
 * Get the joining type for a codepoint
 * Based on Unicode Arabic Shaping data
 */
export function getJoiningType(cp: number): ArabicJoiningType {
	// Non-joining: space, numbers, punctuation
	if (cp < ARABIC_START) return ArabicJoiningType.NonJoining;

	// Arabic block (0600-06FF)
	if (cp >= 0x0600 && cp <= 0x0605) return ArabicJoiningType.NonJoining; // Number signs
	if (cp === 0x0608) return ArabicJoiningType.NonJoining; // Arabic Ray
	if (cp === 0x060b) return ArabicJoiningType.NonJoining; // Afghani Sign
	if (cp === 0x060d) return ArabicJoiningType.NonJoining; // Date Separator

	// Dual-joining letters (most common Arabic letters)
	// These can connect on both sides
	if (cp === 0x0626) return ArabicJoiningType.DualJoining; // YEH WITH HAMZA ABOVE
	if (cp === 0x0628) return ArabicJoiningType.DualJoining; // BEH
	if (cp === 0x062a) return ArabicJoiningType.DualJoining; // TEH
	if (cp === 0x062b) return ArabicJoiningType.DualJoining; // THEH
	if (cp === 0x062c) return ArabicJoiningType.DualJoining; // JEEM
	if (cp === 0x062d) return ArabicJoiningType.DualJoining; // HAH
	if (cp === 0x062e) return ArabicJoiningType.DualJoining; // KHAH
	if (cp === 0x0633) return ArabicJoiningType.DualJoining; // SEEN
	if (cp === 0x0634) return ArabicJoiningType.DualJoining; // SHEEN
	if (cp === 0x0635) return ArabicJoiningType.DualJoining; // SAD
	if (cp === 0x0636) return ArabicJoiningType.DualJoining; // DAD
	if (cp === 0x0637) return ArabicJoiningType.DualJoining; // TAH
	if (cp === 0x0638) return ArabicJoiningType.DualJoining; // ZAH
	if (cp === 0x0639) return ArabicJoiningType.DualJoining; // AIN
	if (cp === 0x063a) return ArabicJoiningType.DualJoining; // GHAIN
	if (cp >= 0x063b && cp <= 0x063f) return ArabicJoiningType.DualJoining; // Extended
	if (cp === 0x0641) return ArabicJoiningType.DualJoining; // FEH
	if (cp === 0x0642) return ArabicJoiningType.DualJoining; // QAF
	if (cp === 0x0643) return ArabicJoiningType.DualJoining; // KAF
	if (cp === 0x0644) return ArabicJoiningType.DualJoining; // LAM
	if (cp === 0x0645) return ArabicJoiningType.DualJoining; // MEEM
	if (cp === 0x0646) return ArabicJoiningType.DualJoining; // NOON
	if (cp === 0x0647) return ArabicJoiningType.DualJoining; // HEH
	if (cp === 0x0649) return ArabicJoiningType.DualJoining; // ALEF MAKSURA
	if (cp === 0x064a) return ArabicJoiningType.DualJoining; // YEH
	if (cp >= 0x066e && cp <= 0x066f) return ArabicJoiningType.DualJoining; // DOTLESS BEH/QAF
	if (cp >= 0x0678 && cp <= 0x0687) return ArabicJoiningType.DualJoining; // Extended Arabic
	if (cp >= 0x069a && cp <= 0x06bf) return ArabicJoiningType.DualJoining; // More extended
	if (cp >= 0x06c1 && cp <= 0x06c2) return ArabicJoiningType.DualJoining; // HEH variants
	if (cp === 0x06cc) return ArabicJoiningType.DualJoining; // FARSI YEH
	if (cp >= 0x06ce && cp <= 0x06d1) return ArabicJoiningType.DualJoining; // YEH variants
	if (cp === 0x06d5) return ArabicJoiningType.DualJoining; // AE
	if (cp >= 0x06fa && cp <= 0x06fc) return ArabicJoiningType.DualJoining; // More letters
	if (cp === 0x06ff) return ArabicJoiningType.DualJoining; // HEH WITH INVERTED V

	// Right-joining letters (only connect on the right)
	// ALEF and its variants, DAL/DHAL, REH/ZAY, WAW
	if (cp === 0x0622) return ArabicJoiningType.RightJoining; // ALEF WITH MADDA ABOVE
	if (cp === 0x0623) return ArabicJoiningType.RightJoining; // ALEF WITH HAMZA ABOVE
	if (cp === 0x0624) return ArabicJoiningType.RightJoining; // WAW WITH HAMZA ABOVE
	if (cp === 0x0625) return ArabicJoiningType.RightJoining; // ALEF WITH HAMZA BELOW
	if (cp === 0x0627) return ArabicJoiningType.RightJoining; // ALEF
	if (cp === 0x0629) return ArabicJoiningType.RightJoining; // TEH MARBUTA
	if (cp === 0x062f) return ArabicJoiningType.RightJoining; // DAL
	if (cp === 0x0630) return ArabicJoiningType.RightJoining; // THAL
	if (cp === 0x0631) return ArabicJoiningType.RightJoining; // REH
	if (cp === 0x0632) return ArabicJoiningType.RightJoining; // ZAIN
	if (cp === 0x0648) return ArabicJoiningType.RightJoining; // WAW
	if (cp === 0x0671) return ArabicJoiningType.RightJoining; // ALEF WASLA
	if (cp >= 0x0672 && cp <= 0x0677) return ArabicJoiningType.RightJoining; // ALEF variants
	if (cp >= 0x0688 && cp <= 0x0699) return ArabicJoiningType.RightJoining; // DAL/REH extended
	if (cp >= 0x06c0 && cp <= 0x06c0) return ArabicJoiningType.RightJoining; // HEH WITH YEH
	if (cp === 0x06c3) return ArabicJoiningType.RightJoining; // TEH MARBUTA GOAL
	if (cp >= 0x06c4 && cp <= 0x06cb) return ArabicJoiningType.RightJoining; // WAW variants
	if (cp === 0x06cd) return ArabicJoiningType.RightJoining; // YEH WITH TAIL
	if (cp >= 0x06d2 && cp <= 0x06d3) return ArabicJoiningType.RightJoining; // YEH BARREE

	// TATWEEL - Join causing
	if (cp === 0x0640) return ArabicJoiningType.JoinCausing;

	// Transparent - combining marks, diacritics
	if (cp >= 0x064b && cp <= 0x065f) return ArabicJoiningType.Transparent; // Arabic marks
	if (cp === 0x0670) return ArabicJoiningType.Transparent; // SUPERSCRIPT ALEF
	if (cp >= 0x06d6 && cp <= 0x06ed) return ArabicJoiningType.Transparent; // Quranic marks
	if (cp >= 0x08d3 && cp <= 0x08ff) return ArabicJoiningType.Transparent; // Extended marks

	// Default for Arabic range: NonJoining
	if (isArabic(cp)) return ArabicJoiningType.NonJoining;

	return ArabicJoiningType.NonJoining;
}

/**
 * Analyze joining for a sequence of glyphs.
 * Returns the action to take for each glyph.
 */
export function analyzeJoining(infos: GlyphInfo[]): JoiningAction[] {
	const n = infos.length;
	const actions: JoiningAction[] = new Array(n).fill(JoiningAction.None);
	const types: ArabicJoiningType[] = [];

	// Get joining types for all glyphs
	for (const info of infos) {
		const cp = info.codepoint ?? 0;
		types.push(getJoiningType(cp));
	}

	// Analyze each glyph based on neighbors (skipping transparent)
	for (let i = 0; i < n; i++) {
		const type = types[i]!;

		// Skip non-Arabic characters
		if (
			type === ArabicJoiningType.NonJoining ||
			type === ArabicJoiningType.Transparent
		) {
			continue;
		}

		// Find previous non-transparent glyph
		let prevType: ArabicJoiningType | null = null;
		for (let j = i - 1; j >= 0; j--) {
			if (types[j] !== ArabicJoiningType.Transparent) {
				prevType = types[j]!;
				break;
			}
		}

		// Find next non-transparent glyph
		let nextType: ArabicJoiningType | null = null;
		for (let j = i + 1; j < n; j++) {
			if (types[j] !== ArabicJoiningType.Transparent) {
				nextType = types[j]!;
				break;
			}
		}

		// Determine if we join left/right
		const joinsLeft =
			prevType === ArabicJoiningType.DualJoining ||
			prevType === ArabicJoiningType.LeftJoining ||
			prevType === ArabicJoiningType.JoinCausing;

		const joinsRight =
			nextType === ArabicJoiningType.DualJoining ||
			nextType === ArabicJoiningType.RightJoining ||
			nextType === ArabicJoiningType.JoinCausing;

		// Determine action based on joining type and context
		if (type === ArabicJoiningType.DualJoining) {
			if (joinsLeft && joinsRight) {
				actions[i] = JoiningAction.Medi;
			} else if (joinsLeft) {
				actions[i] = JoiningAction.Fina;
			} else if (joinsRight) {
				actions[i] = JoiningAction.Init;
			} else {
				actions[i] = JoiningAction.Isol;
			}
		} else if (type === ArabicJoiningType.RightJoining) {
			// Right-joining can only join on the right (to previous glyph in RTL)
			if (joinsLeft) {
				actions[i] = JoiningAction.Fina;
			} else {
				actions[i] = JoiningAction.Isol;
			}
		} else if (type === ArabicJoiningType.LeftJoining) {
			// Left-joining (rare)
			if (joinsRight) {
				actions[i] = JoiningAction.Init;
			} else {
				actions[i] = JoiningAction.Isol;
			}
		} else if (type === ArabicJoiningType.JoinCausing) {
			// TATWEEL - just connects, no form change
			actions[i] = JoiningAction.None;
		}
	}

	return actions;
}

/**
 * Get the feature tag for a joining action
 */
export function getFeatureForAction(action: JoiningAction): string | null {
	switch (action) {
		case JoiningAction.Isol:
			return "isol";
		case JoiningAction.Fina:
			return "fina";
		case JoiningAction.Medi:
			return "medi";
		case JoiningAction.Init:
			return "init";
		default:
			return null;
	}
}

/**
 * Set the feature mask for each glyph based on joining analysis
 */
export function setupArabicMasks(infos: GlyphInfo[]): void {
	const actions = analyzeJoining(infos);

	// Feature tag bits (these should match how ShapePlan assigns masks)
	// For now we use a simple scheme where:
	// - bit 0: isol
	// - bit 1: fina
	// - bit 2: medi
	// - bit 3: init
	for (let i = 0; i < infos.length; i++) {
		const action = actions[i]!;
		const info = infos[i]!;

		// Set mask based on action
		// The shaper will need to check these masks when applying features
		switch (action) {
			case JoiningAction.Isol:
				info.mask = (info.mask & 0xfffffff0) | 0x1;
				break;
			case JoiningAction.Fina:
				info.mask = (info.mask & 0xfffffff0) | 0x2;
				break;
			case JoiningAction.Medi:
				info.mask = (info.mask & 0xfffffff0) | 0x4;
				break;
			case JoiningAction.Init:
				info.mask = (info.mask & 0xfffffff0) | 0x8;
				break;
		}
	}
}
