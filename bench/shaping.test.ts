import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, loadTextFile, type BenchResult } from "./utils"
import { Font, shape, UnicodeBuffer } from "../src"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"
const TEXTS_DIR = "reference/rustybuzz/benches/texts"

interface ScriptConfig {
	name: string
	font: string
	textDir: string
	texts: string[]
}

const SCRIPTS: ScriptConfig[] = [
	{
		name: "English",
		font: "NotoSans-Regular.ttf",
		textDir: "english",
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Arabic",
		font: "NotoSansArabic-Regular.ttf",
		textDir: "arabic",
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Hebrew",
		font: "NotoSansHebrew-Regular.ttf",
		textDir: "hebrew",
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_medium.txt", "paragraph_long_1.txt"],
	},
	{
		name: "Hindi",
		font: "NotoSansDevanagari-Regular.ttf",
		textDir: "hindi",
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Thai",
		font: "NotoSansThai-Regular.ttf",
		textDir: "thai",
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Khmer",
		font: "NotoSansKhmer-Regular.ttf",
		textDir: "khmer",
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_medium.txt", "paragraph_long_1.txt"],
	},
	{
		name: "Myanmar",
		font: "NotoSansMyanmar-Regular.ttf",
		textDir: "myanmar",
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
]

describe("Text Shaping Benchmark", () => {
	let hb: any
	const fonts = new Map<string, Font>()
	const hbFonts = new Map<string, any>()
	const texts = new Map<string, string>()

	beforeAll(async () => {
		// Load harfbuzzjs
		hb = await import("harfbuzzjs").then((m) => m.default)

		// Load all fonts
		for (const script of SCRIPTS) {
			const buffer = await loadFontBuffer(`${FONTS_DIR}/${script.font}`)
			fonts.set(script.font, new Font(buffer))

			const blob = hb.createBlob(buffer)
			const face = hb.createFace(blob, 0)
			const font = hb.createFont(face)
			hbFonts.set(script.font, { font, face, blob })
		}

		// Load all texts
		for (const script of SCRIPTS) {
			for (const textFile of script.texts) {
				const key = `${script.textDir}/${textFile}`
				try {
					const text = await loadTextFile(`${TEXTS_DIR}/${key}`)
					texts.set(key, text.trim())
				} catch {
					// Skip missing files
				}
			}
		}
	})

	for (const script of SCRIPTS) {
		describe(script.name, () => {
			for (const textFile of script.texts) {
				const testName = textFile.replace(".txt", "")

				test(testName, () => {
					const textKey = `${script.textDir}/${textFile}`
					const text = texts.get(textKey)
					if (!text) {
						console.log(`Skipping ${script.name}/${testName}: text file not found`)
						return
					}

					const font = fonts.get(script.font)!
					const hbFont = hbFonts.get(script.font)!

					const results: BenchResult[] = []

					// text-shaper
					results.push(
						measure("text-shaper", () => {
							const buffer = new UnicodeBuffer()
							buffer.addStr(text)
							shape(font, buffer)
						}),
					)

					// harfbuzzjs
					results.push(
						measure("harfbuzzjs", () => {
							const buffer = hb.createBuffer()
							buffer.addText(text)
							buffer.guessSegmentProperties()
							hb.shape(hbFont.font, buffer)
							buffer.destroy()
						}),
					)

					printComparison(
						`Text Shaping - ${script.name} ${testName} (${text.length} chars)`,
						results,
						"text-shaper",
					)
					expect(results.length).toBe(2)
				})
			}
		})
	}

	describe("English Zalgo", () => {
		test("short_zalgo", () => {
			const text = texts.get("english/short_zalgo.txt")
			if (!text) return

			const font = fonts.get("NotoSans-Regular.ttf")!
			const hbFont = hbFonts.get("NotoSans-Regular.ttf")!

			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(font, buffer)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbFont.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison(
				`Text Shaping - Zalgo short (${text.length} chars)`,
				results,
				"text-shaper",
			)
			expect(results.length).toBe(2)
		})

		test("long_zalgo", () => {
			const text = texts.get("english/long_zalgo.txt")
			if (!text) return

			const font = fonts.get("NotoSans-Regular.ttf")!
			const hbFont = hbFonts.get("NotoSans-Regular.ttf")!

			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(font, buffer)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbFont.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison(
				`Text Shaping - Zalgo long (${text.length} chars)`,
				results,
				"text-shaper",
			)
			expect(results.length).toBe(2)
		})
	})

	describe("Variable Font", () => {
		let variableFont: Font
		let hbVariableFont: any

		beforeAll(async () => {
			const buffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-VariableFont.ttf`)
			variableFont = new Font(buffer)

			const blob = hb.createBlob(buffer)
			const face = hb.createFace(blob, 0)
			const font = hb.createFont(face)
			hbVariableFont = { font, face, blob }
		})

		test("default variations", () => {
			const text = texts.get("english/paragraph_medium.txt")
			if (!text) return

			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(variableFont, buffer)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbVariableFont.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison(
				"Text Shaping - Variable Font (default)",
				results,
				"text-shaper",
			)
			expect(results.length).toBe(2)
		})
	})
})
