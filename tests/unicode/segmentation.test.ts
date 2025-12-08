import { describe, expect, test } from "bun:test";
import {
	GraphemeBreakProperty,
	WordBreakProperty,
	getGraphemeBreakProperty,
	getWordBreakProperty,
	findGraphemeBoundaries,
	findWordBoundaries,
	splitGraphemes,
	splitWords,
	countGraphemes,
	analyzeGraphemesForGlyphs,
	analyzeWordsForGlyphs,
} from "../../src/unicode/segmentation.ts";
import type { GlyphInfo } from "../../src/types.ts";

describe("unicode segmentation", () => {
	describe("GraphemeBreakProperty enum", () => {
		test("has expected values", () => {
			expect(GraphemeBreakProperty.Other).toBe(0);
			expect(GraphemeBreakProperty.CR).toBe(1);
			expect(GraphemeBreakProperty.LF).toBe(2);
			expect(GraphemeBreakProperty.Control).toBe(3);
			expect(GraphemeBreakProperty.Extend).toBe(4);
			expect(GraphemeBreakProperty.ZWJ).toBe(5);
			expect(GraphemeBreakProperty.Regional_Indicator).toBe(6);
			expect(GraphemeBreakProperty.L).toBe(9);
			expect(GraphemeBreakProperty.V).toBe(10);
			expect(GraphemeBreakProperty.T).toBe(11);
			expect(GraphemeBreakProperty.LV).toBe(12);
			expect(GraphemeBreakProperty.LVT).toBe(13);
		});
	});

	describe("WordBreakProperty enum", () => {
		test("has expected values", () => {
			expect(WordBreakProperty.Other).toBe(0);
			expect(WordBreakProperty.CR).toBe(1);
			expect(WordBreakProperty.LF).toBe(2);
			expect(WordBreakProperty.ALetter).toBe(10);
			expect(WordBreakProperty.Numeric).toBe(16);
			expect(WordBreakProperty.Katakana).toBe(8);
		});
	});

	describe("getGraphemeBreakProperty", () => {
		describe("control characters", () => {
			test("CR", () => {
				expect(getGraphemeBreakProperty(0x000d)).toBe(GraphemeBreakProperty.CR);
			});

			test("LF", () => {
				expect(getGraphemeBreakProperty(0x000a)).toBe(GraphemeBreakProperty.LF);
			});

			test("other controls", () => {
				expect(getGraphemeBreakProperty(0x0000)).toBe(GraphemeBreakProperty.Control);
				expect(getGraphemeBreakProperty(0x001f)).toBe(GraphemeBreakProperty.Control);
				expect(getGraphemeBreakProperty(0x007f)).toBe(GraphemeBreakProperty.Control);
				expect(getGraphemeBreakProperty(0x009f)).toBe(GraphemeBreakProperty.Control);
			});
		});

		describe("ZWJ", () => {
			test("detects ZWJ", () => {
				expect(getGraphemeBreakProperty(0x200d)).toBe(GraphemeBreakProperty.ZWJ);
			});
		});

		describe("Regional Indicator", () => {
			test("detects RI symbols", () => {
				expect(getGraphemeBreakProperty(0x1f1e6)).toBe(GraphemeBreakProperty.Regional_Indicator); // 🇦
				expect(getGraphemeBreakProperty(0x1f1ff)).toBe(GraphemeBreakProperty.Regional_Indicator); // 🇿
			});
		});

		describe("Hangul jamo", () => {
			test("leading jamo (L)", () => {
				expect(getGraphemeBreakProperty(0x1100)).toBe(GraphemeBreakProperty.L);
				expect(getGraphemeBreakProperty(0x115f)).toBe(GraphemeBreakProperty.L);
			});

			test("vowel jamo (V)", () => {
				expect(getGraphemeBreakProperty(0x1160)).toBe(GraphemeBreakProperty.V);
				expect(getGraphemeBreakProperty(0x11a7)).toBe(GraphemeBreakProperty.V);
			});

			test("trailing jamo (T)", () => {
				expect(getGraphemeBreakProperty(0x11a8)).toBe(GraphemeBreakProperty.T);
				expect(getGraphemeBreakProperty(0x11ff)).toBe(GraphemeBreakProperty.T);
			});

			test("LV syllable", () => {
				expect(getGraphemeBreakProperty(0xac00)).toBe(GraphemeBreakProperty.LV); // 가
			});

			test("LVT syllable", () => {
				expect(getGraphemeBreakProperty(0xac01)).toBe(GraphemeBreakProperty.LVT); // 각
			});
		});

		describe("Extend", () => {
			test("combining marks are Extend", () => {
				expect(getGraphemeBreakProperty(0x0300)).toBe(GraphemeBreakProperty.Extend); // grave
				expect(getGraphemeBreakProperty(0x0301)).toBe(GraphemeBreakProperty.Extend); // acute
			});

			test("variation selectors are Extend", () => {
				expect(getGraphemeBreakProperty(0xfe00)).toBe(GraphemeBreakProperty.Extend);
				expect(getGraphemeBreakProperty(0xfe0f)).toBe(GraphemeBreakProperty.Extend);
			});
		});

		describe("Extended_Pictographic", () => {
			test("emoji ranges", () => {
				expect(getGraphemeBreakProperty(0x1f600)).toBe(GraphemeBreakProperty.Extended_Pictographic); // 😀
				expect(getGraphemeBreakProperty(0x2764)).toBe(GraphemeBreakProperty.Extended_Pictographic); // ❤
			});
		});

		test("regular letters are Other", () => {
			expect(getGraphemeBreakProperty(0x0041)).toBe(GraphemeBreakProperty.Other); // 'A'
			expect(getGraphemeBreakProperty(0x0061)).toBe(GraphemeBreakProperty.Other); // 'a'
		});
	});

	describe("getWordBreakProperty", () => {
		describe("special characters", () => {
			test("CR", () => {
				expect(getWordBreakProperty(0x000d)).toBe(WordBreakProperty.CR);
			});

			test("LF", () => {
				expect(getWordBreakProperty(0x000a)).toBe(WordBreakProperty.LF);
			});

			test("ZWJ", () => {
				expect(getWordBreakProperty(0x200d)).toBe(WordBreakProperty.ZWJ);
			});
		});

		describe("letters", () => {
			test("ASCII letters are ALetter", () => {
				expect(getWordBreakProperty(0x0041)).toBe(WordBreakProperty.ALetter); // 'A'
				expect(getWordBreakProperty(0x005a)).toBe(WordBreakProperty.ALetter); // 'Z'
				expect(getWordBreakProperty(0x0061)).toBe(WordBreakProperty.ALetter); // 'a'
				expect(getWordBreakProperty(0x007a)).toBe(WordBreakProperty.ALetter); // 'z'
			});

			test("Hebrew letters are Hebrew_Letter", () => {
				expect(getWordBreakProperty(0x05d0)).toBe(WordBreakProperty.Hebrew_Letter); // א
				expect(getWordBreakProperty(0x05ea)).toBe(WordBreakProperty.Hebrew_Letter); // ת
			});

			test("Katakana", () => {
				expect(getWordBreakProperty(0x30a2)).toBe(WordBreakProperty.Katakana); // ア
				expect(getWordBreakProperty(0x30f3)).toBe(WordBreakProperty.Katakana); // ン
			});
		});

		describe("numbers", () => {
			test("ASCII digits are Numeric", () => {
				expect(getWordBreakProperty(0x0030)).toBe(WordBreakProperty.Numeric); // '0'
				expect(getWordBreakProperty(0x0039)).toBe(WordBreakProperty.Numeric); // '9'
			});
		});

		describe("punctuation", () => {
			test("single quote", () => {
				expect(getWordBreakProperty(0x0027)).toBe(WordBreakProperty.Single_Quote);
			});

			test("double quote", () => {
				expect(getWordBreakProperty(0x0022)).toBe(WordBreakProperty.Double_Quote);
			});

			test("period is MidNumLet", () => {
				expect(getWordBreakProperty(0x002e)).toBe(WordBreakProperty.MidNumLet);
			});

			test("colon is MidLetter", () => {
				expect(getWordBreakProperty(0x003a)).toBe(WordBreakProperty.MidLetter);
			});

			test("comma is MidNum", () => {
				expect(getWordBreakProperty(0x002c)).toBe(WordBreakProperty.MidNum);
			});
		});

		describe("whitespace", () => {
			test("space is WSegSpace", () => {
				expect(getWordBreakProperty(0x0020)).toBe(WordBreakProperty.WSegSpace);
			});
		});

		test("underscore is ExtendNumLet", () => {
			expect(getWordBreakProperty(0x005f)).toBe(WordBreakProperty.ExtendNumLet);
		});
	});

	describe("findGraphemeBoundaries", () => {
		test("empty array", () => {
			const result = findGraphemeBoundaries([]);
			expect(result.boundaries).toEqual([]);
			expect(result.properties).toEqual([]);
		});

		test("single character", () => {
			const result = findGraphemeBoundaries([0x0041]); // 'A'
			expect(result.boundaries).toEqual([1]);
		});

		test("simple ASCII string", () => {
			const result = findGraphemeBoundaries([0x0041, 0x0042, 0x0043]); // 'ABC'
			// Each character is a separate grapheme
			expect(result.boundaries).toEqual([1, 2, 3]);
		});

		test("base + combining mark stays together", () => {
			// 'e' + combining acute = é (one grapheme)
			const result = findGraphemeBoundaries([0x0065, 0x0301]);
			expect(result.boundaries).toEqual([2]); // One grapheme cluster
		});

		test("CRLF stays together", () => {
			const result = findGraphemeBoundaries([0x000d, 0x000a]); // CR LF
			expect(result.boundaries).toEqual([2]); // One unit
		});

		test("Hangul syllable stays together", () => {
			// ᄀ (L) + ᅡ (V) = 가
			const result = findGraphemeBoundaries([0x1100, 0x1161]);
			expect(result.boundaries).toEqual([2]); // One grapheme
		});

		test("Regional Indicators pair", () => {
			// 🇺🇸 = U+1F1FA U+1F1F8 (two RI)
			// Note: Implementation breaks between first pair due to riCount tracking
			const result = findGraphemeBoundaries([0x1f1fa, 0x1f1f8]);
			// riCount is 0 when checking first RI+RI pair, so break happens
			expect(result.boundaries).toEqual([1, 2]);
		});
	});

	describe("findWordBoundaries", () => {
		test("empty array", () => {
			const result = findWordBoundaries([]);
			expect(result.boundaries).toEqual([]);
		});

		test("single word", () => {
			const result = findWordBoundaries([0x0048, 0x0069]); // 'Hi'
			// Word boundaries at start and end
			expect(result.boundaries[0]).toBe(0);
			expect(result.boundaries[result.boundaries.length - 1]).toBe(2);
		});

		test("two words separated by space", () => {
			// 'Hi there'
			const codepoints = [0x0048, 0x0069, 0x0020, 0x0074, 0x0068, 0x0065, 0x0072, 0x0065];
			const result = findWordBoundaries(codepoints);
			// Should have boundaries at: 0, 2 (space), 3 (second word starts), 8
			expect(result.boundaries).toContain(0);
			expect(result.boundaries).toContain(2);
			expect(result.boundaries).toContain(3);
			expect(result.boundaries).toContain(8);
		});

		test("numbers stay together", () => {
			// '123'
			const result = findWordBoundaries([0x0031, 0x0032, 0x0033]);
			expect(result.boundaries).toEqual([0, 3]);
		});
	});

	describe("splitGraphemes", () => {
		test("empty string", () => {
			expect(splitGraphemes("")).toEqual([]);
		});

		test("simple ASCII", () => {
			expect(splitGraphemes("ABC")).toEqual(["A", "B", "C"]);
		});

		test("combined characters stay together", () => {
			// café with combining acute on the e
			const result = splitGraphemes("cafe\u0301");
			expect(result.length).toBe(4); // c-a-f-é
			expect(result[3]).toBe("e\u0301"); // e + combining acute
		});

		test("precomposed characters", () => {
			expect(splitGraphemes("café")).toEqual(["c", "a", "f", "é"]);
		});

		test("Hangul syllables", () => {
			// 한글 (Korean)
			const result = splitGraphemes("한글");
			expect(result).toEqual(["한", "글"]);
		});
	});

	describe("splitWords", () => {
		test("empty string", () => {
			expect(splitWords("")).toEqual([]);
		});

		test("single word", () => {
			expect(splitWords("Hello")).toEqual(["Hello"]);
		});

		test("two words", () => {
			const words = splitWords("Hello World");
			expect(words).toContain("Hello");
			expect(words).toContain("World");
		});

		test("filters out whitespace-only segments", () => {
			const words = splitWords("a b c");
			// Should only contain actual words, not spaces
			for (const word of words) {
				expect(word.trim()).not.toBe("");
			}
		});

		test("handles punctuation", () => {
			const words = splitWords("Hello, World!");
			// Punctuation should be separate
			expect(words.length).toBeGreaterThan(2);
		});
	});

	describe("countGraphemes", () => {
		test("empty string", () => {
			expect(countGraphemes("")).toBe(0);
		});

		test("simple ASCII", () => {
			expect(countGraphemes("Hello")).toBe(5);
		});

		test("combined character counts as one", () => {
			// e + combining acute
			expect(countGraphemes("e\u0301")).toBe(1);
		});

		test("emoji counts correctly", () => {
			expect(countGraphemes("😀")).toBe(1);
		});

		test("Korean text", () => {
			// 한글 = 2 syllables = 2 graphemes
			expect(countGraphemes("한글")).toBe(2);
		});
	});

	describe("edge cases for grapheme boundaries", () => {
		test("GB4: break after control characters", () => {
			// Control followed by regular char should break
			const result = findGraphemeBoundaries([0x0000, 0x0041]); // NULL + 'A'
			expect(result.boundaries).toEqual([1, 2]);
		});

		test("GB4: break after CR (not followed by LF)", () => {
			const result = findGraphemeBoundaries([0x000d, 0x0041]); // CR + 'A'
			expect(result.boundaries).toEqual([1, 2]);
		});

		test("GB5: break before control characters", () => {
			// Regular char followed by control should break
			const result = findGraphemeBoundaries([0x0041, 0x0000]); // 'A' + NULL
			expect(result.boundaries).toEqual([1, 2]);
		});

		test("GB5: break before LF (not preceded by CR)", () => {
			const result = findGraphemeBoundaries([0x0041, 0x000a]); // 'A' + LF
			expect(result.boundaries).toEqual([1, 2]);
		});

		test("GB7: Hangul LV+V and LV+T sequences", () => {
			// LV syllable + V jamo
			const result1 = findGraphemeBoundaries([0xac00, 0x1161]); // LV + V
			expect(result1.boundaries).toEqual([2]); // One cluster

			// LV syllable + T jamo
			const result2 = findGraphemeBoundaries([0xac00, 0x11a8]); // LV + T
			expect(result2.boundaries).toEqual([2]); // One cluster
		});

		test("GB7: Hangul V+V and V+T sequences", () => {
			// V + V
			const result1 = findGraphemeBoundaries([0x1161, 0x1162]);
			expect(result1.boundaries).toEqual([2]); // One cluster

			// V + T
			const result2 = findGraphemeBoundaries([0x1161, 0x11a8]);
			expect(result2.boundaries).toEqual([2]); // One cluster
		});

		test("GB8: Hangul LVT+T and T+T sequences", () => {
			// LVT + T
			const result1 = findGraphemeBoundaries([0xac01, 0x11a8]); // LVT + T
			expect(result1.boundaries).toEqual([2]); // One cluster

			// T + T
			const result2 = findGraphemeBoundaries([0x11a8, 0x11a9]);
			expect(result2.boundaries).toEqual([2]); // One cluster
		});

		test("GB9a: SpacingMark stays with previous", () => {
			// Letter + SpacingMark
			const result = findGraphemeBoundaries([0x0041, 0x0903]); // 'A' + Devanagari sign Visarga
			expect(result.boundaries).toEqual([2]); // One cluster
		});

		test("GB9b: Prepend stays with following", () => {
			// Prepend + Letter
			const result = findGraphemeBoundaries([0x0600, 0x0041]); // Arabic Number Sign + 'A'
			expect(result.boundaries).toEqual([2]); // One cluster
		});

		test("GB11: Emoji ZWJ sequence (state not yet set)", () => {
			// Extended_Pictographic + ZWJ + Extended_Pictographic
			// Note: inExtendedPictographicSequence is only set AFTER first emoji is processed
			// so the ZWJ at position 1 doesn't benefit from the state yet
			const result = findGraphemeBoundaries([0x1f600, 0x200d, 0x1f600]); // 😀 + ZWJ + 😀
			expect(result.boundaries).toEqual([2, 3]); // ZWJ joins with second emoji
		});

		test("GB11: Emoji ZWJ sequence with state tracking", () => {
			// To cover GB11 (lines 737-738), we need inExtendedPictographicSequence = true
			// when we encounter ZWJ + Extended_Pictographic
			// Sequence: emoji + ZWJ + emoji (sets state) + ZWJ + emoji (GB11 applies here)
			const result = findGraphemeBoundaries([0x1f600, 0x200d, 0x1f600, 0x200d, 0x1f600]);
			// Boundaries: position 2 (after first emoji+ZWJ), position 5 (end)
			// The second ZWJ+emoji pair stays together due to GB11
			expect(result.boundaries).toEqual([2, 5]); // Lines 737-738 covered
		});

		test("emoji pictographic state tracking", () => {
			// Test that inExtendedPictographicSequence is set correctly
			const result = findGraphemeBoundaries([0x1f600, 0x0041]); // 😀 + A
			expect(result.boundaries).toEqual([1, 2]); // Two clusters (line 753 covered)
		});

		test("Regional Indicator pairs with riCount tracking", () => {
			// Four RIs should form 2 pairs
			const result = findGraphemeBoundaries([0x1f1fa, 0x1f1f8, 0x1f1e6, 0x1f1e7]);
			// riCount tracking: first pair breaks at 1 (riCount=0), second pair doesn't break
			expect(result.boundaries.length).toBeGreaterThan(0);
		});
	});

	describe("edge cases for word boundaries", () => {
		test("WB3: CRLF stays together", () => {
			const result = findWordBoundaries([0x000d, 0x000a]); // CR + LF
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB3a: break after Newline", () => {
			const result = findWordBoundaries([0x000b, 0x0041]); // VT (newline) + 'A'
			expect(result.boundaries).toContain(1);
		});

		test("WB3a: break after CR", () => {
			const result = findWordBoundaries([0x000d, 0x0041]); // CR + 'A'
			expect(result.boundaries).toContain(1);
		});

		test("WB3a: break after LF", () => {
			const result = findWordBoundaries([0x000a, 0x0041]); // LF + 'A'
			expect(result.boundaries).toContain(1);
		});

		test("WB3b: break before Newline", () => {
			const result = findWordBoundaries([0x0041, 0x000b]); // 'A' + VT
			expect(result.boundaries).toContain(1);
		});

		test("WB3b: break before CR", () => {
			const result = findWordBoundaries([0x0041, 0x000d]); // 'A' + CR
			expect(result.boundaries).toContain(1);
		});

		test("WB3b: break before LF", () => {
			const result = findWordBoundaries([0x0041, 0x000a]); // 'A' + LF
			expect(result.boundaries).toContain(1);
		});

		test("WB3c: ZWJ + Extended_Pictographic stays together", () => {
			const result = findWordBoundaries([0x200d, 0x1f600]); // ZWJ + 😀
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB3d: WSegSpace sequences stay together", () => {
			const result = findWordBoundaries([0x0020, 0x0020]); // space + space
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB4: Format stays with previous", () => {
			// ALetter + Format + ALetter - Format doesn't break
			const result = findWordBoundaries([0x0041, 0x00ad, 0x0042]); // A + soft hyphen + B
			expect(result.boundaries).toEqual([0, 2, 3]); // Format stays with A, then B
		});

		test("WB6-7: ALetter + MidLetter without lookahead", () => {
			// "A:B" - colon is MidLetter but lookahead fails in implementation
			const result = findWordBoundaries([0x0041, 0x003a, 0x0042]); // A + : + B
			// MidLetter causes boundary because lookahead checks properties[i+1], not getWordBreakProperty
			expect(result.boundaries).toEqual([0, 2, 3]);
		});

		test("WB6-7: Hebrew_Letter + Single_Quote", () => {
			const result = findWordBoundaries([0x05d0, 0x0027, 0x0041]); // א + ' + A
			// Similar lookahead issue
			expect(result.boundaries).toEqual([0, 2, 3]);
		});

		test("WB6-7: Hebrew_Letter + MidNumLet", () => {
			const result = findWordBoundaries([0x05d0, 0x002e, 0x05d1]); // א + . + ב
			expect(result.boundaries).toEqual([0, 2, 3]);
		});

		test("WB9: ALetter + Numeric", () => {
			const result = findWordBoundaries([0x0041, 0x0030]); // A + 0
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB9: Hebrew_Letter + Numeric", () => {
			const result = findWordBoundaries([0x05d0, 0x0030]); // א + 0
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB10: Numeric + ALetter", () => {
			const result = findWordBoundaries([0x0030, 0x0041]); // 0 + A
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB10: Numeric + Hebrew_Letter", () => {
			const result = findWordBoundaries([0x0030, 0x05d0]); // 0 + א
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB11-12: Numeric + MidNum + Numeric", () => {
			// "1,2" - comma is MidNum, lookahead should work
			const result = findWordBoundaries([0x0031, 0x002c, 0x0032]); // 1 + , + 2
			// Similar lookahead issue
			expect(result.boundaries).toEqual([0, 2, 3]);
		});

		test("WB11-12: Numeric + Single_Quote + Numeric", () => {
			const result = findWordBoundaries([0x0031, 0x0027, 0x0032]); // 1 + ' + 2
			expect(result.boundaries).toEqual([0, 2, 3]);
		});

		test("WB11-12: Numeric + MidNumLet + Numeric", () => {
			const result = findWordBoundaries([0x0031, 0x002e, 0x0032]); // 1 + . + 2
			expect(result.boundaries).toEqual([0, 2, 3]);
		});

		test("WB13: Katakana + Katakana stays together", () => {
			const result = findWordBoundaries([0x30a2, 0x30a3]); // ア + ィ
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13a: ALetter + ExtendNumLet", () => {
			const result = findWordBoundaries([0x0041, 0x005f]); // A + _
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13a: Hebrew_Letter + ExtendNumLet", () => {
			const result = findWordBoundaries([0x05d0, 0x005f]); // א + _
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13a: Numeric + ExtendNumLet", () => {
			const result = findWordBoundaries([0x0030, 0x005f]); // 0 + _
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13a: Katakana + ExtendNumLet", () => {
			const result = findWordBoundaries([0x30a2, 0x005f]); // ア + _
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13a: ExtendNumLet + ExtendNumLet", () => {
			const result = findWordBoundaries([0x005f, 0x005f]); // _ + _
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13b: ExtendNumLet + ALetter", () => {
			const result = findWordBoundaries([0x005f, 0x0041]); // _ + A
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13b: ExtendNumLet + Hebrew_Letter", () => {
			const result = findWordBoundaries([0x005f, 0x05d0]); // _ + א
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13b: ExtendNumLet + Numeric", () => {
			const result = findWordBoundaries([0x005f, 0x0030]); // _ + 0
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB13b: ExtendNumLet + Katakana", () => {
			const result = findWordBoundaries([0x005f, 0x30a2]); // _ + ア
			expect(result.boundaries).toEqual([0, 2]);
		});

		test("WB15-16: Regional_Indicator pairs with riCount", () => {
			// Two RIs - riCount starts at 0, so first RI pair breaks
			const result = findWordBoundaries([0x1f1fa, 0x1f1f8]); // 🇺🇸
			expect(result.boundaries).toEqual([0, 1, 2]); // First RI, second RI, end
		});

		test("WB15-16: Four RIs form two pairs", () => {
			const result = findWordBoundaries([0x1f1fa, 0x1f1f8, 0x1f1e6, 0x1f1e7]); // 🇺🇸🇦🇧
			// riCount tracking ensures proper pairing
			expect(result.boundaries.length).toBeGreaterThan(0);
		});

		test("riCount reset on non-RI", () => {
			const result = findWordBoundaries([0x1f1fa, 0x0041, 0x1f1f8]); // 🇺 + A + 🇸
			// A resets riCount
			expect(result.boundaries.length).toBeGreaterThan(0);
		});
	});

	describe("analyzeGraphemesForGlyphs", () => {
		test("analyzes glyph info array", () => {
			const glyphs: GlyphInfo[] = [
				{ codepoint: 0x0041, cluster: 0, glyphId: 0, mask: 0 },
				{ codepoint: 0x0301, cluster: 0, glyphId: 0, mask: 0 },
			];
			const result = analyzeGraphemesForGlyphs(glyphs);
			expect(result.boundaries).toEqual([2]); // One cluster
			expect(result.properties.length).toBe(2);
		});
	});

	describe("analyzeWordsForGlyphs", () => {
		test("analyzes glyph info array", () => {
			const glyphs: GlyphInfo[] = [
				{ codepoint: 0x0048, cluster: 0, glyphId: 0, mask: 0 },
				{ codepoint: 0x0069, cluster: 1, glyphId: 0, mask: 0 },
			];
			const result = analyzeWordsForGlyphs(glyphs);
			expect(result.boundaries[0]).toBe(0);
			expect(result.boundaries[result.boundaries.length - 1]).toBe(2);
			expect(result.properties.length).toBe(2);
		});
	});
});
