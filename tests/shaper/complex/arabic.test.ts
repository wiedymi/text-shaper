import { describe, expect, test } from "bun:test";
import {
	ArabicJoiningType,
	JoiningAction,
	getJoiningType,
	isArabic,
	setupArabicMasks,
	analyzeJoining,
	getFeatureForAction,
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

			test("extended marks (0x08D3-0x08FF) are transparent", () => {
				expect(getJoiningType(0x08d3)).toBe(ArabicJoiningType.Transparent);
				expect(getJoiningType(0x08e0)).toBe(ArabicJoiningType.Transparent);
				expect(getJoiningType(0x08ff)).toBe(ArabicJoiningType.Transparent);
			});
		});

		describe("left-joining", () => {
			test("Syriac ALAPH is left-joining", () => {
				expect(getJoiningType(0x0710)).toBe(ArabicJoiningType.LeftJoining);
				expect(getJoiningType(0x0711)).toBe(ArabicJoiningType.LeftJoining);
				expect(getJoiningType(0x0712)).toBe(ArabicJoiningType.LeftJoining);
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

			test("characters outside all ranges are non-joining", () => {
				expect(getJoiningType(0x0900)).toBe(ArabicJoiningType.NonJoining);
				expect(getJoiningType(0x1000)).toBe(ArabicJoiningType.NonJoining);
			});

			test("boundary characters", () => {
				expect(getJoiningType(0x0700)).toBe(ArabicJoiningType.NonJoining);
				expect(getJoiningType(0x070f)).toBe(ArabicJoiningType.NonJoining);
				expect(getJoiningType(0x0713)).toBe(ArabicJoiningType.NonJoining);
				expect(getJoiningType(0x08d2)).toBe(ArabicJoiningType.NonJoining);
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

		test("handles character with undefined codepoint", () => {
			const infos: GlyphInfo[] = [
				{ glyphId: 0, cluster: 0, mask: 0, codepoint: 0 },
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask).toBe(0);
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

	describe("analyzeJoining", () => {
		test("handles empty array", () => {
			const infos: GlyphInfo[] = [];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([]);
		});

		test("handles single dual-joining letter as isolated", () => {
			const infos = [makeInfo(0x0628)]; // BEH
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Isol]);
		});

		test("handles two dual-joining letters", () => {
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x064a), // YEH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Init, JoiningAction.Fina]);
		});

		test("handles three dual-joining letters", () => {
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x0633), // SEEN
				makeInfo(0x064a), // YEH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([
				JoiningAction.Init,
				JoiningAction.Medi,
				JoiningAction.Fina,
			]);
		});

		test("handles right-joining letter", () => {
			const infos = [makeInfo(0x0627)]; // ALEF (right-joining)
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Isol]);
		});

		test("handles dual-joining followed by right-joining", () => {
			const infos = [
				makeInfo(0x0628), // BEH (dual)
				makeInfo(0x0627), // ALEF (right)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Init, JoiningAction.Fina]);
		});

		test("handles right-joining followed by dual-joining", () => {
			const infos = [
				makeInfo(0x0627), // ALEF (right)
				makeInfo(0x0628), // BEH (dual)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Isol, JoiningAction.Isol]);
		});

		test("handles transparent marks between letters", () => {
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x064e), // FATHAH (transparent)
				makeInfo(0x064a), // YEH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([
				JoiningAction.Init,
				JoiningAction.None,
				JoiningAction.Fina,
			]);
		});

		test("handles join-causing character", () => {
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x0640), // TATWEEL (join-causing)
				makeInfo(0x064a), // YEH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([
				JoiningAction.Init,
				JoiningAction.None,
				JoiningAction.Fina,
			]);
		});

		test("handles left-joining letter isolated", () => {
			const infos = [
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Isol]);
		});

		test("handles left-joining letter with right neighbor", () => {
			const infos = [
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
				makeInfo(0x0628), // BEH (dual)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Init, JoiningAction.Fina]);
		});

		test("handles dual-joining before left-joining", () => {
			const infos = [
				makeInfo(0x0628), // BEH (dual)
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Isol, JoiningAction.Isol]);
		});

		test("handles non-joining characters", () => {
			const infos = [
				makeInfo(0x0041), // ASCII 'A'
				makeInfo(0x0628), // BEH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.None, JoiningAction.Isol]);
		});

		test("handles complex word with multiple marks", () => {
			const infos = [
				makeInfo(0x0645), // MEEM
				makeInfo(0x064f), // DAMMAH
				makeInfo(0x062d), // HAH
				makeInfo(0x064e), // FATHAH
				makeInfo(0x0645), // MEEM
				makeInfo(0x064e), // FATHAH
				makeInfo(0x062f), // DAL (right-joining)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([
				JoiningAction.Init,
				JoiningAction.None,
				JoiningAction.Medi,
				JoiningAction.None,
				JoiningAction.Medi,
				JoiningAction.None,
				JoiningAction.Fina,
			]);
		});

		test("handles isolated letters separated by non-joining", () => {
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x0020), // SPACE
				makeInfo(0x064a), // YEH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([
				JoiningAction.Isol,
				JoiningAction.None,
				JoiningAction.Isol,
			]);
		});

		test("handles multiple transparent marks before letter", () => {
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x064e), // FATHAH
				makeInfo(0x0651), // SHADDA
				makeInfo(0x064a), // YEH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([
				JoiningAction.Init,
				JoiningAction.None,
				JoiningAction.None,
				JoiningAction.Fina,
			]);
		});

		test("handles transparent at start", () => {
			const infos = [
				makeInfo(0x064e), // FATHAH
				makeInfo(0x0628), // BEH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.None, JoiningAction.Isol]);
		});

		test("handles transparent at end", () => {
			const infos = [
				makeInfo(0x0628), // BEH
				makeInfo(0x064e), // FATHAH
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Isol, JoiningAction.None]);
		});

		test("handles dual-joining with join-causing on left", () => {
			const infos = [
				makeInfo(0x0640), // TATWEEL (join-causing)
				makeInfo(0x0628), // BEH (dual)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.None, JoiningAction.Fina]);
		});

		test("handles dual-joining with join-causing on right", () => {
			const infos = [
				makeInfo(0x0628), // BEH (dual)
				makeInfo(0x0640), // TATWEEL (join-causing)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Init, JoiningAction.None]);
		});

		test("handles right-joining with join-causing on left", () => {
			const infos = [
				makeInfo(0x0640), // TATWEEL (join-causing)
				makeInfo(0x0627), // ALEF (right)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.None, JoiningAction.Fina]);
		});

		test("handles left-joining with join-causing on right", () => {
			const infos = [
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
				makeInfo(0x0640), // TATWEEL (join-causing)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Init, JoiningAction.None]);
		});

		test("handles left-joining with right-joining on left", () => {
			const infos = [
				makeInfo(0x0627), // ALEF (right)
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([JoiningAction.Isol, JoiningAction.Isol]);
		});

		test("handles left-joining between two dual-joining", () => {
			const infos = [
				makeInfo(0x0628), // BEH (dual)
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
				makeInfo(0x064a), // YEH (dual)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([
				JoiningAction.Isol,
				JoiningAction.Init,
				JoiningAction.Fina,
			]);
		});

		test("handles join-causing between dual-joining letters", () => {
			const infos = [
				makeInfo(0x0628), // BEH (dual)
				makeInfo(0x0640), // TATWEEL (join-causing) - no form change
				makeInfo(0x064a), // YEH (dual)
			];
			const actions = analyzeJoining(infos);
			expect(actions).toEqual([
				JoiningAction.Init,
				JoiningAction.None,
				JoiningAction.Fina,
			]);
		});
	});

	describe("getFeatureForAction", () => {
		test("returns correct feature for Isol", () => {
			expect(getFeatureForAction(JoiningAction.Isol)).toBe("isol");
		});

		test("returns correct feature for Fina", () => {
			expect(getFeatureForAction(JoiningAction.Fina)).toBe("fina");
		});

		test("returns correct feature for Medi", () => {
			expect(getFeatureForAction(JoiningAction.Medi)).toBe("medi");
		});

		test("returns correct feature for Init", () => {
			expect(getFeatureForAction(JoiningAction.Init)).toBe("init");
		});

		test("returns null for None", () => {
			expect(getFeatureForAction(JoiningAction.None)).toBe(null);
		});

		test("returns null for invalid action", () => {
			expect(getFeatureForAction(999 as JoiningAction)).toBe(null);
		});
	});

	describe("setupArabicMasks - additional coverage", () => {
		test("handles right-joining letter isolated", () => {
			const infos = [
				makeInfo(0x0627), // ALEF (right) - isolated
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask & 0xf).toBe(0x1);
		});

		test("handles join-causing character", () => {
			const infos = [
				makeInfo(0x0640), // TATWEEL (join-causing)
				makeInfo(0x0628), // BEH
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask & 0xf).toBe(0);
			expect(infos[1]!.mask & 0xf).toBe(0x2);
		});

		test("handles right-joining after non-joining", () => {
			const infos = [
				makeInfo(0x0020), // SPACE (non-joining)
				makeInfo(0x0627), // ALEF (right)
			];
			setupArabicMasks(infos);
			expect(infos[1]!.mask & 0xf).toBe(0x1);
		});

		test("handles left-joining letter isolated", () => {
			const infos = [
				makeInfo(0x0710), // Syriac ALAPH (left-joining) - isolated
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask & 0xf).toBe(0x1); // isol
		});

		test("handles left-joining letter with right neighbor", () => {
			const infos = [
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
				makeInfo(0x0628), // BEH (dual)
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask & 0xf).toBe(0x8); // init
		});

		test("handles left-joining after dual-joining", () => {
			const infos = [
				makeInfo(0x0628), // BEH (dual)
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask & 0xf).toBe(0x1); // isol
			expect(infos[1]!.mask & 0xf).toBe(0x1); // isol
		});

		test("handles left-joining with right-joining on left", () => {
			const infos = [
				makeInfo(0x0627), // ALEF (right)
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask & 0xf).toBe(0x1); // isol
			expect(infos[1]!.mask & 0xf).toBe(0x1); // isol
		});

		test("handles left-joining with join-causing on right", () => {
			const infos = [
				makeInfo(0x0710), // Syriac ALAPH (left-joining)
				makeInfo(0x0640), // TATWEEL (join-causing)
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask & 0xf).toBe(0x8); // init
		});

		test("preserves upper bits of mask when setting", () => {
			const infos: GlyphInfo[] = [
				{ glyphId: 0, cluster: 0, mask: 0x000000f0, codepoint: 0x0628 },
			];
			setupArabicMasks(infos);
			expect(infos[0]!.mask).toBe(0x000000f1); // isol, preserving upper bits
		});
	});
});
