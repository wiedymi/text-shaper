import { describe, expect, test } from "bun:test";
import {
	ThaiLaoCategory,
	isThai,
	isLao,
	getThaiLaoCategory,
	setupThaiLaoMasks,
	reorderThaiLao,
} from "../../../src/shaper/complex/thai-lao.ts";
import type { GlyphInfo } from "../../../src/types.ts";

function makeInfo(codepoint: number, cluster = 0): GlyphInfo {
	return { glyphId: 0, cluster, mask: 0, codepoint };
}

describe("shaper/complex/thai-lao", () => {
	describe("ThaiLaoCategory enum", () => {
		test("has expected values", () => {
			expect(ThaiLaoCategory.Other).toBe(0);
			expect(ThaiLaoCategory.Consonant).toBe(1);
			expect(ThaiLaoCategory.LeadingVowel).toBe(2);
			expect(ThaiLaoCategory.AboveVowel).toBe(3);
			expect(ThaiLaoCategory.BelowVowel).toBe(4);
			expect(ThaiLaoCategory.FollowingVowel).toBe(5);
			expect(ThaiLaoCategory.Tone).toBe(6);
			expect(ThaiLaoCategory.NikhahitMaiEk).toBe(7);
			expect(ThaiLaoCategory.SaraAm).toBe(8);
			expect(ThaiLaoCategory.Symbol).toBe(9);
		});
	});

	describe("isThai", () => {
		test("identifies Thai range", () => {
			expect(isThai(0x0e00)).toBe(true);
			expect(isThai(0x0e01)).toBe(true); // Ko Kai
			expect(isThai(0x0e40)).toBe(true); // Sara E
			expect(isThai(0x0e7f)).toBe(true);
		});

		test("rejects non-Thai", () => {
			expect(isThai(0x0041)).toBe(false); // 'A'
			expect(isThai(0x0dff)).toBe(false); // Before Thai
			expect(isThai(0x0e80)).toBe(false); // Lao
			expect(isThai(0x0f00)).toBe(false); // After Lao
		});
	});

	describe("isLao", () => {
		test("identifies Lao range", () => {
			expect(isLao(0x0e80)).toBe(true);
			expect(isLao(0x0e81)).toBe(true); // Lo
			expect(isLao(0x0ec0)).toBe(true); // Vowel
			expect(isLao(0x0eff)).toBe(true);
		});

		test("rejects non-Lao", () => {
			expect(isLao(0x0041)).toBe(false); // 'A'
			expect(isLao(0x0e7f)).toBe(false); // Thai
			expect(isLao(0x0f00)).toBe(false); // After Lao
		});
	});

	describe("getThaiLaoCategory", () => {
		describe("Thai consonants", () => {
			test("basic consonants", () => {
				expect(getThaiLaoCategory(0x0e01)).toBe(ThaiLaoCategory.Consonant); // Ko Kai
				expect(getThaiLaoCategory(0x0e02)).toBe(ThaiLaoCategory.Consonant); // Kho Khai
				expect(getThaiLaoCategory(0x0e15)).toBe(ThaiLaoCategory.Consonant); // To Tao
				expect(getThaiLaoCategory(0x0e2e)).toBe(ThaiLaoCategory.Consonant); // Ho Nok Huk
			});

			test("paiyannoi", () => {
				expect(getThaiLaoCategory(0x0e2f)).toBe(ThaiLaoCategory.Consonant);
			});
		});

		describe("Thai vowels", () => {
			test("leading vowels", () => {
				expect(getThaiLaoCategory(0x0e40)).toBe(ThaiLaoCategory.LeadingVowel); // Sara E
				expect(getThaiLaoCategory(0x0e41)).toBe(ThaiLaoCategory.LeadingVowel); // Sara Ae
				expect(getThaiLaoCategory(0x0e42)).toBe(ThaiLaoCategory.LeadingVowel); // Sara O
				expect(getThaiLaoCategory(0x0e43)).toBe(ThaiLaoCategory.LeadingVowel); // Sara Ai Maimuan
				expect(getThaiLaoCategory(0x0e44)).toBe(ThaiLaoCategory.LeadingVowel); // Sara Ai Maimalai
			});

			test("above vowels", () => {
				expect(getThaiLaoCategory(0x0e31)).toBe(ThaiLaoCategory.AboveVowel); // Mai Han-Akat
				expect(getThaiLaoCategory(0x0e34)).toBe(ThaiLaoCategory.AboveVowel); // Sara I
				expect(getThaiLaoCategory(0x0e35)).toBe(ThaiLaoCategory.AboveVowel); // Sara Ii
				expect(getThaiLaoCategory(0x0e36)).toBe(ThaiLaoCategory.AboveVowel); // Sara Ue
				expect(getThaiLaoCategory(0x0e37)).toBe(ThaiLaoCategory.AboveVowel); // Sara Uee
				expect(getThaiLaoCategory(0x0e47)).toBe(ThaiLaoCategory.AboveVowel); // Maitaikhu
			});

			test("below vowels", () => {
				expect(getThaiLaoCategory(0x0e38)).toBe(ThaiLaoCategory.BelowVowel); // Sara U
				expect(getThaiLaoCategory(0x0e39)).toBe(ThaiLaoCategory.BelowVowel); // Sara Uu
				expect(getThaiLaoCategory(0x0e3a)).toBe(ThaiLaoCategory.BelowVowel); // Phinthu
			});

			test("following vowels", () => {
				expect(getThaiLaoCategory(0x0e30)).toBe(ThaiLaoCategory.FollowingVowel); // Sara A
				expect(getThaiLaoCategory(0x0e32)).toBe(ThaiLaoCategory.FollowingVowel); // Sara Aa
				expect(getThaiLaoCategory(0x0e45)).toBe(ThaiLaoCategory.FollowingVowel); // Lakkhangyao
			});

			test("Sara Am is also following vowel", () => {
				// Sara Am (0x0e33) is categorized as FollowingVowel, not SaraAm
				expect(getThaiLaoCategory(0x0e33)).toBe(ThaiLaoCategory.FollowingVowel);
			});
		});

		describe("Thai tone marks", () => {
			test("tone marks", () => {
				expect(getThaiLaoCategory(0x0e48)).toBe(ThaiLaoCategory.Tone); // Mai Ek
				expect(getThaiLaoCategory(0x0e49)).toBe(ThaiLaoCategory.Tone); // Mai Tho
				expect(getThaiLaoCategory(0x0e4a)).toBe(ThaiLaoCategory.Tone); // Mai Tri
				expect(getThaiLaoCategory(0x0e4b)).toBe(ThaiLaoCategory.Tone); // Mai Chattawa
				expect(getThaiLaoCategory(0x0e4c)).toBe(ThaiLaoCategory.Tone); // Thanthakhat
			});

			test("special marks", () => {
				expect(getThaiLaoCategory(0x0e4d)).toBe(ThaiLaoCategory.NikhahitMaiEk); // Nikhahit
				expect(getThaiLaoCategory(0x0e4e)).toBe(ThaiLaoCategory.NikhahitMaiEk); // Yamakkan
			});
		});

		describe("Thai digits and symbols", () => {
			test("digits", () => {
				expect(getThaiLaoCategory(0x0e50)).toBe(ThaiLaoCategory.Symbol); // 0
				expect(getThaiLaoCategory(0x0e51)).toBe(ThaiLaoCategory.Symbol); // 1
				expect(getThaiLaoCategory(0x0e59)).toBe(ThaiLaoCategory.Symbol); // 9
			});
		});

		describe("Lao consonants", () => {
			test("basic consonants", () => {
				expect(getThaiLaoCategory(0x0e81)).toBe(ThaiLaoCategory.Consonant); // Ko
				expect(getThaiLaoCategory(0x0e82)).toBe(ThaiLaoCategory.Consonant); // Kho Sung
				expect(getThaiLaoCategory(0x0ea5)).toBe(ThaiLaoCategory.Consonant); // Lo Ling
				expect(getThaiLaoCategory(0x0eae)).toBe(ThaiLaoCategory.Consonant); // Ho Sung
			});
		});

		describe("Lao vowels", () => {
			test("leading vowels", () => {
				expect(getThaiLaoCategory(0x0ec0)).toBe(ThaiLaoCategory.LeadingVowel); // E
				expect(getThaiLaoCategory(0x0ec1)).toBe(ThaiLaoCategory.LeadingVowel); // Ei
				expect(getThaiLaoCategory(0x0ec2)).toBe(ThaiLaoCategory.LeadingVowel); // O
				expect(getThaiLaoCategory(0x0ec3)).toBe(ThaiLaoCategory.LeadingVowel); // Ai
				expect(getThaiLaoCategory(0x0ec4)).toBe(ThaiLaoCategory.LeadingVowel); // Ai
			});

			test("above vowels", () => {
				expect(getThaiLaoCategory(0x0eb1)).toBe(ThaiLaoCategory.AboveVowel); // Mai Kan
				expect(getThaiLaoCategory(0x0eb4)).toBe(ThaiLaoCategory.AboveVowel); // I
				expect(getThaiLaoCategory(0x0eb5)).toBe(ThaiLaoCategory.AboveVowel); // Ii
				expect(getThaiLaoCategory(0x0eb6)).toBe(ThaiLaoCategory.AboveVowel); // Y
				expect(getThaiLaoCategory(0x0eb7)).toBe(ThaiLaoCategory.AboveVowel); // Yy
				expect(getThaiLaoCategory(0x0ebb)).toBe(ThaiLaoCategory.AboveVowel); // Mai Kon
			});

			test("below vowels", () => {
				expect(getThaiLaoCategory(0x0eb8)).toBe(ThaiLaoCategory.BelowVowel); // U
				expect(getThaiLaoCategory(0x0eb9)).toBe(ThaiLaoCategory.BelowVowel); // Uu
				expect(getThaiLaoCategory(0x0ebc)).toBe(ThaiLaoCategory.BelowVowel); // Semivowel Sign Lo
			});

			test("following vowels", () => {
				expect(getThaiLaoCategory(0x0eb0)).toBe(ThaiLaoCategory.FollowingVowel); // A
				expect(getThaiLaoCategory(0x0eb2)).toBe(ThaiLaoCategory.FollowingVowel); // Aa
				expect(getThaiLaoCategory(0x0eb3)).toBe(ThaiLaoCategory.FollowingVowel); // Am
			});
		});

		describe("Lao tone marks", () => {
			test("tone marks", () => {
				expect(getThaiLaoCategory(0x0ec8)).toBe(ThaiLaoCategory.Tone); // Tone Mai Ek
				expect(getThaiLaoCategory(0x0ec9)).toBe(ThaiLaoCategory.Tone); // Tone Mai Tho
				expect(getThaiLaoCategory(0x0eca)).toBe(ThaiLaoCategory.Tone); // Tone Mai Ti
				expect(getThaiLaoCategory(0x0ecb)).toBe(ThaiLaoCategory.Tone); // Tone Mai Catawa
				expect(getThaiLaoCategory(0x0ecc)).toBe(ThaiLaoCategory.Tone); // Cancellation Mark
				expect(getThaiLaoCategory(0x0ecd)).toBe(ThaiLaoCategory.Tone); // Niggahita
			});
		});

		describe("Lao digits", () => {
			test("digits", () => {
				expect(getThaiLaoCategory(0x0ed0)).toBe(ThaiLaoCategory.Symbol); // 0
				expect(getThaiLaoCategory(0x0ed5)).toBe(ThaiLaoCategory.Symbol); // 5
				expect(getThaiLaoCategory(0x0ed9)).toBe(ThaiLaoCategory.Symbol); // 9
			});
		});

		test("non-Thai/Lao returns Other", () => {
			expect(getThaiLaoCategory(0x0041)).toBe(ThaiLaoCategory.Other); // 'A'
			expect(getThaiLaoCategory(0x0020)).toBe(ThaiLaoCategory.Other); // space
			expect(getThaiLaoCategory(0x1000)).toBe(ThaiLaoCategory.Other); // Myanmar
		});

		test("Thai range undefined codepoints return Other", () => {
			// Test codepoints within Thai range but not explicitly categorized
			expect(getThaiLaoCategory(0x0e00)).toBe(ThaiLaoCategory.Other); // Start of Thai range
			expect(getThaiLaoCategory(0x0e3b)).toBe(ThaiLaoCategory.Other); // Between vowel ranges
			expect(getThaiLaoCategory(0x0e46)).toBe(ThaiLaoCategory.Other); // Between vowel and tone
			expect(getThaiLaoCategory(0x0e4f)).toBe(ThaiLaoCategory.Other); // After special marks
			expect(getThaiLaoCategory(0x0e5c)).toBe(ThaiLaoCategory.Other); // After symbols
			expect(getThaiLaoCategory(0x0e7f)).toBe(ThaiLaoCategory.Other); // End of Thai range
		});

		test("Lao range undefined codepoints return Other", () => {
			// Test codepoints within Lao range but not explicitly categorized
			expect(getThaiLaoCategory(0x0e80)).toBe(ThaiLaoCategory.Other); // Start of Lao range
			expect(getThaiLaoCategory(0x0eaf)).toBe(ThaiLaoCategory.Other); // After consonants
			expect(getThaiLaoCategory(0x0eba)).toBe(ThaiLaoCategory.Other); // Between vowel ranges
			expect(getThaiLaoCategory(0x0ebd)).toBe(ThaiLaoCategory.Other); // After below vowels
			expect(getThaiLaoCategory(0x0ec5)).toBe(ThaiLaoCategory.Other); // After leading vowels
			expect(getThaiLaoCategory(0x0ece)).toBe(ThaiLaoCategory.Other); // After tone marks
			expect(getThaiLaoCategory(0x0ecf)).toBe(ThaiLaoCategory.Other); // Before digits
			expect(getThaiLaoCategory(0x0eda)).toBe(ThaiLaoCategory.Other); // After digits
		});
	});

	describe("setupThaiLaoMasks", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			setupThaiLaoMasks(infos);
			expect(infos.length).toBe(0);
		});

		test("sets mask for single consonant", () => {
			const infos = [makeInfo(0x0e01)]; // Ko Kai
			setupThaiLaoMasks(infos);
			expect(infos[0].mask & 0xff).toBe(ThaiLaoCategory.Consonant);
		});

		test("assigns cluster indices", () => {
			const infos = [
				makeInfo(0x0e01), // Consonant
				makeInfo(0x0e34), // Above vowel
				makeInfo(0x0e48), // Tone mark
			];
			setupThaiLaoMasks(infos);
			// All should belong to same cluster (index 1)
			const cluster0 = (infos[0].mask >> 16) & 0xffff;
			const cluster1 = (infos[1].mask >> 16) & 0xffff;
			const cluster2 = (infos[2].mask >> 16) & 0xffff;
			expect(cluster0).toBe(cluster1);
			expect(cluster1).toBe(cluster2);
		});

		test("creates separate clusters for multiple consonants", () => {
			const infos = [
				makeInfo(0x0e01), // Consonant 1
				makeInfo(0x0e34), // Vowel
				makeInfo(0x0e02), // Consonant 2
				makeInfo(0x0e35), // Vowel
			];
			setupThaiLaoMasks(infos);
			const cluster0 = (infos[0].mask >> 16) & 0xffff;
			const cluster2 = (infos[2].mask >> 16) & 0xffff;
			expect(cluster0).not.toBe(cluster2);
		});

		test("marks leading vowels for reordering", () => {
			const infos = [makeInfo(0x0e40)]; // Sara E (leading vowel)
			setupThaiLaoMasks(infos);
			expect(infos[0].mask & 0x100).toBe(0x100);
		});

		test("stores category in lower mask bits", () => {
			const infos = [
				makeInfo(0x0e01), // Consonant
				makeInfo(0x0e40), // Leading vowel
				makeInfo(0x0e34), // Above vowel
				makeInfo(0x0e38), // Below vowel
				makeInfo(0x0e48), // Tone mark
			];
			setupThaiLaoMasks(infos);
			expect(infos[0].mask & 0xff).toBe(ThaiLaoCategory.Consonant);
			expect(infos[1].mask & 0xff).toBe(ThaiLaoCategory.LeadingVowel);
			expect(infos[2].mask & 0xff).toBe(ThaiLaoCategory.AboveVowel);
			expect(infos[3].mask & 0xff).toBe(ThaiLaoCategory.BelowVowel);
			expect(infos[4].mask & 0xff).toBe(ThaiLaoCategory.Tone);
		});

		test("handles non-Thai/Lao characters", () => {
			const infos = [
				makeInfo(0x0041), // 'A'
				makeInfo(0x0e01), // Thai consonant
			];
			setupThaiLaoMasks(infos);
			expect(infos[0].mask & 0xff).toBe(ThaiLaoCategory.Other);
			expect(infos[1].mask & 0xff).toBe(ThaiLaoCategory.Consonant);
		});
	});

	describe("reorderThaiLao", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			reorderThaiLao(infos);
			expect(infos.length).toBe(0);
		});

		test("does not reorder non-leading vowels", () => {
			const infos = [
				makeInfo(0x0e01), // Consonant
				makeInfo(0x0e34), // Above vowel (not leading)
			];
			const original = infos.map((i) => i.codepoint);
			reorderThaiLao(infos);
			expect(infos[0].codepoint).toBe(original[0]);
			expect(infos[1].codepoint).toBe(original[1]);
		});

		test("moves leading vowel before following consonant", () => {
			// The reorder function looks for leading vowel followed by consonant
			// and swaps them so consonant comes first in logical order
			const infos = [
				makeInfo(0x0e40), // Sara E (leading vowel)
				makeInfo(0x0e01), // Ko Kai (consonant)
			];
			reorderThaiLao(infos);
			// After reordering: consonant comes first, then vowel
			expect(infos[0].codepoint).toBe(0x0e01);
			expect(infos[1].codepoint).toBe(0x0e40);
		});

		test("complex case: consonant then leading vowel then consonant", () => {
			const infos = [
				makeInfo(0x0e01), // Consonant 1
				makeInfo(0x0e40), // Leading vowel
				makeInfo(0x0e02), // Consonant 2
			];
			reorderThaiLao(infos);
			// Leading vowel at index 1 should move before consonant 2 at index 2
			expect(infos[1].codepoint).toBe(0x0e02); // Consonant moved to position 1
			expect(infos[2].codepoint).toBe(0x0e40); // Vowel moved to position 2
		});

		test("does not move leading vowel if no consonant follows", () => {
			const infos = [
				makeInfo(0x0e40), // Leading vowel
				makeInfo(0x0e34), // Above vowel (not consonant)
			];
			const original = [...infos];
			reorderThaiLao(infos);
			expect(infos[0].codepoint).toBe(original[0].codepoint);
			expect(infos[1].codepoint).toBe(original[1].codepoint);
		});

		test("handles multiple leading vowels", () => {
			const infos = [
				makeInfo(0x0e40), // Leading vowel 1
				makeInfo(0x0e41), // Leading vowel 2
				makeInfo(0x0e01), // Consonant
			];
			reorderThaiLao(infos);
			// Both vowels should be processed
			expect(infos.length).toBe(3);
		});

		test("Thai word: เก (e + ko)", () => {
			// In Unicode: 0x0e40 (Sara E) 0x0e01 (Ko Kai)
			// The function reorders to put consonant first
			const infos = [makeInfo(0x0e40), makeInfo(0x0e01)];
			reorderThaiLao(infos);
			expect(infos[0].codepoint).toBe(0x0e01); // Consonant first
			expect(infos[1].codepoint).toBe(0x0e40); // Vowel second
		});

		test("preserves cluster info during reordering", () => {
			const infos = [
				makeInfo(0x0e40, 0), // Leading vowel
				makeInfo(0x0e01, 1), // Consonant
			];
			reorderThaiLao(infos);
			expect(infos[0].cluster).toBeDefined();
			expect(infos[1].cluster).toBeDefined();
		});

		test("Lao leading vowel reordering", () => {
			const infos = [
				makeInfo(0x0ec0), // Lao E (leading vowel)
				makeInfo(0x0e81), // Lao Ko (consonant)
			];
			reorderThaiLao(infos);
			// Consonant moves before vowel
			expect(infos[0].codepoint).toBe(0x0e81);
			expect(infos[1].codepoint).toBe(0x0ec0);
		});

		test("handles null entries in array", () => {
			const infos: (GlyphInfo | null)[] = [
				null,
				makeInfo(0x0e40), // Leading vowel
				makeInfo(0x0e01), // Consonant
				null,
			];
			// @ts-expect-error - testing null handling
			reorderThaiLao(infos);
			expect(infos[0]).toBe(null);
			expect(infos[3]).toBe(null);
		});

		test("handles null entry in lookahead during reordering", () => {
			const infos: (GlyphInfo | null)[] = [
				makeInfo(0x0e40), // Leading vowel
				null, // Null entry
				makeInfo(0x0e01), // Consonant
			];
			// @ts-expect-error - testing null handling
			reorderThaiLao(infos);
			// Should skip the null and find the consonant
			expect(infos[0].codepoint).toBe(0x0e01);
			expect(infos[1]).toBe(null);
			expect(infos[2].codepoint).toBe(0x0e40);
		});
	});

	describe("integration tests", () => {
		test("Thai syllable with consonant, vowel, and tone", () => {
			// กี้ = Ko Kai + Sara I + Mai Tho
			const infos = [
				makeInfo(0x0e01), // Consonant
				makeInfo(0x0e35), // Above vowel
				makeInfo(0x0e49), // Tone mark
			];
			setupThaiLaoMasks(infos);
			expect(infos.length).toBe(3);
			expect(infos[0].mask & 0xff).toBe(ThaiLaoCategory.Consonant);
			expect(infos[1].mask & 0xff).toBe(ThaiLaoCategory.AboveVowel);
			expect(infos[2].mask & 0xff).toBe(ThaiLaoCategory.Tone);
		});

		test("Thai word with leading vowel", () => {
			// โค = Sara O + Ko Kai
			const infos = [
				makeInfo(0x0e42), // Leading vowel
				makeInfo(0x0e04), // Consonant
			];
			setupThaiLaoMasks(infos);
			reorderThaiLao(infos);
			expect(infos.length).toBe(2);
		});

		test("Lao syllable", () => {
			// ກ + vowel + tone
			const infos = [
				makeInfo(0x0e81), // Lao consonant
				makeInfo(0x0eb4), // Lao above vowel
				makeInfo(0x0ec9), // Lao tone
			];
			setupThaiLaoMasks(infos);
			expect(infos.length).toBe(3);
			expect(infos[0].mask & 0xff).toBe(ThaiLaoCategory.Consonant);
			expect(infos[1].mask & 0xff).toBe(ThaiLaoCategory.AboveVowel);
			expect(infos[2].mask & 0xff).toBe(ThaiLaoCategory.Tone);
		});

		test("mixed Thai and non-Thai", () => {
			const infos = [
				makeInfo(0x0041), // 'A'
				makeInfo(0x0e01), // Thai consonant
				makeInfo(0x0042), // 'B'
			];
			setupThaiLaoMasks(infos);
			expect(infos[0].mask & 0xff).toBe(ThaiLaoCategory.Other);
			expect(infos[1].mask & 0xff).toBe(ThaiLaoCategory.Consonant);
			expect(infos[2].mask & 0xff).toBe(ThaiLaoCategory.Other);
		});
	});
});
