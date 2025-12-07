import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import {
	Font,
	shape,
	UnicodeBuffer,
	standardLigatures,
	kerning,
	smallCaps,
} from "../src"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

describe("Shape Plan Compilation Benchmark", () => {
	let hb: any
	let notoSans: Font
	let notoSansArabic: Font
	let notoSansDevanagari: Font
	let variableFont: Font
	let hbNotoSans: any

	beforeAll(async () => {
		hb = await import("harfbuzzjs").then((m) => m.default)

		const notoSansBuffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-Regular.ttf`)
		notoSans = Font.load(notoSansBuffer)
		const blob = hb.createBlob(notoSansBuffer)
		const face = hb.createFace(blob, 0)
		hbNotoSans = { font: hb.createFont(face), face, blob }

		notoSansArabic = Font.load(await loadFontBuffer(`${FONTS_DIR}/NotoSansArabic-Regular.ttf`))
		notoSansDevanagari = Font.load(await loadFontBuffer(`${FONTS_DIR}/NotoSansDevanagari-Regular.ttf`))
		variableFont = Font.load(await loadFontBuffer(`${FONTS_DIR}/NotoSans-VariableFont.ttf`))
	})

	describe("Plan Creation by Script", () => {
		const scripts = [
			{ name: "Latin", font: () => notoSans, text: "Hello World" },
			{ name: "Arabic", font: () => notoSansArabic, text: "مرحبا بالعالم" },
			{ name: "Devanagari", font: () => notoSansDevanagari, text: "नमस्ते दुनिया" },
		]

		for (const { name, font, text } of scripts) {
			test(`shape with ${name} script`, () => {
				const results: BenchResult[] = []
				const f = font()

				// First shape to warm cache
				const warmBuffer = new UnicodeBuffer()
				warmBuffer.addStr(text)
				shape(f, warmBuffer)

				results.push(
					measure(
						"text-shaper (cached)",
						() => {
							const buffer = new UnicodeBuffer()
							buffer.addStr(text)
							shape(f, buffer)
						},
						{ warmup: 10, iterations: 100 },
					),
				)

				printComparison(`Shape with ${name} Script`, results, "text-shaper (cached)")
				expect(results.length).toBe(1)
			})
		}
	})

	describe("Plan Cache Hit vs Miss", () => {
		test("cache hit - same text repeated", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			// Prime cache
			const primeBuffer = new UnicodeBuffer()
			primeBuffer.addStr(text)
			shape(notoSans, primeBuffer)

			results.push(
				measure(
					"cache hit",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ iterations: 500 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbNotoSans.font, buffer)
						buffer.destroy()
					},
					{ iterations: 500 },
				),
			)

			printComparison("Plan Cache Hit - Same Text", results, "cache hit")
			expect(results.length).toBe(2)
		})

		test("varying features - cache miss pattern", () => {
			const text = "Hello World"
			const results: BenchResult[] = []
			let counter = 0

			results.push(
				measure(
					"varying features",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						// Different features each time forces new plan
						shape(notoSans, buffer, { features: [{ tag: 0x74657374, enabled: counter++ % 2 === 0 }] })
					},
					{ warmup: 0, iterations: 100 },
				),
			)

			printComparison("Plan Cache Miss - Varying Features", results, "varying features")
			expect(results.length).toBe(1)
		})
	})

	describe("Feature Configuration Impact", () => {
		test("no features", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"no features",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer, { features: [] })
					},
					{ iterations: 200 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbNotoSans.font, buffer)
						buffer.destroy()
					},
					{ iterations: 200 },
				),
			)

			printComparison("Shape - No Features", results, "no features")
			expect(results.length).toBe(2)
		})

		test("standard features (liga + kern)", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"liga + kern",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer, { features: [standardLigatures(), kerning()] })
					},
					{ iterations: 200 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbNotoSans.font, buffer, "liga,kern")
						buffer.destroy()
					},
					{ iterations: 200 },
				),
			)

			printComparison("Shape - liga + kern", results, "liga + kern")
			expect(results.length).toBe(2)
		})

		test("many features", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"many features",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer, {
							features: [
								standardLigatures(),
								kerning(),
								smallCaps(),
								{ tag: 0x73733031, enabled: true }, // ss01
								{ tag: 0x73733032, enabled: true }, // ss02
								{ tag: 0x73733033, enabled: true }, // ss03
							],
						})
					},
					{ iterations: 200 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbNotoSans.font, buffer, "liga,kern,smcp,ss01,ss02,ss03")
						buffer.destroy()
					},
					{ iterations: 200 },
				),
			)

			printComparison("Shape - Many Features", results, "many features")
			expect(results.length).toBe(2)
		})
	})

	describe("Variable Font", () => {
		test("variable font - default variations", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"default variations",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(variableFont, buffer)
					},
					{ iterations: 200 },
				),
			)

			printComparison("Variable Font - Default Variations", results, "default variations")
			expect(results.length).toBe(1)
		})

		test("variable font - custom variations", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"custom variations",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(variableFont, buffer, {})
					},
					{ iterations: 200 },
				),
			)

			printComparison("Variable Font - Custom Variations", results, "custom variations")
			expect(results.length).toBe(1)
		})
	})

	describe("Direction and Script", () => {
		test("LTR text shaping", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure(
					"LTR text",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ iterations: 200 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbNotoSans.font, buffer)
						buffer.destroy()
					},
					{ iterations: 200 },
				),
			)

			printComparison("Shape - LTR Text", results, "LTR text")
			expect(results.length).toBe(2)
		})

		test("RTL text shaping", () => {
			const text = "مرحبا بالعالم"
			const results: BenchResult[] = []

			results.push(
				measure(
					"RTL text",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSansArabic, buffer)
					},
					{ iterations: 200 },
				),
			)

			printComparison("Shape - RTL Text", results, "RTL text")
			expect(results.length).toBe(1)
		})
	})

	describe("Fresh vs Cached Plan in Full Shape", () => {
		test("shape with fresh plan vs cached plan", () => {
			const text = "The quick brown fox jumps over the lazy dog."
			const results: BenchResult[] = []

			// Fresh plan each time (worst case) - change tag to force cache miss
			let counter = 0
			results.push(
				measure(
					"fresh plan",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer, { features: [{ tag: 0x74657374 + counter++, enabled: true }] })
					},
					{ warmup: 0, iterations: 50 },
				),
			)

			// Cached plan (best case)
			results.push(
				measure(
					"cached plan",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ warmup: 10, iterations: 100 },
				),
			)

			printComparison("Shape - Fresh vs Cached Plan", results, "cached plan")
			expect(results.length).toBe(2)
		})
	})

	describe("Complex Scripts", () => {
		test("Arabic shaping", () => {
			const text = "مرحبا بالعالم"
			const results: BenchResult[] = []

			results.push(
				measure(
					"Arabic",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSansArabic, buffer)
					},
					{ iterations: 200 },
				),
			)

			printComparison("Complex Script - Arabic", results, "Arabic")
			expect(results.length).toBe(1)
		})

		test("Devanagari shaping", () => {
			const text = "नमस्ते दुनिया"
			const results: BenchResult[] = []

			results.push(
				measure(
					"Devanagari",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSansDevanagari, buffer)
					},
					{ iterations: 200 },
				),
			)

			printComparison("Complex Script - Devanagari", results, "Devanagari")
			expect(results.length).toBe(1)
		})
	})

	describe("Text Length Scaling", () => {
		test("scaling with text length", () => {
			const results: BenchResult[] = []
			const lengths = [10, 100, 1000]

			for (const len of lengths) {
				const text = "A".repeat(len)
				results.push(
					measure(
						`${len} chars`,
						() => {
							const buffer = new UnicodeBuffer()
							buffer.addStr(text)
							shape(notoSans, buffer)
						},
						{ iterations: 50 },
					),
				)
			}

			console.log("\nShape - Scaling with Text Length")
			for (const r of results) {
				console.log(`  ${r.name}: ${r.avgMs.toFixed(3)}ms avg`)
			}
			expect(results.length).toBe(3)
		})
	})
})
