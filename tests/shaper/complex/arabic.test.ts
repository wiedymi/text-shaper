import { describe, expect, test } from "bun:test";
import {
	ArabicJoiningType,
	JoiningAction,
	getJoiningType,
	isArabic,
	setupArabicMasks,
} from "../../../src/shaper/complex/arabic.ts";
import type { GlyphInfo } from "../../../src/types.ts";

function makeInfo(codepoint: number, cluster = 0): GlyphInfo {
	return { glyphId: 0, cluster, mask: 0, codepoint };
}

describe("arabic shaper", () => {
	describe("isArabic", () => {
		test("detects Arabic block (0600-06FF)", () => {
			expect(isArabic(0x0600)).toBe(true);
			expect(isArabic(0x0628)).toBe(true); // BEH
			expect(isArabic(0x0644)).toBe(true); // LAM
			expect(isArabic(0x06ff)).toBe(true);
		});

		test("detects Arabic Supplement (0750-077F)", () => {
			expect(isArabic(0x0750)).toBe(true);
			expect(isArabic(0x077f)).toBe(true);
		});

		test("detects Arabic Extended-A (08A0-08FF)", () => {
			expect(isArabic(0x08a0)).toBe(true);
			expect(isArabic(0x08ff)).toBe(true);
		});

		test("detects Arabic Presentation Forms-A (FB50-FDFF)", () => {
			expect(isArabic(0xfb50)).toBe(true);
			expect(isArabic(0xfdff)).toBe(true);
		});

		test("detects Arabic Presentation Forms-B (FE70-FEFF)", () => {
			expect(isArabic(0xfe70)).toBe(true);
			expect(isArabic(0xfeff)).toBe(true);
		});

		test("rejects non-Arabic", () => {
			expect(isArabic(0x0041)).toBe(false); // 'A'
			expect(isArabic(0x05ff)).toBe(false); // Before Arabic
			expect(isArabic(0x0700)).toBe(false); // After Arabic block
		});
	});

	describe("getJoiningType", () => {
		describe("dual-joining letters", () => {
			test("BEH is dual-joining", () => {
				expect(getJoiningType(0x0628)).toBe(ArabicJoiningType.DualJoining);
			});

			test("SEEN is dual-joining", () => {
				expect(getJoiningType(0x0633)).toBe(ArabicJoiningType.DualJoining);
			});

			test("LAM is dual-joining", () => {
				expect(getJoiningType(0x0644)).toBe(ArabicJoiningType.DualJoining);
			});

			test("MEEM is dual-joining", () => {
				expect(getJoiningType(0x0645)).toBe(ArabicJoiningType.DualJoining);
			});

			test("YEH is dual-joining", () => {
				expect(getJoiningType(0x064a)).toBe(ArabicJoiningType.DualJoining);
			});
		});

		describe("right-joining letters", () => {
			test("ALEF is right-joining", () => {
				expect(getJoiningType(0x0627)).toBe(ArabicJoiningType.RightJoining);
			});

			test("ALEF WITH HAMZA ABOVE is right-joining", () => {
				expect(getJoiningType(0x0623)).toBe(ArabicJoiningType.RightJoining);
			});

			test("DAL is right-joining", () => {
				expect(getJoiningType(0x062f)).toBe(ArabicJoiningType.RightJoining);
			});

			test("REH is right-joining", () => {
				expect(getJoiningType(0x0631)).toBe(ArabicJoiningType.RightJoining);
			});

			test("WAW is right-joining", () => {
				expect(getJoiningType(0x0648)).toBe(ArabicJoiningType.RightJoining);
			});
		});

		describe("join-causing", () => {
			test("TATWEEL is join-causing", () => {
				expect(getJoiningType(0x0640)).toBe(ArabicJoiningType.JoinCausing);
			});
		});

		describe("transparent (marks)", () => {
			test("FATHAH is transparent", () => {
				expect(getJoiningType(0x064e)).toBe(ArabicJoiningType.Transparent);
			});

			test("DAMMAH is transparent", () => {
				expect(getJoiningType(0x064f)).toBe(ArabicJoiningType.Transparent);
			});

			test("KASRAH is transparent", () => {
				expect(getJoiningType(0x0650)).toBe(ArabicJoiningType.Transparent);
			});

			test("SHADDA is transparent", () => {
				expect(getJoiningType(0x0651)).toBe(ArabicJoiningType.Transparent);
			});

			test("SUKUN is transparent", () => {
				expect(getJoiningType(0x0652)).toBe(ArabicJoiningType.Transparent);
			});
		});

		describe("non-joining", () => {
			test("numbers are non-joining", () => {
				expect(getJoiningType(0x0660)).toBe(ArabicJoiningType.NonJoining); // 0
				expect(getJoiningType(0x0661)).toBe(ArabicJoiningType.NonJoining); // 1
			});

			test("ASCII is non-joining", () => {
				expect(getJoiningType(0x0041)).toBe(ArabicJoiningType.NonJoining);
			});
		});
	});

	describe("setupArabicMasks", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			setupArabicMasks(infos);
			expect(infos.length).toBe(0);
		});

		test("handles single character", () => {
			const infos = [makeInfo(0x0628)]; // BEH
			setupArabicMasks(infos);
			expect(infos.length).toBe(1);
		});

		test("handles two dual-joining letters", () => {
			// Two dual-joining letters: first gets init, second gets fina
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x064a), // YEH
			];
			setupArabicMasks(infos);
			expect(infos.length).toBe(2);
		});

		test("handles three dual-joining letters", () => {
			// Three letters: init, medi, fina
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x0633), // SEEN
				makeInfo(0x064a), // YEH
			];
			setupArabicMasks(infos);
			expect(infos.length).toBe(3);
		});

		test("handles right-joining after dual-joining", () => {
			// Dual + Right: first gets init, second gets fina
			const infos = [
				makeInfo(0x0628), // BEH (dual)
				makeInfo(0x0627), // ALEF (right)
			];
			setupArabicMasks(infos);
			expect(infos.length).toBe(2);
		});

		test("handles transparent marks between letters", () => {
			// Letter + mark + letter
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x064e), // FATHAH (transparent)
				makeInfo(0x064a), // YEH
			];
			setupArabicMasks(infos);
			expect(infos.length).toBe(3);
		});

		test("handles Arabic word with diacritics", () => {
			// مُحَمَّد (Muhammad) simplified
			const infos = [
				makeInfo(0x0645), // MEEM
				makeInfo(0x064f), // DAMMAH
				makeInfo(0x062d), // HAH
				makeInfo(0x064e), // FATHAH
				makeInfo(0x0645), // MEEM
				makeInfo(0x064e), // FATHAH
				makeInfo(0x062f), // DAL
			];
			setupArabicMasks(infos);
			expect(infos.length).toBe(7);
		});

		test("handles LAM-ALEF sequence", () => {
			// لا (lam-alef)
			const infos = [
				makeInfo(0x0644), // LAM
				makeInfo(0x0627), // ALEF
			];
			setupArabicMasks(infos);
			expect(infos.length).toBe(2);
		});
	});

	describe("JoiningAction enum", () => {
		test("has expected values", () => {
			expect(JoiningAction.None).toBe(0);
			expect(JoiningAction.Isol).toBe(1);
			expect(JoiningAction.Fina).toBe(2);
			expect(JoiningAction.Medi).toBe(3);
			expect(JoiningAction.Init).toBe(4);
		});
	});
});
