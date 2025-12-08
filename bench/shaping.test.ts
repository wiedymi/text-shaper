import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, loadTextFile, type BenchResult } from "./utils"
import { Font, shape, shapeInto, UnicodeBuffer, GlyphBuffer } from "../src"
import opentype from "opentype.js"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"
const TEXTS_DIR = "reference/rustybuzz/benches/texts"
const BENCH_TEXTS_DIR = "bench/texts"

interface ScriptConfig {
	name: string
	font: string
	fontDir?: string
	textDir: string
	textsDir?: string
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

const ADDITIONAL_SCRIPTS: ScriptConfig[] = [
	{
		name: "Russian",
		font: "Arial Unicode.ttf",
		fontDir: "/System/Library/Fonts/Supplemental",
		textDir: "russian",
		textsDir: BENCH_TEXTS_DIR,
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Ukrainian",
		font: "Arial Unicode.ttf",
		fontDir: "/System/Library/Fonts/Supplemental",
		textDir: "ukrainian",
		textsDir: BENCH_TEXTS_DIR,
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Belarusian",
		font: "Arial Unicode.ttf",
		fontDir: "/System/Library/Fonts/Supplemental",
		textDir: "belarusian",
		textsDir: BENCH_TEXTS_DIR,
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Chinese Simplified",
		font: "Arial Unicode.ttf",
		fontDir: "/System/Library/Fonts/Supplemental",
		textDir: "chinese_simplified",
		textsDir: BENCH_TEXTS_DIR,
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Chinese Traditional",
		font: "Arial Unicode.ttf",
		fontDir: "/System/Library/Fonts/Supplemental",
		textDir: "chinese_traditional",
		textsDir: BENCH_TEXTS_DIR,
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Japanese",
		font: "Arial Unicode.ttf",
		fontDir: "/System/Library/Fonts/Supplemental",
		textDir: "japanese",
		textsDir: BENCH_TEXTS_DIR,
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Korean",
		font: "Arial Unicode.ttf",
		fontDir: "/System/Library/Fonts/Supplemental",
		textDir: "korean",
		textsDir: BENCH_TEXTS_DIR,
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
	{
		name: "Greek",
		font: "Arial Unicode.ttf",
		fontDir: "/System/Library/Fonts/Supplemental",
		textDir: "greek",
		textsDir: BENCH_TEXTS_DIR,
		texts: ["word_1.txt", "sentence_1.txt", "paragraph_short.txt", "paragraph_medium.txt", "paragraph_long.txt"],
	},
]

describe("Text Shaping Benchmark", () => {
	let hb: any
	const fonts = new Map<string, Font>()
	const hbFonts = new Map<string, any>()
	const otFonts = new Map<string, opentype.Font>()
	const texts = new Map<string, string>()

	beforeAll(async () => {
		// Load harfbuzzjs
		hb = await import("harfbuzzjs").then((m) => m.default)

		// Load all fonts from reference folder
		for (const script of SCRIPTS) {
			const fontPath = script.fontDir ? `${script.fontDir}/${script.font}` : `${FONTS_DIR}/${script.font}`
			const buffer = await loadFontBuffer(fontPath)
			fonts.set(script.font, Font.load(buffer))

			const blob = hb.createBlob(buffer)
			const face = hb.createFace(blob, 0)
			const font = hb.createFont(face)
			hbFonts.set(script.font, { font, face, blob })

			// Load opentype.js font
			const otFont = opentype.parse(buffer)
			otFonts.set(script.font, otFont)
		}

		// Load additional fonts (system fonts)
		for (const script of ADDITIONAL_SCRIPTS) {
			const fontKey = script.fontDir ? `${script.fontDir}/${script.font}` : script.font
			if (!fonts.has(fontKey)) {
				try {
					const buffer = await loadFontBuffer(fontKey)
					fonts.set(fontKey, Font.load(buffer))

					const blob = hb.createBlob(buffer)
					const face = hb.createFace(blob, 0)
					const font = hb.createFont(face)
					hbFonts.set(fontKey, { font, face, blob })

					// Load opentype.js font
					const otFont = opentype.parse(buffer)
					otFonts.set(fontKey, otFont)
				} catch {
					// Skip missing fonts
				}
			}
		}

		// Load all texts from reference folder
		for (const script of SCRIPTS) {
			for (const textFile of script.texts) {
				const key = `${script.textDir}/${textFile}`
				const textsDir = script.textsDir || TEXTS_DIR
				try {
					const text = await loadTextFile(`${textsDir}/${key}`)
					texts.set(key, text.trim())
				} catch {
					// Skip missing files
				}
			}
		}

		// Load additional texts
		for (const script of ADDITIONAL_SCRIPTS) {
			for (const textFile of script.texts) {
				const key = `${script.textDir}/${textFile}`
				const textsDir = script.textsDir || TEXTS_DIR
				try {
					const text = await loadTextFile(`${textsDir}/${key}`)
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
					const otFont = otFonts.get(script.font)!

					const results: BenchResult[] = []

					// text-shaper with shapeInto (buffer reuse)
					const uBuffer = new UnicodeBuffer()
					const gBuffer = GlyphBuffer.withCapacity(256)
					results.push(
						measure("text-shaper", () => {
							uBuffer.clear()
							uBuffer.addStr(text)
							gBuffer.reset()
							shapeInto(font, uBuffer, gBuffer)
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

					// opentype.js
					results.push(
						measure("opentype.js", () => {
							otFont.stringToGlyphs(text)
						}),
					)

					printComparison(
						`Text Shaping - ${script.name} ${testName} (${text.length} chars)`,
						results,
						"text-shaper",
					)
					expect(results.length).toBe(3)
				})
			}
		})
	}

	for (const script of ADDITIONAL_SCRIPTS) {
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

					const fontKey = script.fontDir ? `${script.fontDir}/${script.font}` : script.font
					const font = fonts.get(fontKey)
					const hbFont = hbFonts.get(fontKey)
					const otFont = otFonts.get(fontKey)
					if (!font || !hbFont || !otFont) {
						console.log(`Skipping ${script.name}/${testName}: font not found`)
						return
					}

					const results: BenchResult[] = []

					// text-shaper with shapeInto (buffer reuse)
					const uBuffer = new UnicodeBuffer()
					const gBuffer = GlyphBuffer.withCapacity(256)
					results.push(
						measure("text-shaper", () => {
							uBuffer.clear()
							uBuffer.addStr(text)
							gBuffer.reset()
							shapeInto(font, uBuffer, gBuffer)
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

					// opentype.js
					results.push(
						measure("opentype.js", () => {
							otFont.stringToGlyphs(text)
						}),
					)

					printComparison(
						`Text Shaping - ${script.name} ${testName} (${text.length} chars)`,
						results,
						"text-shaper",
					)
					expect(results.length).toBe(3)
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
			const otFont = otFonts.get("NotoSans-Regular.ttf")!

			const results: BenchResult[] = []

			const uBuffer = new UnicodeBuffer()
			const gBuffer = GlyphBuffer.withCapacity(512)
			results.push(
				measure("text-shaper", () => {
					uBuffer.clear()
					uBuffer.addStr(text)
					gBuffer.reset()
					shapeInto(font, uBuffer, gBuffer)
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

			results.push(
				measure("opentype.js", () => {
					otFont.stringToGlyphs(text)
				}),
			)

			printComparison(
				`Text Shaping - Zalgo short (${text.length} chars)`,
				results,
				"text-shaper",
			)
			expect(results.length).toBe(3)
		})

		test("long_zalgo", () => {
			const text = texts.get("english/long_zalgo.txt")
			if (!text) return

			const font = fonts.get("NotoSans-Regular.ttf")!
			const hbFont = hbFonts.get("NotoSans-Regular.ttf")!
			const otFont = otFonts.get("NotoSans-Regular.ttf")!

			const results: BenchResult[] = []

			const uBuffer = new UnicodeBuffer()
			const gBuffer = GlyphBuffer.withCapacity(2048)
			results.push(
				measure("text-shaper", () => {
					uBuffer.clear()
					uBuffer.addStr(text)
					gBuffer.reset()
					shapeInto(font, uBuffer, gBuffer)
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

			results.push(
				measure("opentype.js", () => {
					otFont.stringToGlyphs(text)
				}),
			)

			printComparison(
				`Text Shaping - Zalgo long (${text.length} chars)`,
				results,
				"text-shaper",
			)
			expect(results.length).toBe(3)
		})
	})

	describe("Variable Font", () => {
		let variableFont: Font
		let hbVariableFont: any
		let otVariableFont: opentype.Font

		beforeAll(async () => {
			const buffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-VariableFont.ttf`)
			variableFont = Font.load(buffer)

			const blob = hb.createBlob(buffer)
			const face = hb.createFace(blob, 0)
			const font = hb.createFont(face)
			hbVariableFont = { font, face, blob }

			otVariableFont = opentype.parse(buffer)
		})

		test("default variations", () => {
			const text = texts.get("english/paragraph_medium.txt")
			if (!text) return

			const results: BenchResult[] = []

			const uBuffer = new UnicodeBuffer()
			const gBuffer = GlyphBuffer.withCapacity(1024)
			results.push(
				measure("text-shaper", () => {
					uBuffer.clear()
					uBuffer.addStr(text)
					gBuffer.reset()
					shapeInto(variableFont, uBuffer, gBuffer)
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

			results.push(
				measure("opentype.js", () => {
					otVariableFont.stringToGlyphs(text)
				}),
			)

			printComparison(
				"Text Shaping - Variable Font (default)",
				results,
				"text-shaper",
			)
			expect(results.length).toBe(3)
		})
	})
})
