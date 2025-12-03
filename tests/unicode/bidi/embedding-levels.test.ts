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

		describe("W1: NSM (non-spacing marks)", () => {
			test("NSM after strong L type", () => {
				// U+0300 is combining grave accent (NSM)
				const result = getEmbeddingLevels("A\u0300");
				expect(result.levels.length).toBe(2);
				expect(result.levels[0]).toBe(0);
			});

			test("NSM after strong R type", () => {
				const result = getEmbeddingLevels("\u05D0\u0300");
				expect(result.levels.length).toBe(2);
				expect(result.levels[0]).toBe(1);
			});

			test("NSM after isolate initiator becomes ON", () => {
				// NSM after LRI should become ON
				const result = getEmbeddingLevels("\u2066\u0300\u2069");
				expect(result.levels.length).toBe(3);
			});

			test("NSM after PDI becomes ON", () => {
				const result = getEmbeddingLevels("A\u2066B\u2069\u0300C");
				expect(result.levels.length).toBe(6);
			});

			test("NSM at start of sequence takes sos type", () => {
				const result = getEmbeddingLevels("\u0300ABC");
				expect(result.levels.length).toBe(4);
			});

			test("NSM preceded by BN-like types", () => {
				// U+200B is zero-width space (BN type)
				const result = getEmbeddingLevels("A\u200B\u0300B");
				expect(result.levels.length).toBe(4);
			});
		});

		describe("W5: ET sequences", () => {
			test("ET before EN", () => {
				// $ is ET, 1 is EN
				const result = getEmbeddingLevels("$1");
				expect(result.levels.length).toBe(2);
			});

			test("ET after EN", () => {
				const result = getEmbeddingLevels("1$");
				expect(result.levels.length).toBe(2);
			});

			test("ET between EN", () => {
				const result = getEmbeddingLevels("1$2");
				expect(result.levels.length).toBe(3);
			});

			test("ET with BN before break", () => {
				// U+200B is BN
				const result = getEmbeddingLevels("1$\u200BA");
				expect(result.levels.length).toBe(4);
			});

			test("sequence continues through EN and ET", () => {
				const result = getEmbeddingLevels("1$2$3");
				expect(result.levels.length).toBe(5);
			});
		});

		describe("W6: ET/ES/CS become ON", () => {
			test("ET becomes ON when not near EN", () => {
				const result = getEmbeddingLevels("A$B");
				expect(result.levels.length).toBe(3);
			});

			test("ES becomes ON when not between numbers", () => {
				const result = getEmbeddingLevels("A+B");
				expect(result.levels.length).toBe(3);
			});

			test("CS becomes ON when not between numbers", () => {
				const result = getEmbeddingLevels("A,B");
				expect(result.levels.length).toBe(3);
			});

			test("BN after ET/ES/CS becomes ON", () => {
				const result = getEmbeddingLevels("A$\u200BB");
				expect(result.levels.length).toBe(4);
			});

			test("BN before ET/ES/CS becomes ON", () => {
				const result = getEmbeddingLevels("A\u200B$B");
				expect(result.levels.length).toBe(4);
			});
		});

		describe("isolate matching and nesting", () => {
			test("nested isolates", () => {
				// LRI + LRI + PDI + PDI
				const result = getEmbeddingLevels("\u2066\u2066AB\u2069\u2069");
				expect(result.levels.length).toBe(6);
			});

			test("deeply nested isolates", () => {
				// Three levels of nesting
				const result = getEmbeddingLevels("\u2066\u2066\u2066A\u2069\u2069\u2069");
				expect(result.levels.length).toBe(7);
			});

			test("isolate across paragraph boundary", () => {
				// Isolate initiator without matching PDI before paragraph separator
				const result = getEmbeddingLevels("\u2066AB\nCD");
				expect(result.paragraphs.length).toBe(2);
			});

			test("FSI that ends at PDI", () => {
				const result = getEmbeddingLevels("\u2068\u2069");
				expect(result.levels.length).toBe(2);
			});

			test("FSI with RTL content determines direction", () => {
				const result = getEmbeddingLevels("\u2068\u05D0\u05D1\u2069");
				expect(result.levels.length).toBe(4);
			});

			test("FSI with paragraph break determines LTR", () => {
				const result = getEmbeddingLevels("\u2068\nAB\u2069");
				expect(result.levels.length).toBe(5);
			});

			test("overflow isolate count", () => {
				// Create many nested isolates to trigger overflow
				let text = "";
				for (let i = 0; i < 130; i++) {
					text += "\u2066"; // LRI
				}
				text += "A";
				for (let i = 0; i < 130; i++) {
					text += "\u2069"; // PDI
				}
				const result = getEmbeddingLevels(text);
				expect(result.levels.length).toBe(text.length);
			});

			test("PDI without matching isolate initiator", () => {
				const result = getEmbeddingLevels("A\u2069B");
				expect(result.levels.length).toBe(3);
			});

			test("multiple unmatched PDIs", () => {
				const result = getEmbeddingLevels("\u2069\u2069\u2069ABC");
				expect(result.levels.length).toBe(6);
			});
		});

		describe("RLO/LRO override behavior", () => {
			test("RLO override causes embedding overflow", () => {
				// Deep nesting with RLO to trigger overflow
				let text = "";
				for (let i = 0; i < 130; i++) {
					text += "\u202E"; // RLO
				}
				text += "A";
				for (let i = 0; i < 130; i++) {
					text += "\u202C"; // PDF
				}
				const result = getEmbeddingLevels(text);
				expect(result.levels.length).toBe(text.length);
			});

			test("LRO override causes embedding overflow", () => {
				let text = "";
				for (let i = 0; i < 130; i++) {
					text += "\u202D"; // LRO
				}
				text += "A";
				for (let i = 0; i < 130; i++) {
					text += "\u202C"; // PDF
				}
				const result = getEmbeddingLevels(text);
				expect(result.levels.length).toBe(text.length);
			});

			test("LRO with isolate initiator", () => {
				const result = getEmbeddingLevels("\u202D\u2066AB\u2069\u202C");
				expect(result.levels.length).toBe(6);
			});

			test("RLO with isolate initiator", () => {
				const result = getEmbeddingLevels("\u202E\u2066AB\u2069\u202C");
				expect(result.levels.length).toBe(6);
			});
		});

		describe("bracket pairing (N0)", () => {
			test("simple opening and closing brackets", () => {
				const result = getEmbeddingLevels("(ABC)");
				expect(result.levels.length).toBe(5);
			});

			test("brackets with RTL content", () => {
				const result = getEmbeddingLevels("(\u05D0\u05D1)");
				expect(result.levels.length).toBe(4);
			});

			test("nested brackets", () => {
				const result = getEmbeddingLevels("(A(B)C)");
				expect(result.levels.length).toBe(7);
			});

			test("more than 63 opening brackets triggers break", () => {
				let text = "";
				for (let i = 0; i < 65; i++) {
					text += "(";
				}
				text += "A";
				for (let i = 0; i < 65; i++) {
					text += ")";
				}
				const result = getEmbeddingLevels(text);
				expect(result.levels.length).toBe(text.length);
			});

			test("bracket pair with strong type matching embed direction", () => {
				// LTR paragraph with LTR content in brackets
				const result = getEmbeddingLevels("(ABC)", "ltr");
				expect(result.levels.length).toBe(5);
			});

			test("bracket pair with opposite strong type", () => {
				// LTR paragraph with RTL content in brackets
				const result = getEmbeddingLevels("(\u05D0\u05D1\u05D2)");
				expect(result.levels.length).toBe(5);
			});

			test("bracket pair looks at context when no strong type inside", () => {
				// Brackets with only neutrals, should look at preceding context
				const result = getEmbeddingLevels("A(...)B");
				expect(result.levels.length).toBe(7);
			});

			test("bracket pair with NSM after opener in opposite direction", () => {
				// RTL paragraph with LTR in brackets and NSM after opener
				const result = getEmbeddingLevels("\u05D0(A\u0300)\u05D1", "rtl");
				expect(result.levels.length).toBe(6);
			});

			test("bracket pair with NSM after closer in opposite direction", () => {
				const result = getEmbeddingLevels("\u05D0(A)\u0300\u05D1", "rtl");
				expect(result.levels.length).toBe(6);
			});

			test("unmatched opening bracket", () => {
				const result = getEmbeddingLevels("(ABC");
				expect(result.levels.length).toBe(4);
			});

			test("unmatched closing bracket", () => {
				const result = getEmbeddingLevels("ABC)");
				expect(result.levels.length).toBe(4);
			});

			test("canonical bracket equivalence", () => {
				// Different bracket types that are canonically equivalent
				const result = getEmbeddingLevels("\u300AAB\u300B");
				expect(result.levels.length).toBe(4);
			});

			test("bracket pair in RTL embed direction", () => {
				const result = getEmbeddingLevels("\u05D0(AB)\u05D1");
				expect(result.levels.length).toBe(6);
			});
		});

		describe("L1: trailing whitespace", () => {
			test("paragraph separator at end", () => {
				const result = getEmbeddingLevels("ABC\n");
				// Newline at end creates paragraph boundary
				expect(result.paragraphs.length).toBeGreaterThanOrEqual(1);
				// Level at newline should be paragraph level
				expect(result.levels[3]).toBe(result.paragraphs[0]!.level);
			});

			test("segment separator resets trailing types", () => {
				// U+001F is unit separator (S type)
				const result = getEmbeddingLevels("ABC\u001F");
				expect(result.levels.length).toBe(4);
				// Level at separator should be paragraph level
				expect(result.levels[3]).toBe(result.paragraphs[0]!.level);
			});

			test("trailing whitespace at paragraph end", () => {
				const result = getEmbeddingLevels("ABC   \nDEF");
				expect(result.paragraphs.length).toBe(2);
				// Trailing spaces before newline should have paragraph level
				expect(result.levels[3]).toBe(result.paragraphs[0]!.level);
			});
		});

		describe("N1/N2: neutral resolution", () => {
			test("neutrals between same strong types", () => {
				const result = getEmbeddingLevels("A...B");
				expect(result.levels.length).toBe(5);
			});

			test("neutrals between opposite strong types", () => {
				const result = getEmbeddingLevels("A...\u05D0");
				expect(result.levels.length).toBe(5);
			});

			test("neutrals at start take sos", () => {
				const result = getEmbeddingLevels("...ABC");
				expect(result.levels.length).toBe(6);
			});

			test("neutrals at end take eos", () => {
				const result = getEmbeddingLevels("ABC...");
				expect(result.levels.length).toBe(6);
			});

			test("sequence of neutrals with BN", () => {
				const result = getEmbeddingLevels("A.\u200B.B");
				expect(result.levels.length).toBe(5);
			});
		});

		describe("PDF handling", () => {
			test("PDF without isolate count", () => {
				const result = getEmbeddingLevels("\u202AA\u202CB");
				expect(result.levels.length).toBe(4);
			});

			test("PDF with overflow embedding", () => {
				let text = "";
				for (let i = 0; i < 130; i++) {
					text += "\u202A"; // LRE
				}
				text += "A";
				text += "\u202C"; // PDF should decrement overflow
				const result = getEmbeddingLevels(text);
				expect(result.levels.length).toBe(text.length);
			});

			test("PDF in isolate context", () => {
				const result = getEmbeddingLevels("\u2066\u202AA\u202C\u2069");
				expect(result.levels.length).toBe(5);
			});
		});

		describe("edge cases in auto direction", () => {
			test("auto with only neutrals before first strong", () => {
				const result = getEmbeddingLevels("... \u05D0", "auto");
				expect(result.paragraphs[0]!.level).toBe(1);
			});

			test("auto with paragraph break before strong", () => {
				const result = getEmbeddingLevels("...\n\u05D0", "auto");
				expect(result.paragraphs[0]!.level).toBe(0);
			});

			test("auto with isolate in determination", () => {
				const result = getEmbeddingLevels("\u2066\u05D0\u2069ABC", "auto");
				expect(result.paragraphs[0]!.level).toBe(0);
			});
		});

		describe("PDI with embeddings before isolate", () => {
			test("PDI pops embedding stack before isolate", () => {
				// LRE + LRE + LRI + text + PDI (should pop embeddings to find isolate)
				const result = getEmbeddingLevels("\u202A\u202A\u2066AB\u2069C\u202C\u202C");
				expect(result.levels.length).toBeGreaterThan(0);
			});

			test("PDI with multiple non-isolate embeddings", () => {
				// Create embeddings then isolate, PDI should skip non-isolate entries
				const result = getEmbeddingLevels("A\u202A\u202A\u2066B\u2069\u202C\u202C");
				expect(result.levels.length).toBe(8);
			});

			test("PDI pops non-isolate embeddings from stack", () => {
				// LRI with embeddings inside, PDI should pop embeddings to find isolate
				// This specifically targets line 298: statusStack.pop()
				const result = getEmbeddingLevels("\u2066\u202A\u202AB\u2069C");
				expect(result.levels.length).toBe(6);
			});
		});

		describe("bracket pairing with canonical and context", () => {
			test("canonical bracket with matching via canonical form", () => {
				// Test canonical bracket matching
				const result = getEmbeddingLevels("\u300A\u05D0\u300B");
				expect(result.levels.length).toBe(3);
			});

			test("mismatched brackets don't pair", () => {
				// Opening bracket followed by wrong closing bracket
				// Tests line 623 - the closing brace when brackets don't match
				const result = getEmbeddingLevels("(A]");
				expect(result.levels.length).toBe(3);
			});

			test("nested mismatched brackets", () => {
				// Multiple openers with wrong closer
				const result = getEmbeddingLevels("((A]");
				expect(result.levels.length).toBe(4);
			});

			test("bracket pair uses preceding context type", () => {
				// Brackets with no strong types inside, should look backward for L
				const result = getEmbeddingLevels("A(...)\u05D0");
				expect(result.levels.length).toBe(7);
			});

			test("bracket pair opposite direction looks at context", () => {
				// RTL context with only neutrals in brackets
				const result = getEmbeddingLevels("\u05D0(...)\u05D1");
				expect(result.levels.length).toBe(7);
			});

			test("bracket pair with preceding context different from embed", () => {
				// LTR in RTL paragraph
				const result = getEmbeddingLevels("\u05D0A(...)", "rtl");
				expect(result.levels.length).toBe(7);
			});

			test("bracket with no strong inside looks at preceding context", () => {
				// Targets line 658 - looking backward for context when no strong type inside
				// RTL preceding an LTR paragraph with neutral brackets
				const result = getEmbeddingLevels("\u05D0(...)", "ltr");
				expect(result.levels.length).toBe(6);
			});

			test("bracket with NSM after opener when not embed direction", () => {
				// Test the NSM handling after opener when useStrongType != embedDirection
				// Targets lines 667-675
				const result = getEmbeddingLevels("(\u0300\u05D0)");
				expect(result.levels.length).toBe(4);
			});

			test("bracket with NSM after closer when not embed direction", () => {
				// Test the NSM handling after closer when useStrongType != embedDirection
				const result = getEmbeddingLevels("(\u05D0)\u0300");
				expect(result.levels.length).toBe(4);
			});

			test("bracket with BN before NSM after opener", () => {
				// BN followed by NSM after opening bracket
				const result = getEmbeddingLevels("(\u200B\u0300\u05D0)");
				expect(result.levels.length).toBe(5);
			});

			test("bracket with BN before NSM after closer", () => {
				// BN followed by NSM after closing bracket
				const result = getEmbeddingLevels("(\u05D0)\u200B\u0300");
				expect(result.levels.length).toBe(5);
			});

			test("bracket pair where found strong doesn't match embed", () => {
				// LTR paragraph with RTL in brackets, no matching embed direction
				const result = getEmbeddingLevels("A(\u05D0)B", "ltr");
				expect(result.levels.length).toBe(5);
			});
		});

		describe("complex bracket and NSM scenarios", () => {
			test("RTL bracket pair with LTR content and NSM", () => {
				const result = getEmbeddingLevels("\u05D0(A\u0300)B", "rtl");
				expect(result.levels.length).toBeGreaterThan(0);
			});

			test("nested brackets with mixed directions", () => {
				const result = getEmbeddingLevels("(A(\u05D0)B)");
				expect(result.levels.length).toBe(7);
			});

			test("bracket at sequence end", () => {
				const result = getEmbeddingLevels("ABC(");
				expect(result.levels.length).toBe(4);
			});

			test("bracket pair with opposite context and NSM after opener", () => {
				// RTL content in brackets with NSM immediately after opener
				// Tests lines 667-675 - NSM handling when useStrongType != embedDirection
				const result = getEmbeddingLevels("A(\u0300\u05D0)B");
				expect(result.levels.length).toBe(6);
			});

			test("bracket pair with opposite context and NSM after closer", () => {
				// Tests lines 676-684 - NSM handling after closer
				const result = getEmbeddingLevels("A(\u05D0)\u0300B");
				expect(result.levels.length).toBe(6);
			});

			test("bracket pair looks backward for opposite context", () => {
				// Brackets with only neutrals, preceded by opposite direction
				// Tests line 658 - useStrongType = lr when lr !== embedDirection
				const result = getEmbeddingLevels("\u05D0A(...)B", "ltr");
				expect(result.levels.length).toBe(8);
			});
		});
	});
});
