import { describe, expect, test } from "bun:test";
import {
	getHebrewCategory,
	isHebrew,
	HebrewCategory,
	setupHebrewMasks,
} from "../../../src/shaper/complex/hebrew.ts";
import type { GlyphInfo } from "../../../src/types.ts";

describe("hebrew shaper", () => {
	describe("isHebrew", () => {
		test("detects Hebrew letters", () => {
			expect(isHebrew(0x05d0)).toBe(true); // א (Alef)
			expect(isHebrew(0x05d1)).toBe(true); // ב (Bet)
			expect(isHebrew(0x05ea)).toBe(true); // ת (Tav)
		});

		test("detects Hebrew points (niqqud)", () => {
			expect(isHebrew(0x05b0)).toBe(true); // Sheva
			expect(isHebrew(0x05b4)).toBe(true); // Hiriq
			expect(isHebrew(0x05bc)).toBe(true); // Dagesh
		});

		test("detects Hebrew accents", () => {
			expect(isHebrew(0x0591)).toBe(true); // Etnahta
			expect(isHebrew(0x05af)).toBe(true); // Last accent
		});

		test("detects Hebrew extended forms", () => {
			expect(isHebrew(0xfb1d)).toBe(true); // Yod with hiriq
			expect(isHebrew(0xfb4f)).toBe(true); // Last extended
		});

		test("rejects non-Hebrew", () => {
			expect(isHebrew(0x0041)).toBe(false); // 'A'
			expect(isHebrew(0x0000)).toBe(false);
			expect(isHebrew(0x058f)).toBe(false); // Before range
			expect(isHebrew(0x0600)).toBe(false); // After range (Arabic)
		});

		test("boundary cases", () => {
			expect(isHebrew(0x0590)).toBe(true); // Start of range
			expect(isHebrew(0x05ff)).toBe(true); // End of range
		});
	});

	describe("HebrewCategory enum", () => {
		test("has expected values", () => {
			expect(HebrewCategory.Other).toBe(0);
			expect(HebrewCategory.Letter).toBe(1);
			expect(HebrewCategory.Point).toBe(2);
			expect(HebrewCategory.Dagesh).toBe(3);
			expect(HebrewCategory.Shin).toBe(4);
			expect(HebrewCategory.Rafe).toBe(5);
			expect(HebrewCategory.Accent).toBe(6);
			expect(HebrewCategory.Maqaf).toBe(7);
			expect(HebrewCategory.Punctuation).toBe(8);
		});
	});

	describe("getHebrewCategory", () => {
		describe("letters", () => {
			test("identifies basic letters", () => {
				expect(getHebrewCategory(0x05d0)).toBe(HebrewCategory.Letter); // א (Alef)
				expect(getHebrewCategory(0x05d1)).toBe(HebrewCategory.Letter); // ב (Bet)
				expect(getHebrewCategory(0x05d2)).toBe(HebrewCategory.Letter); // ג (Gimel)
				expect(getHebrewCategory(0x05ea)).toBe(HebrewCategory.Letter); // ת (Tav)
			});

			test("identifies all 22 basic letters", () => {
				for (let cp = 0x05d0; cp <= 0x05ea; cp++) {
					expect(getHebrewCategory(cp)).toBe(HebrewCategory.Letter);
				}
			});

			test("identifies final letters", () => {
				expect(getHebrewCategory(0x05f0)).toBe(HebrewCategory.Letter); // Yod with Vav
				expect(getHebrewCategory(0x05f1)).toBe(HebrewCategory.Letter); // Double Yod
				expect(getHebrewCategory(0x05f2)).toBe(HebrewCategory.Letter); // Double Vav
			});

			test("identifies extended forms", () => {
				expect(getHebrewCategory(0xfb1d)).toBe(HebrewCategory.Letter); // Yod with hiriq
				expect(getHebrewCategory(0xfb20)).toBe(HebrewCategory.Letter);
				expect(getHebrewCategory(0xfb4f)).toBe(HebrewCategory.Letter);
			});
		});

		describe("vowel points (niqqud)", () => {
			test("identifies vowel points", () => {
				expect(getHebrewCategory(0x05b0)).toBe(HebrewCategory.Point); // Sheva
				expect(getHebrewCategory(0x05b1)).toBe(HebrewCategory.Point); // Hataf Segol
				expect(getHebrewCategory(0x05b2)).toBe(HebrewCategory.Point); // Hataf Patah
				expect(getHebrewCategory(0x05b3)).toBe(HebrewCategory.Point); // Hataf Qamats
				expect(getHebrewCategory(0x05b4)).toBe(HebrewCategory.Point); // Hiriq
				expect(getHebrewCategory(0x05b5)).toBe(HebrewCategory.Point); // Tsere
				expect(getHebrewCategory(0x05b6)).toBe(HebrewCategory.Point); // Segol
				expect(getHebrewCategory(0x05b7)).toBe(HebrewCategory.Point); // Patah
				expect(getHebrewCategory(0x05b8)).toBe(HebrewCategory.Point); // Qamats
				expect(getHebrewCategory(0x05b9)).toBe(HebrewCategory.Point); // Holam
				expect(getHebrewCategory(0x05bb)).toBe(HebrewCategory.Point); // Qubuts
			});
		});

		describe("dagesh", () => {
			test("identifies dagesh as Point in implementation", () => {
				// Note: In this implementation, dagesh (0x05bc) is within the Point range (0x05b0-0x05bd)
				// so it returns Point instead of a separate Dagesh category
				expect(getHebrewCategory(0x05bc)).toBe(HebrewCategory.Point);
			});
		});

		describe("shin/sin dot", () => {
			test("identifies shin dot", () => {
				expect(getHebrewCategory(0x05c1)).toBe(HebrewCategory.Shin); // Shin dot
			});

			test("identifies sin dot", () => {
				expect(getHebrewCategory(0x05c2)).toBe(HebrewCategory.Shin); // Sin dot
			});
		});

		describe("rafe", () => {
			test("identifies rafe", () => {
				expect(getHebrewCategory(0x05bf)).toBe(HebrewCategory.Rafe);
			});
		});

		describe("accents (cantillation marks)", () => {
			test("identifies cantillation marks", () => {
				expect(getHebrewCategory(0x0591)).toBe(HebrewCategory.Accent); // Etnahta
				expect(getHebrewCategory(0x0592)).toBe(HebrewCategory.Accent); // Segol
				expect(getHebrewCategory(0x05af)).toBe(HebrewCategory.Accent); // Last
			});

			test("identifies all accent range", () => {
				for (let cp = 0x0591; cp <= 0x05af; cp++) {
					expect(getHebrewCategory(cp)).toBe(HebrewCategory.Accent);
				}
			});
		});

		describe("maqaf", () => {
			test("identifies maqaf (Hebrew hyphen)", () => {
				expect(getHebrewCategory(0x05be)).toBe(HebrewCategory.Maqaf);
			});
		});

		describe("punctuation", () => {
			test("identifies paseq", () => {
				expect(getHebrewCategory(0x05c0)).toBe(HebrewCategory.Punctuation);
			});

			test("identifies sof pasuq", () => {
				expect(getHebrewCategory(0x05c3)).toBe(HebrewCategory.Punctuation);
			});
		});

		describe("other/unknown", () => {
			test("returns Other for non-Hebrew", () => {
				expect(getHebrewCategory(0x0041)).toBe(HebrewCategory.Other);
			});

			test("returns Other for undefined Hebrew codepoints", () => {
				expect(getHebrewCategory(0x0590)).toBe(HebrewCategory.Other);
			});
		});
	});

	describe("setupHebrewMasks", () => {
		function makeInfo(codepoint: number, cluster: number = 0): GlyphInfo {
			return {
				glyphId: 0,
				cluster,
				mask: 0,
				codepoint,
			};
		}

		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			expect(() => setupHebrewMasks(infos)).not.toThrow();
		});

		test("handles single letter", () => {
			const infos = [makeInfo(0x05d0)]; // א
			setupHebrewMasks(infos);
			expect(infos[0]!.mask & 0xffff).toBe(0);
		});

		test("handles letter with point", () => {
			const infos = [
				makeInfo(0x05d0), // א (Alef)
				makeInfo(0x05b4), // Hiriq
			];
			setupHebrewMasks(infos);
			// Point should reference base letter
			expect(infos[1]!.mask & 0xffff).toBe(0);
		});

		test("handles multiple letters with points", () => {
			const infos = [
				makeInfo(0x05d0), // א (Alef)
				makeInfo(0x05b4), // Hiriq
				makeInfo(0x05d1), // ב (Bet)
				makeInfo(0x05bc), // Dagesh
			];
			setupHebrewMasks(infos);
			// First letter's point references index 0
			expect(infos[1]!.mask & 0xffff).toBe(0);
			// Second letter is new base
			expect(infos[2]!.mask & 0xffff).toBe(2);
			// Second letter's dagesh references index 2
			expect(infos[3]!.mask & 0xffff).toBe(2);
		});

		test("handles complex word with multiple marks", () => {
			// שָׁלוֹם (shalom)
			const infos = [
				makeInfo(0x05e9), // ש (Shin)
				makeInfo(0x05c1), // Shin dot
				makeInfo(0x05b8), // Qamats
				makeInfo(0x05dc), // ל (Lamed)
				makeInfo(0x05d5), // ו (Vav)
				makeInfo(0x05b9), // Holam
				makeInfo(0x05dd), // ם (Final Mem)
			];
			setupHebrewMasks(infos);
			// Marks should reference their base letters
			expect(infos[1]!.mask & 0xffff).toBe(0); // Shin dot -> Shin
			expect(infos[2]!.mask & 0xffff).toBe(0); // Qamats -> Shin
			expect(infos[3]!.mask & 0xffff).toBe(3); // Lamed is new base
			expect(infos[5]!.mask & 0xffff).toBe(4); // Holam -> Vav
		});
	});

	describe("edge cases", () => {
		test("handles codepoint 0", () => {
			expect(isHebrew(0)).toBe(false);
			expect(getHebrewCategory(0)).toBe(HebrewCategory.Other);
		});

		test("handles very large codepoints", () => {
			expect(isHebrew(0x10ffff)).toBe(false);
			expect(getHebrewCategory(0x10ffff)).toBe(HebrewCategory.Other);
		});

		test("handles adjacent scripts", () => {
			// Arabic starts at 0x0600
			expect(isHebrew(0x0600)).toBe(false);
			expect(getHebrewCategory(0x0600)).toBe(HebrewCategory.Other);
		});
	});
});
