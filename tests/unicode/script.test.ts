import { describe, expect, test } from "bun:test";
import {
	Script,
	getScript,
	detectScript,
	getScripts,
	isScript,
	getScriptRuns,
	getScriptTag,
	isComplexScript,
	getScriptDirection,
} from "../../src/unicode/script.ts";

describe("unicode script detection", () => {
	describe("Script enum", () => {
		test("has ISO 15924 codes", () => {
			expect(Script.Latin).toBe("Latn");
			expect(Script.Greek).toBe("Grek");
			expect(Script.Cyrillic).toBe("Cyrl");
			expect(Script.Arabic).toBe("Arab");
			expect(Script.Hebrew).toBe("Hebr");
			expect(Script.Devanagari).toBe("Deva");
			expect(Script.Han).toBe("Hani");
			expect(Script.Hangul).toBe("Hang");
			expect(Script.Hiragana).toBe("Hira");
			expect(Script.Katakana).toBe("Kana");
		});

		test("has special scripts", () => {
			expect(Script.Common).toBe("Zyyy");
			expect(Script.Inherited).toBe("Zinh");
			expect(Script.Unknown).toBe("Zzzz");
		});
	});

	describe("getScript", () => {
		describe("Latin script", () => {
			test("ASCII letters are Common", () => {
				expect(getScript(0x0041)).toBe(Script.Common); // 'A'
				expect(getScript(0x005a)).toBe(Script.Common); // 'Z'
				expect(getScript(0x0061)).toBe(Script.Common); // 'a'
				expect(getScript(0x007a)).toBe(Script.Common); // 'z'
			});

			test("Latin-1 Supplement is Latin", () => {
				expect(getScript(0x00c0)).toBe(Script.Latin); // 'À'
				expect(getScript(0x00ff)).toBe(Script.Latin); // 'ÿ'
			});

			test("Latin Extended is Latin", () => {
				expect(getScript(0x0100)).toBe(Script.Latin); // 'Ā'
				expect(getScript(0x017f)).toBe(Script.Latin); // 'ſ'
			});
		});

		describe("Greek script", () => {
			test("Greek letters", () => {
				expect(getScript(0x0391)).toBe(Script.Greek); // 'Α'
				expect(getScript(0x03a9)).toBe(Script.Greek); // 'Ω'
				expect(getScript(0x03b1)).toBe(Script.Greek); // 'α'
				expect(getScript(0x03c9)).toBe(Script.Greek); // 'ω'
			});
		});

		describe("Cyrillic script", () => {
			test("Cyrillic letters", () => {
				expect(getScript(0x0410)).toBe(Script.Cyrillic); // 'А'
				expect(getScript(0x042f)).toBe(Script.Cyrillic); // 'Я'
				expect(getScript(0x0430)).toBe(Script.Cyrillic); // 'а'
				expect(getScript(0x044f)).toBe(Script.Cyrillic); // 'я'
			});
		});

		describe("Hebrew script", () => {
			test("Hebrew letters", () => {
				expect(getScript(0x05d0)).toBe(Script.Hebrew); // 'א'
				expect(getScript(0x05ea)).toBe(Script.Hebrew); // 'ת'
			});
		});

		describe("Arabic script", () => {
			test("Arabic letters", () => {
				expect(getScript(0x0627)).toBe(Script.Arabic); // 'ا'
				expect(getScript(0x0628)).toBe(Script.Arabic); // 'ب'
				expect(getScript(0x064a)).toBe(Script.Arabic); // 'ي'
			});

			test("Arabic presentation forms", () => {
				expect(getScript(0xfb50)).toBe(Script.Arabic);
				expect(getScript(0xfe70)).toBe(Script.Arabic);
			});
		});

		describe("Devanagari script", () => {
			test("Devanagari consonants", () => {
				expect(getScript(0x0915)).toBe(Script.Devanagari); // 'क'
				expect(getScript(0x0939)).toBe(Script.Devanagari); // 'ह'
			});

			test("Devanagari vowels", () => {
				expect(getScript(0x0905)).toBe(Script.Devanagari); // 'अ'
				expect(getScript(0x0914)).toBe(Script.Devanagari); // 'औ'
			});
		});

		describe("CJK scripts", () => {
			test("Han (Chinese characters)", () => {
				expect(getScript(0x4e00)).toBe(Script.Han); // '一'
				expect(getScript(0x9fff)).toBe(Script.Han);
			});

			test("Hiragana", () => {
				expect(getScript(0x3042)).toBe(Script.Hiragana); // 'あ'
				expect(getScript(0x3093)).toBe(Script.Hiragana); // 'ん'
			});

			test("Katakana", () => {
				expect(getScript(0x30a2)).toBe(Script.Katakana); // 'ア'
				expect(getScript(0x30f3)).toBe(Script.Katakana); // 'ン'
			});

			test("Hangul syllables", () => {
				expect(getScript(0xac00)).toBe(Script.Hangul); // '가'
				expect(getScript(0xd7a3)).toBe(Script.Hangul); // '힣'
			});

			test("Hangul Jamo", () => {
				expect(getScript(0x1100)).toBe(Script.Hangul); // 'ᄀ'
				expect(getScript(0x11ff)).toBe(Script.Hangul);
			});
		});

		describe("Southeast Asian scripts", () => {
			test("Thai", () => {
				expect(getScript(0x0e01)).toBe(Script.Thai); // 'ก'
				expect(getScript(0x0e30)).toBe(Script.Thai);
			});

			test("Lao", () => {
				expect(getScript(0x0e81)).toBe(Script.Lao); // 'ກ'
			});

			test("Myanmar", () => {
				expect(getScript(0x1000)).toBe(Script.Myanmar); // 'က'
			});

			test("Khmer", () => {
				expect(getScript(0x1780)).toBe(Script.Khmer); // 'ក'
			});
		});

		describe("special characters", () => {
			test("digits are Common", () => {
				expect(getScript(0x0030)).toBe(Script.Common); // '0'
				expect(getScript(0x0039)).toBe(Script.Common); // '9'
			});

			test("punctuation is Common", () => {
				expect(getScript(0x002e)).toBe(Script.Common); // '.'
				expect(getScript(0x002c)).toBe(Script.Common); // ','
			});

			test("combining marks are Inherited", () => {
				expect(getScript(0x0300)).toBe(Script.Inherited); // Combining grave
				expect(getScript(0x0301)).toBe(Script.Inherited); // Combining acute
			});

			test("Private Use Area is Unknown", () => {
				expect(getScript(0xe000)).toBe(Script.Unknown);
				expect(getScript(0xf8ff)).toBe(Script.Unknown);
			});
		});
	});

	describe("detectScript", () => {
		test("detects Latin text (extended characters)", () => {
			// Basic ASCII is Common, extended Latin is Latin
			expect(detectScript("café")).toBe(Script.Latin); // 'é' is Latin-1 Supplement
		});

		test("returns Common for ASCII-only text", () => {
			// Basic ASCII (0x00-0x7F) is Common, not Latin
			expect(detectScript("Hello World")).toBe(Script.Common);
		});

		test("detects Greek text", () => {
			expect(detectScript("Ελληνικά")).toBe(Script.Greek);
		});

		test("detects Cyrillic text", () => {
			expect(detectScript("Русский")).toBe(Script.Cyrillic);
		});

		test("detects Arabic text", () => {
			expect(detectScript("مرحبا")).toBe(Script.Arabic);
		});

		test("detects Hebrew text", () => {
			expect(detectScript("שלום")).toBe(Script.Hebrew);
		});

		test("detects Devanagari text", () => {
			expect(detectScript("नमस्ते")).toBe(Script.Devanagari);
		});

		test("detects Han text", () => {
			expect(detectScript("中文")).toBe(Script.Han);
		});

		test("detects Hangul text", () => {
			expect(detectScript("한글")).toBe(Script.Hangul);
		});

		test("detects Latin when mixed with Common", () => {
			// Latin-1 Supplement characters with ASCII
			expect(detectScript("Hëllo")).toBe(Script.Latin); // 'ë' is Latin
		});

		test("returns Common for Common-only text", () => {
			expect(detectScript("123")).toBe(Script.Common);
			expect(detectScript("...")).toBe(Script.Common);
		});

		test("returns Common for empty text", () => {
			expect(detectScript("")).toBe(Script.Common);
		});
	});

	describe("getScripts", () => {
		test("returns Common for ASCII text", () => {
			const scripts = getScripts("Hello");
			expect(scripts).toContain(Script.Common);
		});

		test("returns Latin for extended Latin text", () => {
			const scripts = getScripts("café");
			expect(scripts).toContain(Script.Latin);
			expect(scripts).toContain(Script.Common); // 'c', 'a', 'f' are Common
		});

		test("returns multiple scripts for mixed text", () => {
			const scripts = getScripts("café Привет");
			expect(scripts).toContain(Script.Latin); // 'é'
			expect(scripts).toContain(Script.Cyrillic);
			expect(scripts).toContain(Script.Common); // ASCII + space
		});

		test("returns empty array for empty text", () => {
			expect(getScripts("")).toEqual([]);
		});
	});

	describe("isScript", () => {
		test("returns true for matching script", () => {
			// ASCII is Common, so "Hello" matches any script (since Common is allowed)
			expect(isScript("Hello", Script.Common)).toBe(true);
			expect(isScript("Привет", Script.Cyrillic)).toBe(true);
		});

		test("allows Common and Inherited characters", () => {
			expect(isScript("Hello!", Script.Common)).toBe(true);
			expect(isScript("café", Script.Latin)).toBe(true); // 'é' is Latin, rest is Common
		});

		test("returns false for mismatched script", () => {
			expect(isScript("café Привет", Script.Latin)).toBe(false); // Cyrillic doesn't match
		});

		test("returns true for empty text", () => {
			expect(isScript("", Script.Latin)).toBe(true);
		});
	});

	describe("getScriptRuns", () => {
		test("returns empty for empty text", () => {
			expect(getScriptRuns("")).toEqual([]);
		});

		test("returns single run for ASCII text (Common)", () => {
			const runs = getScriptRuns("Hello");
			expect(runs.length).toBe(1);
			expect(runs[0].script).toBe(Script.Common);
			expect(runs[0].text).toBe("Hello");
			expect(runs[0].start).toBe(0);
			expect(runs[0].end).toBe(5);
		});

		test("returns multiple runs for mixed scripts", () => {
			const runs = getScriptRuns("Hello Привет");
			expect(runs.length).toBe(2);
			expect(runs[0].script).toBe(Script.Common); // ASCII is Common
			expect(runs[0].text).toBe("Hello ");
			expect(runs[1].script).toBe(Script.Cyrillic);
			expect(runs[1].text).toBe("Привет");
		});

		test("keeps Common characters in current run", () => {
			const runs = getScriptRuns("Hello, World!");
			expect(runs.length).toBe(1);
			expect(runs[0].script).toBe(Script.Common); // All ASCII is Common
		});

		test("handles Greek text mixed with ASCII", () => {
			const runs = getScriptRuns("ABCαβγ");
			expect(runs.length).toBe(2);
			expect(runs[0].script).toBe(Script.Common); // ABC
			expect(runs[1].script).toBe(Script.Greek); // αβγ
		});
	});

	describe("getScriptTag", () => {
		test("returns OpenType tags for common scripts", () => {
			expect(getScriptTag(Script.Latin)).toBe("latn");
			expect(getScriptTag(Script.Arabic)).toBe("arab");
			expect(getScriptTag(Script.Hebrew)).toBe("hebr");
			expect(getScriptTag(Script.Devanagari)).toBe("deva");
			expect(getScriptTag(Script.Thai)).toBe("thai");
			expect(getScriptTag(Script.Hangul)).toBe("hang");
			expect(getScriptTag(Script.Han)).toBe("hani");
		});

		test("returns DFLT for special scripts", () => {
			expect(getScriptTag(Script.Common)).toBe("DFLT");
			expect(getScriptTag(Script.Inherited)).toBe("DFLT");
			expect(getScriptTag(Script.Unknown)).toBe("DFLT");
		});

		test("returns kana for Japanese syllabaries", () => {
			expect(getScriptTag(Script.Hiragana)).toBe("kana");
			expect(getScriptTag(Script.Katakana)).toBe("kana");
		});
	});

	describe("isComplexScript", () => {
		test("Arabic is complex", () => {
			expect(isComplexScript(Script.Arabic)).toBe(true);
		});

		test("Hebrew is complex", () => {
			expect(isComplexScript(Script.Hebrew)).toBe(true);
		});

		test("Indic scripts are complex", () => {
			expect(isComplexScript(Script.Devanagari)).toBe(true);
			expect(isComplexScript(Script.Bengali)).toBe(true);
			expect(isComplexScript(Script.Tamil)).toBe(true);
			expect(isComplexScript(Script.Telugu)).toBe(true);
			expect(isComplexScript(Script.Malayalam)).toBe(true);
		});

		test("Southeast Asian scripts are complex", () => {
			expect(isComplexScript(Script.Thai)).toBe(true);
			expect(isComplexScript(Script.Lao)).toBe(true);
			expect(isComplexScript(Script.Myanmar)).toBe(true);
			expect(isComplexScript(Script.Khmer)).toBe(true);
		});

		test("Hangul is complex", () => {
			expect(isComplexScript(Script.Hangul)).toBe(true);
		});

		test("Latin is not complex", () => {
			expect(isComplexScript(Script.Latin)).toBe(false);
		});

		test("Greek is not complex", () => {
			expect(isComplexScript(Script.Greek)).toBe(false);
		});

		test("Cyrillic is not complex", () => {
			expect(isComplexScript(Script.Cyrillic)).toBe(false);
		});
	});

	describe("getScriptDirection", () => {
		test("Arabic is RTL", () => {
			expect(getScriptDirection(Script.Arabic)).toBe("rtl");
		});

		test("Hebrew is RTL", () => {
			expect(getScriptDirection(Script.Hebrew)).toBe("rtl");
		});

		test("Syriac is RTL", () => {
			expect(getScriptDirection(Script.Syriac)).toBe("rtl");
		});

		test("Thaana is RTL", () => {
			expect(getScriptDirection(Script.Thaana)).toBe("rtl");
		});

		test("Latin is LTR", () => {
			expect(getScriptDirection(Script.Latin)).toBe("ltr");
		});

		test("Greek is LTR", () => {
			expect(getScriptDirection(Script.Greek)).toBe("ltr");
		});

		test("Devanagari is LTR", () => {
			expect(getScriptDirection(Script.Devanagari)).toBe("ltr");
		});

		test("Thai is LTR", () => {
			expect(getScriptDirection(Script.Thai)).toBe("ltr");
		});

		test("Han is LTR", () => {
			expect(getScriptDirection(Script.Han)).toBe("ltr");
		});
	});
});
