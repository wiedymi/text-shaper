import { describe, expect, test } from "bun:test";
import {
	UseCategory,
	UseFeatureMask,
	usesUSE,
	getUseCategory,
	setupUseMasks,
	reorderUSE,
} from "../../../src/shaper/complex/use.ts";
import type { GlyphInfo } from "../../../src/types.ts";

function makeInfo(codepoint: number, cluster = 0): GlyphInfo {
	return { glyphId: 0, cluster, mask: 0, codepoint };
}

describe("USE shaper", () => {
	describe("usesUSE", () => {
		test("returns true for USE scripts", () => {
			expect(usesUSE("mymr")).toBe(true); // Myanmar
			expect(usesUSE("khmr")).toBe(true); // Khmer
			expect(usesUSE("tibt")).toBe(true); // Tibetan
			expect(usesUSE("java")).toBe(true); // Javanese
			expect(usesUSE("bali")).toBe(true); // Balinese
			expect(usesUSE("sinh")).toBe(true); // Sinhala
			expect(usesUSE("cham")).toBe(true); // Cham
			expect(usesUSE("tale")).toBe(true); // Tai Le
			expect(usesUSE("talu")).toBe(true); // New Tai Lue
			expect(usesUSE("lana")).toBe(true); // Tai Tham
		});

		test("returns false for non-USE scripts", () => {
			expect(usesUSE("latn")).toBe(false); // Latin
			expect(usesUSE("arab")).toBe(false); // Arabic
			expect(usesUSE("deva")).toBe(false); // Devanagari (uses Indic shaper)
			expect(usesUSE("beng")).toBe(false); // Bengali
			expect(usesUSE("hang")).toBe(false); // Hangul
		});
	});

	describe("UseCategory enum", () => {
		test("has expected values", () => {
			expect(UseCategory.O).toBe(0);
			expect(UseCategory.B).toBe(1);
			expect(UseCategory.H).toBe(8);
			expect(UseCategory.ZWJ).toBe(20);
			expect(UseCategory.ZWNJ).toBe(21);
			expect(UseCategory.VPst).toBe(31);
			expect(UseCategory.SMAbv).toBe(32);
		});
	});

	describe("UseFeatureMask", () => {
		test("has expected feature flags", () => {
			expect(UseFeatureMask.rphf).toBe(0x0001);
			expect(UseFeatureMask.pref).toBe(0x0002);
			expect(UseFeatureMask.blwf).toBe(0x0004);
			expect(UseFeatureMask.abvf).toBe(0x0008);
			expect(UseFeatureMask.pstf).toBe(0x0010);
			expect(UseFeatureMask.half).toBe(0x0020);
			expect(UseFeatureMask.haln).toBe(0x1000);
		});
	});

	describe("getUseCategory", () => {
		describe("special characters", () => {
			test("ZWNJ", () => {
				expect(getUseCategory(0x200c)).toBe(UseCategory.ZWNJ);
			});

			test("ZWJ", () => {
				expect(getUseCategory(0x200d)).toBe(UseCategory.ZWJ);
			});

			test("CGJ (Combining Grapheme Joiner)", () => {
				expect(getUseCategory(0x034f)).toBe(UseCategory.CGJ);
			});

			test("WJ (Word Joiner)", () => {
				expect(getUseCategory(0x2060)).toBe(UseCategory.WJ);
			});

			test("Variation Selectors", () => {
				expect(getUseCategory(0xfe00)).toBe(UseCategory.VS);
				expect(getUseCategory(0xfe0f)).toBe(UseCategory.VS);
				expect(getUseCategory(0xe0100)).toBe(UseCategory.VS);
				expect(getUseCategory(0xe01ef)).toBe(UseCategory.VS);
			});
		});

		describe("Myanmar (1000-109F)", () => {
			test("consonants are B (Base)", () => {
				expect(getUseCategory(0x1000)).toBe(UseCategory.B); // KA
				expect(getUseCategory(0x1001)).toBe(UseCategory.B); // KHA
				expect(getUseCategory(0x1020)).toBe(UseCategory.B); // NNA
			});

			test("independent vowels are IND", () => {
				expect(getUseCategory(0x1021)).toBe(UseCategory.IND); // A
				expect(getUseCategory(0x102a)).toBe(UseCategory.IND); // AU
			});

			test("dependent vowels are VPst", () => {
				expect(getUseCategory(0x102b)).toBe(UseCategory.VPst);
				expect(getUseCategory(0x1032)).toBe(UseCategory.VPst);
			});

			test("anusvara and visarga are SMAbv", () => {
				expect(getUseCategory(0x1036)).toBe(UseCategory.SMAbv);
				expect(getUseCategory(0x1037)).toBe(UseCategory.SMAbv);
			});

			test("virama is H (Halant)", () => {
				expect(getUseCategory(0x1039)).toBe(UseCategory.H);
				expect(getUseCategory(0x103a)).toBe(UseCategory.H);
			});

			test("medial consonants are MBlw", () => {
				expect(getUseCategory(0x103b)).toBe(UseCategory.MBlw);
				expect(getUseCategory(0x103e)).toBe(UseCategory.MBlw);
			});

			test("digits are GB (Generic Base)", () => {
				expect(getUseCategory(0x1040)).toBe(UseCategory.GB);
				expect(getUseCategory(0x1049)).toBe(UseCategory.GB);
			});

			test("dependent vowels are VPst", () => {
				expect(getUseCategory(0x102b)).toBe(UseCategory.VPst); // AA
				expect(getUseCategory(0x102c)).toBe(UseCategory.VPst); // AA
				expect(getUseCategory(0x1032)).toBe(UseCategory.VPst); // AI
			});

			test("anusvara and dot below are SMAbv", () => {
				expect(getUseCategory(0x1036)).toBe(UseCategory.SMAbv); // Anusvara
				expect(getUseCategory(0x1037)).toBe(UseCategory.SMAbv); // Dot below
			});

			test("virama is H", () => {
				expect(getUseCategory(0x1039)).toBe(UseCategory.H); // Virama
				expect(getUseCategory(0x103a)).toBe(UseCategory.H); // Asat
			});

			test("medial consonants are MBlw", () => {
				expect(getUseCategory(0x103b)).toBe(UseCategory.MBlw); // YA
				expect(getUseCategory(0x103c)).toBe(UseCategory.MBlw); // RA
				expect(getUseCategory(0x103d)).toBe(UseCategory.MBlw); // WA
				expect(getUseCategory(0x103e)).toBe(UseCategory.MBlw); // HA
			});

			test("digits are GB", () => {
				expect(getUseCategory(0x1040)).toBe(UseCategory.GB); // 0
				expect(getUseCategory(0x1049)).toBe(UseCategory.GB); // 9
			});
		});

		describe("Khmer (1780-17FF)", () => {
			test("consonants are B", () => {
				expect(getUseCategory(0x1780)).toBe(UseCategory.B); // KA
				expect(getUseCategory(0x1781)).toBe(UseCategory.B); // KHA
				expect(getUseCategory(0x17a2)).toBe(UseCategory.B); // QA
			});

			test("independent vowels are IND", () => {
				expect(getUseCategory(0x17a3)).toBe(UseCategory.IND); // QAQ
				expect(getUseCategory(0x17b3)).toBe(UseCategory.IND); // QAU
			});

			test("dependent vowels are VPst", () => {
				expect(getUseCategory(0x17b6)).toBe(UseCategory.VPst); // AA
				expect(getUseCategory(0x17c5)).toBe(UseCategory.VPst); // AU
			});

			test("coeng (virama) is H", () => {
				expect(getUseCategory(0x17d2)).toBe(UseCategory.H);
			});

			test("anusvara/visarga are SMAbv", () => {
				expect(getUseCategory(0x17c6)).toBe(UseCategory.SMAbv); // Nikahit
				expect(getUseCategory(0x17c7)).toBe(UseCategory.SMAbv); // Reahmuk
				expect(getUseCategory(0x17c8)).toBe(UseCategory.SMAbv); // Yuukaleapintu
			});
		});

		describe("Tibetan (0F00-0FFF)", () => {
			test("syllable markers are S", () => {
				expect(getUseCategory(0x0f00)).toBe(UseCategory.S);
				expect(getUseCategory(0x0f17)).toBe(UseCategory.S);
			});

			test("base consonants are B", () => {
				expect(getUseCategory(0x0f40)).toBe(UseCategory.B); // KA
				expect(getUseCategory(0x0f66)).toBe(UseCategory.B); // SA
			});

			test("vowel signs are VAbv", () => {
				expect(getUseCategory(0x0f71)).toBe(UseCategory.VAbv); // AA
				expect(getUseCategory(0x0f74)).toBe(UseCategory.VAbv); // U
			});

			test("subjoined consonants are SUB", () => {
				expect(getUseCategory(0x0f90)).toBe(UseCategory.SUB); // -KA
				expect(getUseCategory(0x0fbc)).toBe(UseCategory.SUB); // -WA
			});
		});

		describe("Thai (0E00-0E7F)", () => {
			test("consonants are B", () => {
				expect(getUseCategory(0x0e01)).toBe(UseCategory.B); // KO KAI
				expect(getUseCategory(0x0e2e)).toBe(UseCategory.B); // HO NOKHUK
			});

			test("post-base vowels are VPst", () => {
				expect(getUseCategory(0x0e30)).toBe(UseCategory.VPst); // SARA A
				expect(getUseCategory(0x0e32)).toBe(UseCategory.VPst); // SARA AA
			});

			test("pre-base vowels are VPre", () => {
				expect(getUseCategory(0x0e40)).toBe(UseCategory.VPre); // SARA E
				expect(getUseCategory(0x0e44)).toBe(UseCategory.VPre); // SARA AI MAIMALAI
			});

			test("tone marks are SMAbv", () => {
				expect(getUseCategory(0x0e48)).toBe(UseCategory.SMAbv); // MAI EK
				expect(getUseCategory(0x0e4b)).toBe(UseCategory.SMAbv); // MAI CHATTAWA
			});
		});

		describe("Lao (0E80-0EFF)", () => {
			test("consonants are B", () => {
				expect(getUseCategory(0x0e81)).toBe(UseCategory.B); // KO
				expect(getUseCategory(0x0ea3)).toBe(UseCategory.B); // LO LING
			});

			test("post-base vowels are VPst", () => {
				expect(getUseCategory(0x0eb0)).toBe(UseCategory.VPst); // SARA A
				expect(getUseCategory(0x0ebc)).toBe(UseCategory.VPst); // Semivowel
			});

			test("pre-base vowels are VPre", () => {
				expect(getUseCategory(0x0ec0)).toBe(UseCategory.VPre); // SARA E
				expect(getUseCategory(0x0ec4)).toBe(UseCategory.VPre); // SARA AI
			});

			test("tone marks are SMAbv", () => {
				expect(getUseCategory(0x0ec8)).toBe(UseCategory.SMAbv);
				expect(getUseCategory(0x0ecd)).toBe(UseCategory.SMAbv);
			});
		});

		test("non-USE returns O", () => {
			expect(getUseCategory(0x0041)).toBe(UseCategory.O); // 'A'
			expect(getUseCategory(0x0915)).toBe(UseCategory.O); // Devanagari KA
		});
	});

	describe("setupUseMasks", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			setupUseMasks(infos);
			expect(infos.length).toBe(0);
		});

		test("sets syllable index in upper bits", () => {
			const infos = [
				makeInfo(0x1000), // Myanmar KA (syllable 0)
				makeInfo(0x1001), // Myanmar KHA (syllable 1)
			];
			setupUseMasks(infos);

			const syllableIndex0 = (infos[0].mask >> 16) & 0xffff;
			const syllableIndex1 = (infos[1].mask >> 16) & 0xffff;
			expect(syllableIndex0).toBe(0);
			expect(syllableIndex1).toBe(1);
		});

		test("sets haln mask for halant after base in cluster", () => {
			// In USE, KA + Virama + KHA forms a cluster where KA is base
			// The virama (at position 1) comes after the base (position 0)
			const infos = [
				makeInfo(0x1000), // KA (base)
				makeInfo(0x1039), // Virama (post-base halant)
				makeInfo(0x1001), // KHA
			];
			setupUseMasks(infos);
			// After base, halant gets haln mask
			expect(infos[1].mask & UseFeatureMask.haln).toBe(UseFeatureMask.haln);
		});

		test("sets haln mask for post-base halant", () => {
			const infos = [
				makeInfo(0x1000), // KA (base)
				makeInfo(0x1039), // Virama (post-base)
			];
			setupUseMasks(infos);
			expect(infos[1].mask & UseFeatureMask.haln).toBe(UseFeatureMask.haln);
		});

		test("sets VPst feature masks", () => {
			const infos = [
				makeInfo(0x1000), // Myanmar KA
				makeInfo(0x102c), // Dependent vowel AA
			];
			setupUseMasks(infos);
			expect(infos[1].mask & UseFeatureMask.pstf).toBe(UseFeatureMask.pstf);
			expect(infos[1].mask & UseFeatureMask.psts).toBe(UseFeatureMask.psts);
		});

		test("sets SMAbv feature masks", () => {
			const infos = [
				makeInfo(0x1000), // Myanmar KA
				makeInfo(0x1036), // Anusvara
			];
			setupUseMasks(infos);
			expect(infos[1].mask & UseFeatureMask.abvs).toBe(UseFeatureMask.abvs);
		});

		test("sets MBlw feature masks for medials", () => {
			const infos = [
				makeInfo(0x1000), // Myanmar KA
				makeInfo(0x103b), // Medial YA
			];
			setupUseMasks(infos);
			expect(infos[1].mask & UseFeatureMask.blws).toBe(UseFeatureMask.blws);
		});

		test("handles Thai pre-base vowel", () => {
			const infos = [
				makeInfo(0x0e01), // KO KAI
				makeInfo(0x0e40), // SARA E (pre-base)
			];
			setupUseMasks(infos);
			expect(infos[1].mask & UseFeatureMask.pref).toBe(UseFeatureMask.pref);
			expect(infos[1].mask & UseFeatureMask.pres).toBe(UseFeatureMask.pres);
		});
	});

	describe("reorderUSE", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			reorderUSE(infos);
			expect(infos.length).toBe(0);
		});

		test("handles single consonant", () => {
			const infos = [makeInfo(0x1000)]; // Myanmar KA
			reorderUSE(infos);
			expect(infos.length).toBe(1);
		});

		test("moves Thai pre-base vowel before base", () => {
			// Thai: consonant + pre-base vowel should become vowel + consonant
			const infos = [
				makeInfo(0x0e01), // KO KAI (base)
				makeInfo(0x0e40), // SARA E (pre-base vowel)
			];

			reorderUSE(infos);

			expect(infos[0].codepoint).toBe(0x0e40); // SARA E now first
			expect(infos[1].codepoint).toBe(0x0e01); // KO KAI now second
		});

		test("preserves post-base vowel position", () => {
			// Myanmar: consonant + post-base vowel
			const infos = [
				makeInfo(0x1000), // KA
				makeInfo(0x102c), // AA (post-base)
			];

			reorderUSE(infos);

			// Post-base vowels don't move
			expect(infos[0].codepoint).toBe(0x1000);
			expect(infos[1].codepoint).toBe(0x102c);
		});
	});
});
