import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import { Font, shape, UnicodeBuffer, getGlyphPath, rasterizeGlyph } from "../src"

// Use system Arial Unicode which has CJK coverage
const ARIAL_UNICODE_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"

// CJK test texts
const CJK_TEXTS = {
	// Chinese Simplified
	chinese_short: "你好世界",
	chinese_medium: "中华人民共和国是工人阶级领导的、以工农联盟为基础的人民民主专政的社会主义国家。",
	chinese_long: `中华人民共和国是工人阶级领导的、以工农联盟为基础的人民民主专政的社会主义国家。
社会主义制度是中华人民共和国的根本制度。中国共产党领导是中国特色社会主义最本质的特征。
禁止任何组织或者个人破坏社会主义制度。`,

	// Japanese (mixed hiragana, katakana, kanji)
	japanese_short: "こんにちは世界",
	japanese_medium: "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。",
	japanese_long: `吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。
何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。
吾輩はここで始めて人間というものを見た。`,

	// Korean
	korean_short: "안녕하세요 세계",
	korean_medium: "대한민국은 민주공화국이다. 대한민국의 주권은 국민에게 있고, 모든 권력은 국민으로부터 나온다.",
	korean_long: `대한민국은 민주공화국이다. 대한민국의 주권은 국민에게 있고, 모든 권력은 국민으로부터 나온다.
대한민국의 영토는 한반도와 그 부속도서로 한다.
대한민국은 통일을 지향하며, 자유민주적 기본질서에 입각한 평화적 통일 정책을 수립하고 이를 추진한다.`,

	// Mixed CJK
	mixed_cjk: "中文 日本語 한국어 混合テスト 혼합 테스트",
}

describe("Large CJK Font Benchmark", () => {
	let hb: any
	let arialUnicode: Font
	let hbArialUnicode: any
	let fontAvailable = false

	beforeAll(async () => {
		hb = await import("harfbuzzjs").then((m) => m.default)

		try {
			const buffer = await loadFontBuffer(ARIAL_UNICODE_PATH)
			arialUnicode = Font.load(buffer)

			const blob = hb.createBlob(buffer)
			const face = hb.createFace(blob, 0)
			hbArialUnicode = { font: hb.createFont(face), face, blob }
			fontAvailable = true
			console.log(`\nLoaded Arial Unicode MS (~23MB, ~50k glyphs)`)
		} catch {
			console.log(`\nSkipping CJK tests: Arial Unicode MS not found at ${ARIAL_UNICODE_PATH}`)
		}
	})

	describe("Font Loading - Large CJK Font", () => {
		test("load time comparison", async () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			const results: BenchResult[] = []
			const buffer = await loadFontBuffer(ARIAL_UNICODE_PATH)

			results.push(
				measure(
					"text-shaper",
					() => {
						Font.load(buffer)
					},
					{ warmup: 2, iterations: 10 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const blob = hb.createBlob(buffer)
						const face = hb.createFace(blob, 0)
						const font = hb.createFont(face)
						font.destroy()
						face.destroy()
						blob.destroy()
					},
					{ warmup: 2, iterations: 10 },
				),
			)

			printComparison("Large Font Loading (~23MB)", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Chinese Text Shaping", () => {
		for (const [name, text] of [
			["short", CJK_TEXTS.chinese_short],
			["medium", CJK_TEXTS.chinese_medium],
			["long", CJK_TEXTS.chinese_long],
		]) {
			test(`Chinese ${name} (${text.length} chars)`, () => {
				if (!fontAvailable) {
					console.log("Skipping: font not available")
					return
				}

				const results: BenchResult[] = []

				results.push(
					measure("text-shaper", () => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(arialUnicode, buffer)
					}),
				)

				results.push(
					measure("harfbuzzjs", () => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbArialUnicode.font, buffer)
						buffer.destroy()
					}),
				)

				printComparison(`Chinese Shaping - ${name} (${text.length} chars)`, results, "text-shaper")
				expect(results.length).toBe(2)
			})
		}
	})

	describe("Japanese Text Shaping", () => {
		for (const [name, text] of [
			["short", CJK_TEXTS.japanese_short],
			["medium", CJK_TEXTS.japanese_medium],
			["long", CJK_TEXTS.japanese_long],
		]) {
			test(`Japanese ${name} (${text.length} chars)`, () => {
				if (!fontAvailable) {
					console.log("Skipping: font not available")
					return
				}

				const results: BenchResult[] = []

				results.push(
					measure("text-shaper", () => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(arialUnicode, buffer)
					}),
				)

				results.push(
					measure("harfbuzzjs", () => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbArialUnicode.font, buffer)
						buffer.destroy()
					}),
				)

				printComparison(`Japanese Shaping - ${name} (${text.length} chars)`, results, "text-shaper")
				expect(results.length).toBe(2)
			})
		}
	})

	describe("Korean Text Shaping", () => {
		for (const [name, text] of [
			["short", CJK_TEXTS.korean_short],
			["medium", CJK_TEXTS.korean_medium],
			["long", CJK_TEXTS.korean_long],
		]) {
			test(`Korean ${name} (${text.length} chars)`, () => {
				if (!fontAvailable) {
					console.log("Skipping: font not available")
					return
				}

				const results: BenchResult[] = []

				results.push(
					measure("text-shaper", () => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(arialUnicode, buffer)
					}),
				)

				results.push(
					measure("harfbuzzjs", () => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbArialUnicode.font, buffer)
						buffer.destroy()
					}),
				)

				printComparison(`Korean Shaping - ${name} (${text.length} chars)`, results, "text-shaper")
				expect(results.length).toBe(2)
			})
		}
	})

	describe("Mixed CJK Shaping", () => {
		test("mixed Chinese/Japanese/Korean", () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			const text = CJK_TEXTS.mixed_cjk
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(arialUnicode, buffer)
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbArialUnicode.font, buffer)
					buffer.destroy()
				}),
			)

			printComparison(`Mixed CJK Shaping (${text.length} chars)`, results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("CJK Glyph Operations", () => {
		test("glyph path extraction - CJK characters", () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			// Get glyph IDs for some CJK characters
			const buffer = new UnicodeBuffer()
			buffer.addStr("中日韓")
			const shaped = shape(arialUnicode, buffer)
			const glyphIds = shaped.infos.map((i) => i.glyphId)

			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const gid of glyphIds) {
						getGlyphPath(arialUnicode, gid)
					}
				}),
			)

			results.push(
				measure("harfbuzzjs", () => {
					for (const gid of glyphIds) {
						hbArialUnicode.font.glyphToPath(gid)
					}
				}),
			)

			printComparison("CJK Glyph Paths (3 glyphs)", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("rasterization - CJK characters at 24px", () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			const buffer = new UnicodeBuffer()
			buffer.addStr("中")
			const shaped = shape(arialUnicode, buffer)
			const glyphId = shaped.infos[0].glyphId

			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					rasterizeGlyph(arialUnicode, glyphId, 24)
				}),
			)

			printComparison("CJK Rasterization - 24px", results, "text-shaper")
			expect(results.length).toBe(1)
		})

		test("rasterization - CJK characters at 48px", () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			const buffer = new UnicodeBuffer()
			buffer.addStr("中")
			const shaped = shape(arialUnicode, buffer)
			const glyphId = shaped.infos[0].glyphId

			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					rasterizeGlyph(arialUnicode, glyphId, 48)
				}),
			)

			printComparison("CJK Rasterization - 48px", results, "text-shaper")
			expect(results.length).toBe(1)
		})
	})

	describe("High Glyph Count Stress Test", () => {
		test("unique CJK characters - 100 glyphs", () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			// Generate text with 100 unique CJK characters
			const chars: string[] = []
			for (let i = 0; i < 100; i++) {
				chars.push(String.fromCodePoint(0x4e00 + i)) // CJK Unified Ideographs
			}
			const text = chars.join("")

			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(arialUnicode, buffer)
					},
					{ iterations: 50 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbArialUnicode.font, buffer)
						buffer.destroy()
					},
					{ iterations: 50 },
				),
			)

			printComparison("100 Unique CJK Characters", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("unique CJK characters - 500 glyphs", () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			const chars: string[] = []
			for (let i = 0; i < 500; i++) {
				chars.push(String.fromCodePoint(0x4e00 + i))
			}
			const text = chars.join("")

			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(arialUnicode, buffer)
					},
					{ iterations: 20 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbArialUnicode.font, buffer)
						buffer.destroy()
					},
					{ iterations: 20 },
				),
			)

			printComparison("500 Unique CJK Characters", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("CMap Lookup Performance", () => {
		test("sequential CJK codepoint lookup", () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			// This stresses the cmap table lookup
			const codepoints = Array.from({ length: 1000 }, (_, i) => 0x4e00 + i)
			const text = String.fromCodePoint(...codepoints)

			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(arialUnicode, buffer)
					},
					{ iterations: 10 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbArialUnicode.font, buffer)
						buffer.destroy()
					},
					{ iterations: 10 },
				),
			)

			printComparison("1000 Sequential CJK Codepoints", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("random CJK codepoint lookup", () => {
			if (!fontAvailable) {
				console.log("Skipping: font not available")
				return
			}

			// Random access pattern - worse cache behavior
			const codepoints: number[] = []
			for (let i = 0; i < 500; i++) {
				// Spread across CJK range
				codepoints.push(0x4e00 + Math.floor(Math.random() * 20000))
			}
			const text = String.fromCodePoint(...codepoints)

			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						shape(arialUnicode, buffer)
					},
					{ iterations: 20 },
				),
			)

			results.push(
				measure(
					"harfbuzzjs",
					() => {
						const buffer = hb.createBuffer()
						buffer.addText(text)
						buffer.guessSegmentProperties()
						hb.shape(hbArialUnicode.font, buffer)
						buffer.destroy()
					},
					{ iterations: 20 },
				),
			)

			printComparison("500 Random CJK Codepoints", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})
})
