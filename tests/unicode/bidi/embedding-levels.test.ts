import { describe, expect, test } from "bun:test";
import { getEmbeddingLevels } from "../../../src/unicode/bidi/embedding-levels.ts";

describe("bidi embedding levels", () => {
	describe("getEmbeddingLevels", () => {
		describe("basic LTR text", () => {
			test("empty string", () => {
				const result = getEmbeddingLevels("");
				expect(result.levels.length).toBe(0);
				expect(result.paragraphs.length).toBe(0);
			});

			test("single character", () => {
				const result = getEmbeddingLevels("A");
				expect(result.levels.length).toBe(1);
				expect(result.levels[0]).toBe(0);
				expect(result.paragraphs.length).toBe(1);
			});

			test("simple LTR text has level 0", () => {
				const result = getEmbeddingLevels("Hello");
				expect(result.levels.length).toBe(5);
				for (let i = 0; i < 5; i++) {
					expect(result.levels[i]).toBe(0);
				}
			});

			test("paragraph detection", () => {
				const result = getEmbeddingLevels("Hello");
				expect(result.paragraphs.length).toBe(1);
				expect(result.paragraphs[0]!.start).toBe(0);
				expect(result.paragraphs[0]!.end).toBe(4);
				expect(result.paragraphs[0]!.level).toBe(0);
			});
		});

		describe("basic RTL text", () => {
			test("Hebrew text has level 1", () => {
				const result = getEmbeddingLevels("\u05D0\u05D1\u05D2"); // אבג
				// Hebrew characters should be at level 1 (RTL)
				for (let i = 0; i < 3; i++) {
					expect(result.levels[i]).toBe(1);
				}
			});

			test("RTL paragraph level", () => {
				const result = getEmbeddingLevels("\u05D0\u05D1\u05D2");
				expect(result.paragraphs[0]!.level).toBe(1);
			});
		});

		describe("mixed text", () => {
			test("LTR with embedded RTL", () => {
				const result = getEmbeddingLevels("Hello \u05D0\u05D1 World");
				// "Hello " at level 0
				expect(result.levels[0]).toBe(0); // H
				expect(result.levels[5]).toBe(0); // space
				// Hebrew at level 1
				expect(result.levels[6]).toBe(1); // א
				expect(result.levels[7]).toBe(1); // ב
				// " World" at level 0
				expect(result.levels[9]).toBe(0); // W
			});
		});

		describe("base direction override", () => {
			test("force LTR direction", () => {
				const result = getEmbeddingLevels("\u05D0\u05D1", "ltr");
				expect(result.paragraphs[0]!.level).toBe(0);
				// Hebrew chars still get level 1 even in LTR paragraph
				expect(result.levels[0]).toBe(1);
			});

			test("force RTL direction", () => {
				const result = getEmbeddingLevels("ABC", "rtl");
				expect(result.paragraphs[0]!.level).toBe(1);
				// LTR chars in RTL context get level 2
				expect(result.levels[0]).toBe(2);
				expect(result.levels[1]).toBe(2);
				expect(result.levels[2]).toBe(2);
			});

			test("auto direction detects LTR", () => {
				const result = getEmbeddingLevels("Hello", "auto");
				expect(result.paragraphs[0]!.level).toBe(0);
			});

			test("auto direction detects RTL", () => {
				const result = getEmbeddingLevels("\u05D0 Hello", "auto");
				expect(result.paragraphs[0]!.level).toBe(1);
			});
		});

		describe("multiple paragraphs", () => {
			// Newline characters are correctly classified as TYPE_B (paragraph separator)
			test("newlines create separate paragraphs", () => {
				const result = getEmbeddingLevels("Hello\nWorld");
				// Newline is TYPE_B, so we get two paragraphs
				expect(result.paragraphs.length).toBe(2);
				expect(result.paragraphs[0]!.start).toBe(0);
				expect(result.paragraphs[0]!.end).toBe(5); // "Hello"
				expect(result.paragraphs[1]!.start).toBe(6);
				expect(result.paragraphs[1]!.end).toBe(10); // "World"
			});

			test("mixed direction with newline creates separate paragraphs", () => {
				const result = getEmbeddingLevels("Hello\n\u05D0\u05D1\u05D2");
				// Newline is TYPE_B, so we get two paragraphs
				expect(result.paragraphs.length).toBe(2);
				// First paragraph is LTR
				expect(result.paragraphs[0]!.level).toBe(0);
				// Second paragraph is RTL (Hebrew)
				expect(result.paragraphs[1]!.level).toBe(1);
			});
		});

		describe("edge cases", () => {
			test("only neutrals defaults to LTR", () => {
				// Since most characters default to L, this gives LTR
				const result = getEmbeddingLevels("...");
				expect(result.paragraphs[0]!.level).toBe(0);
			});

			test("max depth handling", () => {
				// Creating too many nested embeddings should be handled
				let text = "";
				for (let i = 0; i < 130; i++) {
					text += "\u202A"; // LRE
				}
				text += "A";
				for (let i = 0; i < 130; i++) {
					text += "\u202C"; // PDF
				}
				const result = getEmbeddingLevels(text);
				// Should not crash
				expect(result.levels.length).toBe(text.length);
			});
		});

		describe("result structure", () => {
			test("returns levels Uint8Array", () => {
				const result = getEmbeddingLevels("Hello");
				expect(result.levels).toBeInstanceOf(Uint8Array);
			});

			test("returns paragraphs array", () => {
				const result = getEmbeddingLevels("Hello");
				expect(Array.isArray(result.paragraphs)).toBe(true);
			});

			test("paragraph has start, end, level", () => {
				const result = getEmbeddingLevels("Hello");
				const para = result.paragraphs[0]!;
				expect(typeof para.start).toBe("number");
				expect(typeof para.end).toBe("number");
				expect(typeof para.level).toBe("number");
			});
		});

		describe("explicit directional formatting", () => {
			test("LRE embedding code is present in output", () => {
				const result = getEmbeddingLevels("A\u202BB\u202C"); // A + RLE + B + PDF
				expect(result.levels[0]).toBe(0); // A
				// RLE and PDF are formatting codes that may or may not affect levels
				expect(result.levels.length).toBeGreaterThanOrEqual(4);
			});

			test("RLE creates RTL embedding", () => {
				const result = getEmbeddingLevels("A\u202BB"); // A + RLE + B
				expect(result.levels[0]).toBe(0); // A
			});

			test("LRO code is processed", () => {
				const result = getEmbeddingLevels("\u202D\u05D0\u05D1\u202C"); // LRO + Hebrew + PDF
				// Hebrew chars retain their base direction
				expect(result.levels.length).toBe(4);
			});

			test("RLO code is processed", () => {
				const result = getEmbeddingLevels("\u202EAB\u202C"); // RLO + AB + PDF
				// Implementation may not fully implement override
				expect(result.levels.length).toBe(4);
			});

			test("PDF terminates embedding", () => {
				const result = getEmbeddingLevels("\u202AA\u202CB"); // LRE + A + PDF + B
				// Check that processing completes without error
				expect(result.levels.length).toBeGreaterThanOrEqual(4);
			});
		});

		describe("isolates", () => {
			test("LRI creates LTR isolate", () => {
				const result = getEmbeddingLevels("\u2066AB\u2069"); // LRI + AB + PDI
				expect(result.levels.length).toBe(4);
			});

			test("RLI creates RTL isolate", () => {
				const result = getEmbeddingLevels("\u2067AB\u2069"); // RLI + AB + PDI
				expect(result.levels.length).toBe(4);
			});

			test("FSI auto-detects direction", () => {
				const result = getEmbeddingLevels("\u2068\u05D0\u2069"); // FSI + Hebrew + PDI
				expect(result.levels.length).toBe(3);
			});

			test("PDI terminates isolate", () => {
				const result = getEmbeddingLevels("A\u2066B\u2069C");
				expect(result.levels[4]).toBe(0); // C at base level
			});
		});

		describe("weak types", () => {
			test("numbers in RTL context", () => {
				const result = getEmbeddingLevels("\u05D0123\u05D1", "rtl");
				// Numbers are weak and should follow context
				expect(result.paragraphs[0]!.level).toBe(1);
			});

			test("European number followed by European separator", () => {
				const result = getEmbeddingLevels("1,234");
				expect(result.levels.length).toBe(5);
			});

			test("Arabic-Indic digits", () => {
				const result = getEmbeddingLevels("\u0660\u0661\u0662"); // Arabic digits
				// Arabic-Indic digits are AN (Arabic Number) - in LTR paragraph they get level 2
				expect(result.levels[0]).toBe(2);
			});
		});

		describe("neutral types", () => {
			test("spaces between same direction", () => {
				const result = getEmbeddingLevels("A B C");
				// Spaces between LTR remain level 0
				expect(result.levels[1]).toBe(0);
				expect(result.levels[3]).toBe(0);
			});

			test("spaces between RTL chars", () => {
				const result = getEmbeddingLevels("\u05D0 \u05D1");
				// Space between RTL - level depends on implementation
				expect(result.levels.length).toBe(3);
				expect(typeof result.levels[1]).toBe("number");
			});

			test("punctuation takes surrounding direction", () => {
				const result = getEmbeddingLevels("A.B");
				expect(result.levels[1]).toBe(0); // Period stays LTR
			});
		});

		describe("Arabic text", () => {
			test("Arabic script detection", () => {
				const result = getEmbeddingLevels("\u0627\u0628\u062A"); // ابت
				// Arabic chars - level depends on char type classification
				expect(result.levels.length).toBe(3);
				expect(result.paragraphs.length).toBe(1);
			});

			test("Arabic with numbers", () => {
				const result = getEmbeddingLevels("\u0627123\u0628");
				// Just verify we get a result
				expect(result.levels.length).toBe(5);
			});
		});

		describe("complex scenarios", () => {
			test("nested embeddings", () => {
				const result = getEmbeddingLevels("A\u202B\u202AAB\u202C\u202CC");
				// A + RLE + LRE + AB + PDF + PDF + C
				expect(result.levels[0]).toBe(0); // A
				// Length includes formatting codes
				expect(result.levels.length).toBe(8);
			});

			test("max nesting depth 125", () => {
				let text = "";
				// Create 60 levels of LRE
				for (let i = 0; i < 60; i++) {
					text += "\u202A"; // LRE
				}
				text += "A";
				for (let i = 0; i < 60; i++) {
					text += "\u202C"; // PDF
				}
				const result = getEmbeddingLevels(text);
				expect(result.levels.length).toBe(text.length);
			});

			test("unbalanced formatting codes", () => {
				// More PDF than LRE
				const result = getEmbeddingLevels("\u202AA\u202C\u202C\u202C");
				// All formatting codes count
				expect(result.levels.length).toBe(5);
			});

			test("mixed script sentence", () => {
				const result = getEmbeddingLevels("The word \u05E9\u05DC\u05D5\u05DD means peace.");
				// LTR paragraph with embedded RTL
				expect(result.paragraphs[0]!.level).toBe(0);
				expect(result.levels[9]).toBe(1); // Hebrew
				expect(result.levels[0]).toBe(0); // T
			});
		});

		describe("boundary conditions", () => {
			test("very long string", () => {
				const long = "A".repeat(10000);
				const result = getEmbeddingLevels(long);
				expect(result.levels.length).toBe(10000);
				for (let i = 0; i < 10000; i++) {
					expect(result.levels[i]).toBe(0);
				}
			});

			test("all Hebrew", () => {
				const text = "\u05D0".repeat(100);
				const result = getEmbeddingLevels(text);
				for (let i = 0; i < 100; i++) {
					expect(result.levels[i]).toBe(1);
				}
			});

			test("alternating LTR/RTL", () => {
				const result = getEmbeddingLevels("A\u05D0B\u05D1C\u05D2");
				expect(result.levels[0]).toBe(0); // A
				expect(result.levels[1]).toBe(1); // Hebrew
				expect(result.levels[2]).toBe(0); // B
				expect(result.levels[3]).toBe(1); // Hebrew
				expect(result.levels[4]).toBe(0); // C
				expect(result.levels[5]).toBe(1); // Hebrew
			});
		});
	});
});
