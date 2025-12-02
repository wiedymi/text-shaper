import { test, expect, describe } from "bun:test";
import { tag, tagToString, Tags } from "./types.ts";
import { getMyanmarCategory, MyanmarCategory, isMyanmar } from "./shaper/complex/myanmar.ts";
import { getKhmerCategory, KhmerCategory, isKhmer } from "./shaper/complex/khmer.ts";
import { isHangulSyllable, composeHangul, decomposeHangul, getHangulSyllableType, HangulSyllableType } from "./shaper/complex/hangul.ts";

describe("types", () => {
	test("tag creation", () => {
		expect(tag("head")).toBe(0x68656164);
		expect(tag("GSUB")).toBe(0x47535542);
	});

	test("tag to string", () => {
		expect(tagToString(Tags.head)).toBe("head");
		expect(tagToString(Tags.GSUB)).toBe("GSUB");
	});
});

describe("myanmar shaper", () => {
	test("consonant detection", () => {
		expect(getMyanmarCategory(0x1000)).toBe(MyanmarCategory.Consonant); // က
		expect(getMyanmarCategory(0x1021)).toBe(MyanmarCategory.Consonant); // အ
	});

	test("medial detection", () => {
		expect(getMyanmarCategory(0x103b)).toBe(MyanmarCategory.Medial); // ျ
		expect(getMyanmarCategory(0x103c)).toBe(MyanmarCategory.Medial); // ြ
		expect(getMyanmarCategory(0x103d)).toBe(MyanmarCategory.Medial); // ွ
		expect(getMyanmarCategory(0x103e)).toBe(MyanmarCategory.Medial); // ှ
	});

	test("asat detection", () => {
		expect(getMyanmarCategory(0x1039)).toBe(MyanmarCategory.Asat); // ္
		expect(getMyanmarCategory(0x103a)).toBe(MyanmarCategory.Asat);
	});

	test("isMyanmar", () => {
		expect(isMyanmar(0x1000)).toBe(true);
		expect(isMyanmar(0x109f)).toBe(true);
		expect(isMyanmar(0x0041)).toBe(false); // 'A'
	});
});

describe("khmer shaper", () => {
	test("consonant detection", () => {
		expect(getKhmerCategory(0x1780)).toBe(KhmerCategory.Consonant); // ក
		expect(getKhmerCategory(0x17a2)).toBe(KhmerCategory.Consonant); // អ
	});

	test("coeng detection", () => {
		expect(getKhmerCategory(0x17d2)).toBe(KhmerCategory.Coeng); // ្
	});

	test("dependent vowel detection", () => {
		expect(getKhmerCategory(0x17b6)).toBe(KhmerCategory.DependentVowel); // ា
		expect(getKhmerCategory(0x17c1)).toBe(KhmerCategory.DependentVowel); // េ (pre-base)
	});

	test("isKhmer", () => {
		expect(isKhmer(0x1780)).toBe(true);
		expect(isKhmer(0x17ff)).toBe(true);
		expect(isKhmer(0x0041)).toBe(false); // 'A'
	});
});

describe("hangul shaper", () => {
	test("syllable detection", () => {
		expect(isHangulSyllable(0xac00)).toBe(true); // 가
		expect(isHangulSyllable(0xd7a3)).toBe(true); // 힣
		expect(isHangulSyllable(0x0041)).toBe(false); // 'A'
	});

	test("syllable type", () => {
		expect(getHangulSyllableType(0xac00)).toBe(HangulSyllableType.LVSyllable); // 가 (no T)
		expect(getHangulSyllableType(0xac01)).toBe(HangulSyllableType.LVTSyllable); // 각 (with T)
		expect(getHangulSyllableType(0x1100)).toBe(HangulSyllableType.LeadingJamo); // ᄀ
		expect(getHangulSyllableType(0x1161)).toBe(HangulSyllableType.VowelJamo); // ᅡ
		expect(getHangulSyllableType(0x11a8)).toBe(HangulSyllableType.TrailingJamo); // ᆨ
	});

	test("decomposition", () => {
		const decomposed = decomposeHangul(0xac00); // 가
		expect(decomposed).toEqual([0x1100, 0x1161]); // ᄀ + ᅡ

		const decomposedWithT = decomposeHangul(0xac01); // 각
		expect(decomposedWithT).toEqual([0x1100, 0x1161, 0x11a8]); // ᄀ + ᅡ + ᆨ
	});

	test("composition", () => {
		expect(composeHangul(0x1100, 0x1161)).toBe(0xac00); // ᄀ + ᅡ = 가
		expect(composeHangul(0x1100, 0x1161, 0x11a8)).toBe(0xac01); // ᄀ + ᅡ + ᆨ = 각
	});
});
