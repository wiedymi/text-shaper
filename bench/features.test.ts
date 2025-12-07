import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import {
	Font,
	shape,
	UnicodeBuffer,
	standardLigatures,
	kerning,
	smallCaps,
	oldstyleFigures,
	tabularFigures,
	fractions,
	stylisticSet,
	contextualAlternates,
} from "../src"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

// Test texts that exercise specific features
const FEATURE_TEXTS = {
	ligatures: "fi fl ff ffi ffl", // Standard ligatures
	kerning: "AVATAR WAY TAVERN Type", // Kerning pairs
	smallcaps: "Hello World ABCDEFG", // Small caps
	figures: "0123456789 $1,234.56", // Figure styles
	fractions: "1/2 3/4 1/4 2/3 5/8", // Fractions
	contextual: "The quick brown fox", // Contextual alternates
	mixed: "The five boxing wizards jump quickly. 1234567890 fi fl ff",
}

describe("OpenType Features Benchmark", () => {
	let hb: any
	let notoSans: Font
	let hbNotoSans: any

	beforeAll(async () => {
		hb = await import("harfbuzzjs").then((m) => m.default)

		const buffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-Regular.ttf`)
		notoSans = Font.load(buffer)

		const blob = hb.createBlob(buffer)
		const face = hb.createFace(blob, 0)
		hbNotoSans = { font: hb.createFont(face), face, blob }
	})

	describe("No Features (Baseline)", () => {
		test("mixed text - no features", () => {
			const text = FEATURE_TEXTS.mixed
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison("No Features - mixed text", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Standard Ligatures (liga)", () => {
		test("ligature text with liga enabled", () => {
			const text = FEATURE_TEXTS.ligatures
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [standardLigatures()] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "liga")
					buffer.destroy()
				}),
			)

			printComparison("Standard Ligatures - liga text", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("mixed text with liga", () => {
			const text = FEATURE_TEXTS.mixed
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [standardLigatures()] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "liga")
					buffer.destroy()
				}),
			)

			printComparison("Standard Ligatures - mixed text", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Kerning (kern)", () => {
		test("kerning pairs", () => {
			const text = FEATURE_TEXTS.kerning
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [kerning()] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "kern")
					buffer.destroy()
				}),
			)

			printComparison("Kerning - pairs text", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Small Caps (smcp)", () => {
		test("small caps text", () => {
			const text = FEATURE_TEXTS.smallcaps
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [smallCaps()] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "smcp")
					buffer.destroy()
				}),
			)

			printComparison("Small Caps - text", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Figure Styles (onum, tnum)", () => {
		test("oldstyle figures", () => {
			const text = FEATURE_TEXTS.figures
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [oldstyleFigures()] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "onum")
					buffer.destroy()
				}),
			)

			printComparison("Oldstyle Figures - numbers", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("tabular figures", () => {
			const text = FEATURE_TEXTS.figures
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [tabularFigures()] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "tnum")
					buffer.destroy()
				}),
			)

			printComparison("Tabular Figures - numbers", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Fractions (frac)", () => {
		test("fraction text", () => {
			const text = FEATURE_TEXTS.fractions
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [fractions()] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "frac")
					buffer.destroy()
				}),
			)

			printComparison("Fractions - text", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Multiple Features Combined", () => {
		test("liga + kern", () => {
			const text = FEATURE_TEXTS.mixed
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, { features: [standardLigatures(), kerning()] })
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "liga,kern")
					buffer.destroy()
				}),
			)

			printComparison("liga + kern - mixed text", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("liga + kern + smcp", () => {
			const text = FEATURE_TEXTS.mixed
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, {
						features: [standardLigatures(), kerning(), smallCaps()],
					})
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "liga,kern,smcp")
					buffer.destroy()
				}),
			)

			printComparison("liga + kern + smcp - mixed text", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("all common features", () => {
			const text = FEATURE_TEXTS.mixed
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSans, buffer, {
						features: [
							standardLigatures(),
							kerning(),
							contextualAlternates(),
						],
					})
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer, "liga,kern,calt")
					buffer.destroy()
				}),
			)

			printComparison("All Common Features - mixed text", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Feature Toggle Overhead", () => {
		test("feature lookup overhead - 0 features", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer, { features: [] })
					},
					{ iterations: 500 },
				),
			)

			printComparison("Feature Overhead - 0 features", results, "text-shaper")
			expect(results.length).toBe(1)
		})

		test("feature lookup overhead - 1 feature", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer, { features: [standardLigatures()] })
					},
					{ iterations: 500 },
				),
			)

			printComparison("Feature Overhead - 1 feature", results, "text-shaper")
			expect(results.length).toBe(1)
		})

		test("feature lookup overhead - 5 features", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer, {
							features: [
								standardLigatures(),
								kerning(),
								smallCaps(),
								tabularFigures(),
								fractions(),
							],
						})
					},
					{ iterations: 500 },
				),
			)

			printComparison("Feature Overhead - 5 features", results, "text-shaper")
			expect(results.length).toBe(1)
		})
	})

	describe("Stylistic Sets (ss01-ss20)", () => {
		for (const ssNum of [1, 5, 10]) {
			test(`stylistic set ss${ssNum.toString().padStart(2, "0")}`, () => {
				const text = FEATURE_TEXTS.mixed
				const results: BenchResult[] = []

				results.push(
					measure("text-shaper", () => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer, { features: [stylisticSet(ssNum)] })
					}),
				)

				const ssTag = `ss${ssNum.toString().padStart(2, "0")}`
				results.push(
					measure("harfbuzzjs", () => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbNotoSans.font, buffer, ssTag)
						buffer.destroy()
					}),
				)

				printComparison(`Stylistic Set ${ssTag}`, results, "text-shaper")
				expect(results.length).toBe(2)
			})
		}
	})
})
