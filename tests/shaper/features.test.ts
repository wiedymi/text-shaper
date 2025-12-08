import { test, expect, describe } from "bun:test";
import { tag, tagToString } from "../../src/types.ts";
import {
	stylisticSet,
	stylisticSets,
	characterVariant,
	characterVariants,
	standardLigatures,
	discretionaryLigatures,
	historicalLigatures,
	contextualAlternates,
	stylisticAlternates,
	swash,
	smallCaps,
	capsToSmallCaps,
	petiteCaps,
	allSmallCaps,
	oldstyleFigures,
	liningFigures,
	proportionalFigures,
	tabularFigures,
	fractions,
	ordinals,
	slashedZero,
	superscript,
	subscript,
	scientificInferiors,
	caseSensitiveForms,
	capitalSpacing,
	kerning,
	verticalForms,
	verticalAlternatesRotation,
	verticalKanaAlternates,
	verticalLayoutFeatures,
	ruby,
	halfWidthForms,
	fullWidthForms,
	proportionalWidthForms,
	quarterWidthForms,
	thirdWidthForms,
	jis78Forms,
	jis83Forms,
	jis90Forms,
	jis2004Forms,
	simplifiedForms,
	traditionalForms,
	feature,
	features,
	combineFeatures,
} from "../../src/shaper/features.ts";

describe("stylisticSet", () => {
	test("creates stylistic set feature with default enabled=true", () => {
		const feat = stylisticSet(1);
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("ss01");
	});

	test("creates stylistic set feature with enabled=false", () => {
		const feat = stylisticSet(5, false);
		expect(feat.enabled).toBe(false);
		expect(tagToString(feat.tag)).toBe("ss05");
	});

	test("pads single digit numbers with zero", () => {
		const feat = stylisticSet(3);
		expect(tagToString(feat.tag)).toBe("ss03");
	});

	test("handles double digit numbers", () => {
		const feat = stylisticSet(15);
		expect(tagToString(feat.tag)).toBe("ss15");
	});

	test("handles maximum value 20", () => {
		const feat = stylisticSet(20);
		expect(tagToString(feat.tag)).toBe("ss20");
	});

	test("throws error for number less than 1", () => {
		expect(() => stylisticSet(0)).toThrow(
			"Stylistic set number must be 1-20, got 0",
		);
	});

	test("throws error for number greater than 20", () => {
		expect(() => stylisticSet(21)).toThrow(
			"Stylistic set number must be 1-20, got 21",
		);
	});
});

describe("stylisticSets", () => {
	test("creates multiple stylistic sets with default enabled=true", () => {
		const feats = stylisticSets([1, 5, 10]);
		expect(feats).toHaveLength(3);
		expect(tagToString(feats[0]!.tag)).toBe("ss01");
		expect(tagToString(feats[1]!.tag)).toBe("ss05");
		expect(tagToString(feats[2]!.tag)).toBe("ss10");
		expect(feats[0]!.enabled).toBe(true);
		expect(feats[1]!.enabled).toBe(true);
		expect(feats[2]!.enabled).toBe(true);
	});

	test("creates multiple stylistic sets with enabled=false", () => {
		const feats = stylisticSets([2, 7], false);
		expect(feats).toHaveLength(2);
		expect(tagToString(feats[0]!.tag)).toBe("ss02");
		expect(tagToString(feats[1]!.tag)).toBe("ss07");
		expect(feats[0]!.enabled).toBe(false);
		expect(feats[1]!.enabled).toBe(false);
	});

	test("handles empty array", () => {
		const feats = stylisticSets([]);
		expect(feats).toHaveLength(0);
	});
});

describe("characterVariant", () => {
	test("creates character variant feature with default enabled=true", () => {
		const feat = characterVariant(1);
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("cv01");
	});

	test("creates character variant feature with enabled=false", () => {
		const feat = characterVariant(25, false);
		expect(feat.enabled).toBe(false);
		expect(tagToString(feat.tag)).toBe("cv25");
	});

	test("pads single digit numbers with zero", () => {
		const feat = characterVariant(7);
		expect(tagToString(feat.tag)).toBe("cv07");
	});

	test("handles double digit numbers", () => {
		const feat = characterVariant(42);
		expect(tagToString(feat.tag)).toBe("cv42");
	});

	test("handles maximum value 99", () => {
		const feat = characterVariant(99);
		expect(tagToString(feat.tag)).toBe("cv99");
	});

	test("throws error for number less than 1", () => {
		expect(() => characterVariant(0)).toThrow(
			"Character variant number must be 1-99, got 0",
		);
	});

	test("throws error for number greater than 99", () => {
		expect(() => characterVariant(100)).toThrow(
			"Character variant number must be 1-99, got 100",
		);
	});
});

describe("characterVariants", () => {
	test("creates multiple character variants with default enabled=true", () => {
		const feats = characterVariants([1, 15, 99]);
		expect(feats).toHaveLength(3);
		expect(tagToString(feats[0]!.tag)).toBe("cv01");
		expect(tagToString(feats[1]!.tag)).toBe("cv15");
		expect(tagToString(feats[2]!.tag)).toBe("cv99");
		expect(feats[0]!.enabled).toBe(true);
		expect(feats[1]!.enabled).toBe(true);
		expect(feats[2]!.enabled).toBe(true);
	});

	test("creates multiple character variants with enabled=false", () => {
		const feats = characterVariants([5, 50], false);
		expect(feats).toHaveLength(2);
		expect(tagToString(feats[0]!.tag)).toBe("cv05");
		expect(tagToString(feats[1]!.tag)).toBe("cv50");
		expect(feats[0]!.enabled).toBe(false);
		expect(feats[1]!.enabled).toBe(false);
	});

	test("handles empty array", () => {
		const feats = characterVariants([]);
		expect(feats).toHaveLength(0);
	});
});

describe("ligature features", () => {
	test("standardLigatures with default enabled=true", () => {
		const feat = standardLigatures();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("liga");
	});

	test("standardLigatures with enabled=false", () => {
		const feat = standardLigatures(false);
		expect(feat.enabled).toBe(false);
		expect(tagToString(feat.tag)).toBe("liga");
	});

	test("discretionaryLigatures with default enabled=true", () => {
		const feat = discretionaryLigatures();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("dlig");
	});

	test("discretionaryLigatures with enabled=false", () => {
		const feat = discretionaryLigatures(false);
		expect(feat.enabled).toBe(false);
	});

	test("historicalLigatures with default enabled=true", () => {
		const feat = historicalLigatures();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("hlig");
	});

	test("historicalLigatures with enabled=false", () => {
		const feat = historicalLigatures(false);
		expect(feat.enabled).toBe(false);
	});
});

describe("alternate features", () => {
	test("contextualAlternates with default enabled=true", () => {
		const feat = contextualAlternates();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("calt");
	});

	test("contextualAlternates with enabled=false", () => {
		const feat = contextualAlternates(false);
		expect(feat.enabled).toBe(false);
	});

	test("stylisticAlternates with default enabled=true", () => {
		const feat = stylisticAlternates();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("salt");
	});

	test("stylisticAlternates with enabled=false", () => {
		const feat = stylisticAlternates(false);
		expect(feat.enabled).toBe(false);
	});

	test("swash with default enabled=true", () => {
		const feat = swash();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("swsh");
	});

	test("swash with enabled=false", () => {
		const feat = swash(false);
		expect(feat.enabled).toBe(false);
	});
});

describe("capitals features", () => {
	test("smallCaps with default enabled=true", () => {
		const feat = smallCaps();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("smcp");
	});

	test("smallCaps with enabled=false", () => {
		const feat = smallCaps(false);
		expect(feat.enabled).toBe(false);
	});

	test("capsToSmallCaps with default enabled=true", () => {
		const feat = capsToSmallCaps();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("c2sc");
	});

	test("capsToSmallCaps with enabled=false", () => {
		const feat = capsToSmallCaps(false);
		expect(feat.enabled).toBe(false);
	});

	test("petiteCaps with default enabled=true", () => {
		const feat = petiteCaps();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("pcap");
	});

	test("petiteCaps with enabled=false", () => {
		const feat = petiteCaps(false);
		expect(feat.enabled).toBe(false);
	});

	test("allSmallCaps with default enabled=true returns array", () => {
		const feats = allSmallCaps();
		expect(feats).toHaveLength(2);
		expect(tagToString(feats[0]!.tag)).toBe("smcp");
		expect(tagToString(feats[1]!.tag)).toBe("c2sc");
		expect(feats[0]!.enabled).toBe(true);
		expect(feats[1]!.enabled).toBe(true);
	});

	test("allSmallCaps with enabled=false returns array", () => {
		const feats = allSmallCaps(false);
		expect(feats).toHaveLength(2);
		expect(feats[0]!.enabled).toBe(false);
		expect(feats[1]!.enabled).toBe(false);
	});
});

describe("figures features", () => {
	test("oldstyleFigures with default enabled=true", () => {
		const feat = oldstyleFigures();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("onum");
	});

	test("oldstyleFigures with enabled=false", () => {
		const feat = oldstyleFigures(false);
		expect(feat.enabled).toBe(false);
	});

	test("liningFigures with default enabled=true", () => {
		const feat = liningFigures();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("lnum");
	});

	test("liningFigures with enabled=false", () => {
		const feat = liningFigures(false);
		expect(feat.enabled).toBe(false);
	});

	test("proportionalFigures with default enabled=true", () => {
		const feat = proportionalFigures();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("pnum");
	});

	test("proportionalFigures with enabled=false", () => {
		const feat = proportionalFigures(false);
		expect(feat.enabled).toBe(false);
	});

	test("tabularFigures with default enabled=true", () => {
		const feat = tabularFigures();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("tnum");
	});

	test("tabularFigures with enabled=false", () => {
		const feat = tabularFigures(false);
		expect(feat.enabled).toBe(false);
	});
});

describe("numeric features", () => {
	test("fractions with default enabled=true", () => {
		const feat = fractions();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("frac");
	});

	test("fractions with enabled=false", () => {
		const feat = fractions(false);
		expect(feat.enabled).toBe(false);
	});

	test("ordinals with default enabled=true", () => {
		const feat = ordinals();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("ordn");
	});

	test("ordinals with enabled=false", () => {
		const feat = ordinals(false);
		expect(feat.enabled).toBe(false);
	});

	test("slashedZero with default enabled=true", () => {
		const feat = slashedZero();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("zero");
	});

	test("slashedZero with enabled=false", () => {
		const feat = slashedZero(false);
		expect(feat.enabled).toBe(false);
	});

	test("superscript with default enabled=true", () => {
		const feat = superscript();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("sups");
	});

	test("superscript with enabled=false", () => {
		const feat = superscript(false);
		expect(feat.enabled).toBe(false);
	});

	test("subscript with default enabled=true", () => {
		const feat = subscript();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("subs");
	});

	test("subscript with enabled=false", () => {
		const feat = subscript(false);
		expect(feat.enabled).toBe(false);
	});

	test("scientificInferiors with default enabled=true", () => {
		const feat = scientificInferiors();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("sinf");
	});

	test("scientificInferiors with enabled=false", () => {
		const feat = scientificInferiors(false);
		expect(feat.enabled).toBe(false);
	});
});

describe("spacing and kerning features", () => {
	test("caseSensitiveForms with default enabled=true", () => {
		const feat = caseSensitiveForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("case");
	});

	test("caseSensitiveForms with enabled=false", () => {
		const feat = caseSensitiveForms(false);
		expect(feat.enabled).toBe(false);
	});

	test("capitalSpacing with default enabled=true", () => {
		const feat = capitalSpacing();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("cpsp");
	});

	test("capitalSpacing with enabled=false", () => {
		const feat = capitalSpacing(false);
		expect(feat.enabled).toBe(false);
	});

	test("kerning with default enabled=true", () => {
		const feat = kerning();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("kern");
	});

	test("kerning with enabled=false", () => {
		const feat = kerning(false);
		expect(feat.enabled).toBe(false);
	});
});

describe("vertical layout features", () => {
	test("verticalForms with default enabled=true", () => {
		const feat = verticalForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("vert");
	});

	test("verticalForms with enabled=false", () => {
		const feat = verticalForms(false);
		expect(feat.enabled).toBe(false);
	});

	test("verticalAlternatesRotation with default enabled=true", () => {
		const feat = verticalAlternatesRotation();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("vrt2");
	});

	test("verticalAlternatesRotation with enabled=false", () => {
		const feat = verticalAlternatesRotation(false);
		expect(feat.enabled).toBe(false);
	});

	test("verticalKanaAlternates with default enabled=true", () => {
		const feat = verticalKanaAlternates();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("vkna");
	});

	test("verticalKanaAlternates with enabled=false", () => {
		const feat = verticalKanaAlternates(false);
		expect(feat.enabled).toBe(false);
	});

	test("verticalLayoutFeatures with default enabled=true returns array", () => {
		const feats = verticalLayoutFeatures();
		expect(feats).toHaveLength(3);
		expect(tagToString(feats[0]!.tag)).toBe("vert");
		expect(tagToString(feats[1]!.tag)).toBe("vrt2");
		expect(tagToString(feats[2]!.tag)).toBe("vkna");
		expect(feats[0]!.enabled).toBe(true);
		expect(feats[1]!.enabled).toBe(true);
		expect(feats[2]!.enabled).toBe(true);
	});

	test("verticalLayoutFeatures with enabled=false returns array", () => {
		const feats = verticalLayoutFeatures(false);
		expect(feats).toHaveLength(3);
		expect(feats[0]!.enabled).toBe(false);
		expect(feats[1]!.enabled).toBe(false);
		expect(feats[2]!.enabled).toBe(false);
	});
});

describe("CJK features", () => {
	test("ruby with default enabled=true", () => {
		const feat = ruby();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("ruby");
	});

	test("ruby with enabled=false", () => {
		const feat = ruby(false);
		expect(feat.enabled).toBe(false);
	});

	test("halfWidthForms with default enabled=true", () => {
		const feat = halfWidthForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("hwid");
	});

	test("halfWidthForms with enabled=false", () => {
		const feat = halfWidthForms(false);
		expect(feat.enabled).toBe(false);
	});

	test("fullWidthForms with default enabled=true", () => {
		const feat = fullWidthForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("fwid");
	});

	test("fullWidthForms with enabled=false", () => {
		const feat = fullWidthForms(false);
		expect(feat.enabled).toBe(false);
	});

	test("proportionalWidthForms with default enabled=true", () => {
		const feat = proportionalWidthForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("pwid");
	});

	test("proportionalWidthForms with enabled=false", () => {
		const feat = proportionalWidthForms(false);
		expect(feat.enabled).toBe(false);
	});

	test("quarterWidthForms with default enabled=true", () => {
		const feat = quarterWidthForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("qwid");
	});

	test("quarterWidthForms with enabled=false", () => {
		const feat = quarterWidthForms(false);
		expect(feat.enabled).toBe(false);
	});

	test("thirdWidthForms with default enabled=true", () => {
		const feat = thirdWidthForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("twid");
	});

	test("thirdWidthForms with enabled=false", () => {
		const feat = thirdWidthForms(false);
		expect(feat.enabled).toBe(false);
	});
});

describe("Japanese JIS features", () => {
	test("jis78Forms with default enabled=true", () => {
		const feat = jis78Forms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("jp78");
	});

	test("jis78Forms with enabled=false", () => {
		const feat = jis78Forms(false);
		expect(feat.enabled).toBe(false);
	});

	test("jis83Forms with default enabled=true", () => {
		const feat = jis83Forms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("jp83");
	});

	test("jis83Forms with enabled=false", () => {
		const feat = jis83Forms(false);
		expect(feat.enabled).toBe(false);
	});

	test("jis90Forms with default enabled=true", () => {
		const feat = jis90Forms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("jp90");
	});

	test("jis90Forms with enabled=false", () => {
		const feat = jis90Forms(false);
		expect(feat.enabled).toBe(false);
	});

	test("jis2004Forms with default enabled=true", () => {
		const feat = jis2004Forms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("jp04");
	});

	test("jis2004Forms with enabled=false", () => {
		const feat = jis2004Forms(false);
		expect(feat.enabled).toBe(false);
	});
});

describe("Chinese features", () => {
	test("simplifiedForms with default enabled=true", () => {
		const feat = simplifiedForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("smpl");
	});

	test("simplifiedForms with enabled=false", () => {
		const feat = simplifiedForms(false);
		expect(feat.enabled).toBe(false);
	});

	test("traditionalForms with default enabled=true", () => {
		const feat = traditionalForms();
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("trad");
	});

	test("traditionalForms with enabled=false", () => {
		const feat = traditionalForms(false);
		expect(feat.enabled).toBe(false);
	});
});

describe("generic feature helpers", () => {
	test("feature creates feature from tag string with default enabled=true", () => {
		const feat = feature("test");
		expect(feat.enabled).toBe(true);
		expect(tagToString(feat.tag)).toBe("test");
	});

	test("feature creates feature from tag string with enabled=false", () => {
		const feat = feature("test", false);
		expect(feat.enabled).toBe(false);
		expect(tagToString(feat.tag)).toBe("test");
	});

	test("features creates multiple features with default enabled=true", () => {
		const feats = features(["aaa1", "bbb2", "ccc3"]);
		expect(feats).toHaveLength(3);
		expect(tagToString(feats[0]!.tag)).toBe("aaa1");
		expect(tagToString(feats[1]!.tag)).toBe("bbb2");
		expect(tagToString(feats[2]!.tag)).toBe("ccc3");
		expect(feats[0]!.enabled).toBe(true);
		expect(feats[1]!.enabled).toBe(true);
		expect(feats[2]!.enabled).toBe(true);
	});

	test("features creates multiple features with enabled=false", () => {
		const feats = features(["xxx1", "yyy2"], false);
		expect(feats).toHaveLength(2);
		expect(feats[0]!.enabled).toBe(false);
		expect(feats[1]!.enabled).toBe(false);
	});

	test("features handles empty array", () => {
		const feats = features([]);
		expect(feats).toHaveLength(0);
	});
});

describe("combineFeatures", () => {
	test("combines single features", () => {
		const combined = combineFeatures(
			standardLigatures(),
			kerning(),
			smallCaps(),
		);
		expect(combined).toHaveLength(3);
		expect(tagToString(combined[0]!.tag)).toBe("liga");
		expect(tagToString(combined[1]!.tag)).toBe("kern");
		expect(tagToString(combined[2]!.tag)).toBe("smcp");
	});

	test("combines arrays of features", () => {
		const combined = combineFeatures(allSmallCaps(), verticalLayoutFeatures());
		expect(combined).toHaveLength(5);
		expect(tagToString(combined[0]!.tag)).toBe("smcp");
		expect(tagToString(combined[1]!.tag)).toBe("c2sc");
		expect(tagToString(combined[2]!.tag)).toBe("vert");
		expect(tagToString(combined[3]!.tag)).toBe("vrt2");
		expect(tagToString(combined[4]!.tag)).toBe("vkna");
	});

	test("combines mix of single features and arrays", () => {
		const combined = combineFeatures(
			kerning(),
			allSmallCaps(),
			standardLigatures(),
			verticalLayoutFeatures(),
		);
		expect(combined).toHaveLength(7);
		expect(tagToString(combined[0]!.tag)).toBe("kern");
		expect(tagToString(combined[1]!.tag)).toBe("smcp");
		expect(tagToString(combined[2]!.tag)).toBe("c2sc");
		expect(tagToString(combined[3]!.tag)).toBe("liga");
		expect(tagToString(combined[4]!.tag)).toBe("vert");
		expect(tagToString(combined[5]!.tag)).toBe("vrt2");
		expect(tagToString(combined[6]!.tag)).toBe("vkna");
	});

	test("handles empty input", () => {
		const combined = combineFeatures();
		expect(combined).toHaveLength(0);
	});

	test("preserves enabled state", () => {
		const combined = combineFeatures(
			kerning(false),
			standardLigatures(true),
		);
		expect(combined).toHaveLength(2);
		expect(combined[0]!.enabled).toBe(false);
		expect(combined[1]!.enabled).toBe(true);
	});
});
