import { describe, expect, test } from "bun:test";
import {
	getKhmerCategory,
	isKhmer,
	KhmerCategory,
	KhmerFeatureMask,
	setupKhmerMasks,
	reorderKhmer,
} from "../../../src/shaper/complex/khmer.ts";
import type { GlyphInfo } from "../../../src/types.ts";

describe("khmer shaper", () => {
	describe("consonant detection", () => {
		test("detects basic consonants", () => {
			expect(getKhmerCategory(0x1780)).toBe(KhmerCategory.Consonant); // ក
			expect(getKhmerCategory(0x1781)).toBe(KhmerCategory.Consonant); // ខ
			expect(getKhmerCategory(0x17a2)).toBe(KhmerCategory.Consonant); // អ
		});

		test("detects consonant range", () => {
			for (let cp = 0x1780; cp <= 0x17a2; cp++) {
				const cat = getKhmerCategory(cp);
				expect(cat === KhmerCategory.Consonant || cat === KhmerCategory.IndependentVowel).toBe(true);
			}
		});
	});

	describe("coeng detection", () => {
		test("detects coeng (virama)", () => {
			expect(getKhmerCategory(0x17d2)).toBe(KhmerCategory.Coeng); // ្
		});
	});

	describe("dependent vowel detection", () => {
		test("detects dependent vowels", () => {
			expect(getKhmerCategory(0x17b6)).toBe(KhmerCategory.DependentVowel); // ា
			expect(getKhmerCategory(0x17b7)).toBe(KhmerCategory.DependentVowel); // ិ
			expect(getKhmerCategory(0x17c1)).toBe(KhmerCategory.DependentVowel); // េ (pre-base)
			expect(getKhmerCategory(0x17c2)).toBe(KhmerCategory.DependentVowel); // ែ
		});

		test("detects pre-base vowels", () => {
			// These vowels visually appear before the base consonant
			expect(getKhmerCategory(0x17c1)).toBe(KhmerCategory.DependentVowel); // េ
			expect(getKhmerCategory(0x17c2)).toBe(KhmerCategory.DependentVowel); // ែ
			expect(getKhmerCategory(0x17c3)).toBe(KhmerCategory.DependentVowel); // ៃ
		});
	});

	describe("sign detection", () => {
		test("detects anusvara (nikahit)", () => {
			expect(getKhmerCategory(0x17c6)).toBe(KhmerCategory.Anusvara); // ំ (Nikahit)
		});

		test("detects visarga (reahmuk)", () => {
			expect(getKhmerCategory(0x17c7)).toBe(KhmerCategory.Visarga); // ះ (Reahmuk)
		});

		test("detects other signs", () => {
			expect(getKhmerCategory(0x17c8)).toBe(KhmerCategory.Sign); // ៈ (Yuukaleapintu)
		});
	});

	describe("isKhmer", () => {
		test("returns true for Khmer range", () => {
			expect(isKhmer(0x1780)).toBe(true);
			expect(isKhmer(0x17bf)).toBe(true);
			expect(isKhmer(0x17ff)).toBe(true);
		});

		test("returns true for Khmer symbols range", () => {
			expect(isKhmer(0x19e0)).toBe(true);
			expect(isKhmer(0x19f0)).toBe(true);
			expect(isKhmer(0x19ff)).toBe(true);
		});

		test("returns false for non-Khmer", () => {
			expect(isKhmer(0x0041)).toBe(false); // 'A'
			expect(isKhmer(0x177f)).toBe(false);
			expect(isKhmer(0x1800)).toBe(false);
		});
	});

	describe("register shifters", () => {
		test("detects register shifter musĕkâtoăn", () => {
			expect(getKhmerCategory(0x17c9)).toBe(KhmerCategory.Register);
		});

		test("detects register shifter trĕysăp", () => {
			expect(getKhmerCategory(0x17ca)).toBe(KhmerCategory.Register);
		});
	});

	describe("robat detection", () => {
		test("detects robat", () => {
			expect(getKhmerCategory(0x17cc)).toBe(KhmerCategory.Robat);
		});
	});

	describe("independent vowel detection", () => {
		test("detects independent vowels", () => {
			expect(getKhmerCategory(0x17a3)).toBe(KhmerCategory.IndependentVowel);
			expect(getKhmerCategory(0x17a4)).toBe(KhmerCategory.IndependentVowel);
			expect(getKhmerCategory(0x17a5)).toBe(KhmerCategory.IndependentVowel);
			expect(getKhmerCategory(0x17b3)).toBe(KhmerCategory.IndependentVowel);
		});
	});

	describe("other sign detection", () => {
		test("detects bantoc", () => {
			expect(getKhmerCategory(0x17cb)).toBe(KhmerCategory.Sign);
		});

		test("detects toandakhiat", () => {
			expect(getKhmerCategory(0x17cd)).toBe(KhmerCategory.Sign);
		});

		test("detects signs after coeng", () => {
			expect(getKhmerCategory(0x17d3)).toBe(KhmerCategory.Sign);
			expect(getKhmerCategory(0x17dd)).toBe(KhmerCategory.Sign);
		});
	});

	describe("KhmerFeatureMask", () => {
		test("has correct mask values", () => {
			expect(KhmerFeatureMask.pref).toBe(0x0001);
			expect(KhmerFeatureMask.blwf).toBe(0x0002);
			expect(KhmerFeatureMask.abvf).toBe(0x0004);
			expect(KhmerFeatureMask.pstf).toBe(0x0008);
			expect(KhmerFeatureMask.cfar).toBe(0x0010);
			expect(KhmerFeatureMask.pres).toBe(0x0020);
			expect(KhmerFeatureMask.abvs).toBe(0x0040);
			expect(KhmerFeatureMask.blws).toBe(0x0080);
			expect(KhmerFeatureMask.psts).toBe(0x0100);
			expect(KhmerFeatureMask.clig).toBe(0x0200);
		});
	});

	describe("setupKhmerMasks", () => {
		function makeInfo(codepoint: number): GlyphInfo {
			return { glyphId: 0, cluster: 0, mask: 0, codepoint };
		}

		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			expect(() => setupKhmerMasks(infos)).not.toThrow();
		});

		test("handles non-Khmer characters", () => {
			const infos = [makeInfo(0x0041)];
			setupKhmerMasks(infos);
			expect(infos[0]!.mask).toBe(0);
		});

		test("handles null info at start of array", () => {
			const infos: any[] = [
				null,
				makeInfo(0x1780),
				makeInfo(0x17c1),
			];
			expect(() => setupKhmerMasks(infos)).not.toThrow();
			expect(infos[2].mask & KhmerFeatureMask.pref).toBe(KhmerFeatureMask.pref);
		});

		test("handles null info in middle of array", () => {
			const infos: any[] = [
				makeInfo(0x1780),
				null,
				makeInfo(0x17c1),
			];
			expect(() => setupKhmerMasks(infos)).not.toThrow();
			expect(infos[2].mask & KhmerFeatureMask.pref).toBe(KhmerFeatureMask.pref);
		});

		test("handles undefined nextInfo in syllable processing", () => {
			const infos: any[] = [
				makeInfo(0x1780),
				null,
				makeInfo(0x17b6),
			];
			setupKhmerMasks(infos);
			expect(infos[2].mask & KhmerFeatureMask.pstf).toBe(KhmerFeatureMask.pstf);
		});

		test("breaks syllable when consonant not preceded by coeng", () => {
			const infos = [
				makeInfo(0x1780),
				makeInfo(0x17b6),
				makeInfo(0x1781),
				makeInfo(0x17b7),
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.pstf).toBe(KhmerFeatureMask.pstf);
			expect(infos[3]!.mask & KhmerFeatureMask.abvf).toBe(KhmerFeatureMask.abvf);
		});

		test("breaks syllable when consonant follows vowel instead of coeng", () => {
			const infos = [
				makeInfo(0x1780),
				makeInfo(0x17b7),
				makeInfo(0x1781),
				makeInfo(0x17b6),
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.abvf).toBe(KhmerFeatureMask.abvf);
			expect(infos[3]!.mask & KhmerFeatureMask.pstf).toBe(KhmerFeatureMask.pstf);
		});

		test("breaks syllable when consonant not after coeng in compound", () => {
			const infos = [
				makeInfo(0x1780),
				makeInfo(0x17b6),
				makeInfo(0x17c9),
				makeInfo(0x1781),
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.pstf).toBe(KhmerFeatureMask.pstf);
			expect(infos[2]!.mask & KhmerFeatureMask.abvs).toBe(KhmerFeatureMask.abvs);
		});

		test("starts new syllable when second consonant not preceded by coeng", () => {
			const cons1 = makeInfo(0x1780);
			const cons2 = makeInfo(0x1781);
			const infos = [cons1, cons2];
			setupKhmerMasks(infos);
			expect(infos[0]!.mask).toBe(0);
			expect(infos[1]!.mask).toBe(0);
		});

		test("handles consonant with null prevInfo", () => {
			const infos: any[] = [
				makeInfo(0x1780),
				null,
				makeInfo(0x1781),
			];
			setupKhmerMasks(infos);
			expect(infos[0].mask).toBe(0);
			expect(infos[2].mask).toBe(0);
		});

		test("does not break when prevInfo is coeng", () => {
			const infos = [
				makeInfo(0x1780),
				makeInfo(0x17d2),
				makeInfo(0x1781),
			];
			setupKhmerMasks(infos);
			expect(infos[1].mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
			expect(infos[2].mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
		});

		test("breaks syllable when encountering bare consonant", () => {
			const infos = [
				makeInfo(0x1780),
				makeInfo(0x17b6),
				makeInfo(0x17c9),
				makeInfo(0x1781),
				makeInfo(0x17b7),
			];
			setupKhmerMasks(infos);
			expect(infos[1].mask).toBeGreaterThan(0);
			expect(infos[2].mask).toBeGreaterThan(0);
			expect(infos[4].mask).toBeGreaterThan(0);
		});

		test("handles coeng without following consonant", () => {
			const infos = [
				makeInfo(0x1780),
				makeInfo(0x17d2),
			];
			setupKhmerMasks(infos);
			expect(infos[0]!.mask).toBe(0);
		});

		test("handles coeng at end of array", () => {
			const infos: any[] = [
				makeInfo(0x1780),
				makeInfo(0x17d2),
				null,
			];
			setupKhmerMasks(infos);
			expect(infos[0].mask).toBe(0);
		});

		test("sets blwf mask for coeng + consonant", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17d2), // ្ (coeng)
				makeInfo(0x1781), // ខ
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
			expect(infos[2]!.mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
		});

		test("sets pref mask for pre-base vowels", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17c1), // េ
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.pref).toBe(KhmerFeatureMask.pref);
		});

		test("sets abvf mask for above-base vowels", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17b7), // ិ
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.abvf).toBe(KhmerFeatureMask.abvf);
		});

		test("sets blwf mask for below-base vowels", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17bb), // ុ
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
		});

		test("sets pstf mask for post-base vowels", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17b6), // ា (aa)
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.pstf).toBe(KhmerFeatureMask.pstf);
		});

		test("sets abvs mask for register shifters", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17c9), // ៉
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.abvs).toBe(KhmerFeatureMask.abvs);
		});

		test("sets abvs mask for robat", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17cc), // ៌
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.abvs).toBe(KhmerFeatureMask.abvs);
		});

		test("handles complex syllable", () => {
			// ស្រ្តី (strey - woman)
			const infos = [
				makeInfo(0x179f), // ស
				makeInfo(0x17d2), // ្
				makeInfo(0x179a), // រ
				makeInfo(0x17d2), // ្
				makeInfo(0x178f), // ត
				makeInfo(0x17b8), // ី
			];
			setupKhmerMasks(infos);
			// First coeng+consonant pair gets blwf
			expect(infos[1]!.mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
			expect(infos[2]!.mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
			// Second coeng+consonant pair gets blwf
			expect(infos[3]!.mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
			expect(infos[4]!.mask & KhmerFeatureMask.blwf).toBe(KhmerFeatureMask.blwf);
		});

		test("breaks at non-coeng consonant", () => {
			// Two separate syllables
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17b6), // ា
				makeInfo(0x1781), // ខ
				makeInfo(0x17b7), // ិ
			];
			setupKhmerMasks(infos);
			expect(infos[1]!.mask & KhmerFeatureMask.pstf).toBe(KhmerFeatureMask.pstf);
			expect(infos[3]!.mask & KhmerFeatureMask.abvf).toBe(KhmerFeatureMask.abvf);
		});
	});

	describe("reorderKhmer", () => {
		function makeInfo(codepoint: number, cluster: number = 0): GlyphInfo {
			return { glyphId: 0, cluster, mask: 0, codepoint };
		}

		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			expect(() => reorderKhmer(infos)).not.toThrow();
		});

		test("handles non-Khmer characters", () => {
			const infos = [makeInfo(0x0041)];
			reorderKhmer(infos);
			expect(infos[0]!.codepoint).toBe(0x0041);
		});

		test("handles null info at start of array", () => {
			const infos: any[] = [
				null,
				makeInfo(0x1780),
				makeInfo(0x17c1),
			];
			expect(() => reorderKhmer(infos)).not.toThrow();
		});

		test("handles null info in middle of array", () => {
			const infos: any[] = [
				makeInfo(0x1780),
				null,
				makeInfo(0x17c1),
			];
			expect(() => reorderKhmer(infos)).not.toThrow();
		});

		test("moves pre-base vowel before base", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17c1), // េ (pre-base vowel)
			];
			reorderKhmer(infos);
			expect(infos[0]!.codepoint).toBe(0x17c1); // Vowel first
			expect(infos[1]!.codepoint).toBe(0x1780); // Consonant after
		});

		test("moves pre-base vowel over coeng sequence", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17d2), // ្
				makeInfo(0x1781), // ខ
				makeInfo(0x17c1), // េ
			];
			reorderKhmer(infos);
			expect(infos[0]!.codepoint).toBe(0x17c1); // Vowel moved to front
			expect(infos[1]!.codepoint).toBe(0x1780); // Base consonant
			expect(infos[2]!.codepoint).toBe(0x17d2); // Coeng
			expect(infos[3]!.codepoint).toBe(0x1781); // Subscript consonant
		});

		test("does not move non-pre-base vowels", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17b6), // ា (not pre-base)
			];
			reorderKhmer(infos);
			expect(infos[0]!.codepoint).toBe(0x1780); // Consonant stays first
			expect(infos[1]!.codepoint).toBe(0x17b6); // Vowel stays after
		});

		test("handles multiple syllables", () => {
			const infos = [
				makeInfo(0x1780), // ក
				makeInfo(0x17c1), // េ
				makeInfo(0x1781), // ខ
				makeInfo(0x17c2), // ែ
			];
			reorderKhmer(infos);
			expect(infos[0]!.codepoint).toBe(0x17c1); // First vowel moved
			expect(infos[1]!.codepoint).toBe(0x1780);
			expect(infos[2]!.codepoint).toBe(0x17c2); // Second vowel moved
			expect(infos[3]!.codepoint).toBe(0x1781);
		});
	});

	describe("edge cases", () => {
		test("getKhmerCategory returns Other for codepoints below range", () => {
			expect(getKhmerCategory(0x177f)).toBe(KhmerCategory.Other);
		});

		test("getKhmerCategory returns Other for codepoints above range", () => {
			expect(getKhmerCategory(0x1800)).toBe(KhmerCategory.Other);
		});

		test("boundary codepoints", () => {
			expect(getKhmerCategory(0x1780)).toBe(KhmerCategory.Consonant);
			expect(getKhmerCategory(0x17ff)).toBe(KhmerCategory.Other); // Undefined
		});

		test("dependent vowel range boundaries", () => {
			expect(getKhmerCategory(0x17b5)).not.toBe(KhmerCategory.DependentVowel); // Before range
			expect(getKhmerCategory(0x17b6)).toBe(KhmerCategory.DependentVowel); // First
			expect(getKhmerCategory(0x17c5)).toBe(KhmerCategory.DependentVowel); // Last
			expect(getKhmerCategory(0x17c6)).toBe(KhmerCategory.Anusvara); // After range
		});
	});
});
