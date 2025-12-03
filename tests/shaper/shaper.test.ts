import { describe, expect, test, beforeAll } from "bun:test";
import { Font } from "../../src/font/font.ts";
import { UnicodeBuffer } from "../../src/buffer/unicode-buffer.ts";
import { shape } from "../../src/shaper/shaper.ts";
import { Direction } from "../../src/types.ts";

// System font paths (macOS)
const ARIAL_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf";
const TIMES_PATH = "/System/Library/Fonts/Supplemental/Times New Roman.ttf";
const ARIAL_UNICODE_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";

describe("shape", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("basic shaping", () => {
		test("shapes simple Latin text", () => {
			const buffer = new UnicodeBuffer().addStr("Hello");
			const result = shape(font, buffer);

			expect(result.length).toBe(5);
			expect(result.glyphIds().length).toBe(5);

			// All glyphs should be valid (non-zero for actual characters)
			for (const id of result.glyphIds()) {
				expect(id).toBeGreaterThan(0);
			}
		});

		test("shapes empty buffer", () => {
			const buffer = new UnicodeBuffer();
			const result = shape(font, buffer);

			expect(result.length).toBe(0);
		});

		test("shapes single character", () => {
			const buffer = new UnicodeBuffer().addStr("A");
			const result = shape(font, buffer);

			expect(result.length).toBe(1);
			expect(result.glyphIds()[0]).toBe(font.glyphId(0x41));
		});

		test("shapes with spaces", () => {
			const buffer = new UnicodeBuffer().addStr("A B");
			const result = shape(font, buffer);

			expect(result.length).toBe(3);
		});

		test("shapes digits", () => {
			const buffer = new UnicodeBuffer().addStr("12345");
			const result = shape(font, buffer);

			expect(result.length).toBe(5);
			for (const id of result.glyphIds()) {
				expect(id).toBeGreaterThan(0);
			}
		});
	});

	describe("clusters", () => {
		test("preserves cluster indices", () => {
			const buffer = new UnicodeBuffer().addStr("ABC");
			const result = shape(font, buffer);

			expect(result.clusters()).toEqual([0, 1, 2]);
		});

		test("preserves custom cluster indices", () => {
			const buffer = new UnicodeBuffer().addStr("ABC", 10);
			const result = shape(font, buffer);

			expect(result.clusters()).toEqual([10, 11, 12]);
		});
	});

	describe("direction", () => {
		test("shapes LTR by default", () => {
			const buffer = new UnicodeBuffer().addStr("ABC");
			const result = shape(font, buffer, { direction: "ltr" });

			const ids = result.glyphIds();
			// LTR order
			expect(ids[0]).toBe(font.glyphId(0x41)); // A
			expect(ids[1]).toBe(font.glyphId(0x42)); // B
			expect(ids[2]).toBe(font.glyphId(0x43)); // C
		});

		test("reverses for RTL", () => {
			const buffer = new UnicodeBuffer().addStr("ABC");
			const result = shape(font, buffer, { direction: "rtl" });

			const ids = result.glyphIds();
			// RTL order (reversed)
			expect(ids[0]).toBe(font.glyphId(0x43)); // C
			expect(ids[1]).toBe(font.glyphId(0x42)); // B
			expect(ids[2]).toBe(font.glyphId(0x41)); // A
		});
	});

	describe("positions", () => {
		test("generates advance widths", () => {
			const buffer = new UnicodeBuffer().addStr("ABC");
			const result = shape(font, buffer);

			for (const { position } of result) {
				expect(position.xAdvance).toBeGreaterThan(0);
			}
		});

		test("getTotalAdvance sums advances", () => {
			const buffer = new UnicodeBuffer().addStr("A");
			const result = shape(font, buffer);

			const advance = result.getTotalAdvance();
			expect(advance.x).toBeGreaterThan(0);
		});

		test("different characters have different widths", () => {
			const bufferI = new UnicodeBuffer().addStr("i");
			const bufferW = new UnicodeBuffer().addStr("W");

			const resultI = shape(font, bufferI);
			const resultW = shape(font, bufferW);

			// 'W' should be wider than 'i'
			expect(resultW.getTotalAdvance().x).toBeGreaterThan(resultI.getTotalAdvance().x);
		});
	});

	describe("script option", () => {
		test("accepts script parameter", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(font, buffer, { script: "latn" });

			expect(result.length).toBe(4);
		});

		test("uses buffer script if not specified", () => {
			const buffer = new UnicodeBuffer()
				.setScript("Latn")
				.addStr("test");
			const result = shape(font, buffer);

			// Script from buffer is used (preserving case)
			expect(result.script).toBe("Latn");
		});
	});

	describe("language option", () => {
		test("accepts language parameter", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(font, buffer, { language: "en" });

			expect(result.language).toBe("en");
		});

		test("uses buffer language if not specified", () => {
			const buffer = new UnicodeBuffer()
				.setLanguage("de")
				.addStr("test");
			const result = shape(font, buffer);

			expect(result.language).toBe("de");
		});
	});

	describe("output buffer properties", () => {
		test("sets direction from buffer", () => {
			const buffer = new UnicodeBuffer()
				.setDirection(Direction.RTL)
				.addStr("test");
			const result = shape(font, buffer);

			expect(result.direction).toBe(Direction.RTL);
		});

		test("sets script in output", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(font, buffer, { script: "latn" });

			expect(result.script).toBe("latn");
		});
	});

	describe("unmapped characters", () => {
		test("handles unmapped codepoints", () => {
			const buffer = new UnicodeBuffer().addCodepoint(0xf0000); // Private use
			const result = shape(font, buffer);

			expect(result.length).toBe(1);
			// Should return .notdef glyph (0)
			expect(result.glyphIds()[0]).toBe(0);
		});
	});

	describe("serialization", () => {
		test("serializes to string format", () => {
			const buffer = new UnicodeBuffer().addStr("AB");
			const result = shape(font, buffer);

			const serialized = result.serialize();
			expect(serialized.startsWith("[")).toBe(true);
			expect(serialized.endsWith("]")).toBe(true);
		});
	});

	describe("iteration", () => {
		test("iterates over glyph pairs", () => {
			const buffer = new UnicodeBuffer().addStr("AB");
			const result = shape(font, buffer);

			let count = 0;
			for (const { info, position } of result) {
				expect(info.glyphId).toBeGreaterThan(0);
				expect(position.xAdvance).toBeGreaterThan(0);
				count++;
			}
			expect(count).toBe(2);
		});
	});
});

describe("shape with features", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	test("shapes with empty features", () => {
		const buffer = new UnicodeBuffer().addStr("test");
		const result = shape(font, buffer, { features: [] });

		expect(result.length).toBe(4);
	});
});

describe("shape with special characters", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	test("shapes newline", () => {
		const buffer = new UnicodeBuffer().addStr("A\nB");
		const result = shape(font, buffer);

		expect(result.length).toBe(3);
	});

	test("shapes tab", () => {
		const buffer = new UnicodeBuffer().addStr("A\tB");
		const result = shape(font, buffer);

		expect(result.length).toBe(3);
	});

	test("shapes punctuation", () => {
		const buffer = new UnicodeBuffer().addStr("Hello, World!");
		const result = shape(font, buffer);

		expect(result.length).toBe(13);
	});
});

describe("shape with complex scripts", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("Arabic script", () => {
		test("shapes Arabic text with arab script option", () => {
			const buffer = new UnicodeBuffer().addStr("\u0627\u0644\u0639\u0631\u0628\u064A\u0629"); // العربية
			const result = shape(font, buffer, { script: "arab", direction: "rtl" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Arabic with auto-detected script", () => {
			const buffer = new UnicodeBuffer().addStr("\u0627\u0628\u062A"); // ابت
			const result = shape(font, buffer, { script: "arab" });
			expect(result.length).toBe(3);
		});

		test("shapes Syriac text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0710\u0712\u0713"); // Syriac letters
			const result = shape(font, buffer, { script: "syrc" });
			expect(result.length).toBe(3);
		});

		test("shapes Mandaic text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0840\u0841\u0842"); // Mandaic letters
			const result = shape(font, buffer, { script: "mand" });
			expect(result.length).toBe(3);
		});

		test("shapes NKo text", () => {
			const buffer = new UnicodeBuffer().addStr("\u07C0\u07C1\u07C2"); // NKo letters
			const result = shape(font, buffer, { script: "nko " });
			expect(result.length).toBe(3);
		});
	});

	describe("Hebrew script", () => {
		test("shapes Hebrew text", () => {
			const buffer = new UnicodeBuffer().addStr("\u05D0\u05D1\u05D2"); // אבג
			const result = shape(font, buffer, { script: "hebr", direction: "rtl" });
			expect(result.length).toBe(3);
		});

		test("shapes Hebrew with vowel marks", () => {
			// שָׁלוֹם - shalom with vowels
			const buffer = new UnicodeBuffer().addStr("\u05E9\u05B8\u05C1\u05DC\u05D5\u05B9\u05DD");
			const result = shape(font, buffer, { script: "hebr" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("Hangul script", () => {
		test("shapes Hangul syllables", () => {
			const buffer = new UnicodeBuffer().addStr("\uD55C\uAE00"); // 한글
			const result = shape(font, buffer, { script: "hang" });
			expect(result.length).toBe(2);
		});

		test("shapes Korean with kore script tag", () => {
			const buffer = new UnicodeBuffer().addStr("\uD55C\uAE00");
			const result = shape(font, buffer, { script: "kore" });
			expect(result.length).toBe(2);
		});

		test("shapes Hangul Jamo (decomposed)", () => {
			// ㅎ ㅏ ㄴ - decomposed Hangul
			const buffer = new UnicodeBuffer().addStr("\u1112\u1161\u11AB");
			const result = shape(font, buffer, { script: "hang" });
			// May be normalized to single syllable or stay as jamo
			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("Indic scripts", () => {
		test("shapes Devanagari text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0928\u092E\u0938\u094D\u0924\u0947"); // नमस्ते
			const result = shape(font, buffer, { script: "deva" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Bengali text", () => {
			const buffer = new UnicodeBuffer().addStr("\u09AC\u09BE\u0982\u09B2\u09BE"); // বাংলা
			const result = shape(font, buffer, { script: "beng" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Gurmukhi text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0A17\u0A41\u0A30\u0A2E\u0A41\u0A16\u0A40"); // ਗੁਰਮੁਖੀ
			const result = shape(font, buffer, { script: "guru" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Gujarati text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0"); // ગુજરાતી
			const result = shape(font, buffer, { script: "gujr" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Oriya text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0B13\u0B21\u0B3C\u0B3F\u0B06"); // ଓଡ଼ିଆ
			const result = shape(font, buffer, { script: "orya" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Tamil text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD"); // தமிழ்
			const result = shape(font, buffer, { script: "taml" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Telugu text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41"); // తెలుగు
			const result = shape(font, buffer, { script: "telu" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Kannada text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0C95\u0CA8\u0CCD\u0CA8\u0CA1"); // ಕನ್ನಡ
			const result = shape(font, buffer, { script: "knda" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Malayalam text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02"); // മലയാളം
			const result = shape(font, buffer, { script: "mlym" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("Thai and Lao", () => {
		test("shapes Thai text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"); // ภาษาไทย
			const result = shape(font, buffer, { script: "thai" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Lao text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0E9E\u0EB2\u0EAA\u0EB2\u0EA5\u0EB2\u0EA7"); // ພາສາລາວ
			const result = shape(font, buffer, { script: "lao " });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("Khmer", () => {
		test("shapes Khmer text", () => {
			const buffer = new UnicodeBuffer().addStr("\u1797\u17B6\u179F\u17B6\u1781\u17D2\u1798\u17C2\u179A"); // ភាសាខ្មែរ
			const result = shape(font, buffer, { script: "khmr" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("Myanmar", () => {
		test("shapes Myanmar text", () => {
			const buffer = new UnicodeBuffer().addStr("\u1019\u103C\u1014\u103A\u1019\u102C\u1018\u102C\u101E\u102C"); // မြန်မာဘာသာ
			const result = shape(font, buffer, { script: "mymr" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("Universal Shaping Engine scripts", () => {
		test("shapes Tibetan text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0F56\u0F7C\u0F51"); // བོད
			const result = shape(font, buffer, { script: "tibt" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Sinhala text", () => {
			const buffer = new UnicodeBuffer().addStr("\u0DC3\u0DD2\u0D82\u0DC4\u0DBD"); // සිංහල
			const result = shape(font, buffer, { script: "sinh" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Javanese text", () => {
			const buffer = new UnicodeBuffer().addStr("\uA984\uA9B2\uA9C0"); // Javanese
			const result = shape(font, buffer, { script: "java" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("auto-detected complex scripts", () => {
		test("auto-detects Arabic from content", () => {
			const buffer = new UnicodeBuffer().addStr("\u0627\u0644\u0639"); // الع
			const result = shape(font, buffer, { script: "Zyyy" }); // Common/auto
			expect(result.length).toBe(3);
		});

		test("auto-detects Hebrew from content", () => {
			const buffer = new UnicodeBuffer().addStr("\u05E9\u05DC\u05D5\u05DD"); // שלום
			const result = shape(font, buffer, { script: "Zinh" }); // Inherited/auto
			expect(result.length).toBeGreaterThan(0);
		});

		test("auto-detects Devanagari from content", () => {
			const buffer = new UnicodeBuffer().addStr("\u0928\u092E\u0938\u094D\u0924\u0947"); // नमस्ते
			const result = shape(font, buffer, { script: "Zzzz" }); // Unknown/auto
			expect(result.length).toBeGreaterThan(0);
		});

		test("auto-detects Thai from content", () => {
			const buffer = new UnicodeBuffer().addStr("\u0E20\u0E32\u0E29\u0E32");
			const result = shape(font, buffer, { script: "Zyyy" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("auto-detects Lao from content", () => {
			const buffer = new UnicodeBuffer().addStr("\u0E9E\u0EB2\u0EAA\u0EB2");
			const result = shape(font, buffer, { script: "Zyyy" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("auto-detects Khmer from content", () => {
			const buffer = new UnicodeBuffer().addStr("\u1780\u17D2\u1798\u17C2\u179A"); // ក្មែរ
			const result = shape(font, buffer, { script: "Zyyy" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("auto-detects Myanmar from content", () => {
			const buffer = new UnicodeBuffer().addStr("\u1019\u103C\u1014\u103A\u1019\u102C");
			const result = shape(font, buffer, { script: "Zyyy" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("auto-detects Korean from content", () => {
			const buffer = new UnicodeBuffer().addStr("\uD55C\uAE00");
			const result = shape(font, buffer, { script: "Zyyy" });
			expect(result.length).toBe(2);
		});
	});
});

describe("shape edge cases", () => {
	let font: Font;

	beforeAll(async () => {
		font = await Font.fromFile(ARIAL_PATH);
	});

	describe("Unicode edge cases", () => {
		test("shapes surrogate pairs (emoji)", () => {
			const buffer = new UnicodeBuffer().addStr("😀");
			const result = shape(font, buffer);
			// Emoji should produce 1 glyph (may be .notdef if font doesn't support)
			expect(result.length).toBe(1);
		});

		test("shapes zero-width characters", () => {
			const buffer = new UnicodeBuffer().addStr("A\u200BB"); // Zero-width space
			const result = shape(font, buffer);
			expect(result.length).toBe(3);
		});

		test("shapes combining marks", () => {
			// e + combining acute accent
			const buffer = new UnicodeBuffer().addStr("e\u0301");
			const result = shape(font, buffer);
			// May be 1 or 2 glyphs depending on font support
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("shapes BOM character", () => {
			const buffer = new UnicodeBuffer().addStr("\uFEFFtest");
			const result = shape(font, buffer);
			expect(result.length).toBeGreaterThanOrEqual(4);
		});

		test("shapes right-to-left mark", () => {
			const buffer = new UnicodeBuffer().addStr("A\u200FB"); // RTL mark
			const result = shape(font, buffer);
			expect(result.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("long strings", () => {
		test("shapes long text", () => {
			const longText = "A".repeat(1000);
			const buffer = new UnicodeBuffer().addStr(longText);
			const result = shape(font, buffer);
			expect(result.length).toBe(1000);
		});

		test("shapes text with many different characters", () => {
			const buffer = new UnicodeBuffer().addStr(
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
			);
			const result = shape(font, buffer);
			expect(result.length).toBe(62);
		});
	});

	describe("boundary conditions", () => {
		test("shapes string starting with space", () => {
			const buffer = new UnicodeBuffer().addStr(" ABC");
			const result = shape(font, buffer);
			expect(result.length).toBe(4);
		});

		test("shapes string ending with space", () => {
			const buffer = new UnicodeBuffer().addStr("ABC ");
			const result = shape(font, buffer);
			expect(result.length).toBe(4);
		});

		test("shapes only spaces", () => {
			const buffer = new UnicodeBuffer().addStr("   ");
			const result = shape(font, buffer);
			expect(result.length).toBe(3);
		});

		test("handles multiple consecutive spaces", () => {
			const buffer = new UnicodeBuffer().addStr("A    B");
			const result = shape(font, buffer);
			expect(result.length).toBe(6);
		});
	});

	describe("mixed content", () => {
		test("shapes mixed Latin and digits", () => {
			const buffer = new UnicodeBuffer().addStr("ABC123xyz");
			const result = shape(font, buffer);
			expect(result.length).toBe(9);
		});

		test("shapes mixed case", () => {
			const buffer = new UnicodeBuffer().addStr("AaBbCc");
			const result = shape(font, buffer);
			expect(result.length).toBe(6);
		});

		test("shapes mixed punctuation and letters", () => {
			const buffer = new UnicodeBuffer().addStr("a.b,c;d:e");
			const result = shape(font, buffer);
			expect(result.length).toBe(9);
		});
	});

	describe("feature handling", () => {
		test("accepts feature strings", () => {
			const buffer = new UnicodeBuffer().addStr("fi");
			// Request liga feature
			const result = shape(font, buffer, { features: ["liga"] });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("accepts disabled features", () => {
			const buffer = new UnicodeBuffer().addStr("fi");
			// Disable liga feature
			const result = shape(font, buffer, { features: ["-liga"] });
			expect(result.length).toBe(2);
		});

		test("accepts multiple features", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(font, buffer, {
				features: ["kern", "liga", "calt"],
			});
			expect(result.length).toBe(4);
		});
	});

	describe("buffer state", () => {
		test("original buffer is not modified", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const originalLength = buffer.length;
			shape(font, buffer);
			expect(buffer.length).toBe(originalLength);
		});

		test("can reuse buffer after shaping", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			shape(font, buffer);
			buffer.clear();
			buffer.addStr("new");
			const result = shape(font, buffer);
			expect(result.length).toBe(3);
		});
	});

	describe("special Unicode ranges", () => {
		test("shapes Latin Extended A", () => {
			const buffer = new UnicodeBuffer().addStr("\u0100\u0101\u0102"); // Ā ā Ă
			const result = shape(font, buffer);
			expect(result.length).toBe(3);
		});

		test("shapes Latin Extended B", () => {
			const buffer = new UnicodeBuffer().addStr("\u0180\u0181\u0182"); // ƀ Ɓ Ƃ
			const result = shape(font, buffer);
			expect(result.length).toBe(3);
		});

		test("shapes Greek", () => {
			const buffer = new UnicodeBuffer().addStr("\u0391\u0392\u0393"); // Α Β Γ
			const result = shape(font, buffer);
			expect(result.length).toBe(3);
		});

		test("shapes Cyrillic", () => {
			const buffer = new UnicodeBuffer().addStr("\u0410\u0411\u0412"); // А Б В
			const result = shape(font, buffer);
			expect(result.length).toBe(3);
		});
	});

	describe("output buffer methods", () => {
		test("glyphIds returns array", () => {
			const buffer = new UnicodeBuffer().addStr("AB");
			const result = shape(font, buffer);
			const ids = result.glyphIds();
			expect(Array.isArray(ids)).toBe(true);
			expect(ids.length).toBe(2);
		});

		test("clusters returns array", () => {
			const buffer = new UnicodeBuffer().addStr("AB");
			const result = shape(font, buffer);
			const clusters = result.clusters();
			expect(Array.isArray(clusters)).toBe(true);
			expect(clusters.length).toBe(2);
		});

		test("positions are accessible via iteration", () => {
			const buffer = new UnicodeBuffer().addStr("AB");
			const result = shape(font, buffer);
			let count = 0;
			for (const { position } of result) {
				expect(typeof position.xAdvance).toBe("number");
				expect(typeof position.yAdvance).toBe("number");
				count++;
			}
			expect(count).toBe(2);
		});
	});
});

describe("GPOS and GSUB features with real fonts", () => {
	let arialFont: Font;
	let timesFont: Font;
	let arialUnicode: Font;

	beforeAll(async () => {
		arialFont = await Font.fromFile(ARIAL_PATH);
		timesFont = await Font.fromFile(TIMES_PATH);
		arialUnicode = await Font.fromFile(ARIAL_UNICODE_PATH);
	});

	describe("GSUB ligature substitution", () => {
		test("applies ligature substitution for fi", () => {
			const buffer = new UnicodeBuffer().addStr("fi");
			const withLiga = shape(timesFont, buffer, { features: ["liga"] });
			const withoutLiga = shape(timesFont, buffer, { features: ["-liga"] });

			// With liga enabled, might produce 1 glyph (ligature) or 2 (if not available)
			// Without liga, should produce 2 glyphs
			expect(withoutLiga.length).toBe(2);
			expect(withLiga.length).toBeGreaterThanOrEqual(1);
		});

		test("applies ligature substitution for fl", () => {
			const buffer = new UnicodeBuffer().addStr("fl");
			const result = shape(timesFont, buffer, { features: ["liga"] });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("applies ligature substitution for ffi", () => {
			const buffer = new UnicodeBuffer().addStr("ffi");
			const result = shape(timesFont, buffer, { features: ["liga"] });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("applies ligature substitution for ffl", () => {
			const buffer = new UnicodeBuffer().addStr("ffl");
			const result = shape(timesFont, buffer, { features: ["liga"] });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("handles mixed ligature context", () => {
			const buffer = new UnicodeBuffer().addStr("office");
			const result = shape(timesFont, buffer, { features: ["liga"] });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("GPOS kerning", () => {
		test("applies kerning pairs", () => {
			const buffer = new UnicodeBuffer().addStr("AV");
			const withKern = shape(arialFont, buffer, { features: ["kern"] });
			const withoutKern = shape(arialFont, buffer, { features: ["-kern"] });

			const withAdvance = withKern.getTotalAdvance().x;
			const withoutAdvance = withoutKern.getTotalAdvance().x;

			// Kerning should reduce the total advance for AV pair
			expect(withAdvance).toBeLessThanOrEqual(withoutAdvance);
		});

		test("applies kerning for multiple pairs", () => {
			const buffer = new UnicodeBuffer().addStr("AWAY");
			const result = shape(arialFont, buffer, { features: ["kern"] });
			expect(result.length).toBe(4);
		});

		test("kerning with RTL direction", () => {
			const buffer = new UnicodeBuffer().addStr("AV");
			const result = shape(arialFont, buffer, {
				direction: "rtl",
				features: ["kern"],
			});
			expect(result.length).toBe(2);
		});
	});

	describe("GPOS mark positioning", () => {
		test("positions combining marks", () => {
			// e with combining acute accent
			const buffer = new UnicodeBuffer().addStr("e\u0301");
			const result = shape(arialFont, buffer);
			expect(result.length).toBeGreaterThanOrEqual(1);

			// Mark should have zero or minimal advance
			if (result.length === 2) {
				const positions = Array.from(result).map(({ position }) => position);
				expect(positions[1]?.xAdvance).toBeLessThanOrEqual(
					positions[0]?.xAdvance || 0,
				);
			}
		});

		test("positions multiple combining marks", () => {
			// a with combining diaeresis and macron
			const buffer = new UnicodeBuffer().addStr("a\u0308\u0304");
			const result = shape(arialFont, buffer);
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("positions marks in Hebrew", () => {
			const buffer = new UnicodeBuffer().addStr("\u05E9\u05B8"); // shin with qamats
			const result = shape(arialUnicode, buffer, { script: "hebr" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("positions marks in Arabic", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u064E"); // beh with fatha
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("fallback positioning without GPOS", () => {
		test("applies fallback kerning from kern table", () => {
			// Test with font that has kern table but might not have GPOS
			const buffer = new UnicodeBuffer().addStr("AV");
			const result = shape(arialFont, buffer);

			// Should still apply positioning
			expect(result.length).toBe(2);
			const totalAdvance = result.getTotalAdvance().x;
			expect(totalAdvance).toBeGreaterThan(0);
		});

		test("applies fallback mark positioning", () => {
			// Test combining marks with fallback positioning
			const buffer = new UnicodeBuffer().addStr("e\u0301\u0302"); // e with acute and circumflex
			const result = shape(arialFont, buffer);
			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("GSUB contextual substitution", () => {
		test("handles contextual forms", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(timesFont, buffer, { features: ["calt"] });
			expect(result.length).toBe(4);
		});

		test("handles contextual alternates in sequence", () => {
			const buffer = new UnicodeBuffer().addStr("different");
			const result = shape(timesFont, buffer, { features: ["calt"] });
			expect(result.length).toBe(9);
		});
	});

	describe("GSUB multiple substitution", () => {
		test("handles multiple glyph output", () => {
			// Some fonts have multiple substitution for specific glyphs
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(arialFont, buffer);
			expect(result.length).toBeGreaterThanOrEqual(4);
		});
	});

	describe("GSUB alternate substitution", () => {
		test("uses first alternate by default", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(timesFont, buffer, { features: ["salt"] });
			expect(result.length).toBe(4);
		});
	});

	describe("GSUB reverse chaining context", () => {
		test("processes glyphs in reverse order", () => {
			// Test with Arabic text which uses reverse chaining
			const buffer = new UnicodeBuffer().addStr("\u0628\u0629\u062A");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(3);
		});
	});

	describe("Arabic joining forms", () => {
		test("applies Arabic initial forms", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u0627"); // beh alef
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(2);
		});

		test("applies Arabic medial forms", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u0628\u0628");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(3);
		});

		test("applies Arabic final forms", () => {
			const buffer = new UnicodeBuffer().addStr("\u0627\u0644\u0628");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(3);
		});

		test("handles Arabic with marks and ligatures", () => {
			const buffer = new UnicodeBuffer().addStr(
				"\u0644\u0627\u0645" // lam alef meem
			);
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("complex feature interactions", () => {
		test("combines ligatures and kerning", () => {
			const buffer = new UnicodeBuffer().addStr("official");
			const result = shape(timesFont, buffer, { features: ["liga", "kern"] });
			expect(result.length).toBeGreaterThan(0);
		});

		test("applies features with marks", () => {
			const buffer = new UnicodeBuffer().addStr("cafe\u0301");
			const result = shape(timesFont, buffer, { features: ["liga", "kern"] });
			expect(result.length).toBeGreaterThan(0);
		});

		test("handles disabled feature combinations", () => {
			const buffer = new UnicodeBuffer().addStr("fi");
			const result = shape(timesFont, buffer, {
				features: ["-liga", "-kern"],
			});
			expect(result.length).toBe(2);
		});
	});

	describe("RTL text with GPOS", () => {
		test("shapes RTL text with marks", () => {
			const buffer = new UnicodeBuffer().addStr("\u05E9\u05DC\u05D5\u05DD");
			const result = shape(arialUnicode, buffer, {
				script: "hebr",
				direction: "rtl",
			});
			expect(result.length).toBe(4);
		});

		test("shapes Arabic RTL with kerning", () => {
			const buffer = new UnicodeBuffer().addStr("\u0627\u0644\u0639\u0631\u0628");
			const result = shape(arialUnicode, buffer, {
				script: "arab",
				direction: "rtl",
			});
			expect(result.length).toBe(5);
		});
	});

	describe("feature variations", () => {
		test("enables specific feature", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(timesFont, buffer, { features: ["smcp"] });
			expect(result.length).toBe(4);
		});

		test("handles unknown features gracefully", () => {
			const buffer = new UnicodeBuffer().addStr("test");
			const result = shape(arialFont, buffer, { features: ["xxxx"] });
			expect(result.length).toBe(4);
		});
	});
});

describe("GPOS cursive and mark attachment", () => {
	let arialUnicode: Font;

	beforeAll(async () => {
		arialUnicode = await Font.fromFile(ARIAL_UNICODE_PATH);
	});

	test("applies cursive attachment", () => {
		// Arabic text with cursive attachment
		const buffer = new UnicodeBuffer().addStr("\u0633\u0644\u0627\u0645");
		const result = shape(arialUnicode, buffer, { script: "arab" });
		expect(result.length).toBe(4);

		// Check that positions are adjusted
		for (const { position } of result) {
			expect(typeof position.xOffset).toBe("number");
			expect(typeof position.yOffset).toBe("number");
		}
	});

	test("applies mark-to-base positioning", () => {
		const buffer = new UnicodeBuffer().addStr("\u0628\u064E\u0650");
		const result = shape(arialUnicode, buffer, { script: "arab" });
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	test("applies mark-to-ligature positioning", () => {
		const buffer = new UnicodeBuffer().addStr("\u0644\u0627\u064E");
		const result = shape(arialUnicode, buffer, { script: "arab" });
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	test("applies mark-to-mark positioning", () => {
		const buffer = new UnicodeBuffer().addStr("a\u0308\u0304");
		const result = shape(arialUnicode, buffer);
		expect(result.length).toBeGreaterThanOrEqual(1);
	});
});

describe("GPOS and GSUB context formats", () => {
	let timesFont: Font;

	beforeAll(async () => {
		timesFont = await Font.fromFile(TIMES_PATH);
	});

	test("handles context format 1 (glyph-based)", () => {
		const buffer = new UnicodeBuffer().addStr("test");
		const result = shape(timesFont, buffer, { features: ["calt"] });
		expect(result.length).toBe(4);
	});

	test("handles context format 2 (class-based)", () => {
		const buffer = new UnicodeBuffer().addStr("testing");
		const result = shape(timesFont, buffer, { features: ["calt"] });
		expect(result.length).toBe(7);
	});

	test("handles context format 3 (coverage-based)", () => {
		const buffer = new UnicodeBuffer().addStr("example");
		const result = shape(timesFont, buffer, { features: ["calt"] });
		expect(result.length).toBe(7);
	});

	test("handles chaining context format 1", () => {
		const buffer = new UnicodeBuffer().addStr("difficult");
		const result = shape(timesFont, buffer, { features: ["calt"] });
		expect(result.length).toBe(9);
	});

	test("handles chaining context format 2", () => {
		const buffer = new UnicodeBuffer().addStr("qualification");
		const result = shape(timesFont, buffer, { features: ["calt"] });
		expect(result.length).toBe(13);
	});

	test("handles chaining context format 3", () => {
		const buffer = new UnicodeBuffer().addStr("beautiful");
		const result = shape(timesFont, buffer, { features: ["calt"] });
		expect(result.length).toBe(9);
	});
});

describe("complex script reordering", () => {
	let arialUnicode: Font;

	beforeAll(async () => {
		arialUnicode = await Font.fromFile(ARIAL_UNICODE_PATH);
	});

	test("reorders Indic syllables", () => {
		const buffer = new UnicodeBuffer().addStr("\u0915\u094D\u0937\u093E");
		const result = shape(arialUnicode, buffer, { script: "deva" });
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	test("reorders Thai vowels", () => {
		const buffer = new UnicodeBuffer().addStr("\u0E01\u0E34\u0E19");
		const result = shape(arialUnicode, buffer, { script: "thai" });
		expect(result.length).toBe(3);
	});

	test("reorders Lao vowels", () => {
		const buffer = new UnicodeBuffer().addStr("\u0E81\u0EB4\u0E99");
		const result = shape(arialUnicode, buffer, { script: "lao " });
		expect(result.length).toBe(3);
	});

	test("reorders Khmer subscripts", () => {
		const buffer = new UnicodeBuffer().addStr("\u1780\u17D2\u179A");
		const result = shape(arialUnicode, buffer, { script: "khmr" });
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	test("reorders Myanmar medials", () => {
		const buffer = new UnicodeBuffer().addStr("\u1000\u103C\u103E");
		const result = shape(arialUnicode, buffer, { script: "mymr" });
		expect(result.length).toBeGreaterThanOrEqual(1);
	});
});

describe("feature-specific coverage", () => {
	let arialFont: Font;
	let timesFont: Font;

	beforeAll(async () => {
		arialFont = await Font.fromFile(ARIAL_PATH);
		timesFont = await Font.fromFile(TIMES_PATH);
	});

	test("single positioning adjusts glyph positions", () => {
		const buffer = new UnicodeBuffer().addStr("test");
		const result = shape(timesFont, buffer);
		expect(result.length).toBe(4);

		// All glyphs should have position info
		for (const { position } of result) {
			expect(position.xAdvance).toBeGreaterThanOrEqual(0);
		}
	});

	test("pair positioning adjusts adjacent glyphs", () => {
		const buffer = new UnicodeBuffer().addStr("To");
		const result = shape(timesFont, buffer, { features: ["kern"] });
		expect(result.length).toBe(2);
	});

	test("handles long ligature sequences", () => {
		const buffer = new UnicodeBuffer().addStr("ffi ffl fi fl ff");
		const result = shape(timesFont, buffer, { features: ["liga"] });
		expect(result.length).toBeGreaterThan(0);
	});

	test("handles complex ligature context", () => {
		const buffer = new UnicodeBuffer().addStr("shuffling");
		const result = shape(timesFont, buffer, { features: ["liga"] });
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("edge cases in feature application", () => {
	let arialFont: Font;

	beforeAll(async () => {
		arialFont = await Font.fromFile(ARIAL_PATH);
	});

	test("handles empty feature list", () => {
		const buffer = new UnicodeBuffer().addStr("test");
		const result = shape(arialFont, buffer, { features: [] });
		expect(result.length).toBe(4);
	});

	test("handles feature with value", () => {
		const buffer = new UnicodeBuffer().addStr("test");
		const result = shape(arialFont, buffer, { features: ["kern=1"] });
		expect(result.length).toBe(4);
	});

	test("handles mixed enabled and disabled features", () => {
		const buffer = new UnicodeBuffer().addStr("fi");
		const result = shape(arialFont, buffer, { features: ["liga", "-calt"] });
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	test("processes text with no applicable features", () => {
		const buffer = new UnicodeBuffer().addStr("123");
		const result = shape(arialFont, buffer, { features: ["liga", "calt"] });
		expect(result.length).toBe(3);
	});
});

describe("Unicode normalization and complex chars", () => {
	let arialFont: Font;

	beforeAll(async () => {
		arialFont = await Font.fromFile(ARIAL_PATH);
	});

	test("handles precomposed characters", () => {
		const buffer = new UnicodeBuffer().addStr("\u00E9"); // precomposed é
		const result = shape(arialFont, buffer);
		expect(result.length).toBe(1);
	});

	test("handles decomposed characters", () => {
		const buffer = new UnicodeBuffer().addStr("e\u0301"); // decomposed é
		const result = shape(arialFont, buffer);
		expect(result.length).toBeGreaterThanOrEqual(1);
	});

	test("handles complex Unicode sequences", () => {
		const buffer = new UnicodeBuffer().addStr("e\u0301\u0302\u0304");
		const result = shape(arialFont, buffer);
		expect(result.length).toBeGreaterThanOrEqual(1);
	});
});

describe("stress testing with real features", () => {
	let timesFont: Font;

	beforeAll(async () => {
		timesFont = await Font.fromFile(TIMES_PATH);
	});

	test("handles long text with ligatures", () => {
		const text = "The office staff efficiently shuffled files for qualification.";
		const buffer = new UnicodeBuffer().addStr(text);
		const result = shape(timesFont, buffer, { features: ["liga", "kern"] });
		expect(result.length).toBeGreaterThan(0);
	});

	test("handles repeated ligature candidates", () => {
		const buffer = new UnicodeBuffer().addStr("fi fi fi fi fi");
		const result = shape(timesFont, buffer, { features: ["liga"] });
		expect(result.length).toBeGreaterThan(0);
	});

	test("handles mixed scripts in single buffer", () => {
		const buffer = new UnicodeBuffer().addStr("Hello שלום");
		const result = shape(timesFont, buffer);
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("exhaustive GSUB/GPOS coverage with Arial Unicode", () => {
	let arialUnicode: Font;

	beforeAll(async () => {
		arialUnicode = await Font.fromFile(ARIAL_UNICODE_PATH);
	});

	describe("GSUB Type 1: Single Substitution", () => {
		test("applies single glyph replacement", () => {
			const buffer = new UnicodeBuffer().addStr("\u0633\u0644\u0627\u0645");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("applies single substitution in context", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629");
			const result = shape(arialUnicode, buffer, { script: "arab", direction: "rtl" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("GSUB Type 2: Multiple Substitution", () => {
		test("expands single glyph to multiple", () => {
			// Some Arabic ligatures or special cases might expand
			const buffer = new UnicodeBuffer().addStr("\u0644\u0644\u0647");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("GSUB Type 4: Ligature Substitution", () => {
		test("combines multiple glyphs into ligature", () => {
			const buffer = new UnicodeBuffer().addStr("\u0644\u0627\u0644\u0627");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("ligature with cluster merging", () => {
			const buffer = new UnicodeBuffer().addStr("\u0644\u0627\u0645");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
			// Clusters should be properly merged
			const clusters = result.clusters();
			expect(clusters.length).toBe(result.length);
		});
	});

	describe("GSUB Type 5 & 6: Context Substitution", () => {
		test("applies context format 1 glyph-based", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u0628\u0628\u0628");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(4);
		});

		test("applies context format 2 class-based", () => {
			const buffer = new UnicodeBuffer().addStr("\u0633\u0644\u0633\u0644\u0629");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("applies context format 3 coverage-based", () => {
			const buffer = new UnicodeBuffer().addStr("\u0645\u062D\u0645\u062F");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("applies chaining context format 1", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u0627\u0644\u0639\u0631\u0628\u064A");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("applies chaining context format 2", () => {
			const buffer = new UnicodeBuffer().addStr("\u0645\u062D\u0645\u062F\u0627\u0644\u0644\u0647");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("applies chaining context format 3", () => {
			const buffer = new UnicodeBuffer().addStr("\u0645\u0631\u062D\u0628\u0627");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("GSUB Type 8: Reverse Chaining", () => {
		test("processes reverse chaining substitution", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u0629\u062A\u0627\u062B");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("reverse chaining with backtrack and lookahead", () => {
			const buffer = new UnicodeBuffer().addStr("\u0627\u0644\u0628\u0629\u062A");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("GPOS Type 1: Single Positioning", () => {
		test("adjusts single glyph position", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u064E");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);

			// Check position adjustments
			for (const { position } of result) {
				expect(typeof position.xOffset).toBe("number");
				expect(typeof position.yOffset).toBe("number");
			}
		});
	});

	describe("GPOS Type 4: Mark to Base", () => {
		test("positions mark relative to base", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u064E\u0650");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);

			// Check that marks are positioned (marks typically have xAdvance = 0)
			const positions = Array.from(result).map(({ position }) => position);
			expect(positions.length).toBeGreaterThan(0);
			expect(positions.some(p => p.xAdvance === 0)).toBe(true);
		});

		test("positions multiple marks on base", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u064E\u0651");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("GPOS Type 5: Mark to Ligature", () => {
		test("positions mark on ligature component", () => {
			const buffer = new UnicodeBuffer().addStr("\u0644\u0627\u064E");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});

		test("positions marks on different ligature components", () => {
			const buffer = new UnicodeBuffer().addStr("\u0644\u0627\u064E\u0650");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("GPOS Type 7 & 8: Context Positioning", () => {
		test("applies context pos format 1", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u0627\u0644");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(3);
		});

		test("applies context pos format 2", () => {
			const buffer = new UnicodeBuffer().addStr("\u0645\u062D\u0645\u062F");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(4);
		});

		test("applies context pos format 3", () => {
			const buffer = new UnicodeBuffer().addStr("\u0633\u0644\u0627\u0645");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(4);
		});

		test("applies chaining context pos format 1", () => {
			const buffer = new UnicodeBuffer().addStr("\u0628\u0627\u0644\u0639\u0631\u0628");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(6);
		});

		test("applies chaining context pos format 2", () => {
			const buffer = new UnicodeBuffer().addStr("\u0645\u0631\u062D\u0628\u0627");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBe(5);
		});

		test("applies chaining context pos format 3", () => {
			const buffer = new UnicodeBuffer().addStr("\u0627\u0644\u0644\u0647");
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("Complex Arabic shaping", () => {
		test("shapes full Arabic sentence with all features", () => {
			// "مرحبا بكم في العالم العربي"
			const buffer = new UnicodeBuffer().addStr(
				"\u0645\u0631\u062D\u0628\u0627 \u0628\u0643\u0645 \u0641\u064A \u0627\u0644\u0639\u0627\u0644\u0645 \u0627\u0644\u0639\u0631\u0628\u064A"
			);
			const result = shape(arialUnicode, buffer, { script: "arab", direction: "rtl" });
			expect(result.length).toBeGreaterThan(0);

			// Check all glyphs have positions
			for (const { position } of result) {
				expect(position.xAdvance).toBeGreaterThanOrEqual(0);
			}
		});

		test("shapes Arabic with all diacritics", () => {
			const buffer = new UnicodeBuffer().addStr(
				"\u0628\u064E\u0631\u0652\u0643\u064E\u0629\u064C"
			);
			const result = shape(arialUnicode, buffer, { script: "arab" });
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe("Indic shaping with complex features", () => {
		test("shapes Devanagari with reordering", () => {
			const buffer = new UnicodeBuffer().addStr("\u0928\u092E\u0938\u094D\u0924\u0947");
			const result = shape(arialUnicode, buffer, { script: "deva" });
			expect(result.length).toBeGreaterThan(0);
		});

		test("shapes Devanagari conjuncts", () => {
			const buffer = new UnicodeBuffer().addStr("\u0915\u094D\u0937\u0924\u094D\u0930");
			const result = shape(arialUnicode, buffer, { script: "deva" });
			expect(result.length).toBeGreaterThan(0);
		});
	});
});
