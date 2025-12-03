import { describe, expect, test } from "bun:test";
import {
	TYPES,
	TYPES_TO_NAMES,
	getBidiCharType,
	getBidiCharTypeName,
	STRONG_TYPES,
	ISOLATE_INIT_TYPES,
	NEUTRAL_ISOLATE_TYPES,
	BN_LIKE_TYPES,
	TRAILING_TYPES,
} from "../../../src/unicode/bidi/char-types.ts";

describe("bidi char types", () => {
	describe("TYPES", () => {
		test("L is default", () => {
			expect(TYPES.L).toBe(1);
		});

		test("has strong types", () => {
			expect(TYPES.R).toBeDefined();
			expect(TYPES.AL).toBeDefined();
		});

		test("has weak types", () => {
			expect(TYPES.EN).toBeDefined();
			expect(TYPES.ES).toBeDefined();
			expect(TYPES.ET).toBeDefined();
			expect(TYPES.AN).toBeDefined();
			expect(TYPES.CS).toBeDefined();
			expect(TYPES.NSM).toBeDefined();
			expect(TYPES.BN).toBeDefined();
		});

		test("has neutral types", () => {
			expect(TYPES.B).toBeDefined();
			expect(TYPES.S).toBeDefined();
			expect(TYPES.WS).toBeDefined();
			expect(TYPES.ON).toBeDefined();
		});

		test("has explicit formatting types", () => {
			expect(TYPES.LRE).toBeDefined();
			expect(TYPES.RLE).toBeDefined();
			expect(TYPES.LRO).toBeDefined();
			expect(TYPES.RLO).toBeDefined();
			expect(TYPES.PDF).toBeDefined();
		});

		test("has isolate types", () => {
			expect(TYPES.LRI).toBeDefined();
			expect(TYPES.RLI).toBeDefined();
			expect(TYPES.FSI).toBeDefined();
			expect(TYPES.PDI).toBeDefined();
		});

		test("is frozen", () => {
			expect(Object.isFrozen(TYPES)).toBe(true);
		});

		test("type values are powers of 2", () => {
			// Each type should be a unique power of 2 for bitmasking
			const values = Object.values(TYPES).filter(v => typeof v === "number");
			for (const v of values) {
				// Check it's a power of 2 (only one bit set)
				expect(v > 0 && (v & (v - 1)) === 0).toBe(true);
			}
		});
	});

	describe("TYPES_TO_NAMES", () => {
		test("maps L", () => {
			expect(TYPES_TO_NAMES[1]).toBe("L");
		});

		test("maps type values to names", () => {
			expect(TYPES_TO_NAMES[TYPES.L!]).toBe("L");
			if (TYPES.R) expect(TYPES_TO_NAMES[TYPES.R]).toBe("R");
			if (TYPES.AL) expect(TYPES_TO_NAMES[TYPES.AL]).toBe("AL");
			if (TYPES.EN) expect(TYPES_TO_NAMES[TYPES.EN]).toBe("EN");
		});
	});

	describe("type masks", () => {
		test("STRONG_TYPES includes L, R, AL", () => {
			expect(STRONG_TYPES & TYPES.L!).toBeTruthy();
			if (TYPES.R) expect(STRONG_TYPES & TYPES.R).toBeTruthy();
			if (TYPES.AL) expect(STRONG_TYPES & TYPES.AL).toBeTruthy();
		});

		test("ISOLATE_INIT_TYPES includes LRI, RLI, FSI", () => {
			if (TYPES.LRI) expect(ISOLATE_INIT_TYPES & TYPES.LRI).toBeTruthy();
			if (TYPES.RLI) expect(ISOLATE_INIT_TYPES & TYPES.RLI).toBeTruthy();
			if (TYPES.FSI) expect(ISOLATE_INIT_TYPES & TYPES.FSI).toBeTruthy();
		});

		test("NEUTRAL_ISOLATE_TYPES includes neutrals", () => {
			if (TYPES.B) expect(NEUTRAL_ISOLATE_TYPES & TYPES.B).toBeTruthy();
			if (TYPES.S) expect(NEUTRAL_ISOLATE_TYPES & TYPES.S).toBeTruthy();
			if (TYPES.WS) expect(NEUTRAL_ISOLATE_TYPES & TYPES.WS).toBeTruthy();
			if (TYPES.ON) expect(NEUTRAL_ISOLATE_TYPES & TYPES.ON).toBeTruthy();
		});

		test("BN_LIKE_TYPES includes BN and explicit embeddings", () => {
			if (TYPES.BN) expect(BN_LIKE_TYPES & TYPES.BN).toBeTruthy();
			if (TYPES.RLE) expect(BN_LIKE_TYPES & TYPES.RLE).toBeTruthy();
			if (TYPES.LRE) expect(BN_LIKE_TYPES & TYPES.LRE).toBeTruthy();
			if (TYPES.PDF) expect(BN_LIKE_TYPES & TYPES.PDF).toBeTruthy();
		});

		test("TRAILING_TYPES includes S, WS, B, isolates", () => {
			if (TYPES.S) expect(TRAILING_TYPES & TYPES.S).toBeTruthy();
			if (TYPES.WS) expect(TRAILING_TYPES & TYPES.WS).toBeTruthy();
			if (TYPES.B) expect(TRAILING_TYPES & TYPES.B).toBeTruthy();
		});
	});

	describe("getBidiCharType", () => {
		describe("strong types", () => {
			test("ASCII letters are L (default)", () => {
				// ASCII letters default to L in this implementation
				expect(getBidiCharType("A")).toBe(TYPES.L);
				expect(getBidiCharType("Z")).toBe(TYPES.L);
				expect(getBidiCharType("a")).toBe(TYPES.L);
				expect(getBidiCharType("z")).toBe(TYPES.L);
			});

			test("Hebrew letters are R", () => {
				expect(getBidiCharType("\u05D0")).toBe(TYPES.R); // א
				expect(getBidiCharType("\u05EA")).toBe(TYPES.R); // ת
			});
		});

		describe("edge cases", () => {
			test("returns L for empty string", () => {
				expect(getBidiCharType("")).toBe(TYPES.L);
			});

			test("handles multi-char string (uses first)", () => {
				expect(getBidiCharType("AB")).toBe(TYPES.L);
			});

			test("common characters have correct types", () => {
				// ASCII letters are L
				expect(getBidiCharType("A")).toBe(TYPES.L);
				// Digits are EN (European Number)
				expect(getBidiCharType("0")).toBe(TYPES.EN);
				// Space is WS (Whitespace)
				expect(getBidiCharType(" ")).toBe(TYPES.WS);
			});
		});
	});

	describe("getBidiCharTypeName", () => {
		test("returns L for left-to-right", () => {
			expect(getBidiCharTypeName("A")).toBe("L");
		});

		test("returns R for Hebrew", () => {
			expect(getBidiCharTypeName("\u05D0")).toBe("R");
		});

		test("returns L for empty string", () => {
			expect(getBidiCharTypeName("")).toBe("L");
		});

		test("returns correct type names for common characters", () => {
			expect(getBidiCharTypeName("0")).toBe("EN"); // Digit is European Number
			expect(getBidiCharTypeName(" ")).toBe("WS"); // Space is Whitespace
		});
	});

	describe("data parsing", () => {
		test("parses Hebrew range correctly", () => {
			// Hebrew letters should all be R
			for (let cp = 0x05D0; cp <= 0x05EA; cp++) {
				const char = String.fromCodePoint(cp);
				expect(getBidiCharType(char)).toBe(TYPES.R);
			}
		});
	});
});
