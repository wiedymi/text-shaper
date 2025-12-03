import { describe, expect, test } from "bun:test";
import {
	IndicCategory,
	IndicPosition,
	IndicFeatureMask,
	MatraPosition,
	isIndic,
	getIndicCategory,
	findSyllables,
	setupIndicMasks,
	reorderIndic,
} from "../../../src/shaper/complex/indic.ts";
import type { GlyphInfo } from "../../../src/types.ts";

function makeInfo(codepoint: number, cluster = 0): GlyphInfo {
	return { glyphId: 0, cluster, mask: 0, codepoint };
}

describe("indic shaper", () => {
	describe("isIndic", () => {
		describe("Devanagari (0900-097F)", () => {
			test("detects Devanagari consonants", () => {
				expect(isIndic(0x0915)).toBe(true); // क (KA)
				expect(isIndic(0x0916)).toBe(true); // ख (KHA)
				expect(isIndic(0x0930)).toBe(true); // र (RA)
				expect(isIndic(0x0939)).toBe(true); // ह (HA)
			});

			test("detects Devanagari vowels", () => {
				expect(isIndic(0x0905)).toBe(true); // अ (A)
				expect(isIndic(0x0906)).toBe(true); // आ (AA)
				expect(isIndic(0x0914)).toBe(true); // औ (AU)
			});

			test("detects Devanagari signs", () => {
				expect(isIndic(0x0901)).toBe(true); // Chandrabindu
				expect(isIndic(0x0902)).toBe(true); // Anusvara
				expect(isIndic(0x0903)).toBe(true); // Visarga
				expect(isIndic(0x093c)).toBe(true); // Nukta
				expect(isIndic(0x094d)).toBe(true); // Virama
			});

			test("detects Devanagari matras", () => {
				expect(isIndic(0x093e)).toBe(true); // AA matra
				expect(isIndic(0x093f)).toBe(true); // I matra
				expect(isIndic(0x0940)).toBe(true); // II matra
			});
		});

		describe("Bengali (0980-09FF)", () => {
			test("detects Bengali range", () => {
				expect(isIndic(0x0995)).toBe(true); // ক (KA)
				expect(isIndic(0x09b0)).toBe(true); // র (RA)
				expect(isIndic(0x09cd)).toBe(true); // Virama
			});
		});

		describe("Gurmukhi (0A00-0A7F)", () => {
			test("detects Gurmukhi range", () => {
				expect(isIndic(0x0a15)).toBe(true); // ਕ (KA)
				expect(isIndic(0x0a30)).toBe(true); // ਰ (RA)
			});
		});

		describe("Gujarati (0A80-0AFF)", () => {
			test("detects Gujarati range", () => {
				expect(isIndic(0x0a95)).toBe(true); // ક (KA)
				expect(isIndic(0x0ab0)).toBe(true); // ર (RA)
			});
		});

		describe("Oriya (0B00-0B7F)", () => {
			test("detects Oriya range", () => {
				expect(isIndic(0x0b15)).toBe(true); // କ (KA)
				expect(isIndic(0x0b30)).toBe(true); // ର (RA)
			});
		});

		describe("Tamil (0B80-0BFF)", () => {
			test("detects Tamil range", () => {
				expect(isIndic(0x0b95)).toBe(true); // க (KA)
				expect(isIndic(0x0bb0)).toBe(true); // ர (RA)
			});
		});

		describe("Telugu (0C00-0C7F)", () => {
			test("detects Telugu range", () => {
				expect(isIndic(0x0c15)).toBe(true); // క (KA)
				expect(isIndic(0x0c30)).toBe(true); // ర (RA)
			});
		});

		describe("Kannada (0C80-0CFF)", () => {
			test("detects Kannada range", () => {
				expect(isIndic(0x0c95)).toBe(true); // ಕ (KA)
				expect(isIndic(0x0cb0)).toBe(true); // ರ (RA)
			});
		});

		describe("Malayalam (0D00-0D7F)", () => {
			test("detects Malayalam range", () => {
				expect(isIndic(0x0d15)).toBe(true); // ക (KA)
				expect(isIndic(0x0d30)).toBe(true); // ര (RA)
			});
		});

		test("rejects non-Indic", () => {
			expect(isIndic(0x0041)).toBe(false); // 'A'
			expect(isIndic(0x0628)).toBe(false); // Arabic BEH
			expect(isIndic(0xac00)).toBe(false); // Hangul
			expect(isIndic(0x08ff)).toBe(false); // Before Devanagari
			expect(isIndic(0x0d80)).toBe(false); // After Malayalam
		});
	});

	describe("getIndicCategory", () => {
		describe("special characters", () => {
			test("ZWNJ", () => {
				expect(getIndicCategory(0x200c)).toBe(IndicCategory.ZWNJ);
			});

			test("ZWJ", () => {
				expect(getIndicCategory(0x200d)).toBe(IndicCategory.ZWJ);
			});

			test("Dotted Circle", () => {
				expect(getIndicCategory(0x25cc)).toBe(IndicCategory.Dotted_Circle);
			});
		});

		describe("Devanagari categories", () => {
			test("consonants are C", () => {
				expect(getIndicCategory(0x0915)).toBe(IndicCategory.C); // क (KA)
				expect(getIndicCategory(0x0916)).toBe(IndicCategory.C); // ख (KHA)
				expect(getIndicCategory(0x0917)).toBe(IndicCategory.C); // ग (GA)
				expect(getIndicCategory(0x0939)).toBe(IndicCategory.C); // ह (HA)
			});

			test("Ra is special", () => {
				expect(getIndicCategory(0x0930)).toBe(IndicCategory.Ra); // र (RA)
			});

			test("vowels are V", () => {
				expect(getIndicCategory(0x0905)).toBe(IndicCategory.V); // अ (A)
				expect(getIndicCategory(0x0906)).toBe(IndicCategory.V); // आ (AA)
				expect(getIndicCategory(0x0914)).toBe(IndicCategory.V); // औ (AU)
			});

			test("matras are M", () => {
				expect(getIndicCategory(0x093e)).toBe(IndicCategory.M); // AA matra
				expect(getIndicCategory(0x093f)).toBe(IndicCategory.M); // I matra
				expect(getIndicCategory(0x0940)).toBe(IndicCategory.M); // II matra
				expect(getIndicCategory(0x0941)).toBe(IndicCategory.M); // U matra
				expect(getIndicCategory(0x094c)).toBe(IndicCategory.M); // AU matra
			});

			test("virama is H", () => {
				expect(getIndicCategory(0x094d)).toBe(IndicCategory.H);
			});

			test("nukta is N", () => {
				expect(getIndicCategory(0x093c)).toBe(IndicCategory.N);
			});

			test("syllable modifiers are SM", () => {
				expect(getIndicCategory(0x0901)).toBe(IndicCategory.SM); // Chandrabindu
				expect(getIndicCategory(0x0902)).toBe(IndicCategory.SM); // Anusvara
				expect(getIndicCategory(0x0903)).toBe(IndicCategory.SM); // Visarga
			});

			test("accent marks are A", () => {
				expect(getIndicCategory(0x0951)).toBe(IndicCategory.A); // Udatta
				expect(getIndicCategory(0x0952)).toBe(IndicCategory.A); // Anudatta
			});

			test("digits are Symbol", () => {
				expect(getIndicCategory(0x0966)).toBe(IndicCategory.Symbol); // 0
				expect(getIndicCategory(0x096f)).toBe(IndicCategory.Symbol); // 9
			});
		});

		describe("Bengali categories", () => {
			test("consonants", () => {
				expect(getIndicCategory(0x0995)).toBe(IndicCategory.C); // ক (KA)
				expect(getIndicCategory(0x09a8)).toBe(IndicCategory.C); // ন (NA)
			});

			test("Ra is special", () => {
				expect(getIndicCategory(0x09b0)).toBe(IndicCategory.Ra); // র (RA)
			});

			test("matras", () => {
				expect(getIndicCategory(0x09be)).toBe(IndicCategory.M); // AA matra
				expect(getIndicCategory(0x09bf)).toBe(IndicCategory.M); // I matra
			});

			test("virama", () => {
				expect(getIndicCategory(0x09cd)).toBe(IndicCategory.H);
			});

			test("nukta", () => {
				expect(getIndicCategory(0x09bc)).toBe(IndicCategory.N);
			});

			test("syllable modifiers", () => {
				expect(getIndicCategory(0x0981)).toBe(IndicCategory.SM); // Chandrabindu
				expect(getIndicCategory(0x0982)).toBe(IndicCategory.SM); // Anusvara
				expect(getIndicCategory(0x0983)).toBe(IndicCategory.SM); // Visarga
			});

			test("vowels", () => {
				expect(getIndicCategory(0x0985)).toBe(IndicCategory.V); // অ (A)
				expect(getIndicCategory(0x0986)).toBe(IndicCategory.V); // আ (AA)
			});
		});

		test("non-Indic returns X", () => {
			expect(getIndicCategory(0x0041)).toBe(IndicCategory.X); // 'A'
			expect(getIndicCategory(0x0628)).toBe(IndicCategory.X); // Arabic BEH
		});
	});

	describe("IndicCategory enum", () => {
		test("has expected values", () => {
			expect(IndicCategory.X).toBe(0);
			expect(IndicCategory.C).toBe(1);
			expect(IndicCategory.V).toBe(2);
			expect(IndicCategory.N).toBe(3);
			expect(IndicCategory.H).toBe(4);
			expect(IndicCategory.ZWNJ).toBe(5);
			expect(IndicCategory.ZWJ).toBe(6);
			expect(IndicCategory.M).toBe(7);
			expect(IndicCategory.SM).toBe(8);
			expect(IndicCategory.Ra).toBe(15);
		});
	});

	describe("IndicPosition enum", () => {
		test("has expected values", () => {
			expect(IndicPosition.Start).toBe(0);
			expect(IndicPosition.RaToBecomeReph).toBe(1);
			expect(IndicPosition.BaseC).toBe(4);
			expect(IndicPosition.End).toBe(15);
		});
	});

	describe("IndicFeatureMask", () => {
		test("has expected feature flags", () => {
			expect(IndicFeatureMask.nukt).toBe(0x0001);
			expect(IndicFeatureMask.akhn).toBe(0x0002);
			expect(IndicFeatureMask.rphf).toBe(0x0004);
			expect(IndicFeatureMask.half).toBe(0x0080);
			expect(IndicFeatureMask.pstf).toBe(0x0100);
			expect(IndicFeatureMask.cjct).toBe(0x0400);
		});
	});

	describe("findSyllables", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(0);
		});

		test("finds single consonant syllable", () => {
			const infos = [makeInfo(0x0915)]; // क (KA)
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(1);
			expect(syllables[0].start).toBe(0);
			expect(syllables[0].end).toBe(1);
		});

		test("finds consonant + matra syllable", () => {
			// का (KA + AA matra)
			const infos = [makeInfo(0x0915), makeInfo(0x093e)];
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(1);
			expect(syllables[0].start).toBe(0);
			expect(syllables[0].end).toBe(2);
		});

		test("finds consonant cluster with halant", () => {
			// क्ष (KA + virama + SSA)
			const infos = [
				makeInfo(0x0915), // KA
				makeInfo(0x094d), // Virama
				makeInfo(0x0937), // SSA
			];
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(1);
			expect(syllables[0].end).toBe(3);
		});

		test("finds syllable with anusvara", () => {
			// कं (KA + Anusvara)
			const infos = [makeInfo(0x0915), makeInfo(0x0902)];
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(1);
			expect(syllables[0].end).toBe(2);
		});

		test("detects reph (Ra + Halant at start)", () => {
			// र्क (RA + virama + KA) - reph
			const infos = [
				makeInfo(0x0930), // RA
				makeInfo(0x094d), // Virama
				makeInfo(0x0915), // KA
			];
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(1);
			expect(syllables[0].hasReph).toBe(true);
		});

		test("finds multiple syllables", () => {
			// कर (KA + RA)
			const infos = [
				makeInfo(0x0915), // KA (syllable 1)
				makeInfo(0x0930), // RA (syllable 2)
			];
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(2);
		});

		test("finds independent vowel as syllable", () => {
			const infos = [makeInfo(0x0905)]; // अ (A)
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(1);
		});

		test("handles consonant + nukta", () => {
			// क़ (KA + nukta)
			const infos = [makeInfo(0x0915), makeInfo(0x093c)];
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(1);
			expect(syllables[0].end).toBe(2);
		});

		test("handles complex syllable", () => {
			// स्त्री (SA + virama + TA + virama + RA + II matra)
			const infos = [
				makeInfo(0x0938), // SA
				makeInfo(0x094d), // Virama
				makeInfo(0x0924), // TA
				makeInfo(0x094d), // Virama
				makeInfo(0x0930), // RA
				makeInfo(0x0940), // II matra
			];
			const syllables = findSyllables(infos);
			expect(syllables.length).toBe(1);
		});
	});

	describe("setupIndicMasks", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			setupIndicMasks(infos);
			expect(infos.length).toBe(0);
		});

		test("sets nukta feature mask", () => {
			const infos = [
				makeInfo(0x0915), // KA
				makeInfo(0x093c), // Nukta
			];
			setupIndicMasks(infos);
			expect(infos[1].mask & IndicFeatureMask.nukt).toBe(IndicFeatureMask.nukt);
		});

		test("sets reph feature mask", () => {
			const infos = [
				makeInfo(0x0930), // RA
				makeInfo(0x094d), // Virama
				makeInfo(0x0915), // KA
			];
			setupIndicMasks(infos);
			expect(infos[0].mask & IndicFeatureMask.rphf).toBe(IndicFeatureMask.rphf);
			expect(infos[1].mask & IndicFeatureMask.rphf).toBe(IndicFeatureMask.rphf);
		});

		test("sets syllable index in upper bits", () => {
			const infos = [
				makeInfo(0x0915), // KA (syllable 0)
				makeInfo(0x0930), // RA (syllable 1)
			];
			setupIndicMasks(infos);

			const syllableIndex0 = (infos[0].mask >> 16) & 0xffff;
			const syllableIndex1 = (infos[1].mask >> 16) & 0xffff;
			expect(syllableIndex0).toBe(0);
			expect(syllableIndex1).toBe(1);
		});

		test("sets half form mask for pre-base halant", () => {
			const infos = [
				makeInfo(0x0915), // KA
				makeInfo(0x094d), // Virama (pre-base)
				makeInfo(0x0924), // TA (base)
			];
			setupIndicMasks(infos);
			expect(infos[1].mask & IndicFeatureMask.half).toBe(IndicFeatureMask.half);
		});

		test("sets cjct mask for pre-base consonant", () => {
			const infos = [
				makeInfo(0x0915), // KA (pre-base)
				makeInfo(0x094d), // Virama
				makeInfo(0x0924), // TA (base)
			];
			setupIndicMasks(infos);
			expect(infos[0].mask & IndicFeatureMask.cjct).toBe(IndicFeatureMask.cjct);
		});

		test("sets SM features for anusvara", () => {
			const infos = [
				makeInfo(0x0915), // KA
				makeInfo(0x0902), // Anusvara
			];
			setupIndicMasks(infos);
			expect(infos[1].mask & IndicFeatureMask.abvs).toBe(IndicFeatureMask.abvs);
		});
	});

	describe("reorderIndic", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			reorderIndic(infos);
			expect(infos.length).toBe(0);
		});

		test("handles single consonant", () => {
			const infos = [makeInfo(0x0915)]; // KA
			reorderIndic(infos);
			expect(infos.length).toBe(1);
		});

		test("moves pre-base matra before base", () => {
			// कि should become िक visually (I matra moves before KA)
			const infos = [
				makeInfo(0x0915), // KA (base)
				makeInfo(0x093f), // I matra (pre-base)
			];

			reorderIndic(infos);

			// After reordering, the I matra should be first
			expect(infos[0].codepoint).toBe(0x093f); // I matra
			expect(infos[1].codepoint).toBe(0x0915); // KA
		});

		test("preserves post-base matra position", () => {
			// का (KA + AA matra) - AA is post-base, no reorder
			const infos = [
				makeInfo(0x0915), // KA
				makeInfo(0x093e), // AA matra (post-base)
			];

			reorderIndic(infos);

			expect(infos[0].codepoint).toBe(0x0915);
			expect(infos[1].codepoint).toBe(0x093e);
		});
	});
});
