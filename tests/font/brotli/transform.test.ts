import { describe, expect, test } from "bun:test";
import { transformDictionaryWord, TRANSFORMS } from "../../../src/font/brotli/transform.ts";

describe("brotli transform", () => {
	describe("transformDictionaryWord", () => {
		test("IDENTITY transform - no prefix, suffix, or case change", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 0, dict);

			expect(len).toBe(5);
			expect(Array.from(dst.slice(0, len))).toEqual([104, 101, 108, 108, 111]);
		});

		test("IDENTITY with suffix - space", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 1, dict); // Transform 1: IDENTITY + " "

			expect(len).toBe(6);
			expect(Array.from(dst.slice(0, len))).toEqual([104, 101, 108, 108, 111, 32]);
		});

		test("prefix and suffix - space before and after", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 2, dict); // Transform 2: " " + IDENTITY + " "

			expect(len).toBe(7);
			expect(Array.from(dst.slice(0, len))).toEqual([32, 104, 101, 108, 108, 111, 32]);
		});

		test("OMIT_FIRST_1 - skip first character", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 3, dict); // Transform 3: OMIT_FIRST_1

			expect(len).toBe(4);
			expect(Array.from(dst.slice(0, len))).toEqual([101, 108, 108, 111]); // "ello"
		});

		test("UPPERCASE_FIRST - capitalize first letter", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 4, dict); // Transform 4: UPPERCASE_FIRST + " "

			expect(len).toBe(6);
			expect(Array.from(dst.slice(0, len))).toEqual([72, 101, 108, 108, 111, 32]); // "Hello "
		});

		test("UPPERCASE_FIRST with non-offset index", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 5, 0, 5, 9, dict); // Transform 9: UPPERCASE_FIRST

			expect(len).toBe(5);
			expect(Array.from(dst.slice(5, 5 + len))).toEqual([72, 101, 108, 108, 111]); // "Hello"
		});

		test("UPPERCASE_ALL - all letters uppercase", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 44, dict); // Transform 44: UPPERCASE_ALL

			expect(len).toBe(5);
			expect(Array.from(dst.slice(0, len))).toEqual([72, 69, 76, 76, 79]); // "HELLO"
		});

		test("UPPERCASE_ALL with suffix", () => {
			const dict = new Uint8Array([116, 101, 115, 116]); // "test"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 4, 68, dict); // Transform 68: UPPERCASE_ALL + " "

			expect(len).toBe(5);
			expect(Array.from(dst.slice(0, len))).toEqual([84, 69, 83, 84, 32]); // "TEST "
		});

		test("OMIT_LAST_1 - remove last character", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 12, dict); // Transform 12: OMIT_LAST_1

			expect(len).toBe(4);
			expect(Array.from(dst.slice(0, len))).toEqual([104, 101, 108, 108]); // "hell"
		});

		test("OMIT_LAST_3 - remove last 3 characters", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 23, dict); // Transform 23: OMIT_LAST_3

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([104, 101]); // "he"
		});

		test("OMIT_FIRST_2 - skip first 2 characters", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 11, dict); // Transform 11: OMIT_FIRST_2

			expect(len).toBe(3);
			expect(Array.from(dst.slice(0, len))).toEqual([108, 108, 111]); // "llo"
		});

		test("OMIT_FIRST_3 - skip first 3 characters", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 26, dict); // Transform 26: OMIT_FIRST_3

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([108, 111]); // "lo"
		});

		test("OMIT_FIRST_4", () => {
			const dict = new Uint8Array([116, 101, 115, 116, 105, 110, 103]); // "testing"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 7, 34, dict); // Transform 34: OMIT_FIRST_4

			expect(len).toBe(3);
			expect(Array.from(dst.slice(0, len))).toEqual([105, 110, 103]); // "ing"
		});

		test("OMIT_FIRST_5", () => {
			const dict = new Uint8Array([112, 114, 101, 102, 105, 120, 101, 100]); // "prefixed"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 8, 39, dict); // Transform 39: OMIT_FIRST_5

			expect(len).toBe(3);
			expect(Array.from(dst.slice(0, len))).toEqual([120, 101, 100]); // "xed"
		});

		test("OMIT_FIRST_6", () => {
			const dict = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104]); // "abcdefgh"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 8, 40, dict); // Transform 40: OMIT_FIRST_6

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([103, 104]); // "gh"
		});

		test("OMIT_FIRST_7", () => {
			const dict = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104, 105]); // "abcdefghi"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 9, 55, dict); // Transform 55: OMIT_FIRST_7

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([104, 105]); // "hi"
		});

		test("OMIT_FIRST_9", () => {
			const dict = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107]); // "abcdefghijk"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 11, 54, dict); // Transform 54: OMIT_FIRST_9

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([106, 107]); // "jk"
		});

		test("OMIT_LAST_2", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 27, dict); // Transform 27: OMIT_LAST_2

			expect(len).toBe(3);
			expect(Array.from(dst.slice(0, len))).toEqual([104, 101, 108]); // "hel"
		});

		test("OMIT_LAST_4", () => {
			const dict = new Uint8Array([116, 101, 115, 116, 105, 110, 103]); // "testing"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 7, 42, dict); // Transform 42: OMIT_LAST_4

			expect(len).toBe(3);
			expect(Array.from(dst.slice(0, len))).toEqual([116, 101, 115]); // "tes"
		});

		test("OMIT_LAST_5", () => {
			const dict = new Uint8Array([112, 114, 101, 102, 105, 120, 101, 100]); // "prefixed"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 8, 63, dict); // Transform 63: OMIT_LAST_5

			expect(len).toBe(3);
			expect(Array.from(dst.slice(0, len))).toEqual([112, 114, 101]); // "pre"
		});

		test("OMIT_LAST_6", () => {
			const dict = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104]); // "abcdefgh"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 8, 56, dict); // Transform 56: OMIT_LAST_6

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([97, 98]); // "ab"
		});

		test("OMIT_LAST_7", () => {
			const dict = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104, 105]); // "abcdefghi"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 9, 48, dict); // Transform 48: OMIT_LAST_7

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([97, 98]); // "ab"
		});

		test("OMIT_LAST_8", () => {
			const dict = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104, 105, 106]); // "abcdefghij"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 10, 59, dict); // Transform 59: OMIT_LAST_8

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([97, 98]); // "ab"
		});

		test("OMIT_LAST_9", () => {
			const dict = new Uint8Array([97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107]); // "abcdefghijk"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 11, 64, dict); // Transform 64: OMIT_LAST_9

			expect(len).toBe(2);
			expect(Array.from(dst.slice(0, len))).toEqual([97, 98]); // "ab"
		});

		test("OMIT_LAST_1 with suffix 'ing '", () => {
			const dict = new Uint8Array([116, 101, 115, 116, 115]); // "tests"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 49, dict); // Transform 49: OMIT_LAST_1 + "ing "

			expect(len).toBe(8);
			expect(Array.from(dst.slice(0, len))).toEqual([116, 101, 115, 116, 105, 110, 103, 32]); // "testing "
		});

		test("skip > len - handles case when skip exceeds word length", () => {
			const dict = new Uint8Array([104, 105]); // "hi"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 2, 40, dict); // OMIT_FIRST_6 but word is only 2 chars

			// Should skip entire word, leaving only prefix/suffix if any
			expect(len).toBe(0);
		});

		test("complex prefix and suffix - .com/", () => {
			const dict = new Uint8Array([103, 111, 111, 103, 108, 101]); // "google"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 6, 72, dict); // Transform 72: ".com/" + IDENTITY

			expect(len).toBe(11);
			expect(Array.from(dst.slice(0, len))).toEqual([46, 99, 111, 109, 47, 103, 111, 111, 103, 108, 101]); // ".com/google"
		});

		test("UTF-8 two-byte character uppercase", () => {
			// Test two-byte UTF-8 character (0xc0-0xdf range)
			const dict = new Uint8Array([0xc3, 0xa9, 0x61, 0x62]); // "éab" in UTF-8
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 4, 9, dict); // Transform 9: UPPERCASE_FIRST

			expect(len).toBe(4);
			// First char is two-byte UTF-8, second byte should be XORed with 32
			expect(dst[0]).toBe(0xc3);
			expect(dst[1]).toBe(0x89); // 0xa9 ^ 32 = 0x89
		});

		test("UTF-8 three-byte character uppercase", () => {
			// Test three-byte UTF-8 character (0xe0-0xef range)
			const dict = new Uint8Array([0xe2, 0x80, 0x99, 0x61]); // Right single quotation mark + 'a'
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 4, 9, dict); // UPPERCASE_FIRST

			expect(len).toBe(4);
			// Three-byte character, third byte should be XORed with 5
			expect(dst[0]).toBe(0xe2);
			expect(dst[1]).toBe(0x80);
			expect(dst[2]).toBe(0x9c); // 0x99 ^ 5 = 0x9c
		});

		test("UPPERCASE_ALL with multi-byte UTF-8", () => {
			const dict = new Uint8Array([0xc3, 0xa9, 0x61, 0xc3, 0xa0]); // "éaà" in UTF-8
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 44, dict); // UPPERCASE_ALL

			expect(len).toBe(5);
			// Should handle multi-byte chars
			expect(dst[0]).toBe(0xc3);
		});

		test("word at non-zero offset in dictionary", () => {
			const dict = new Uint8Array([0, 0, 0, 104, 101, 108, 108, 111]); // "hello" at offset 3
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 3, 5, 0, dict); // IDENTITY from offset 3

			expect(len).toBe(5);
			expect(Array.from(dst.slice(0, len))).toEqual([104, 101, 108, 108, 111]);
		});

		test("write to non-zero offset in destination", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 10, 0, 5, 0, dict); // Write to offset 10

			expect(len).toBe(5);
			expect(Array.from(dst.slice(10, 15))).toEqual([104, 101, 108, 108, 111]);
		});

		test("various suffix transformations", () => {
			const dict = new Uint8Array([116, 101, 115, 116]); // "test"
			const dst = new Uint8Array(30);

			// Transform with " the "
			let len = transformDictionaryWord(dst, 0, 0, 4, 5, dict);
			expect(len).toBe(9);
			expect(Array.from(dst.slice(0, len))).toEqual([116, 101, 115, 116, 32, 116, 104, 101, 32]); // "test the "

			// Transform with " of "
			len = transformDictionaryWord(dst, 0, 0, 4, 8, dict);
			expect(len).toBe(8);
			expect(Array.from(dst.slice(0, len))).toEqual([116, 101, 115, 116, 32, 111, 102, 32]); // "test of "
		});

		test("empty word after omissions", () => {
			const dict = new Uint8Array([97]); // "a"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 1, 12, dict); // OMIT_LAST_1

			expect(len).toBe(0); // Nothing left after omitting last char
		});

		test("all transforms are valid", () => {
			const dict = new Uint8Array([116, 101, 115, 116, 105, 110, 103]); // "testing"
			const dst = new Uint8Array(50);

			// Test that all 121 transforms can execute without error
			for (let i = 0; i < TRANSFORMS.length; i++) {
				const len = transformDictionaryWord(dst, 0, 0, 7, i, dict);
				expect(len).toBeGreaterThanOrEqual(0);
			}
		});

		test("prefix with space and uppercase", () => {
			const dict = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 5, 15, dict); // Transform 15: " " + UPPERCASE_FIRST + " "

			expect(len).toBe(7);
			expect(Array.from(dst.slice(0, len))).toEqual([32, 72, 101, 108, 108, 111, 32]); // " Hello "
		});

		test("ASCII lowercase character uppercase (a-z)", () => {
			const dict = new Uint8Array([97, 98, 99]); // "abc"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 3, 44, dict); // UPPERCASE_ALL

			expect(len).toBe(3);
			expect(Array.from(dst.slice(0, len))).toEqual([65, 66, 67]); // "ABC"
		});

		test("ASCII non-letter character unchanged by uppercase", () => {
			const dict = new Uint8Array([49, 50, 51]); // "123"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 3, 44, dict); // UPPERCASE_ALL

			expect(len).toBe(3);
			expect(Array.from(dst.slice(0, len))).toEqual([49, 50, 51]); // "123" unchanged
		});

		test("mixed ASCII letters and non-letters", () => {
			const dict = new Uint8Array([97, 49, 98, 50]); // "a1b2"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 4, 44, dict); // UPPERCASE_ALL

			expect(len).toBe(4);
			expect(Array.from(dst.slice(0, len))).toEqual([65, 49, 66, 50]); // "A1B2"
		});

		test("single character UTF-8 below 0xc0", () => {
			const dict = new Uint8Array([90]); // "Z"
			const dst = new Uint8Array(20);
			const len = transformDictionaryWord(dst, 0, 0, 1, 9, dict); // UPPERCASE_FIRST

			expect(len).toBe(1);
			expect(dst[0]).toBe(90); // "Z" stays "Z"
		});
	});

	describe("TRANSFORMS array", () => {
		test("has expected length", () => {
			expect(TRANSFORMS.length).toBe(121);
		});

		test("first transform is identity", () => {
			expect(TRANSFORMS[0].prefix.length).toBe(0);
			expect(TRANSFORMS[0].transform).toBe(0);
			expect(TRANSFORMS[0].suffix.length).toBe(0);
		});

		test("all transforms have valid structure", () => {
			for (let i = 0; i < TRANSFORMS.length; i++) {
				const t = TRANSFORMS[i];
				expect(t.prefix).toBeInstanceOf(Uint8Array);
				expect(t.suffix).toBeInstanceOf(Uint8Array);
				expect(typeof t.transform).toBe("number");
				expect(t.transform).toBeGreaterThanOrEqual(0);
				expect(t.transform).toBeLessThanOrEqual(20);
			}
		});
	});
});
