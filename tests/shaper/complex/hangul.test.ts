import { describe, expect, test } from "bun:test";
import {
	composeHangul,
	decomposeHangul,
	getHangulSyllableType,
	HangulSyllableType,
	HangulFeatureMask,
	isHangulSyllable,
	isHangulJamo,
	isJamoL,
	isJamoV,
	isJamoT,
	isKorean,
	setupHangulMasks,
	normalizeHangul,
} from "../../../src/shaper/complex/hangul.ts";
import type { GlyphInfo } from "../../../src/types.ts";

describe("hangul shaper", () => {
	describe("syllable detection", () => {
		test("detects precomposed syllables", () => {
			expect(isHangulSyllable(0xac00)).toBe(true); // 가
			expect(isHangulSyllable(0xac01)).toBe(true); // 각
			expect(isHangulSyllable(0xd7a3)).toBe(true); // 힣
		});

		test("rejects non-syllables", () => {
			expect(isHangulSyllable(0x0041)).toBe(false); // 'A'
			expect(isHangulSyllable(0xabff)).toBe(false); // Before range
			expect(isHangulSyllable(0xd7a4)).toBe(false); // After range
		});
	});

	describe("syllable type", () => {
		test("detects LV syllable (no trailing)", () => {
			expect(getHangulSyllableType(0xac00)).toBe(HangulSyllableType.LVSyllable); // 가
			expect(getHangulSyllableType(0xac1c)).toBe(HangulSyllableType.LVSyllable); // 개
		});

		test("detects LVT syllable (with trailing)", () => {
			expect(getHangulSyllableType(0xac01)).toBe(HangulSyllableType.LVTSyllable); // 각
			expect(getHangulSyllableType(0xac02)).toBe(HangulSyllableType.LVTSyllable); // 갂
		});

		test("detects leading jamo", () => {
			expect(getHangulSyllableType(0x1100)).toBe(HangulSyllableType.LeadingJamo); // ᄀ
			expect(getHangulSyllableType(0x1112)).toBe(HangulSyllableType.LeadingJamo); // ᄒ
		});

		test("detects vowel jamo", () => {
			expect(getHangulSyllableType(0x1161)).toBe(HangulSyllableType.VowelJamo); // ᅡ
			expect(getHangulSyllableType(0x1175)).toBe(HangulSyllableType.VowelJamo); // ᅵ
		});

		test("detects trailing jamo", () => {
			expect(getHangulSyllableType(0x11a8)).toBe(HangulSyllableType.TrailingJamo); // ᆨ
			expect(getHangulSyllableType(0x11c2)).toBe(HangulSyllableType.TrailingJamo); // ᇂ
		});
	});

	describe("jamo detection", () => {
		test("isHangulJamo", () => {
			expect(isHangulJamo(0x1100)).toBe(true); // Leading
			expect(isHangulJamo(0x1161)).toBe(true); // Vowel
			expect(isHangulJamo(0x11a8)).toBe(true); // Trailing
			expect(isHangulJamo(0x0041)).toBe(false); // 'A'
		});

		test("isJamoL (leading)", () => {
			expect(isJamoL(0x1100)).toBe(true); // ᄀ
			expect(isJamoL(0x1112)).toBe(true); // ᄒ
			expect(isJamoL(0x1161)).toBe(false); // Vowel
		});

		test("isJamoV (vowel)", () => {
			expect(isJamoV(0x1161)).toBe(true); // ᅡ
			expect(isJamoV(0x1175)).toBe(true); // ᅵ
			expect(isJamoV(0x1100)).toBe(false); // Leading
		});

		test("isJamoT (trailing)", () => {
			expect(isJamoT(0x11a8)).toBe(true); // ᆨ
			expect(isJamoT(0x11c2)).toBe(true); // ᇂ
			expect(isJamoT(0x1161)).toBe(false); // Vowel
		});
	});

	describe("decomposition", () => {
		test("decomposes LV syllable", () => {
			const decomposed = decomposeHangul(0xac00); // 가
			expect(decomposed).toEqual([0x1100, 0x1161]); // ᄀ + ᅡ
		});

		test("decomposes LVT syllable", () => {
			const decomposed = decomposeHangul(0xac01); // 각
			expect(decomposed).toEqual([0x1100, 0x1161, 0x11a8]); // ᄀ + ᅡ + ᆨ
		});

		test("decomposes various syllables", () => {
			// 한 (han) = ᄒ + ᅡ + ᆫ
			const han = decomposeHangul(0xd55c);
			expect(han).toEqual([0x1112, 0x1161, 0x11ab]);

			// 글 (geul) = ᄀ + ᅳ + ᆯ
			const geul = decomposeHangul(0xae00);
			expect(geul).toEqual([0x1100, 0x1173, 0x11af]);
		});

		test("returns single-element array for non-syllables", () => {
			// Non-syllables return array containing the codepoint
			expect(decomposeHangul(0x0041)).toEqual([0x0041]); // 'A'
			expect(decomposeHangul(0x1100)).toEqual([0x1100]); // Already jamo
		});
	});

	describe("composition", () => {
		test("composes LV syllable", () => {
			expect(composeHangul(0x1100, 0x1161)).toBe(0xac00); // ᄀ + ᅡ = 가
		});

		test("composes LVT syllable", () => {
			expect(composeHangul(0x1100, 0x1161, 0x11a8)).toBe(0xac01); // ᄀ + ᅡ + ᆨ = 각
		});

		test("composes various syllables", () => {
			// 한 (han)
			expect(composeHangul(0x1112, 0x1161, 0x11ab)).toBe(0xd55c);

			// 글 (geul)
			expect(composeHangul(0x1100, 0x1173, 0x11af)).toBe(0xae00);
		});

		test("round-trips correctly", () => {
			const syllables = [0xac00, 0xac01, 0xd55c, 0xae00, 0xd7a3];
			for (const syllable of syllables) {
				const decomposed = decomposeHangul(syllable);
				if (decomposed) {
					const recomposed = decomposed.length === 2
						? composeHangul(decomposed[0], decomposed[1])
						: composeHangul(decomposed[0], decomposed[1], decomposed[2]);
					expect(recomposed).toBe(syllable);
				}
			}
		});

		test("returns null for invalid leading jamo index", () => {
			expect(composeHangul(0x10ff, 0x1161)).toBe(null); // Invalid L
		});

		test("returns null for invalid vowel jamo index", () => {
			expect(composeHangul(0x1100, 0x1160)).toBe(null); // Invalid V (before range)
			expect(composeHangul(0x1100, 0x1176)).toBe(null); // Invalid V (after range)
		});

		test("returns null for invalid trailing jamo index", () => {
			expect(composeHangul(0x1100, 0x1161, 0x11c3)).toBe(null); // Invalid T (after range)
		});
	});

	describe("isKorean", () => {
		test("identifies Hangul syllables", () => {
			expect(isKorean(0xac00)).toBe(true); // 가
			expect(isKorean(0xd7a3)).toBe(true); // 힣
		});

		test("identifies Jamo", () => {
			expect(isKorean(0x1100)).toBe(true); // Leading
			expect(isKorean(0x1161)).toBe(true); // Vowel
			expect(isKorean(0x11a8)).toBe(true); // Trailing
		});

		test("identifies compatibility Jamo", () => {
			expect(isKorean(0x3131)).toBe(true); // ㄱ
			expect(isKorean(0x318e)).toBe(true); // ㆎ
			expect(isKorean(0x314f)).toBe(true); // ㅏ
		});

		test("rejects non-Korean", () => {
			expect(isKorean(0x0041)).toBe(false); // 'A'
			expect(isKorean(0x0000)).toBe(false);
			expect(isKorean(0x4e00)).toBe(false); // CJK
		});
	});

	describe("Jamo extended ranges", () => {
		test("isHangulJamo detects Extended-A", () => {
			expect(isHangulJamo(0xa960)).toBe(true);
			expect(isHangulJamo(0xa97c)).toBe(true);
		});

		test("isHangulJamo detects Extended-B", () => {
			expect(isHangulJamo(0xd7b0)).toBe(true);
			expect(isHangulJamo(0xd7fb)).toBe(true);
		});

		test("isJamoL detects Extended-A leading jamo", () => {
			expect(isJamoL(0xa960)).toBe(true);
			expect(isJamoL(0xa97c)).toBe(true);
		});

		test("isJamoV detects Extended-B vowel jamo", () => {
			expect(isJamoV(0xd7b0)).toBe(true);
			expect(isJamoV(0xd7c6)).toBe(true);
		});

		test("isJamoT detects Extended-B trailing jamo", () => {
			expect(isJamoT(0xd7cb)).toBe(true);
			expect(isJamoT(0xd7fb)).toBe(true);
		});
	});

	describe("HangulFeatureMask", () => {
		test("has correct mask values", () => {
			expect(HangulFeatureMask.ljmo).toBe(0x0001);
			expect(HangulFeatureMask.vjmo).toBe(0x0002);
			expect(HangulFeatureMask.tjmo).toBe(0x0004);
		});
	});

	describe("setupHangulMasks", () => {
		function makeInfo(codepoint: number): GlyphInfo {
			return { glyphId: 0, cluster: 0, mask: 0, codepoint };
		}

		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			expect(() => setupHangulMasks(infos)).not.toThrow();
		});

		test("sets ljmo mask for leading jamo", () => {
			const infos = [makeInfo(0x1100)]; // ᄀ
			setupHangulMasks(infos);
			expect(infos[0]!.mask & HangulFeatureMask.ljmo).toBe(HangulFeatureMask.ljmo);
		});

		test("sets vjmo mask for vowel jamo", () => {
			const infos = [makeInfo(0x1161)]; // ᅡ
			setupHangulMasks(infos);
			expect(infos[0]!.mask & HangulFeatureMask.vjmo).toBe(HangulFeatureMask.vjmo);
		});

		test("sets tjmo mask for trailing jamo", () => {
			const infos = [makeInfo(0x11a8)]; // ᆨ
			setupHangulMasks(infos);
			expect(infos[0]!.mask & HangulFeatureMask.tjmo).toBe(HangulFeatureMask.tjmo);
		});

		test("does not set mask for precomposed syllables", () => {
			const infos = [makeInfo(0xac00)]; // 가
			setupHangulMasks(infos);
			expect(infos[0]!.mask).toBe(0);
		});

		test("handles mixed jamo sequence", () => {
			const infos = [
				makeInfo(0x1100), // Leading
				makeInfo(0x1161), // Vowel
				makeInfo(0x11a8), // Trailing
			];
			setupHangulMasks(infos);
			expect(infos[0]!.mask & HangulFeatureMask.ljmo).toBe(HangulFeatureMask.ljmo);
			expect(infos[1]!.mask & HangulFeatureMask.vjmo).toBe(HangulFeatureMask.vjmo);
			expect(infos[2]!.mask & HangulFeatureMask.tjmo).toBe(HangulFeatureMask.tjmo);
		});

		test("preserves existing mask bits", () => {
			const infos = [{ glyphId: 0, cluster: 0, mask: 0xff00, codepoint: 0x1100 }];
			setupHangulMasks(infos);
			expect(infos[0]!.mask).toBe(0xff00 | HangulFeatureMask.ljmo);
		});
	});

	describe("normalizeHangul", () => {
		function makeInfo(codepoint: number, cluster: number = 0): GlyphInfo {
			return { glyphId: 0, cluster, mask: 0, codepoint };
		}

		test("handles empty array", () => {
			const result = normalizeHangul([]);
			expect(result).toEqual([]);
		});

		test("passes through non-Hangul", () => {
			const infos = [makeInfo(0x0041), makeInfo(0x0042)];
			const result = normalizeHangul(infos);
			expect(result.length).toBe(2);
			expect(result[0]!.codepoint).toBe(0x0041);
			expect(result[1]!.codepoint).toBe(0x0042);
		});

		test("passes through precomposed syllables", () => {
			const infos = [makeInfo(0xac00), makeInfo(0xac01)];
			const result = normalizeHangul(infos);
			expect(result.length).toBe(2);
			expect(result[0]!.codepoint).toBe(0xac00);
			expect(result[1]!.codepoint).toBe(0xac01);
		});

		test("composes L + V into LV syllable", () => {
			const infos = [makeInfo(0x1100), makeInfo(0x1161)]; // ᄀ + ᅡ
			const result = normalizeHangul(infos);
			expect(result.length).toBe(1);
			expect(result[0]!.codepoint).toBe(0xac00); // 가
		});

		test("composes L + V + T into LVT syllable", () => {
			const infos = [makeInfo(0x1100), makeInfo(0x1161), makeInfo(0x11a8)]; // ᄀ + ᅡ + ᆨ
			const result = normalizeHangul(infos);
			expect(result.length).toBe(1);
			expect(result[0]!.codepoint).toBe(0xac01); // 각
		});

		test("composes LV + T into LVT syllable", () => {
			const infos = [makeInfo(0xac00), makeInfo(0x11a8)]; // 가 + ᆨ
			const result = normalizeHangul(infos);
			expect(result.length).toBe(1);
			expect(result[0]!.codepoint).toBe(0xac01); // 각
		});

		test("preserves cluster from first element", () => {
			const infos = [makeInfo(0x1100, 5), makeInfo(0x1161, 6)];
			const result = normalizeHangul(infos);
			expect(result[0]!.cluster).toBe(5);
		});

		test("handles multiple syllables", () => {
			// 한글 = ㅎ+ㅏ+ㄴ ㄱ+ㅡ+ㄹ
			const infos = [
				makeInfo(0x1112), makeInfo(0x1161), makeInfo(0x11ab), // 한
				makeInfo(0x1100), makeInfo(0x1173), makeInfo(0x11af), // 글
			];
			const result = normalizeHangul(infos);
			expect(result.length).toBe(2);
			expect(result[0]!.codepoint).toBe(0xd55c); // 한
			expect(result[1]!.codepoint).toBe(0xae00); // 글
		});

		test("handles lone leading jamo at end", () => {
			const infos = [makeInfo(0x1100)]; // Just ᄀ
			const result = normalizeHangul(infos);
			expect(result.length).toBe(1);
			expect(result[0]!.codepoint).toBe(0x1100);
		});

		test("handles L followed by non-V", () => {
			const infos = [makeInfo(0x1100), makeInfo(0x0041)]; // ᄀ + 'A'
			const result = normalizeHangul(infos);
			expect(result.length).toBe(2);
			expect(result[0]!.codepoint).toBe(0x1100);
			expect(result[1]!.codepoint).toBe(0x0041);
		});

		test("handles LV followed by non-T", () => {
			const infos = [makeInfo(0xac00), makeInfo(0x0041)]; // 가 + 'A'
			const result = normalizeHangul(infos);
			expect(result.length).toBe(2);
			expect(result[0]!.codepoint).toBe(0xac00);
			expect(result[1]!.codepoint).toBe(0x0041);
		});
	});

	describe("edge cases", () => {
		test("syllable boundaries", () => {
			// First syllable
			expect(isHangulSyllable(0xac00)).toBe(true);
			expect(isHangulSyllable(0xabff)).toBe(false);
			// Last syllable
			expect(isHangulSyllable(0xd7a3)).toBe(true);
			expect(isHangulSyllable(0xd7a4)).toBe(false);
		});

		test("jamo boundaries", () => {
			// First jamo L
			expect(isJamoL(0x1100)).toBe(true);
			expect(isJamoL(0x10ff)).toBe(false);
			// Last standard jamo L
			expect(isJamoL(0x1112)).toBe(true);
			expect(isJamoL(0x1113)).toBe(false);
			// First jamo V
			expect(isJamoV(0x1161)).toBe(true);
			expect(isJamoV(0x1160)).toBe(false);
			// Last jamo V
			expect(isJamoV(0x1175)).toBe(true);
			expect(isJamoV(0x1176)).toBe(false);
			// First jamo T (0x11a7 is "no trailing", 0x11a8 is first real one)
			expect(isJamoT(0x11a8)).toBe(true);
			expect(isJamoT(0x11a7)).toBe(false);
		});

		test("getHangulSyllableType returns NotApplicable for non-Hangul", () => {
			expect(getHangulSyllableType(0x0041)).toBe(HangulSyllableType.NotApplicable);
			expect(getHangulSyllableType(0x4e00)).toBe(HangulSyllableType.NotApplicable);
		});
	});
});
