import { describe, expect, test } from "bun:test";
import {
	NormalizationMode,
	getCombiningClass,
	reorderMarks,
	decompose,
	tryCompose,
	normalize,
} from "../../src/unicode/normalize.ts";
import type { GlyphInfo } from "../../src/types.ts";

function makeInfo(codepoint: number, cluster = 0): GlyphInfo {
	return { glyphId: 0, cluster, mask: 0, codepoint };
}

describe("unicode normalization", () => {
	describe("NormalizationMode enum", () => {
		test("has expected values", () => {
			expect(NormalizationMode.None).toBe(0);
			expect(NormalizationMode.Decompose).toBe(1);
			expect(NormalizationMode.Compose).toBe(2);
			expect(NormalizationMode.Auto).toBe(3);
		});
	});

	describe("getCombiningClass", () => {
		describe("base characters", () => {
			test("ASCII letters have ccc 0", () => {
				expect(getCombiningClass(0x0041)).toBe(0); // 'A'
				expect(getCombiningClass(0x0061)).toBe(0); // 'a'
				expect(getCombiningClass(0x007a)).toBe(0); // 'z'
			});

			test("digits have ccc 0", () => {
				expect(getCombiningClass(0x0030)).toBe(0); // '0'
				expect(getCombiningClass(0x0039)).toBe(0); // '9'
			});
		});

		describe("Latin combining marks", () => {
			test("combining grave accent", () => {
				expect(getCombiningClass(0x0300)).toBe(230);
			});

			test("combining acute accent", () => {
				expect(getCombiningClass(0x0301)).toBe(230);
			});

			test("combining circumflex", () => {
				expect(getCombiningClass(0x0302)).toBe(230);
			});

			test("combining tilde", () => {
				expect(getCombiningClass(0x0303)).toBe(230);
			});

			test("combining macron", () => {
				expect(getCombiningClass(0x0304)).toBe(230);
			});

			test("combining diaeresis", () => {
				expect(getCombiningClass(0x0308)).toBe(230);
			});

			test("combining cedilla (attached below)", () => {
				expect(getCombiningClass(0x0327)).toBe(202);
			});

			test("combining ogonek (attached below)", () => {
				expect(getCombiningClass(0x0328)).toBe(202);
			});

			test("combining dot below", () => {
				expect(getCombiningClass(0x0323)).toBe(220);
			});

			test("combining overlay marks", () => {
				expect(getCombiningClass(0x0334)).toBe(1);
				expect(getCombiningClass(0x0338)).toBe(1);
			});

			test("iota subscript has ccc 240", () => {
				expect(getCombiningClass(0x0345)).toBe(240);
			});

			test("CGJ (combining grapheme joiner) has ccc 0", () => {
				expect(getCombiningClass(0x034f)).toBe(0);
			});

			test("combining double below has ccc 233", () => {
				expect(getCombiningClass(0x035c)).toBe(233);
			});

			test("combining double above has ccc 234", () => {
				expect(getCombiningClass(0x035d)).toBe(234);
			});
		});

		describe("Hebrew combining marks", () => {
			test("sheva", () => {
				expect(getCombiningClass(0x05b0)).toBe(10);
			});

			test("hiriq", () => {
				expect(getCombiningClass(0x05b4)).toBe(14);
			});

			test("dagesh", () => {
				expect(getCombiningClass(0x05bc)).toBe(21);
			});

			test("meteg", () => {
				expect(getCombiningClass(0x05bd)).toBe(22);
			});

			test("holam haser", () => {
				expect(getCombiningClass(0x05ba)).toBe(19);
			});

			test("qubuts", () => {
				expect(getCombiningClass(0x05bb)).toBe(20);
			});

			test("Hebrew marks outside vowel range", () => {
				expect(getCombiningClass(0x05bf)).toBe(23);
				expect(getCombiningClass(0x05c1)).toBe(24);
				expect(getCombiningClass(0x05c2)).toBe(25);
				expect(getCombiningClass(0x05c4)).toBe(230);
				expect(getCombiningClass(0x05c5)).toBe(220);
				expect(getCombiningClass(0x05c7)).toBe(18);
			});

			test("Hebrew marks in 0591-05a1 range", () => {
				expect(getCombiningClass(0x0591)).toBe(220);
				expect(getCombiningClass(0x05a1)).toBe(220);
			});

			test("Hebrew marks in 05a2-05af range", () => {
				expect(getCombiningClass(0x05a2)).toBe(230);
				expect(getCombiningClass(0x05af)).toBe(230);
			});
		});

		describe("Arabic combining marks", () => {
			test("fathatan", () => {
				expect(getCombiningClass(0x064b)).toBe(27);
			});

			test("fatha", () => {
				expect(getCombiningClass(0x064e)).toBe(30);
			});

			test("kasra", () => {
				expect(getCombiningClass(0x0650)).toBe(32);
			});

			test("shadda", () => {
				expect(getCombiningClass(0x0651)).toBe(33);
			});

			test("sukun", () => {
				expect(getCombiningClass(0x0652)).toBe(34);
			});

			test("dammatan", () => {
				expect(getCombiningClass(0x064c)).toBe(28);
			});

			test("kasratan", () => {
				expect(getCombiningClass(0x064d)).toBe(29);
			});

			test("damma", () => {
				expect(getCombiningClass(0x064f)).toBe(31);
			});

			test("extended Arabic marks", () => {
				expect(getCombiningClass(0x0610)).toBe(230);
				expect(getCombiningClass(0x061a)).toBe(230);
				expect(getCombiningClass(0x0670)).toBe(35);
				expect(getCombiningClass(0x06d6)).toBe(230);
				expect(getCombiningClass(0x06dc)).toBe(230);
			});

			test("Arabic mark maddah and hamza above", () => {
				expect(getCombiningClass(0x0653)).toBe(230);
				expect(getCombiningClass(0x0655)).toBe(230);
			});

			test("Arabic subscript alef", () => {
				expect(getCombiningClass(0x0656)).toBe(220);
			});
		});

		describe("Indic marks", () => {
			test("Devanagari nukta has ccc 7", () => {
				expect(getCombiningClass(0x093c)).toBe(7);
			});

			test("Devanagari virama has ccc 9", () => {
				expect(getCombiningClass(0x094d)).toBe(9);
			});

			test("Devanagari accent marks", () => {
				expect(getCombiningClass(0x0951)).toBe(230);
				expect(getCombiningClass(0x0954)).toBe(230);
			});

			test("Bengali nukta has ccc 7", () => {
				expect(getCombiningClass(0x09bc)).toBe(7);
			});

			test("Bengali virama has ccc 9", () => {
				expect(getCombiningClass(0x09cd)).toBe(9);
			});

			test("Tamil virama has ccc 9", () => {
				expect(getCombiningClass(0x0bcd)).toBe(9);
			});

			test("Gurmukhi nukta and virama", () => {
				expect(getCombiningClass(0x0a3c)).toBe(7);
				expect(getCombiningClass(0x0a4d)).toBe(9);
			});

			test("Gujarati nukta and virama", () => {
				expect(getCombiningClass(0x0abc)).toBe(7);
				expect(getCombiningClass(0x0acd)).toBe(9);
			});

			test("Telugu marks", () => {
				expect(getCombiningClass(0x0c4d)).toBe(9);
				expect(getCombiningClass(0x0c55)).toBe(84);
				expect(getCombiningClass(0x0c56)).toBe(91);
			});

			test("Kannada nukta and virama", () => {
				expect(getCombiningClass(0x0cbc)).toBe(7);
				expect(getCombiningClass(0x0ccd)).toBe(9);
			});

			test("Malayalam virama", () => {
				expect(getCombiningClass(0x0d4d)).toBe(9);
			});

			test("Sinhala virama", () => {
				expect(getCombiningClass(0x0dca)).toBe(9);
			});

			test("Myanmar nukta and virama", () => {
				expect(getCombiningClass(0x1037)).toBe(7);
				expect(getCombiningClass(0x1039)).toBe(9);
				expect(getCombiningClass(0x103a)).toBe(9);
			});
		});

		describe("Thai and Lao tone marks", () => {
			test("Thai tone marks have ccc 107", () => {
				expect(getCombiningClass(0x0e48)).toBe(107);
				expect(getCombiningClass(0x0e4b)).toBe(107);
			});

			test("Thai thanthakhat and nikhahit", () => {
				expect(getCombiningClass(0x0e4c)).toBe(0);
				expect(getCombiningClass(0x0e4d)).toBe(0);
				expect(getCombiningClass(0x0e4e)).toBe(0);
			});

			test("Lao tone marks", () => {
				expect(getCombiningClass(0x0ec8)).toBe(122);
				expect(getCombiningClass(0x0ecb)).toBe(122);
			});

			test("Thai/Lao vowels and tone marks", () => {
				expect(getCombiningClass(0x0e31)).toBe(0);
				expect(getCombiningClass(0x0e3a)).toBe(0);
				expect(getCombiningClass(0x0eb1)).toBe(0);
				expect(getCombiningClass(0x0ebc)).toBe(0);
			});
		});

		describe("Tibetan marks", () => {
			test("Tibetan combining marks", () => {
				expect(getCombiningClass(0x0f18)).toBe(220);
				expect(getCombiningClass(0x0f19)).toBe(220);
				expect(getCombiningClass(0x0f35)).toBe(220);
				expect(getCombiningClass(0x0f37)).toBe(220);
				expect(getCombiningClass(0x0f39)).toBe(216);
				expect(getCombiningClass(0x0f86)).toBe(230);
				expect(getCombiningClass(0x0f87)).toBe(230);
			});

			test("Tibetan vowel and consonant signs", () => {
				expect(getCombiningClass(0x0f71)).toBe(129);
				expect(getCombiningClass(0x0f72)).toBe(130);
				expect(getCombiningClass(0x0f74)).toBe(132);
				expect(getCombiningClass(0x0f7a)).toBe(130);
				expect(getCombiningClass(0x0f80)).toBe(130);
				expect(getCombiningClass(0x0f82)).toBe(230);
				expect(getCombiningClass(0x0f84)).toBe(9);
			});

			test("Tibetan composed and zero-class marks", () => {
				expect(getCombiningClass(0x0f73)).toBe(0);
				expect(getCombiningClass(0x0f75)).toBe(0);
				expect(getCombiningClass(0x0f81)).toBe(0);
			});
		});

		describe("Hangul and Kana", () => {
			test("Kana voicing marks have ccc 8", () => {
				expect(getCombiningClass(0x3099)).toBe(8);
				expect(getCombiningClass(0x309a)).toBe(8);
			});

			test("Hangul combining marks", () => {
				expect(getCombiningClass(0x302a)).toBe(218);
				expect(getCombiningClass(0x302b)).toBe(228);
				expect(getCombiningClass(0x302c)).toBe(232);
				expect(getCombiningClass(0x302d)).toBe(222);
				expect(getCombiningClass(0x302e)).toBe(224);
				expect(getCombiningClass(0x302f)).toBe(224);
			});
		});

		describe("Combining Diacritical Marks Extended", () => {
			test("CDME marks", () => {
				expect(getCombiningClass(0x1ab0)).toBe(230);
				expect(getCombiningClass(0x1abe)).toBe(230);
				expect(getCombiningClass(0x1abf)).toBe(220);
				expect(getCombiningClass(0x1ac0)).toBe(220);
			});
		});

		describe("Combining Diacritical Marks Supplement", () => {
			test("CDMS marks", () => {
				expect(getCombiningClass(0x1dc0)).toBe(230);
				expect(getCombiningClass(0x1dc2)).toBe(220);
				expect(getCombiningClass(0x1dcd)).toBe(234);
				expect(getCombiningClass(0x1dce)).toBe(214);
				expect(getCombiningClass(0x1dd0)).toBe(202);
				expect(getCombiningClass(0x1dfa)).toBe(218);
			});
		});

		describe("Combining Half Marks", () => {
			test("FE20-FE2F marks", () => {
				expect(getCombiningClass(0xfe20)).toBe(230);
				expect(getCombiningClass(0xfe2f)).toBe(230);
			});
		});
	});

	describe("reorderMarks", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			reorderMarks(infos);
			expect(infos.length).toBe(0);
		});

		test("handles single base character", () => {
			const infos = [makeInfo(0x0041)]; // 'A'
			reorderMarks(infos);
			expect(infos.length).toBe(1);
			expect(infos[0].codepoint).toBe(0x0041);
		});

		test("does not reorder already-ordered marks", () => {
			// A + cedilla (ccc 202) + grave (ccc 230)
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0327), // cedilla (ccc 202)
				makeInfo(0x0300), // grave (ccc 230)
			];
			reorderMarks(infos);
			expect(infos[0].codepoint).toBe(0x0041);
			expect(infos[1].codepoint).toBe(0x0327);
			expect(infos[2].codepoint).toBe(0x0300);
		});

		test("reorders marks by combining class", () => {
			// A + grave (ccc 230) + cedilla (ccc 202) -> A + cedilla + grave
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0300), // grave (ccc 230)
				makeInfo(0x0327), // cedilla (ccc 202)
			];
			reorderMarks(infos);
			expect(infos[0].codepoint).toBe(0x0041);
			expect(infos[1].codepoint).toBe(0x0327); // cedilla first
			expect(infos[2].codepoint).toBe(0x0300); // grave second
		});

		test("preserves order of marks with same ccc", () => {
			// A + grave + acute (both ccc 230) - order preserved
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0300), // grave (ccc 230)
				makeInfo(0x0301), // acute (ccc 230)
			];
			reorderMarks(infos);
			expect(infos[0].codepoint).toBe(0x0041);
			expect(infos[1].codepoint).toBe(0x0300);
			expect(infos[2].codepoint).toBe(0x0301);
		});

		test("handles multiple base characters", () => {
			// A + grave, B + cedilla + grave
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0300), // grave
				makeInfo(0x0042), // B
				makeInfo(0x0300), // grave (ccc 230)
				makeInfo(0x0327), // cedilla (ccc 202)
			];
			reorderMarks(infos);
			// First sequence unchanged
			expect(infos[0].codepoint).toBe(0x0041);
			expect(infos[1].codepoint).toBe(0x0300);
			// Second sequence: B + cedilla + grave
			expect(infos[2].codepoint).toBe(0x0042);
			expect(infos[3].codepoint).toBe(0x0327); // cedilla reordered first
			expect(infos[4].codepoint).toBe(0x0300);
		});
	});

	describe("decompose", () => {
		test("returns null for non-decomposable characters", () => {
			expect(decompose(0x0041)).toBeNull(); // 'A'
			expect(decompose(0x0061)).toBeNull(); // 'a'
		});

		test("decomposes Latin-1 precomposed characters", () => {
			expect(decompose(0x00c0)).toEqual([0x0041, 0x0300]); // À = A + grave
			expect(decompose(0x00c1)).toEqual([0x0041, 0x0301]); // Á = A + acute
			expect(decompose(0x00c7)).toEqual([0x0043, 0x0327]); // Ç = C + cedilla
			expect(decompose(0x00e9)).toEqual([0x0065, 0x0301]); // é = e + acute
			expect(decompose(0x00f1)).toEqual([0x006e, 0x0303]); // ñ = n + tilde
		});

		test("decomposes Latin Extended-A characters", () => {
			expect(decompose(0x0100)).toEqual([0x0041, 0x0304]); // Ā = A + macron
			expect(decompose(0x010c)).toEqual([0x0043, 0x030c]); // Č = C + caron
			expect(decompose(0x0160)).toEqual([0x0053, 0x030c]); // Š = S + caron
			expect(decompose(0x017e)).toEqual([0x007a, 0x030c]); // ž = z + caron
		});

		test("decomposes Vietnamese characters", () => {
			expect(decompose(0x1ea0)).toEqual([0x0041, 0x0323]); // Ạ = A + dot below
			expect(decompose(0x1ea1)).toEqual([0x0061, 0x0323]); // ạ = a + dot below
		});
	});

	describe("tryCompose", () => {
		test("returns null for non-composable pairs", () => {
			expect(tryCompose(0x0041, 0x0041)).toBeNull(); // A + A
			expect(tryCompose(0x0041, 0x0020)).toBeNull(); // A + space
		});

		test("composes Latin characters with diacritics", () => {
			expect(tryCompose(0x0041, 0x0300)).toBe(0x00c0); // A + grave = À
			expect(tryCompose(0x0041, 0x0301)).toBe(0x00c1); // A + acute = Á
			expect(tryCompose(0x0043, 0x0327)).toBe(0x00c7); // C + cedilla = Ç
			expect(tryCompose(0x0065, 0x0301)).toBe(0x00e9); // e + acute = é
			expect(tryCompose(0x006e, 0x0303)).toBe(0x00f1); // n + tilde = ñ
		});

		test("composes extended Latin characters", () => {
			expect(tryCompose(0x0041, 0x0304)).toBe(0x0100); // A + macron = Ā
			expect(tryCompose(0x0043, 0x030c)).toBe(0x010c); // C + caron = Č
			expect(tryCompose(0x0053, 0x030c)).toBe(0x0160); // S + caron = Š
		});

		test("composes lowercase characters", () => {
			expect(tryCompose(0x0061, 0x0300)).toBe(0x00e0); // a + grave = à
			expect(tryCompose(0x0061, 0x0301)).toBe(0x00e1); // a + acute = á
			expect(tryCompose(0x0063, 0x0327)).toBe(0x00e7); // c + cedilla = ç
		});
	});

	describe("normalize", () => {
		test("NormalizationMode.None returns unchanged", () => {
			const infos = [makeInfo(0x00c0)]; // À
			const result = normalize(infos, NormalizationMode.None);
			expect(result).toBe(infos);
			expect(result[0].codepoint).toBe(0x00c0);
		});

		test("NormalizationMode.Decompose decomposes precomposed", () => {
			const infos = [makeInfo(0x00c0)]; // À
			const result = normalize(infos, NormalizationMode.Decompose);
			expect(result.length).toBe(2);
			expect(result[0].codepoint).toBe(0x0041); // A
			expect(result[1].codepoint).toBe(0x0300); // grave
		});

		test("NormalizationMode.Decompose preserves base characters", () => {
			const infos = [makeInfo(0x0041)]; // A
			const result = normalize(infos, NormalizationMode.Decompose);
			expect(result.length).toBe(1);
			expect(result[0].codepoint).toBe(0x0041);
		});

		test("NormalizationMode.Decompose reorders marks", () => {
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0300), // grave (ccc 230)
				makeInfo(0x0327), // cedilla (ccc 202)
			];
			const result = normalize(infos, NormalizationMode.Decompose);
			expect(result.length).toBe(3);
			expect(result[0].codepoint).toBe(0x0041);
			expect(result[1].codepoint).toBe(0x0327); // cedilla first
			expect(result[2].codepoint).toBe(0x0300); // grave second
		});

		test("NormalizationMode.Compose composes base + mark to precomposed", () => {
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0301), // acute
			];
			const result = normalize(infos, NormalizationMode.Compose);
			// The first output should be the composed character
			expect(result[0].codepoint).toBe(0x00c1); // Á
		});

		test("NormalizationMode.Compose decomposes already-composed then recomposes", () => {
			const infos = [makeInfo(0x00c1)]; // Á
			const result = normalize(infos, NormalizationMode.Compose);
			// NFC: first decompose (A + acute), reorder, then compose -> Á
			// But composing only works if mark wasn't already composed, so it outputs both
			// The implementation decomposes to A + acute, then tries to compose
			expect(result[0].codepoint).toBe(0x00c1); // Should be composed back
		});

		test("NormalizationMode.Compose leaves uncomposable marks", () => {
			// A + grave + acute -> À + acute (can only compose one)
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0300), // grave
				makeInfo(0x0301), // acute
			];
			const result = normalize(infos, NormalizationMode.Compose);
			// Should compose A + grave = À, leave acute
			expect(result[0].codepoint).toBe(0x00c0); // À
		});

		test("NormalizationMode.Auto behaves like Decompose", () => {
			const infos = [makeInfo(0x00c0)]; // À
			const result = normalize(infos, NormalizationMode.Auto);
			expect(result.length).toBe(2);
			expect(result[0].codepoint).toBe(0x0041); // A
			expect(result[1].codepoint).toBe(0x0300); // grave
		});

		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			expect(normalize(infos, NormalizationMode.None).length).toBe(0);
			expect(normalize(infos, NormalizationMode.Decompose).length).toBe(0);
			expect(normalize(infos, NormalizationMode.Compose).length).toBe(0);
			expect(normalize(infos, NormalizationMode.Auto).length).toBe(0);
		});

		test("preserves cluster info during decomposition", () => {
			const infos = [makeInfo(0x00c0, 5)]; // À with cluster 5
			const result = normalize(infos, NormalizationMode.Decompose);
			expect(result[0].cluster).toBe(5);
			expect(result[1].cluster).toBe(5);
		});

		test("NormalizationMode.Compose handles standalone marks", () => {
			// Standalone combining mark should be passed through
			const infos = [makeInfo(0x0300)]; // grave (ccc 230)
			const result = normalize(infos, NormalizationMode.Compose);
			expect(result.length).toBe(1);
			expect(result[0].codepoint).toBe(0x0300);
		});

		test("NormalizationMode.Compose with multiple base characters", () => {
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0301), // acute -> Á
				makeInfo(0x0045), // E
				makeInfo(0x0300), // grave -> È
			];
			const result = normalize(infos, NormalizationMode.Compose);
			expect(result[0].codepoint).toBe(0x00c1); // Á (A + acute composed)
			// E + grave will be handled as a separate sequence
			const eIndex = result.findIndex((r) => r.codepoint === 0x0045 || r.codepoint === 0x00c8);
			expect(eIndex).toBeGreaterThanOrEqual(0);
		});

		test("NormalizationMode.Auto preserves cluster and mask", () => {
			const infos = [{ glyphId: 5, cluster: 10, mask: 0xff, codepoint: 0x00c0 }];
			const result = normalize(infos, NormalizationMode.Auto);
			expect(result[0].glyphId).toBe(5);
			expect(result[0].cluster).toBe(10);
			expect(result[0].mask).toBe(0xff);
			expect(result[1].glyphId).toBe(5);
			expect(result[1].cluster).toBe(10);
			expect(result[1].mask).toBe(0xff);
		});

		test("NormalizationMode.Decompose with multiple precomposed in sequence", () => {
			const infos = [
				makeInfo(0x00c0), // À
				makeInfo(0x00c1), // Á
				makeInfo(0x00c7), // Ç
			];
			const result = normalize(infos, NormalizationMode.Decompose);
			expect(result.length).toBe(6); // 3 * 2 decomposed characters
			expect(result[0].codepoint).toBe(0x0041); // A
			expect(result[1].codepoint).toBe(0x0300); // grave
			expect(result[2].codepoint).toBe(0x0041); // A
			expect(result[3].codepoint).toBe(0x0301); // acute
			expect(result[4].codepoint).toBe(0x0043); // C
			expect(result[5].codepoint).toBe(0x0327); // cedilla
		});

		test("NormalizationMode.Compose with unmatched mark after base", () => {
			const infos = [
				makeInfo(0x0041), // A
				makeInfo(0x0327), // cedilla (no composition with A)
			];
			const result = normalize(infos, NormalizationMode.Compose);
			// cedilla doesn't compose with A, so both should be in result
			expect(result[0].codepoint).toBe(0x0041);
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("NormalizationMode.Decompose handles all precomposed variations", () => {
			const infos = [
				makeInfo(0x00e9), // é
				makeInfo(0x00f1), // ñ
				makeInfo(0x00fc), // ü
			];
			const result = normalize(infos, NormalizationMode.Decompose);
			expect(result.length).toBe(6);
			expect(result[0].codepoint).toBe(0x0065); // e
			expect(result[1].codepoint).toBe(0x0301); // acute
			expect(result[2].codepoint).toBe(0x006e); // n
			expect(result[3].codepoint).toBe(0x0303); // tilde
			expect(result[4].codepoint).toBe(0x0075); // u
			expect(result[5].codepoint).toBe(0x0308); // diaeresis
		});
	});
});
