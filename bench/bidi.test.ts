import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import { Font, shape, UnicodeBuffer, getEmbeddings, getVisualOrder, detectDirection } from "../src"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

// BiDi test texts
const BIDI_TEXTS = {
	// Pure RTL
	arabic_only: "مرحبا بالعالم",
	hebrew_only: "שלום עולם",

	// Mixed LTR/RTL
	mixed_simple: "Hello مرحبا World",
	mixed_numbers: "Price: 123 دولار",
	mixed_complex: "The word مرحبا means hello في العربية and שלום in עברית",

	// Nested embeddings
	nested: "English עברית English عربي English",

	// Long mixed paragraph
	paragraph: `This is a test paragraph that contains both English and Arabic مرحبا بكم في هذا الاختبار
and also some Hebrew שלום לכולם and numbers like 12345 mixed with عربي text.
The quick brown fox الثعلب السريع البني jumps over the lazy dog الكلب الكسول.`,
}

describe("BiDi Processing Benchmark", () => {
	let hb: any
	let notoSans: Font
	let notoSansArabic: Font
	let hbNotoSans: any
	let hbNotoSansArabic: any

	beforeAll(async () => {
		hb = await import("harfbuzzjs").then((m) => m.default)

		const notoSansBuffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-Regular.ttf`)
		notoSans = Font.load(notoSansBuffer)
		const blob1 = hb.createBlob(notoSansBuffer)
		const face1 = hb.createFace(blob1, 0)
		hbNotoSans = { font: hb.createFont(face1), face: face1, blob: blob1 }

		const notoSansArabicBuffer = await loadFontBuffer(`${FONTS_DIR}/NotoSansArabic-Regular.ttf`)
		notoSansArabic = Font.load(notoSansArabicBuffer)
		const blob2 = hb.createBlob(notoSansArabicBuffer)
		const face2 = hb.createFace(blob2, 0)
		hbNotoSansArabic = { font: hb.createFont(face2), face: face2, blob: blob2 }
	})

	describe("Embedding Levels Computation", () => {
		for (const [name, text] of Object.entries(BIDI_TEXTS)) {
			test(`getEmbeddings - ${name}`, () => {
				const results: BenchResult[] = []

				results.push(
					measure("text-shaper", () => {
						getEmbeddings(text)
					}),
				)

				printComparison(`BiDi Embeddings - ${name} (${text.length} chars)`, results, "text-shaper")
				expect(results.length).toBe(1)
			})
		}
	})

	describe("Visual Order Computation", () => {
		for (const [name, text] of Object.entries(BIDI_TEXTS)) {
			test(`getVisualOrder - ${name}`, () => {
				const results: BenchResult[] = []
				const bidiResult = getEmbeddings(text)

				results.push(
					measure("text-shaper", () => {
						getVisualOrder(text, bidiResult)
					}),
				)

				printComparison(`Visual Order - ${name} (${text.length} chars)`, results, "text-shaper")
				expect(results.length).toBe(1)
			})
		}
	})

	describe("Mixed Text Shaping (Arabic + Latin)", () => {
		test("mixed_simple - shape with Arabic font", () => {
			const text = BIDI_TEXTS.mixed_simple
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSansArabic, buffer)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSansArabic.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison(`Mixed Text Shaping - simple (${text.length} chars)`, results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("mixed_complex - full pipeline", () => {
			const text = BIDI_TEXTS.mixed_complex
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSansArabic, buffer)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSansArabic.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison(`Mixed Text Shaping - complex (${text.length} chars)`, results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("paragraph - long mixed text", () => {
			const text = BIDI_TEXTS.paragraph
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSansArabic, buffer)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSansArabic.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison(`Mixed Text Shaping - paragraph (${text.length} chars)`, results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("RTL-only Shaping", () => {
		test("Arabic text", () => {
			const text = BIDI_TEXTS.arabic_only
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(notoSansArabic, buffer)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSansArabic.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison(`RTL Shaping - Arabic (${text.length} chars)`, results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Direction Detection", () => {
		const texts = [
			{ name: "LTR", text: "Hello World" },
			{ name: "RTL Arabic", text: "مرحبا بالعالم" },
			{ name: "RTL Hebrew", text: "שלום עולם" },
			{ name: "Mixed", text: "Hello مرحبا World" },
			{ name: "Numbers", text: "123456789" },
		]

		for (const { name, text } of texts) {
			test(`direction detection - ${name}`, () => {
				const results: BenchResult[] = []

				results.push(
					measure(
						"text-shaper",
						() => {
							detectDirection(text)
						},
						{ iterations: 1000 },
					),
				)

				printComparison(`Direction Detection - ${name}`, results, "text-shaper")
				expect(results.length).toBe(1)
			})
		}
	})
})
