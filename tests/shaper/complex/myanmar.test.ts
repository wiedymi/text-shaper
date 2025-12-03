import { describe, expect, test } from "bun:test";
import {
	getMyanmarCategory,
	isMyanmar,
	MyanmarCategory,
	MyanmarFeatureMask,
	setupMyanmarMasks,
	reorderMyanmar,
} from "../../../src/shaper/complex/myanmar.ts";
import type { GlyphInfo } from "../../../src/types.ts";

describe("myanmar shaper", () => {
	describe("consonant detection", () => {
		test("detects basic consonants", () => {
			expect(getMyanmarCategory(0x1000)).toBe(MyanmarCategory.Consonant); // က
			expect(getMyanmarCategory(0x1001)).toBe(MyanmarCategory.Consonant); // ခ
			expect(getMyanmarCategory(0x1021)).toBe(MyanmarCategory.Consonant); // အ
		});

		test("detects consonant range", () => {
			for (let cp = 0x1000; cp <= 0x1020; cp++) {
				const cat = getMyanmarCategory(cp);
				expect(cat).toBe(MyanmarCategory.Consonant);
			}
		});

		test("detects extended consonants", () => {
			expect(getMyanmarCategory(0x103f)).toBe(MyanmarCategory.Consonant); // ဿ
			expect(getMyanmarCategory(0x1050)).toBe(MyanmarCategory.Consonant);
			expect(getMyanmarCategory(0x1065)).toBe(MyanmarCategory.Consonant);
		});
	});

	describe("medial detection", () => {
		test("detects medial consonants", () => {
			expect(getMyanmarCategory(0x103b)).toBe(MyanmarCategory.Medial); // ျ (Ya)
			expect(getMyanmarCategory(0x103c)).toBe(MyanmarCategory.Medial); // ြ (Ra)
			expect(getMyanmarCategory(0x103d)).toBe(MyanmarCategory.Medial); // ွ (Wa)
			expect(getMyanmarCategory(0x103e)).toBe(MyanmarCategory.Medial); // ှ (Ha)
		});
	});

	describe("asat detection", () => {
		test("detects asat characters", () => {
			expect(getMyanmarCategory(0x1039)).toBe(MyanmarCategory.Asat); // ္ (Virama)
			expect(getMyanmarCategory(0x103a)).toBe(MyanmarCategory.Asat); // ် (Asat)
		});
	});

	describe("vowel detection", () => {
		test("detects dependent vowels", () => {
			expect(getMyanmarCategory(0x102b)).toBe(MyanmarCategory.DependentVowel); // ါ
			expect(getMyanmarCategory(0x102c)).toBe(MyanmarCategory.DependentVowel); // ာ
		});
	});

	describe("isMyanmar", () => {
		test("returns true for Myanmar range", () => {
			expect(isMyanmar(0x1000)).toBe(true);
			expect(isMyanmar(0x104f)).toBe(true);
			expect(isMyanmar(0x109f)).toBe(true);
		});

		test("returns true for Myanmar Extended-A range", () => {
			expect(isMyanmar(0xaa60)).toBe(true);
			expect(isMyanmar(0xaa70)).toBe(true);
			expect(isMyanmar(0xaa7f)).toBe(true);
		});

		test("returns true for Myanmar Extended-B range", () => {
			expect(isMyanmar(0xa9e0)).toBe(true);
			expect(isMyanmar(0xa9f0)).toBe(true);
			expect(isMyanmar(0xa9ff)).toBe(true);
		});

		test("returns false for non-Myanmar", () => {
			expect(isMyanmar(0x0041)).toBe(false); // 'A'
			expect(isMyanmar(0x0fff)).toBe(false);
			expect(isMyanmar(0x10a0)).toBe(false);
		});
	});

	describe("independent vowels", () => {
		test("detects independent vowels", () => {
			expect(getMyanmarCategory(0x1023)).toBe(MyanmarCategory.IndependentVowel);
			expect(getMyanmarCategory(0x1027)).toBe(MyanmarCategory.IndependentVowel);
			expect(getMyanmarCategory(0x1029)).toBe(MyanmarCategory.IndependentVowel);
			expect(getMyanmarCategory(0x102a)).toBe(MyanmarCategory.IndependentVowel);
		});
	});

	describe("anusvara and visarga", () => {
		test("detects anusvara", () => {
			expect(getMyanmarCategory(0x1036)).toBe(MyanmarCategory.Anusvara);
		});

		test("detects visarga", () => {
			expect(getMyanmarCategory(0x1038)).toBe(MyanmarCategory.Visarga);
		});
	});

	describe("signs", () => {
		test("detects dot below", () => {
			expect(getMyanmarCategory(0x1037)).toBe(MyanmarCategory.Sign);
		});

		test("detects punctuation signs", () => {
			expect(getMyanmarCategory(0x104a)).toBe(MyanmarCategory.Sign);
			expect(getMyanmarCategory(0x104f)).toBe(MyanmarCategory.Sign);
		});
	});

	describe("numbers", () => {
		test("detects Myanmar digits", () => {
			expect(getMyanmarCategory(0x1040)).toBe(MyanmarCategory.Number); // ၀
			expect(getMyanmarCategory(0x1049)).toBe(MyanmarCategory.Number); // ၉
			expect(getMyanmarCategory(0x1090)).toBe(MyanmarCategory.Number);
			expect(getMyanmarCategory(0x1099)).toBe(MyanmarCategory.Number);
		});
	});

	describe("Extended-A categories", () => {
		test("detects Extended-A consonants", () => {
			expect(getMyanmarCategory(0xaa60)).toBe(MyanmarCategory.Consonant);
			expect(getMyanmarCategory(0xaa76)).toBe(MyanmarCategory.Consonant);
			expect(getMyanmarCategory(0xaa7a)).toBe(MyanmarCategory.Consonant);
		});

		test("detects Extended-A signs", () => {
			expect(getMyanmarCategory(0xaa77)).toBe(MyanmarCategory.Sign);
			expect(getMyanmarCategory(0xaa7b)).toBe(MyanmarCategory.Sign);
		});
	});

	describe("Extended-B categories", () => {
		test("detects Extended-B consonants", () => {
			expect(getMyanmarCategory(0xa9e0)).toBe(MyanmarCategory.Consonant);
			expect(getMyanmarCategory(0xa9ef)).toBe(MyanmarCategory.Consonant);
		});

		test("detects Extended-B vowels", () => {
			expect(getMyanmarCategory(0xa9e5)).toBe(MyanmarCategory.DependentVowel);
		});

		test("detects Extended-B numbers", () => {
			expect(getMyanmarCategory(0xa9f0)).toBe(MyanmarCategory.Number);
			expect(getMyanmarCategory(0xa9f9)).toBe(MyanmarCategory.Number);
		});
	});

	describe("MyanmarFeatureMask", () => {
		test("has correct mask values", () => {
			expect(MyanmarFeatureMask.rphf).toBe(0x0001);
			expect(MyanmarFeatureMask.pref).toBe(0x0002);
			expect(MyanmarFeatureMask.blwf).toBe(0x0004);
			expect(MyanmarFeatureMask.pstf).toBe(0x0008);
			expect(MyanmarFeatureMask.pres).toBe(0x0010);
			expect(MyanmarFeatureMask.abvs).toBe(0x0020);
			expect(MyanmarFeatureMask.blws).toBe(0x0040);
			expect(MyanmarFeatureMask.psts).toBe(0x0080);
		});
	});

	describe("setupMyanmarMasks", () => {
		function makeInfo(codepoint: number): GlyphInfo {
			return { glyphId: 0, cluster: 0, mask: 0, codepoint };
		}

		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			expect(() => setupMyanmarMasks(infos)).not.toThrow();
		});

		test("handles non-Myanmar characters", () => {
			const infos = [makeInfo(0x0041)];
			setupMyanmarMasks(infos);
			expect(infos[0]!.mask).toBe(0);
		});

		test("sets blwf mask for asat", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x1039), // ္
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.blwf).toBe(MyanmarFeatureMask.blwf);
		});

		test("sets blwf mask for asat + following consonant", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x1039), // ္
				makeInfo(0x1001), // ခ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.blwf).toBe(MyanmarFeatureMask.blwf);
			expect(infos[2]!.mask & MyanmarFeatureMask.blwf).toBe(MyanmarFeatureMask.blwf);
		});

		test("sets pref mask for medial ya", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x103b), // ျ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.pref).toBe(MyanmarFeatureMask.pref);
		});

		test("sets pref mask for medial ra", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x103c), // ြ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.pref).toBe(MyanmarFeatureMask.pref);
		});

		test("sets blwf mask for medial wa", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x103d), // ွ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.blwf).toBe(MyanmarFeatureMask.blwf);
		});

		test("sets blwf mask for medial ha", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x103e), // ှ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.blwf).toBe(MyanmarFeatureMask.blwf);
		});

		test("sets pref mask for pre-base vowel", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x1031), // ေ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.pref).toBe(MyanmarFeatureMask.pref);
		});

		test("sets abvs mask for above-base vowels", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x102d), // ိ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.abvs).toBe(MyanmarFeatureMask.abvs);
		});

		test("sets blws mask for below-base vowels", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x102f), // ု
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.blws).toBe(MyanmarFeatureMask.blws);
		});

		test("sets psts mask for post-base vowels", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x102b), // ါ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.psts).toBe(MyanmarFeatureMask.psts);
		});

		test("sets abvs mask for anusvara", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x1036), // ံ
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.abvs).toBe(MyanmarFeatureMask.abvs);
		});

		test("sets abvs mask for sign", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x1037), // ့
			];
			setupMyanmarMasks(infos);
			expect(infos[1]!.mask & MyanmarFeatureMask.abvs).toBe(MyanmarFeatureMask.abvs);
		});
	});

	describe("reorderMyanmar", () => {
		function makeInfo(codepoint: number, cluster: number = 0): GlyphInfo {
			return { glyphId: 0, cluster, mask: 0, codepoint };
		}

		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			expect(() => reorderMyanmar(infos)).not.toThrow();
		});

		test("handles non-Myanmar characters", () => {
			const infos = [makeInfo(0x0041)];
			reorderMyanmar(infos);
			expect(infos[0]!.codepoint).toBe(0x0041);
		});

		test("moves pre-base vowel before base", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x1031), // ေ
			];
			reorderMyanmar(infos);
			expect(infos[0]!.codepoint).toBe(0x1031); // Vowel first
			expect(infos[1]!.codepoint).toBe(0x1000); // Consonant after
		});

		test("moves medial ra before base", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x103c), // ြ
			];
			reorderMyanmar(infos);
			expect(infos[0]!.codepoint).toBe(0x103c); // Medial first
			expect(infos[1]!.codepoint).toBe(0x1000); // Consonant after
		});

		test("moves both pre-base vowel and medial ra", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x103c), // ြ
				makeInfo(0x1031), // ေ
			];
			reorderMyanmar(infos);
			// Both should be before base
			expect(infos[0]!.codepoint).toBe(0x103c);
			expect(infos[1]!.codepoint).toBe(0x1031);
			expect(infos[2]!.codepoint).toBe(0x1000);
		});

		test("does not move non-pre-base vowels", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x102b), // ါ (not pre-base)
			];
			reorderMyanmar(infos);
			expect(infos[0]!.codepoint).toBe(0x1000); // Consonant stays first
			expect(infos[1]!.codepoint).toBe(0x102b); // Vowel stays after
		});

		test("does not move medial ya (only ra moves)", () => {
			const infos = [
				makeInfo(0x1000), // က
				makeInfo(0x103b), // ျ (ya, not pre-base)
			];
			reorderMyanmar(infos);
			expect(infos[0]!.codepoint).toBe(0x1000); // Consonant stays first
			expect(infos[1]!.codepoint).toBe(0x103b); // Medial stays after
		});
	});

	describe("edge cases", () => {
		test("getMyanmarCategory returns Other for codepoints below range", () => {
			expect(getMyanmarCategory(0x0fff)).toBe(MyanmarCategory.Other);
		});

		test("getMyanmarCategory returns Other for codepoints above range", () => {
			expect(getMyanmarCategory(0x10a0)).toBe(MyanmarCategory.Other);
		});

		test("getMyanmarCategory returns Other for gaps between extended ranges", () => {
			expect(getMyanmarCategory(0xaa80)).toBe(MyanmarCategory.Other);
			expect(getMyanmarCategory(0xa9df)).toBe(MyanmarCategory.Other);
		});
	});
});
