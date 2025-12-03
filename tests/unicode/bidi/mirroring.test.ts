import { describe, expect, test } from "bun:test";
import {
	getMirroredCharacter,
	getMirroredCharactersMap,
} from "../../../src/unicode/bidi/mirroring.ts";

describe("bidi mirroring", () => {
	describe("getMirroredCharacter", () => {
		describe("basic brackets and parentheses", () => {
			test("mirrors left parenthesis to right", () => {
				expect(getMirroredCharacter("(")).toBe(")");
			});

			test("mirrors right parenthesis to left", () => {
				expect(getMirroredCharacter(")")).toBe("(");
			});

			test("mirrors left square bracket to right", () => {
				expect(getMirroredCharacter("[")).toBe("]");
			});

			test("mirrors right square bracket to left", () => {
				expect(getMirroredCharacter("]")).toBe("[");
			});

			test("mirrors left curly bracket to right", () => {
				expect(getMirroredCharacter("{")).toBe("}");
			});

			test("mirrors right curly bracket to left", () => {
				expect(getMirroredCharacter("}")).toBe("{");
			});
		});

		describe("angle brackets", () => {
			test("mirrors less-than to greater-than", () => {
				expect(getMirroredCharacter("<")).toBe(">");
			});

			test("mirrors greater-than to less-than", () => {
				expect(getMirroredCharacter(">")).toBe("<");
			});
		});

		describe("quotation marks", () => {
			test("mirrors left guillemet to right", () => {
				expect(getMirroredCharacter("«")).toBe("»");
			});

			test("mirrors right guillemet to left", () => {
				expect(getMirroredCharacter("»")).toBe("«");
			});

			test("mirrors single left angle quotation to right", () => {
				expect(getMirroredCharacter("‹")).toBe("›");
			});

			test("mirrors single right angle quotation to left", () => {
				expect(getMirroredCharacter("›")).toBe("‹");
			});
		});

		describe("mathematical brackets", () => {
			test("mirrors left angle bracket to right", () => {
				expect(getMirroredCharacter("⟨")).toBe("⟩");
			});

			test("mirrors right angle bracket to left", () => {
				expect(getMirroredCharacter("⟩")).toBe("⟨");
			});

			test("mirrors left double angle bracket to right", () => {
				expect(getMirroredCharacter("⟪")).toBe("⟫");
			});

			test("mirrors right double angle bracket to left", () => {
				expect(getMirroredCharacter("⟫")).toBe("⟪");
			});
		});

		describe("CJK brackets", () => {
			test("mirrors left corner bracket to right", () => {
				expect(getMirroredCharacter("「")).toBe("」");
			});

			test("mirrors right corner bracket to left", () => {
				expect(getMirroredCharacter("」")).toBe("「");
			});

			test("mirrors left double angle bracket to right", () => {
				expect(getMirroredCharacter("《")).toBe("》");
			});

			test("mirrors right double angle bracket to left", () => {
				expect(getMirroredCharacter("》")).toBe("《");
			});
		});

		describe("small form variants", () => {
			test("mirrors small left parenthesis to right", () => {
				expect(getMirroredCharacter("﹙")).toBe("﹚");
			});

			test("mirrors small right parenthesis to left", () => {
				expect(getMirroredCharacter("﹚")).toBe("﹙");
			});
		});

		describe("non-mirrored characters", () => {
			test("returns null for ASCII letters", () => {
				expect(getMirroredCharacter("A")).toBe(null);
				expect(getMirroredCharacter("z")).toBe(null);
			});

			test("returns null for digits", () => {
				expect(getMirroredCharacter("0")).toBe(null);
				expect(getMirroredCharacter("9")).toBe(null);
			});

			test("returns null for space", () => {
				expect(getMirroredCharacter(" ")).toBe(null);
			});

			test("returns null for common punctuation", () => {
				expect(getMirroredCharacter(".")).toBe(null);
				expect(getMirroredCharacter(",")).toBe(null);
				expect(getMirroredCharacter("!")).toBe(null);
				expect(getMirroredCharacter("?")).toBe(null);
			});
		});

		describe("edge cases", () => {
			test("returns null for empty string", () => {
				expect(getMirroredCharacter("")).toBe(null);
			});

			test("returns null for multi-character string", () => {
				// The function only accepts single characters
				expect(getMirroredCharacter("(abc)")).toBe(null);
			});
		});

		describe("bidirectional consistency", () => {
			test("mirroring is symmetric for parentheses", () => {
				const left = getMirroredCharacter("(");
				const right = getMirroredCharacter(left!);
				expect(right).toBe("(");
			});

			test("mirroring is symmetric for brackets", () => {
				const left = getMirroredCharacter("[");
				const right = getMirroredCharacter(left!);
				expect(right).toBe("[");
			});

			test("mirroring is symmetric for braces", () => {
				const left = getMirroredCharacter("{");
				const right = getMirroredCharacter(left!);
				expect(right).toBe("{");
			});

			test("mirroring is symmetric for angle brackets", () => {
				const left = getMirroredCharacter("<");
				const right = getMirroredCharacter(left!);
				expect(right).toBe("<");
			});
		});
	});

	describe("getMirroredCharactersMap", () => {
		describe("basic functionality", () => {
			test("returns empty map for all LTR levels", () => {
				const str = "Hello (world)";
				const levels = new Uint8Array(str.length).fill(0);
				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(0);
			});

			test("mirrors brackets in RTL sections", () => {
				const str = "Hello (world)";
				const levels = new Uint8Array(str.length);
				// Mark parentheses as RTL (odd level)
				levels[6] = 1; // '('
				levels[12] = 1; // ')'

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(2);
				expect(map.get(6)).toBe(")");
				expect(map.get(12)).toBe("(");
			});

			test("mirrors only characters in RTL sections", () => {
				const str = "(LTR) مرحبا (RTL)";
				// 0-4: LTR (level 0)
				// 6-10: RTL (level 1)
				// 12-16: RTL (level 1)
				const levels = new Uint8Array(str.length);
				levels.fill(0, 0, 5);
				levels.fill(1, 6, 17);

				const map = getMirroredCharactersMap(str, levels);
				// Only RTL parentheses should be mirrored
				expect(map.has(0)).toBe(false); // LTR '('
				expect(map.has(4)).toBe(false); // LTR ')'
				expect(map.get(12)).toBe(")"); // RTL '('
				expect(map.get(16)).toBe("("); // RTL ')'
			});

			test("handles multiple bracket pairs in RTL", () => {
				const str = "({[test]})";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(6);
				expect(map.get(0)).toBe(")"); // '('
				expect(map.get(1)).toBe("}"); // '{'
				expect(map.get(2)).toBe("]"); // '['
				expect(map.get(7)).toBe("["); // ']'
				expect(map.get(8)).toBe("{"); // '}'
				expect(map.get(9)).toBe("("); // ')'
			});
		});

		describe("start and end parameters", () => {
			test("respects start parameter", () => {
				const str = "(test) (world)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels, 7);
				expect(map.has(0)).toBe(false); // Before start
				expect(map.has(5)).toBe(false); // Before start
				expect(map.get(7)).toBe(")"); // After start
				expect(map.get(13)).toBe("("); // After start
			});

			test("respects end parameter", () => {
				const str = "(test) (world)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels, 0, 5);
				expect(map.get(0)).toBe(")"); // Before end
				expect(map.get(5)).toBe("("); // At end
				expect(map.has(7)).toBe(false); // After end
				expect(map.has(13)).toBe(false); // After end
			});

			test("respects both start and end", () => {
				const str = "(a) (b) (c)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels, 4, 6);
				expect(map.has(0)).toBe(false); // Before start
				expect(map.has(2)).toBe(false); // Before start
				expect(map.get(4)).toBe(")"); // In range
				expect(map.get(6)).toBe("("); // In range
				expect(map.has(8)).toBe(false); // After end
				expect(map.has(10)).toBe(false); // After end
			});

			test("handles start greater than actual start", () => {
				const str = "(test)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels, 10);
				expect(map.size).toBe(0);
			});

			test("handles end less than actual end", () => {
				const str = "(test)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels, 0, 2);
				expect(map.get(0)).toBe(")");
				expect(map.has(5)).toBe(false);
			});

			test("defaults start to 0 when not provided", () => {
				const str = "(test)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.get(0)).toBe(")");
				expect(map.get(5)).toBe("(");
			});

			test("defaults end to string length when not provided", () => {
				const str = "(test)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.get(5)).toBe("(");
			});

			test("clamps negative start to 0", () => {
				const str = "(test)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels, -5);
				expect(map.get(0)).toBe(")");
			});

			test("clamps end beyond string length", () => {
				const str = "(test)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels, 0, 100);
				expect(map.get(5)).toBe("(");
			});
		});

		describe("embedding levels", () => {
			test("only mirrors characters at odd levels", () => {
				const str = "((((";
				const levels = new Uint8Array([0, 1, 2, 3]);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.has(0)).toBe(false); // Level 0 (even)
				expect(map.has(1)).toBe(true); // Level 1 (odd)
				expect(map.has(2)).toBe(false); // Level 2 (even)
				expect(map.has(3)).toBe(true); // Level 3 (odd)
			});

			test("handles level 0 correctly", () => {
				const str = "(test)";
				const levels = new Uint8Array(str.length).fill(0);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(0);
			});

			test("handles high odd levels", () => {
				const str = "()";
				const levels = new Uint8Array([127, 127]);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(2);
				expect(map.get(0)).toBe(")");
				expect(map.get(1)).toBe("(");
			});
		});

		describe("non-mirrored characters in RTL", () => {
			test("ignores letters in RTL sections", () => {
				const str = "Hello";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(0);
			});

			test("ignores digits in RTL sections", () => {
				const str = "12345";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(0);
			});

			test("only mirrors bracket characters", () => {
				const str = "a(b)c";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(2);
				expect(map.has(0)).toBe(false); // 'a'
				expect(map.get(1)).toBe(")"); // '('
				expect(map.has(2)).toBe(false); // 'b'
				expect(map.get(3)).toBe("("); // ')'
				expect(map.has(4)).toBe(false); // 'c'
			});
		});

		describe("edge cases", () => {
			test("handles empty string", () => {
				const str = "";
				const levels = new Uint8Array(0);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(0);
			});

			test("handles single character LTR", () => {
				const str = "(";
				const levels = new Uint8Array([0]);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(0);
			});

			test("handles single character RTL", () => {
				const str = "(";
				const levels = new Uint8Array([1]);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.size).toBe(1);
				expect(map.get(0)).toBe(")");
			});

			test("handles start equals end", () => {
				const str = "(test)";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels, 3, 3);
				// At index 3 is 't', which has no mirror
				expect(map.size).toBe(0);
				expect(map.has(0)).toBe(false);
				expect(map.has(5)).toBe(false);
			});
		});

		describe("real-world scenarios", () => {
			test("handles mixed Hebrew and English with parentheses", () => {
				// "Hello (שלום) world"
				const str = "Hello (שלום) world";
				const levels = new Uint8Array(str.length);
				levels.fill(0, 0, 6); // "Hello "
				levels.fill(1, 6, 12); // "(שלום)"
				levels.fill(0, 12); // " world"

				const map = getMirroredCharactersMap(str, levels);
				expect(map.get(6)).toBe(")"); // '(' in RTL
				expect(map.get(11)).toBe("("); // ')' in RTL
			});

			test("handles mathematical expressions in RTL", () => {
				const str = "⟨x + y⟩";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.get(0)).toBe("⟩");
				expect(map.get(6)).toBe("⟨");
			});

			test("handles nested brackets in RTL", () => {
				const str = "{[()]}";
				const levels = new Uint8Array(str.length).fill(1);

				const map = getMirroredCharactersMap(str, levels);
				expect(map.get(0)).toBe("}"); // '{'
				expect(map.get(1)).toBe("]"); // '['
				expect(map.get(2)).toBe(")"); // '('
				expect(map.get(3)).toBe("("); // ')'
				expect(map.get(4)).toBe("["); // ']'
				expect(map.get(5)).toBe("{"); // '}'
			});
		});
	});
});
