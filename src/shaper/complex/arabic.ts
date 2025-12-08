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

// Pre-computed joining type lookup table for Arabic block (0x0600-0x06FF)
// Values: 0=NonJoining, 1=RightJoining, 2=DualJoining, 3=JoinCausing, 4=LeftJoining, 5=Transparent
const JOINING_TYPE_ARABIC_BLOCK = new Uint8Array([
	// 0x0600-0x060F: Number signs and punctuation (NonJoining)
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	// 0x0610-0x061F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	// 0x0620-0x062F
	0, 0, 1, 1, 1, 1, 2, 1, 2, 1, 2, 2, 2, 2, 2, 1, // 0622-0627=R, 0626/0628=D, 0629=R, 062A-062E=D, 062F=R
	// 0x0630-0x063F
	1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // 0630-0632=R, 0633-063F=D
	// 0x0640-0x064F
	3, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 5, 5, 5, 5, 5, // 0640=C, 0641-0647=D, 0648=R, 0649-064A=D, 064B-064F=T
	// 0x0650-0x065F
	5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, // 0650-065F=T
	// 0x0660-0x066F
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, // 066E-066F=D
	// 0x0670-0x067F
	5, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, // 0670=T, 0671-0677=R, 0678-067F=D
	// 0x0680-0x068F
	2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, // 0680-0687=D, 0688-068F=R
	// 0x0690-0x069F
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, // 0690-0699=R, 069A-069F=D
	// 0x06A0-0x06AF
	2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // 06A0-06AF=D
	// 0x06B0-0x06BF
	2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // 06B0-06BF=D
	// 0x06C0-0x06CF
	1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 2, 2, // 06C0=R, 06C1-06C2=D, 06C3-06CB=R, 06CC=D, 06CD=R, 06CE-06CF=D
	// 0x06D0-0x06DF
	2, 2, 1, 1, 0, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, // 06D0-06D1=D, 06D2-06D3=R, 06D4=N, 06D5=D, 06D6-06DF=T
	// 0x06E0-0x06EF
	5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, // 06E0-06ED=T, 06EE-06EF=N
	// 0x06F0-0x06FF
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 2, // 06FA-06FC=D, 06FF=D
]);

// Map from lookup table value to ArabicJoiningType
const JOINING_TYPE_MAP: ArabicJoiningType[] = [
	ArabicJoiningType.NonJoining,   // 0
	ArabicJoiningType.RightJoining, // 1
	ArabicJoiningType.DualJoining,  // 2
	ArabicJoiningType.JoinCausing,  // 3
	ArabicJoiningType.LeftJoining,  // 4
	ArabicJoiningType.Transparent,  // 5
];

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
	// Fast path: Arabic block (0x0600-0x06FF) - use lookup table
	if (cp >= 0x0600 && cp <= 0x06ff) {
		return JOINING_TYPE_MAP[JOINING_TYPE_ARABIC_BLOCK[cp - 0x0600]!]!;
	}

	// Non-joining: below Arabic range
	if (cp < ARABIC_START) return ArabicJoiningType.NonJoining;

	// Extended marks (0x08D3-0x08FF)
	if (cp >= 0x08d3 && cp <= 0x08ff) return ArabicJoiningType.Transparent;

	// Default: NonJoining
	return ArabicJoiningType.NonJoining;
}

// Numeric constants for fast joining type comparison (avoid string comparison)
const JT_NON_JOINING = 0;
const JT_RIGHT_JOINING = 1;
const JT_DUAL_JOINING = 2;
const JT_JOIN_CAUSING = 3;
const JT_LEFT_JOINING = 4;
const JT_TRANSPARENT = 5;

/**
 * Get the numeric joining type for a codepoint (faster than enum)
 */
function getJoiningTypeNumeric(cp: number): number {
	// Fast path: Arabic block (0x0600-0x06FF) - use lookup table
	if (cp >= 0x0600 && cp <= 0x06ff) {
		return JOINING_TYPE_ARABIC_BLOCK[cp - 0x0600]!;
	}

	// Non-joining: below Arabic range
	if (cp < 0x0600) return JT_NON_JOINING;

	// Extended marks (0x08D3-0x08FF)
	if (cp >= 0x08d3 && cp <= 0x08ff) return JT_TRANSPARENT;

	// Default: NonJoining
	return JT_NON_JOINING;
}

/**
 * Analyze joining for a sequence of glyphs.
 * Returns the action to take for each glyph.
 */
export function analyzeJoining(infos: GlyphInfo[]): JoiningAction[] {
	const n = infos.length;
	const actions: JoiningAction[] = new Array(n).fill(JoiningAction.None);

	// Analyze each glyph based on neighbors (skipping transparent)
	for (let i = 0; i < n; i++) {
		const info = infos[i]!;
		const cp = info.codepoint ?? 0;
		const type = getJoiningTypeNumeric(cp);

		// Skip non-Arabic characters
		if (type === JT_NON_JOINING || type === JT_TRANSPARENT) {
			continue;
		}

		// Find previous non-transparent glyph
		let prevType = JT_NON_JOINING;
		for (let j = i - 1; j >= 0; j--) {
			const prevInfo = infos[j]!;
			const prevCp = prevInfo.codepoint ?? 0;
			const jType = getJoiningTypeNumeric(prevCp);
			if (jType !== JT_TRANSPARENT) {
				prevType = jType;
				break;
			}
		}

		// Find next non-transparent glyph
		let nextType = JT_NON_JOINING;
		for (let j = i + 1; j < n; j++) {
			const nextInfo = infos[j]!;
			const nextCp = nextInfo.codepoint ?? 0;
			const jType = getJoiningTypeNumeric(nextCp);
			if (jType !== JT_TRANSPARENT) {
				nextType = jType;
				break;
			}
		}

		// Determine if we join left/right
		const joinsLeft =
			prevType === JT_DUAL_JOINING ||
			prevType === JT_LEFT_JOINING ||
			prevType === JT_JOIN_CAUSING;

		const joinsRight =
			nextType === JT_DUAL_JOINING ||
			nextType === JT_RIGHT_JOINING ||
			nextType === JT_JOIN_CAUSING;

		// Determine action based on joining type and context
		if (type === JT_DUAL_JOINING) {
			if (joinsLeft && joinsRight) {
				actions[i] = JoiningAction.Medi;
			} else if (joinsLeft) {
				actions[i] = JoiningAction.Fina;
			} else if (joinsRight) {
				actions[i] = JoiningAction.Init;
			} else {
				actions[i] = JoiningAction.Isol;
			}
		} else if (type === JT_RIGHT_JOINING) {
			// Right-joining can only join on the right (to previous glyph in RTL)
			if (joinsLeft) {
				actions[i] = JoiningAction.Fina;
			} else {
				actions[i] = JoiningAction.Isol;
			}
		} else if (type === JT_LEFT_JOINING) {
			// Left-joining (rare)
			if (joinsRight) {
				actions[i] = JoiningAction.Init;
			} else {
				actions[i] = JoiningAction.Isol;
			}
		}
		// JoinCausing - no form change, leave as None
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
 * Inlined for performance - avoids intermediate array allocation
 */
export function setupArabicMasks(infos: GlyphInfo[]): void {
	const n = infos.length;

	// Feature tag bits:
	// - bit 0: isol (0x1)
	// - bit 1: fina (0x2)
	// - bit 2: medi (0x4)
	// - bit 3: init (0x8)
	for (let i = 0; i < n; i++) {
		const info = infos[i]!;
		const cp = info.codepoint ?? 0;
		const type = getJoiningTypeNumeric(cp);

		// Skip non-Arabic characters
		if (type === JT_NON_JOINING || type === JT_TRANSPARENT) {
			continue;
		}

		// Find previous non-transparent glyph
		let prevType = JT_NON_JOINING;
		for (let j = i - 1; j >= 0; j--) {
			const prevInfo = infos[j]!;
			const prevCp = prevInfo.codepoint ?? 0;
			const jType = getJoiningTypeNumeric(prevCp);
			if (jType !== JT_TRANSPARENT) {
				prevType = jType;
				break;
			}
		}

		// Find next non-transparent glyph
		let nextType = JT_NON_JOINING;
		for (let j = i + 1; j < n; j++) {
			const nextInfo = infos[j]!;
			const nextCp = nextInfo.codepoint ?? 0;
			const jType = getJoiningTypeNumeric(nextCp);
			if (jType !== JT_TRANSPARENT) {
				nextType = jType;
				break;
			}
		}

		// Determine if we join left/right
		const joinsLeft =
			prevType === JT_DUAL_JOINING ||
			prevType === JT_LEFT_JOINING ||
			prevType === JT_JOIN_CAUSING;

		const joinsRight =
			nextType === JT_DUAL_JOINING ||
			nextType === JT_RIGHT_JOINING ||
			nextType === JT_JOIN_CAUSING;

		// Determine action and set mask based on joining type and context
		let mask = 0;
		if (type === JT_DUAL_JOINING) {
			if (joinsLeft && joinsRight) {
				mask = 0x4; // medi
			} else if (joinsLeft) {
				mask = 0x2; // fina
			} else if (joinsRight) {
				mask = 0x8; // init
			} else {
				mask = 0x1; // isol
			}
		} else if (type === JT_RIGHT_JOINING) {
			if (joinsLeft) {
				mask = 0x2; // fina
			} else {
				mask = 0x1; // isol
			}
		} else if (type === JT_LEFT_JOINING) {
			if (joinsRight) {
				mask = 0x8; // init
			} else {
				mask = 0x1; // isol
			}
		}
		// JoinCausing - no form change, mask stays 0

		if (mask !== 0) {
			info.mask = (info.mask & 0xfffffff0) | mask;
		}
	}
}
