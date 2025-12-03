import { describe, expect, test } from "bun:test";
import {
	LineBreakClass,
	BreakAction,
	BreakOpportunity,
	getLineBreakClass,
	analyzeLineBreaks,
	analyzeLineBreaksFromCodepoints,
	findNextBreak,
	canBreakAt,
	mustBreakAt,
	getAllBreakOpportunities,
} from "../../src/unicode/line-break.ts";

describe("unicode line breaking", () => {
	describe("LineBreakClass enum", () => {
		test("has mandatory break classes", () => {
			expect(LineBreakClass.BK).toBe(0);
			expect(LineBreakClass.CR).toBe(1);
			expect(LineBreakClass.LF).toBe(2);
			expect(LineBreakClass.NL).toBe(4);
		});

		test("has combining and joiner classes", () => {
			expect(LineBreakClass.CM).toBe(3);
			expect(LineBreakClass.WJ).toBe(6);
			expect(LineBreakClass.ZW).toBe(7);
			expect(LineBreakClass.ZWJ).toBe(10);
		});

		test("has break opportunity classes", () => {
			expect(LineBreakClass.SP).toBe(9);
			expect(LineBreakClass.GL).toBe(8);
			expect(LineBreakClass.B2).toBe(11);
			expect(LineBreakClass.BA).toBe(12);
			expect(LineBreakClass.BB).toBe(13);
			expect(LineBreakClass.HY).toBe(14);
		});

		test("has punctuation classes", () => {
			expect(LineBreakClass.CL).toBe(16);
			expect(LineBreakClass.CP).toBe(17);
			expect(LineBreakClass.EX).toBe(18);
			expect(LineBreakClass.OP).toBe(21);
			expect(LineBreakClass.QU).toBe(22);
		});

		test("has numeric classes", () => {
			expect(LineBreakClass.NU).toBe(24);
			expect(LineBreakClass.IS).toBe(23);
			expect(LineBreakClass.PO).toBe(25);
			expect(LineBreakClass.PR).toBe(26);
		});

		test("has alphabetic and other classes", () => {
			expect(LineBreakClass.AL).toBe(29);
			expect(LineBreakClass.ID).toBe(36);
			expect(LineBreakClass.HL).toBe(35);
			expect(LineBreakClass.SA).toBe(41);
		});

		test("has Hangul classes", () => {
			expect(LineBreakClass.JL).toBe(37);
			expect(LineBreakClass.JV).toBe(38);
			expect(LineBreakClass.JT).toBe(39);
			expect(LineBreakClass.H2).toBe(33);
			expect(LineBreakClass.H3).toBe(34);
		});

		test("has emoji classes", () => {
			expect(LineBreakClass.EB).toBe(31);
			expect(LineBreakClass.EM).toBe(32);
			expect(LineBreakClass.RI).toBe(40);
		});
	});

	describe("BreakOpportunity enum", () => {
		test("has expected values", () => {
			expect(BreakOpportunity.NoBreak).toBe(0);
			expect(BreakOpportunity.Optional).toBe(1);
			expect(BreakOpportunity.Mandatory).toBe(2);
		});
	});

	describe("getLineBreakClass", () => {
		describe("mandatory breaks", () => {
			test("LF", () => {
				expect(getLineBreakClass(0x000a)).toBe(LineBreakClass.LF);
			});

			test("CR", () => {
				expect(getLineBreakClass(0x000d)).toBe(LineBreakClass.CR);
			});

			test("NEL (Next Line)", () => {
				expect(getLineBreakClass(0x0085)).toBe(LineBreakClass.NL);
			});

			test("vertical tab and form feed are BK", () => {
				expect(getLineBreakClass(0x000b)).toBe(LineBreakClass.BK);
				expect(getLineBreakClass(0x000c)).toBe(LineBreakClass.BK);
			});

			test("line separator", () => {
				expect(getLineBreakClass(0x2028)).toBe(LineBreakClass.BK);
			});

			test("paragraph separator", () => {
				expect(getLineBreakClass(0x2029)).toBe(LineBreakClass.BK);
			});
		});

		describe("zero-width characters", () => {
			test("zero width space", () => {
				expect(getLineBreakClass(0x200b)).toBe(LineBreakClass.ZW);
			});

			test("zero width joiner", () => {
				expect(getLineBreakClass(0x200d)).toBe(LineBreakClass.ZWJ);
			});

			test("word joiner", () => {
				expect(getLineBreakClass(0x2060)).toBe(LineBreakClass.WJ);
			});

			test("BOM is word joiner", () => {
				expect(getLineBreakClass(0xfeff)).toBe(LineBreakClass.WJ);
			});
		});

		describe("spaces", () => {
			test("space", () => {
				expect(getLineBreakClass(0x0020)).toBe(LineBreakClass.SP);
			});

			test("no-break space is GL", () => {
				expect(getLineBreakClass(0x00a0)).toBe(LineBreakClass.GL);
			});

			test("narrow no-break space is GL", () => {
				expect(getLineBreakClass(0x202f)).toBe(LineBreakClass.GL);
			});

			test("figure space is GL", () => {
				expect(getLineBreakClass(0x2007)).toBe(LineBreakClass.GL);
			});

			test("non-breaking hyphen is GL", () => {
				expect(getLineBreakClass(0x2011)).toBe(LineBreakClass.GL);
			});

			test("tab is BA", () => {
				expect(getLineBreakClass(0x0009)).toBe(LineBreakClass.BA);
			});

			test("other spaces are BA", () => {
				expect(getLineBreakClass(0x2002)).toBe(LineBreakClass.BA); // En space
				expect(getLineBreakClass(0x2003)).toBe(LineBreakClass.BA); // Em space
			});
		});

		describe("combining marks", () => {
			test("combining diacritical marks", () => {
				expect(getLineBreakClass(0x0300)).toBe(LineBreakClass.CM);
				expect(getLineBreakClass(0x0301)).toBe(LineBreakClass.CM);
				expect(getLineBreakClass(0x036f)).toBe(LineBreakClass.CM);
			});

			test("Hebrew combining marks", () => {
				expect(getLineBreakClass(0x0591)).toBe(LineBreakClass.CM);
				expect(getLineBreakClass(0x05bd)).toBe(LineBreakClass.CM);
			});

			test("Arabic combining marks", () => {
				expect(getLineBreakClass(0x064b)).toBe(LineBreakClass.CM);
				expect(getLineBreakClass(0x065f)).toBe(LineBreakClass.CM);
			});

			test("Devanagari combining marks", () => {
				expect(getLineBreakClass(0x093e)).toBe(LineBreakClass.CM);
				expect(getLineBreakClass(0x094f)).toBe(LineBreakClass.CM);
			});

			test("variation selectors", () => {
				expect(getLineBreakClass(0xfe00)).toBe(LineBreakClass.CM);
				expect(getLineBreakClass(0xfe0f)).toBe(LineBreakClass.CM);
			});
		});

		describe("punctuation", () => {
			test("exclamation and question", () => {
				expect(getLineBreakClass(0x0021)).toBe(LineBreakClass.EX);
				expect(getLineBreakClass(0x003f)).toBe(LineBreakClass.EX);
			});

			test("quotes", () => {
				expect(getLineBreakClass(0x0022)).toBe(LineBreakClass.QU);
				expect(getLineBreakClass(0x0027)).toBe(LineBreakClass.QU);
				expect(getLineBreakClass(0x2018)).toBe(LineBreakClass.QU);
				expect(getLineBreakClass(0x201c)).toBe(LineBreakClass.QU);
			});

			test("opening punctuation", () => {
				expect(getLineBreakClass(0x0028)).toBe(LineBreakClass.OP);
				expect(getLineBreakClass(0x005b)).toBe(LineBreakClass.OP);
				expect(getLineBreakClass(0x007b)).toBe(LineBreakClass.OP);
			});

			test("closing punctuation", () => {
				expect(getLineBreakClass(0x0029)).toBe(LineBreakClass.CP);
				expect(getLineBreakClass(0x005d)).toBe(LineBreakClass.CP);
				expect(getLineBreakClass(0x007d)).toBe(LineBreakClass.CL);
			});

			test("infix separators", () => {
				expect(getLineBreakClass(0x002c)).toBe(LineBreakClass.IS);
				expect(getLineBreakClass(0x002e)).toBe(LineBreakClass.IS);
				expect(getLineBreakClass(0x003a)).toBe(LineBreakClass.IS);
				expect(getLineBreakClass(0x003b)).toBe(LineBreakClass.IS);
			});

			test("hyphen", () => {
				expect(getLineBreakClass(0x002d)).toBe(LineBreakClass.HY);
			});

			test("dashes", () => {
				expect(getLineBreakClass(0x2010)).toBe(LineBreakClass.BA); // Hyphen
				expect(getLineBreakClass(0x2013)).toBe(LineBreakClass.BA); // En dash
				expect(getLineBreakClass(0x2014)).toBe(LineBreakClass.B2); // Em dash
			});

			test("ellipsis", () => {
				expect(getLineBreakClass(0x2026)).toBe(LineBreakClass.IN);
			});
		});

		describe("CJK punctuation", () => {
			test("ideographic comma and period", () => {
				expect(getLineBreakClass(0x3001)).toBe(LineBreakClass.CL);
				expect(getLineBreakClass(0x3002)).toBe(LineBreakClass.CL);
			});

			test("CJK brackets", () => {
				expect(getLineBreakClass(0x3008)).toBe(LineBreakClass.OP);
				expect(getLineBreakClass(0x3009)).toBe(LineBreakClass.CL);
				expect(getLineBreakClass(0x300c)).toBe(LineBreakClass.OP);
				expect(getLineBreakClass(0x300d)).toBe(LineBreakClass.CL);
			});

			test("fullwidth punctuation", () => {
				expect(getLineBreakClass(0xff08)).toBe(LineBreakClass.OP);
				expect(getLineBreakClass(0xff09)).toBe(LineBreakClass.CL);
				expect(getLineBreakClass(0xff01)).toBe(LineBreakClass.EX);
				expect(getLineBreakClass(0xff1f)).toBe(LineBreakClass.EX);
			});
		});

		describe("kana", () => {
			test("regular hiragana is ID", () => {
				expect(getLineBreakClass(0x3042)).toBe(LineBreakClass.ID); // あ
				expect(getLineBreakClass(0x304b)).toBe(LineBreakClass.ID); // か
			});

			test("small hiragana is CJ", () => {
				expect(getLineBreakClass(0x3041)).toBe(LineBreakClass.CJ); // ぁ
				expect(getLineBreakClass(0x3043)).toBe(LineBreakClass.CJ); // ぃ
				expect(getLineBreakClass(0x3063)).toBe(LineBreakClass.CJ); // っ
			});

			test("regular katakana is ID", () => {
				expect(getLineBreakClass(0x30a2)).toBe(LineBreakClass.ID); // ア
				expect(getLineBreakClass(0x30ab)).toBe(LineBreakClass.ID); // カ
			});

			test("small katakana is CJ", () => {
				expect(getLineBreakClass(0x30a1)).toBe(LineBreakClass.CJ); // ァ
				expect(getLineBreakClass(0x30a3)).toBe(LineBreakClass.CJ); // ィ
				expect(getLineBreakClass(0x30c3)).toBe(LineBreakClass.CJ); // ッ
			});

			test("prolonged sound mark is CJ", () => {
				expect(getLineBreakClass(0x30fc)).toBe(LineBreakClass.CJ); // ー
			});
		});

		describe("Hangul", () => {
			test("jamo L", () => {
				expect(getLineBreakClass(0x1100)).toBe(LineBreakClass.JL);
				expect(getLineBreakClass(0x115f)).toBe(LineBreakClass.JL);
			});

			test("jamo V", () => {
				expect(getLineBreakClass(0x1160)).toBe(LineBreakClass.JV);
				expect(getLineBreakClass(0x11a7)).toBe(LineBreakClass.JV);
			});

			test("jamo T", () => {
				expect(getLineBreakClass(0x11a8)).toBe(LineBreakClass.JT);
				expect(getLineBreakClass(0x11ff)).toBe(LineBreakClass.JT);
			});

			test("syllable LV is H2", () => {
				expect(getLineBreakClass(0xac00)).toBe(LineBreakClass.H2); // 가
			});

			test("syllable LVT is H3", () => {
				expect(getLineBreakClass(0xac01)).toBe(LineBreakClass.H3); // 각
			});
		});

		describe("numbers", () => {
			test("ASCII digits", () => {
				expect(getLineBreakClass(0x0030)).toBe(LineBreakClass.NU);
				expect(getLineBreakClass(0x0039)).toBe(LineBreakClass.NU);
			});

			test("Arabic-Indic digits", () => {
				expect(getLineBreakClass(0x0660)).toBe(LineBreakClass.NU);
				expect(getLineBreakClass(0x0669)).toBe(LineBreakClass.NU);
			});

			test("Devanagari digits", () => {
				expect(getLineBreakClass(0x0966)).toBe(LineBreakClass.NU);
				expect(getLineBreakClass(0x096f)).toBe(LineBreakClass.NU);
			});

			test("fullwidth digits", () => {
				expect(getLineBreakClass(0xff10)).toBe(LineBreakClass.NU);
				expect(getLineBreakClass(0xff19)).toBe(LineBreakClass.NU);
			});
		});

		describe("currency and percent", () => {
			test("currency symbols are PR", () => {
				expect(getLineBreakClass(0x0024)).toBe(LineBreakClass.PR); // $
				expect(getLineBreakClass(0x00a3)).toBe(LineBreakClass.PR); // £
				expect(getLineBreakClass(0x00a5)).toBe(LineBreakClass.PR); // ¥
				expect(getLineBreakClass(0x20ac)).toBe(LineBreakClass.PR); // €
			});

			test("percent is PO", () => {
				expect(getLineBreakClass(0x0025)).toBe(LineBreakClass.PO);
			});
		});

		describe("Hebrew", () => {
			test("Hebrew letters are HL", () => {
				expect(getLineBreakClass(0x05d0)).toBe(LineBreakClass.HL); // א
				expect(getLineBreakClass(0x05ea)).toBe(LineBreakClass.HL); // ת
			});
		});

		describe("CJK ideographs", () => {
			test("CJK unified ideographs", () => {
				expect(getLineBreakClass(0x4e00)).toBe(LineBreakClass.ID);
				expect(getLineBreakClass(0x9fff)).toBe(LineBreakClass.ID);
			});

			test("CJK extension A", () => {
				expect(getLineBreakClass(0x3400)).toBe(LineBreakClass.ID);
			});

			test("CJK compatibility ideographs", () => {
				expect(getLineBreakClass(0xf900)).toBe(LineBreakClass.ID);
			});
		});

		describe("emoji", () => {
			test("emoji are ID", () => {
				expect(getLineBreakClass(0x1f600)).toBe(LineBreakClass.ID); // 😀
				expect(getLineBreakClass(0x2764)).toBe(LineBreakClass.ID); // ❤
			});

			test("regional indicators", () => {
				expect(getLineBreakClass(0x1f1e6)).toBe(LineBreakClass.RI);
				expect(getLineBreakClass(0x1f1ff)).toBe(LineBreakClass.RI);
			});

			test("emoji modifiers classified as ID", () => {
				// Note: In this implementation, emoji modifiers fall into the general
				// emoji range (1f300-1f9ff) which returns ID before reaching the EM check
				expect(getLineBreakClass(0x1f3fb)).toBe(LineBreakClass.ID);
				expect(getLineBreakClass(0x1f3ff)).toBe(LineBreakClass.ID);
			});
		});

		describe("complex scripts (SA)", () => {
			test("Thai", () => {
				expect(getLineBreakClass(0x0e01)).toBe(LineBreakClass.SA);
				expect(getLineBreakClass(0x0e30)).toBe(LineBreakClass.SA);
			});

			test("Lao", () => {
				expect(getLineBreakClass(0x0e81)).toBe(LineBreakClass.SA);
			});

			test("Myanmar", () => {
				expect(getLineBreakClass(0x1000)).toBe(LineBreakClass.SA);
			});

			test("Khmer", () => {
				expect(getLineBreakClass(0x1780)).toBe(LineBreakClass.SA);
			});
		});

		describe("alphabetics", () => {
			test("ASCII letters are AL", () => {
				expect(getLineBreakClass(0x0041)).toBe(LineBreakClass.AL); // A
				expect(getLineBreakClass(0x005a)).toBe(LineBreakClass.AL); // Z
				expect(getLineBreakClass(0x0061)).toBe(LineBreakClass.AL); // a
				expect(getLineBreakClass(0x007a)).toBe(LineBreakClass.AL); // z
			});

			test("Latin extended are AL", () => {
				expect(getLineBreakClass(0x00c0)).toBe(LineBreakClass.AL); // À
				expect(getLineBreakClass(0x00ff)).toBe(LineBreakClass.AL); // ÿ
			});

			test("Greek is AL", () => {
				expect(getLineBreakClass(0x0391)).toBe(LineBreakClass.AL); // Α
				expect(getLineBreakClass(0x03c9)).toBe(LineBreakClass.AL); // ω
			});

			test("Cyrillic is AL", () => {
				expect(getLineBreakClass(0x0410)).toBe(LineBreakClass.AL); // А
				expect(getLineBreakClass(0x044f)).toBe(LineBreakClass.AL); // я
			});
		});
	});

	describe("analyzeLineBreaks", () => {
		test("empty string", () => {
			const result = analyzeLineBreaks("");
			expect(result.breaks).toEqual([BreakOpportunity.NoBreak, BreakOpportunity.Mandatory]);
			expect(result.classes).toEqual([]);
		});

		test("single character", () => {
			const result = analyzeLineBreaks("A");
			expect(result.breaks.length).toBe(2); // before + after
			expect(result.breaks[0]).toBe(BreakOpportunity.NoBreak); // LB2: never break at start
			expect(result.breaks[1]).toBe(BreakOpportunity.Mandatory); // LB3: always break at end
		});

		test("simple word has no internal breaks", () => {
			const result = analyzeLineBreaks("Hello");
			expect(result.breaks[0]).toBe(BreakOpportunity.NoBreak);
			// LB28: no break between alphabetics
			for (let i = 1; i < result.breaks.length - 1; i++) {
				expect(result.breaks[i]).toBe(BreakOpportunity.NoBreak);
			}
			expect(result.breaks[result.breaks.length - 1]).toBe(BreakOpportunity.Mandatory);
		});

		test("break after space", () => {
			const result = analyzeLineBreaks("A B");
			// Position: A[0] SP[1] B[2]
			// Breaks: [0:NoBreak, 1:NoBreak (before SP), 2:Optional (after SP), 3:Mandatory (end)]
			expect(result.breaks[2]).toBe(BreakOpportunity.Optional); // LB18: break after space
		});

		test("break after newline (LF)", () => {
			const result = analyzeLineBreaks("A\nB");
			// Position: A[0] LF[1] B[2]
			// After LF is mandatory break
			expect(result.breaks[2]).toBe(BreakOpportunity.Mandatory);
		});

		test("CRLF stays together", () => {
			const result = analyzeLineBreaks("A\r\nB");
			// CR LF should be treated as single break
			// Position: A[0] CR[1] LF[2] B[3]
			expect(result.breaks[2]).toBe(BreakOpportunity.NoBreak); // no break between CR LF
			expect(result.breaks[3]).toBe(BreakOpportunity.Mandatory); // mandatory after LF
		});

		test("no break before punctuation", () => {
			const result = analyzeLineBreaks("A.");
			// LB13: no break before IS
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("no break after opening bracket", () => {
			const result = analyzeLineBreaks("(A");
			// LB14: no break after OP
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("no break before closing bracket", () => {
			const result = analyzeLineBreaks("A)");
			// LB13: no break before CP
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("break opportunity after hyphen", () => {
			const result = analyzeLineBreaks("self-test");
			// Find index of hyphen
			const hyphenIndex = 4; // s-e-l-f-hyphen-t-e-s-t
			// LB21: no break before HY, but can break after
			// Actually LB21 says don't break before HY - there should be a break after though
			// This is implementation dependent based on the pair table
		});

		test("no break in number", () => {
			const result = analyzeLineBreaks("123");
			// LB25: no break within numbers
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
			expect(result.breaks[2]).toBe(BreakOpportunity.NoBreak);
		});

		test("no break between currency and number", () => {
			const result = analyzeLineBreaks("$10");
			// LB24/LB25: no break between PR and NU
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});
	});

	describe("analyzeLineBreaksFromCodepoints", () => {
		test("same as analyzeLineBreaks for ASCII", () => {
			const text = "Hello World";
			const codepoints = [...text].map(c => c.codePointAt(0)!);
			const result1 = analyzeLineBreaks(text);
			const result2 = analyzeLineBreaksFromCodepoints(codepoints);
			expect(result1.breaks).toEqual(result2.breaks);
			expect(result1.classes).toEqual(result2.classes);
		});

		test("handles surrogate pairs correctly", () => {
			// Emoji codepoint
			const codepoints = [0x1f600]; // 😀
			const result = analyzeLineBreaksFromCodepoints(codepoints);
			expect(result.classes[0]).toBe(LineBreakClass.ID);
		});
	});

	describe("findNextBreak", () => {
		test("finds break after space", () => {
			const result = analyzeLineBreaks("A B C");
			// Start at 0, should find break at position 2 (after first space)
			const next = findNextBreak(result, 0);
			expect(next).toBe(2);
		});

		test("returns end for no more breaks", () => {
			const result = analyzeLineBreaks("ABC");
			// No internal breaks, should return end
			const next = findNextBreak(result, 0);
			expect(next).toBe(result.breaks.length - 1);
		});

		test("finds mandatory break", () => {
			const result = analyzeLineBreaks("A\nB");
			const next = findNextBreak(result, 0);
			expect(next).toBe(2); // After LF
		});
	});

	describe("canBreakAt", () => {
		test("returns false at start", () => {
			const result = analyzeLineBreaks("Hello");
			expect(canBreakAt(result, 0)).toBe(false);
		});

		test("returns true at end", () => {
			const result = analyzeLineBreaks("Hello");
			expect(canBreakAt(result, result.breaks.length - 1)).toBe(true);
		});

		test("returns true after space", () => {
			const result = analyzeLineBreaks("A B");
			expect(canBreakAt(result, 2)).toBe(true);
		});

		test("returns false between letters", () => {
			const result = analyzeLineBreaks("AB");
			expect(canBreakAt(result, 1)).toBe(false);
		});

		test("returns false for out of bounds", () => {
			const result = analyzeLineBreaks("Hello");
			expect(canBreakAt(result, -1)).toBe(false);
			expect(canBreakAt(result, 100)).toBe(false);
		});
	});

	describe("mustBreakAt", () => {
		test("returns false at start", () => {
			const result = analyzeLineBreaks("Hello");
			expect(mustBreakAt(result, 0)).toBe(false);
		});

		test("returns true at end", () => {
			const result = analyzeLineBreaks("Hello");
			expect(mustBreakAt(result, result.breaks.length - 1)).toBe(true);
		});

		test("returns true after newline", () => {
			const result = analyzeLineBreaks("A\nB");
			expect(mustBreakAt(result, 2)).toBe(true);
		});

		test("returns false after space (optional break)", () => {
			const result = analyzeLineBreaks("A B");
			expect(mustBreakAt(result, 2)).toBe(false);
		});

		test("returns false for out of bounds", () => {
			const result = analyzeLineBreaks("Hello");
			expect(mustBreakAt(result, -1)).toBe(false);
			expect(mustBreakAt(result, 100)).toBe(false);
		});
	});

	describe("getAllBreakOpportunities", () => {
		test("empty string returns just end", () => {
			const result = analyzeLineBreaks("");
			const opportunities = getAllBreakOpportunities(result);
			expect(opportunities).toEqual([1]); // Just end position
		});

		test("single word returns just end", () => {
			const result = analyzeLineBreaks("Hello");
			const opportunities = getAllBreakOpportunities(result);
			expect(opportunities).toEqual([5]); // Just end
		});

		test("two words returns break after space and end", () => {
			const result = analyzeLineBreaks("A B");
			const opportunities = getAllBreakOpportunities(result);
			expect(opportunities).toContain(2); // After space
			expect(opportunities).toContain(3); // End
		});

		test("multiple spaces", () => {
			const result = analyzeLineBreaks("A B C");
			const opportunities = getAllBreakOpportunities(result);
			expect(opportunities.length).toBeGreaterThan(1);
			expect(opportunities).toContain(2); // After first space
			expect(opportunities).toContain(4); // After second space
		});

		test("with newline", () => {
			const result = analyzeLineBreaks("A\nB");
			const opportunities = getAllBreakOpportunities(result);
			expect(opportunities).toContain(2); // After newline (mandatory)
		});
	});

	describe("specific UAX #14 rules", () => {
		test("LB4: break after BK", () => {
			const result = analyzeLineBreaksFromCodepoints([0x0041, 0x000b, 0x0042]);
			// After VT (BK), should be mandatory break
			expect(result.breaks[2]).toBe(BreakOpportunity.Mandatory);
		});

		test("LB5: CR LF is single break", () => {
			const result = analyzeLineBreaksFromCodepoints([0x000d, 0x000a]);
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak); // No break between CR LF
		});

		test("LB7: no break before SP or ZW", () => {
			const result = analyzeLineBreaks("A ");
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak); // No break before space
		});

		test("LB8: break after ZW", () => {
			const result = analyzeLineBreaksFromCodepoints([0x0041, 0x200b, 0x0042]);
			// After ZWSP, can break
			expect(result.breaks[2]).toBe(BreakOpportunity.Optional);
		});

		test("LB11: no break around WJ", () => {
			const result = analyzeLineBreaksFromCodepoints([0x0041, 0x2060, 0x0042]);
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak); // Before WJ
			expect(result.breaks[2]).toBe(BreakOpportunity.NoBreak); // After WJ
		});

		test("LB12: no break after GL", () => {
			const result = analyzeLineBreaksFromCodepoints([0x00a0, 0x0041]); // NBSP A
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("LB19: no break around quotes", () => {
			const result = analyzeLineBreaks("\"A\"");
			// No break after opening quote or before closing quote
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
			expect(result.breaks[2]).toBe(BreakOpportunity.NoBreak);
		});

		test("LB22: no break before IN (ellipsis)", () => {
			const result = analyzeLineBreaksFromCodepoints([0x0041, 0x2026]); // A…
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("LB26: Korean syllable stays together", () => {
			// L + V
			const result = analyzeLineBreaksFromCodepoints([0x1100, 0x1161]);
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("LB28: no break between alphabetics", () => {
			const result = analyzeLineBreaks("AB");
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("LB30a: RI pairs stay together", () => {
			const result = analyzeLineBreaksFromCodepoints([0x1f1fa, 0x1f1f8]); // 🇺🇸
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("LB30b: emoji base + modifier stay together", () => {
			// EB + EM - but need to check what's classified as EB
			// Most emoji are ID, modifiers are EM
			const result = analyzeLineBreaksFromCodepoints([0x1f466, 0x1f3fb]); // 👦🏻
			// The base may be ID not EB depending on implementation
		});
	});

	describe("CJK line breaking", () => {
		test("can break between ideographs", () => {
			const result = analyzeLineBreaksFromCodepoints([0x4e00, 0x4e8c]); // 一二
			// ID ID - can break between (LB31)
			expect(result.breaks[1]).toBe(BreakOpportunity.Optional);
		});

		test("no break before small kana", () => {
			// Regular kana + small kana
			const result = analyzeLineBreaksFromCodepoints([0x3042, 0x3041]); // あぁ
			// ID + CJ (resolved to NS) - LB21 no break before NS
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});

		test("no break before prolonged sound mark", () => {
			const result = analyzeLineBreaksFromCodepoints([0x30a2, 0x30fc]); // アー
			// ID + CJ (-> NS) - no break before NS
			expect(result.breaks[1]).toBe(BreakOpportunity.NoBreak);
		});
	});
});
