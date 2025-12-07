import { tag } from "../types.ts";
import type { ShapeFeature } from "./shape-plan.ts";

/**
 * Feature helper utilities
 * Provides convenient APIs for enabling OpenType features
 */

/**
 * Create a ShapeFeature for a stylistic set (ss01-ss20)
 */
export function stylisticSet(
	setNumber: number,
	enabled: boolean = true,
): ShapeFeature {
	if (setNumber < 1 || setNumber > 20) {
		throw new Error(`Stylistic set number must be 1-20, got ${setNumber}`);
	}
	const tagStr = `ss${setNumber.toString().padStart(2, "0")}`;
	return { tag: tag(tagStr), enabled };
}

/**
 * Create ShapeFeatures for multiple stylistic sets
 */
export function stylisticSets(
	setNumbers: number[],
	enabled: boolean = true,
): ShapeFeature[] {
	return setNumbers.map((n) => stylisticSet(n, enabled));
}

/**
 * Create a ShapeFeature for a character variant (cv01-cv99)
 */
export function characterVariant(
	variantNumber: number,
	enabled: boolean = true,
): ShapeFeature {
	if (variantNumber < 1 || variantNumber > 99) {
		throw new Error(
			`Character variant number must be 1-99, got ${variantNumber}`,
		);
	}
	const tagStr = `cv${variantNumber.toString().padStart(2, "0")}`;
	return { tag: tag(tagStr), enabled };
}

/**
 * Create ShapeFeatures for multiple character variants
 */
export function characterVariants(
	variantNumbers: number[],
	enabled: boolean = true,
): ShapeFeature[] {
	return variantNumbers.map((n) => characterVariant(n, enabled));
}

/**
 * Standard ligatures (liga)
 */
export function standardLigatures(enabled: boolean = true): ShapeFeature {
	return { tag: tag("liga"), enabled };
}

/**
 * Discretionary ligatures (dlig)
 */
export function discretionaryLigatures(enabled: boolean = true): ShapeFeature {
	return { tag: tag("dlig"), enabled };
}

/**
 * Historical ligatures (hlig)
 */
export function historicalLigatures(enabled: boolean = true): ShapeFeature {
	return { tag: tag("hlig"), enabled };
}

/**
 * Contextual alternates (calt)
 */
export function contextualAlternates(enabled: boolean = true): ShapeFeature {
	return { tag: tag("calt"), enabled };
}

/**
 * Stylistic alternates (salt)
 */
export function stylisticAlternates(enabled: boolean = true): ShapeFeature {
	return { tag: tag("salt"), enabled };
}

/**
 * Swash (swsh)
 */
export function swash(enabled: boolean = true): ShapeFeature {
	return { tag: tag("swsh"), enabled };
}

/**
 * Small capitals (smcp)
 */
export function smallCaps(enabled: boolean = true): ShapeFeature {
	return { tag: tag("smcp"), enabled };
}

/**
 * Capitals to small capitals (c2sc)
 */
export function capsToSmallCaps(enabled: boolean = true): ShapeFeature {
	return { tag: tag("c2sc"), enabled };
}

/**
 * Petite capitals (pcap)
 */
export function petiteCaps(enabled: boolean = true): ShapeFeature {
	return { tag: tag("pcap"), enabled };
}

/**
 * All small capitals (both smcp and c2sc)
 */
export function allSmallCaps(enabled: boolean = true): ShapeFeature[] {
	return [smallCaps(enabled), capsToSmallCaps(enabled)];
}

/**
 * Oldstyle figures (onum)
 */
export function oldstyleFigures(enabled: boolean = true): ShapeFeature {
	return { tag: tag("onum"), enabled };
}

/**
 * Lining figures (lnum)
 */
export function liningFigures(enabled: boolean = true): ShapeFeature {
	return { tag: tag("lnum"), enabled };
}

/**
 * Proportional figures (pnum)
 */
export function proportionalFigures(enabled: boolean = true): ShapeFeature {
	return { tag: tag("pnum"), enabled };
}

/**
 * Tabular figures (tnum)
 */
export function tabularFigures(enabled: boolean = true): ShapeFeature {
	return { tag: tag("tnum"), enabled };
}

/**
 * Fractions (frac)
 */
export function fractions(enabled: boolean = true): ShapeFeature {
	return { tag: tag("frac"), enabled };
}

/**
 * Ordinals (ordn)
 */
export function ordinals(enabled: boolean = true): ShapeFeature {
	return { tag: tag("ordn"), enabled };
}

/**
 * Slashed zero (zero)
 */
export function slashedZero(enabled: boolean = true): ShapeFeature {
	return { tag: tag("zero"), enabled };
}

/**
 * Superscript (sups)
 */
export function superscript(enabled: boolean = true): ShapeFeature {
	return { tag: tag("sups"), enabled };
}

/**
 * Subscript (subs)
 */
export function subscript(enabled: boolean = true): ShapeFeature {
	return { tag: tag("subs"), enabled };
}

/**
 * Scientific inferiors (sinf)
 */
export function scientificInferiors(enabled: boolean = true): ShapeFeature {
	return { tag: tag("sinf"), enabled };
}

/**
 * Case-sensitive forms (case)
 */
export function caseSensitiveForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("case"), enabled };
}

/**
 * Capital spacing (cpsp)
 */
export function capitalSpacing(enabled: boolean = true): ShapeFeature {
	return { tag: tag("cpsp"), enabled };
}

/**
 * Kerning (kern)
 */
export function kerning(enabled: boolean = true): ShapeFeature {
	return { tag: tag("kern"), enabled };
}

/**
 * Vertical forms (vert) - for vertical text layout
 */
export function verticalForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("vert"), enabled };
}

/**
 * Vertical alternates and rotation (vrt2) - for vertical text layout
 */
export function verticalAlternatesRotation(
	enabled: boolean = true,
): ShapeFeature {
	return { tag: tag("vrt2"), enabled };
}

/**
 * Vertical Kana alternates (vkna) - for Japanese vertical text
 */
export function verticalKanaAlternates(enabled: boolean = true): ShapeFeature {
	return { tag: tag("vkna"), enabled };
}

/**
 * All vertical layout features
 */
export function verticalLayoutFeatures(
	enabled: boolean = true,
): ShapeFeature[] {
	return [
		verticalForms(enabled),
		verticalAlternatesRotation(enabled),
		verticalKanaAlternates(enabled),
	];
}

/**
 * Ruby notation forms (ruby)
 */
export function ruby(enabled: boolean = true): ShapeFeature {
	return { tag: tag("ruby"), enabled };
}

/**
 * Half-width forms (hwid)
 */
export function halfWidthForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("hwid"), enabled };
}

/**
 * Full-width forms (fwid)
 */
export function fullWidthForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("fwid"), enabled };
}

/**
 * Proportional-width forms (pwid)
 */
export function proportionalWidthForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("pwid"), enabled };
}

/**
 * Quarter-width forms (qwid)
 */
export function quarterWidthForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("qwid"), enabled };
}

/**
 * Third-width forms (twid)
 */
export function thirdWidthForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("twid"), enabled };
}

/**
 * JIS78 forms (jp78) - Japanese
 */
export function jis78Forms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("jp78"), enabled };
}

/**
 * JIS83 forms (jp83) - Japanese
 */
export function jis83Forms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("jp83"), enabled };
}

/**
 * JIS90 forms (jp90) - Japanese
 */
export function jis90Forms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("jp90"), enabled };
}

/**
 * JIS2004 forms (jp04) - Japanese
 */
export function jis2004Forms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("jp04"), enabled };
}

/**
 * Simplified forms (smpl) - Chinese
 */
export function simplifiedForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("smpl"), enabled };
}

/**
 * Traditional forms (trad) - Chinese
 */
export function traditionalForms(enabled: boolean = true): ShapeFeature {
	return { tag: tag("trad"), enabled };
}

/**
 * Create a feature from a 4-character tag string
 */
export function feature(tagStr: string, enabled: boolean = true): ShapeFeature {
	return { tag: tag(tagStr), enabled };
}

/**
 * Create multiple features from tag strings
 */
export function features(
	tagStrs: string[],
	enabled: boolean = true,
): ShapeFeature[] {
	return tagStrs.map((t) => feature(t, enabled));
}

/**
 * Combine multiple feature sets
 */
export function combineFeatures(
	...featureSets: (ShapeFeature | ShapeFeature[])[]
): ShapeFeature[] {
	const result: ShapeFeature[] = [];
	for (let i = 0; i < featureSets.length; i++) {
		const set = featureSets[i]!;
		if (Array.isArray(set)) {
			result.push(...set);
		} else {
			result.push(set);
		}
	}
	return result;
}
