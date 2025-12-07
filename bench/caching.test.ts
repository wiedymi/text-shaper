import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import {
	Font,
	shape,
	shapeInto,
	UnicodeBuffer,
	GlyphBuffer,
	getGlyphPath,
	rasterizeGlyph,
	PixelMode,
} from "../src"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

describe("Caching Benchmark", () => {
	let hb: any
	let notoSans: Font
	let notoSansArabic: Font
	let hbNotoSans: any

	beforeAll(async () => {
		hb = await import("harfbuzzjs").then((m) => m.default)

		const buffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-Regular.ttf`)
		notoSans = Font.load(buffer)

		const blob = hb.createBlob(buffer)
		const face = hb.createFace(blob, 0)
		hbNotoSans = { font: hb.createFont(face), face, blob }

		const arabicBuffer = await loadFontBuffer(`${FONTS_DIR}/NotoSansArabic-Regular.ttf`)
		notoSansArabic = Font.load(arabicBuffer)
	})

	describe("Shape Plan Caching", () => {
		test("cold vs warm shape - Latin", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			// Cold - first run without warmup
			results.push(
				measure(
					"cold (first)",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ warmup: 0, iterations: 10 },
				),
			)

			// Warm - subsequent runs with cache
			results.push(
				measure(
					"warm (cached)",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ warmup: 10, iterations: 100 },
				),
			)

			printComparison("Shape - Cold vs Warm (Latin)", results, "warm (cached)")
			expect(results.length).toBe(2)
		})

		test("cold vs warm shape - Arabic", () => {
			const text = "مرحبا بالعالم"
			const results: BenchResult[] = []

			// Cold
			results.push(
				measure(
					"cold (first)",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSansArabic, buffer)
					},
					{ warmup: 0, iterations: 10 },
				),
			)

			// Warm
			results.push(
				measure(
					"warm (cached)",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSansArabic, buffer)
					},
					{ warmup: 10, iterations: 100 },
				),
			)

			printComparison("Shape - Cold vs Warm (Arabic)", results, "warm (cached)")
			expect(results.length).toBe(2)
		})
	})

	describe("Repeated Shaping (Same Text)", () => {
		test("same text repeated - short", () => {
			const text = "Hello"
			const results: BenchResult[] = []

			// First iteration (cold)
			results.push(
				measure(
					"text-shaper (first)",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ warmup: 0, iterations: 1 },
				),
			)

			// Subsequent iterations (warm) - use shapeInto for buffer reuse
			const uBuffer = new UnicodeBuffer()
			const gBuffer = GlyphBuffer.withCapacity(64)
			results.push(
				measure(
					"text-shaper (repeat)",
					() => {
						uBuffer.clear()
						uBuffer.addStr(text)
						gBuffer.reset()
						shapeInto(notoSans, uBuffer, gBuffer)
					},
					{ warmup: 10, iterations: 100 },
				),
			)

			// harfbuzzjs comparison
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
					{ warmup: 10, iterations: 100 },
				),
			)

			printComparison(`Repeated Shaping - "${text}"`, results, "text-shaper (repeat)")
			expect(results.length).toBe(3)
		})

		test("same text repeated - paragraph", () => {
			const text = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs."
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper (first)",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ warmup: 0, iterations: 1 },
				),
			)

			// Use shapeInto for buffer reuse
			const uBuffer = new UnicodeBuffer()
			const gBuffer = GlyphBuffer.withCapacity(256)
			results.push(
				measure(
					"text-shaper (repeat)",
					() => {
						uBuffer.clear()
						uBuffer.addStr(text)
						gBuffer.reset()
						shapeInto(notoSans, uBuffer, gBuffer)
					},
					{ warmup: 10, iterations: 100 },
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
					{ warmup: 10, iterations: 100 },
				),
			)

			printComparison(`Repeated Shaping - paragraph (${text.length} chars)`, results, "text-shaper (repeat)")
			expect(results.length).toBe(3)
		})
	})

	describe("Varying Text (Cache Miss Pattern)", () => {
		test("unique texts each iteration", () => {
			const results: BenchResult[] = []
			let counter = 0

			results.push(
				measure(
					"text-shaper",
					() => {
						const text = `Unique text number ${counter++}`
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ warmup: 0, iterations: 100 },
				),
			)

			counter = 0
			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const text = `Unique text number ${counter++}`
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbNotoSans.font, buffer)
						buffer.destroy()
					},
					{ warmup: 0, iterations: 100 },
				),
			)

			printComparison("Unique Texts (no cache benefit)", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("cycling through 10 different texts", () => {
			const texts = [
				"Hello World",
				"The quick brown fox",
				"Pack my box",
				"Sphinx of black quartz",
				"How vexingly quick",
				"Jackdaws love my big",
				"The five boxing wizards",
				"Crazy Frederick bought",
				"Jived fox nymph grabs",
				"Glib jocks quiz nymph",
			]
			const results: BenchResult[] = []
			let index = 0

			results.push(
				measure(
					"text-shaper",
					() => {
						const text = texts[index++ % texts.length]
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(notoSans, buffer)
					},
					{ warmup: 0, iterations: 500 },
				),
			)

			index = 0
			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const text = texts[index++ % texts.length]
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbNotoSans.font, buffer)
						buffer.destroy()
					},
					{ warmup: 0, iterations: 500 },
				),
			)

			printComparison("Cycling 10 texts (some cache hits)", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Glyph Path Caching", () => {
		test("same glyph repeated", () => {
			const glyphId = 36 // 'A'
			const results: BenchResult[] = []

			results.push(
				measure(
					"first access",
					() => {
						getGlyphPath(notoSans, glyphId)
					},
					{ warmup: 0, iterations: 1 },
				),
			)

			results.push(
				measure(
					"repeated access",
					() => {
						getGlyphPath(notoSans, glyphId)
					},
					{ warmup: 10, iterations: 1000 },
				),
			)

			printComparison("Glyph Path - same glyph", results, "repeated access")
			expect(results.length).toBe(2)
		})

		test("cycling through alphabet", () => {
			const glyphs = Array.from({ length: 26 }, (_, i) => 36 + i) // A-Z
			const results: BenchResult[] = []
			let index = 0

			results.push(
				measure(
					"first pass",
					() => {
						const gid = glyphs[index++ % glyphs.length]
						getGlyphPath(notoSans, gid)
					},
					{ warmup: 0, iterations: 26 },
				),
			)

			index = 0
			results.push(
				measure(
					"subsequent passes",
					() => {
						const gid = glyphs[index++ % glyphs.length]
						getGlyphPath(notoSans, gid)
					},
					{ warmup: 26, iterations: 260 },
				),
			)

			printComparison("Glyph Path - alphabet cycling", results, "subsequent passes")
			expect(results.length).toBe(2)
		})
	})

	describe("Rasterization Caching", () => {
		test("same glyph same size repeated", () => {
			const glyphId = 36
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure(
					"first rasterize",
					() => {
						rasterizeGlyph(notoSans, glyphId, fontSize)
					},
					{ warmup: 0, iterations: 1 },
				),
			)

			results.push(
				measure(
					"repeated rasterize",
					() => {
						rasterizeGlyph(notoSans, glyphId, fontSize)
					},
					{ warmup: 10, iterations: 500 },
				),
			)

			printComparison("Rasterization - same glyph/size", results, "repeated rasterize")
			expect(results.length).toBe(2)
		})

		test("same glyph different sizes", () => {
			const glyphId = 36
			const sizes = [12, 16, 20, 24, 32, 48, 64, 72, 96]
			const results: BenchResult[] = []
			let index = 0

			results.push(
				measure(
					"varying sizes",
					() => {
						const size = sizes[index++ % sizes.length]
						rasterizeGlyph(notoSans, glyphId, size)
					},
					{ warmup: 0, iterations: 90 },
				),
			)

			printComparison("Rasterization - varying sizes", results, "varying sizes")
			expect(results.length).toBe(1)
		})
	})

	describe("Mixed Workload", () => {
		test("realistic UI rendering simulation", () => {
			// Simulate rendering a UI with repeated elements
			const labels = ["File", "Edit", "View", "Help", "Save", "Open", "Close", "New"]
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						for (const label of labels) {
							const buffer = new UnicodeBuffer()
							buffer.addStr(label)
							const shaped = shape(notoSans, buffer)
							// Simulate getting paths for rendering
							for (const info of shaped.infos.slice(0, 3)) {
								getGlyphPath(notoSans, info.glyphId)
							}
						}
					},
					{ warmup: 10, iterations: 100 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						for (const label of labels) {
							const buffer = hb.createBuffer()
							buffer.addText(label)
							buffer.guessSegmentProperties()
							hb.shape(hbNotoSans.font, buffer)
							const output = buffer.json()
							for (const glyph of output.slice(0, 3)) {
								hbNotoSans.font.glyphToPath(glyph.g)
							}
							buffer.destroy()
						}
					},
					{ warmup: 10, iterations: 100 },
				),
			)

			printComparison("UI Simulation - 8 labels with paths", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("document rendering simulation", () => {
			const paragraphs = [
				"The quick brown fox jumps over the lazy dog.",
				"Pack my box with five dozen liquor jugs.",
				"How vexingly quick daft zebras jump!",
				"The five boxing wizards jump quickly.",
			]
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						for (const para of paragraphs) {
							const buffer = new UnicodeBuffer()
							buffer.addStr(para)
							shape(notoSans, buffer)
						}
					},
					{ warmup: 10, iterations: 100 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						for (const para of paragraphs) {
							const buffer = hb.createBuffer()
							buffer.addText(para)
							buffer.guessSegmentProperties()
							hb.shape(hbNotoSans.font, buffer)
							buffer.destroy()
						}
					},
					{ warmup: 10, iterations: 100 },
				),
			)

			printComparison("Document Simulation - 4 paragraphs", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})
})
