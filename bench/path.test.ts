import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import { Font, getGlyphPath, pathToSVG, shape, UnicodeBuffer } from "../src"
import opentype from "opentype.js"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

describe("Path Rendering Benchmark", () => {
	let hb: any
	let notoSans: Font
	let notoSansOT: opentype.Font
	let hbFont: any

	// Representative glyphs
	const LATIN_GLYPHS = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45] // 10 glyphs

	beforeAll(async () => {
		const buffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-Regular.ttf`)
		notoSans = new Font(buffer)
		notoSansOT = opentype.parse(buffer)

		hb = await import("harfbuzzjs").then((m) => m.default)
		const blob = hb.createBlob(buffer)
		const face = hb.createFace(blob, 0)
		hbFont = hb.createFont(face)
	})

	describe("Glyph Path Extraction", () => {
		test("getGlyphPath comparison", () => {
			const results: BenchResult[] = []

			// text-shaper
			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						getGlyphPath(notoSans, glyphId)
					}
				}),
			)

			// opentype.js
			results.push(
				measure("opentype.js", () => {
					for (const glyphId of LATIN_GLYPHS) {
						notoSansOT.glyphs.get(glyphId)?.getPath(0, 0, 72)
					}
				}),
			)

			// harfbuzzjs
			results.push(
				measure("harfbuzzjs", () => {
					for (const glyphId of LATIN_GLYPHS) {
						hbFont.glyphToPath(glyphId)
					}
				}),
			)

			printComparison("Glyph Path Extraction (10 glyphs)", results, "text-shaper")
			expect(results.length).toBe(3)
		})
	})

	describe("SVG Path Generation", () => {
		test("pathToSVG vs opentype.js toPathData", () => {
			const results: BenchResult[] = []

			// text-shaper: get path then convert to SVG
			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						const path = getGlyphPath(notoSans, glyphId)
						if (path) pathToSVG(path)
					}
				}),
			)

			// opentype.js
			results.push(
				measure("opentype.js", () => {
					for (const glyphId of LATIN_GLYPHS) {
						const glyph = notoSansOT.glyphs.get(glyphId)
						glyph?.getPath(0, 0, 72).toPathData(2)
					}
				}),
			)

			// harfbuzzjs returns SVG path directly
			results.push(
				measure("harfbuzzjs", () => {
					for (const glyphId of LATIN_GLYPHS) {
						hbFont.glyphToPath(glyphId)
					}
				}),
			)

			printComparison("SVG Path Generation (10 glyphs)", results, "text-shaper")
			expect(results.length).toBe(3)
		})
	})

	describe("Full Text to SVG Pipeline", () => {
		test("Hello World", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			// text-shaper: shape then get paths
			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					const shaped = shape(notoSans, buffer)
					for (const info of shaped.infos) {
						const path = getGlyphPath(notoSans, info.glyphId)
						if (path) pathToSVG(path)
					}
				}),
			)

			// opentype.js doesn't have full shaping, just get path for text
			results.push(
				measure("opentype.js", () => {
					notoSansOT.getPath(text, 0, 0, 72).toPathData(2)
				}),
			)

			// harfbuzzjs: shape then get paths
			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbFont, buffer)
					const output = buffer.json()
					for (const glyph of output) {
						hbFont.glyphToPath(glyph.g)
					}
					buffer.destroy()
				}),
			)

			printComparison("Text to SVG - 'Hello World'", results, "text-shaper")
			expect(results.length).toBe(3)
		})

		test("Longer paragraph", () => {
			const text = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs."
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					const shaped = shape(notoSans, buffer)
					for (const info of shaped.infos) {
						const path = getGlyphPath(notoSans, info.glyphId)
						if (path) pathToSVG(path)
					}
				}),
			)

			results.push(
				measure("opentype.js", () => {
					notoSansOT.getPath(text, 0, 0, 72).toPathData(2)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbFont, buffer)
					const output = buffer.json()
					for (const glyph of output) {
						hbFont.glyphToPath(glyph.g)
					}
					buffer.destroy()
				}),
			)

			printComparison("Text to SVG - Paragraph (87 chars)", results, "text-shaper")
			expect(results.length).toBe(3)
		})
	})

	describe("Scaled Path", () => {
		test("72pt scaled paths", () => {
			const fontSize = 72
			const scale = fontSize / notoSans.unitsPerEm
			const results: BenchResult[] = []

			// text-shaper - path needs manual scaling
			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						const path = getGlyphPath(notoSans, glyphId)
						if (path) {
							pathToSVG(path, { scale })
						}
					}
				}),
			)

			// opentype.js - fontSize built into getPath
			results.push(
				measure("opentype.js", () => {
					for (const glyphId of LATIN_GLYPHS) {
						const glyph = notoSansOT.glyphs.get(glyphId)
						glyph?.getPath(0, 0, fontSize).toPathData(2)
					}
				}),
			)

			// harfbuzzjs - requires manual scaling
			results.push(
				measure("harfbuzzjs", () => {
					for (const glyphId of LATIN_GLYPHS) {
						hbFont.glyphToPath(glyphId)
					}
				}),
			)

			printComparison("Scaled Path (72pt, 10 glyphs)", results, "text-shaper")
			expect(results.length).toBe(3)
		})
	})
})
