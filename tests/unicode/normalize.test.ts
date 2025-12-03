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
		});

		describe("Indic marks", () => {
			test("Devanagari nukta has ccc 7", () => {
				expect(getCombiningClass(0x093c)).toBe(7);
			});

			test("Devanagari virama has ccc 9", () => {
				expect(getCombiningClass(0x094d)).toBe(9);
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
		});

		describe("Thai tone marks", () => {
			test("Thai tone marks have ccc 107", () => {
				expect(getCombiningClass(0x0e48)).toBe(107);
				expect(getCombiningClass(0x0e4b)).toBe(107);
			});
		});

		describe("Hangul and Kana", () => {
			test("Kana voicing marks have ccc 8", () => {
				expect(getCombiningClass(0x3099)).toBe(8);
				expect(getCombiningClass(0x309a)).toBe(8);
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
	});
});
