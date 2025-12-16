import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import {
	Font,
	shape,
	UnicodeBuffer,
	splitGraphemes,
	countGraphemes,
	findGraphemeBoundaries,
	findWordBoundaries,
	splitWords,
} from "../src"
import Graphemer from "graphemer"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

// Reduced iterations for faster benchmarks
const CLUSTER_OPTS = { warmup: 10, iterations: 3, batchSize: 100 }

// Test texts with various cluster complexities
const CLUSTER_TEXTS = {
	// Simple ASCII
	ascii: "Hello World",

	// With combining marks (accents)
	combining: "café résumé naïve über",

	// Emoji with ZWJ sequences
	emoji_simple: "😀😃😄😁😆",
	emoji_zwj: "👨‍👩‍👧‍👦 👩‍💻 🏳️‍🌈 👨‍🦰",
	emoji_skin: "👋🏻👋🏼👋🏽👋🏾👋🏿",

	// Complex scripts
	devanagari: "नमस्ते दुनिया", // Hindi with conjuncts
	arabic: "مرحبا بالعالم", // Arabic with joining
	thai: "สวัสดีครับ", // Thai with stacking

	// Mixed complexity
	mixed: "Hello 👋 नमस्ते مرحبا café 🏳️‍🌈",

	// Long text for stress testing
	long_ascii: "The quick brown fox jumps over the lazy dog. ".repeat(20),
	long_mixed: "Hello 😀 café résumé नमस्ते مرحبا 🏳️‍🌈 ".repeat(10),
}

describe("Cluster Iteration Benchmark", () => {
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

	describe("Grapheme Counting", () => {
		for (const [name, text] of Object.entries(CLUSTER_TEXTS)) {
			test(`countGraphemes - ${name}`, () => {
				const results: BenchResult[] = []

				results.push(
					measure(
						"text-shaper",
						() => {
							countGraphemes(text)
						},
						CLUSTER_OPTS,
					),
				)

				// Intl.Segmenter comparison
				const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
				results.push(
					measure(
						"Intl.Segmenter",
						() => {
							let count = 0
							for (const _ of segmenter.segment(text)) {
								count++
							}
						},
						CLUSTER_OPTS,
					),
				)

				// graphemer comparison
				const graphemer = new Graphemer()
				results.push(
					measure(
						"graphemer",
						() => {
							graphemer.countGraphemes(text)
						},
						CLUSTER_OPTS,
					),
				)

				const graphemeCount = countGraphemes(text)
				printComparison(`Count Graphemes - ${name} (${text.length} chars, ${graphemeCount} graphemes)`, results, "text-shaper")
				expect(results.length).toBe(3)
			})
		}
	})

	describe("Grapheme Splitting", () => {
		for (const [name, text] of Object.entries(CLUSTER_TEXTS)) {
			test(`splitGraphemes - ${name}`, () => {
				const results: BenchResult[] = []

				results.push(
					measure(
						"text-shaper",
						() => {
							splitGraphemes(text)
						},
						CLUSTER_OPTS,
					),
				)

				// Intl.Segmenter comparison
				const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
				results.push(
					measure(
						"Intl.Segmenter",
						() => {
							const result: string[] = []
							for (const seg of segmenter.segment(text)) {
								result.push(seg.segment)
							}
						},
						CLUSTER_OPTS,
					),
				)

				// graphemer comparison
				const graphemer = new Graphemer()
				results.push(
					measure(
						"graphemer",
						() => {
							graphemer.splitGraphemes(text)
						},
						CLUSTER_OPTS,
					),
				)

				const graphemes = splitGraphemes(text)
				printComparison(`Split Graphemes - ${name} (${graphemes.length} graphemes)`, results, "text-shaper")
				expect(results.length).toBe(3)
			})
		}
	})

	describe("Grapheme Boundary Detection", () => {
		for (const [name, text] of Object.entries(CLUSTER_TEXTS)) {
			test(`findGraphemeBoundaries - ${name}`, () => {
				const results: BenchResult[] = []

				results.push(
					measure(
						"text-shaper",
						() => {
							findGraphemeBoundaries([...text].map((c) => c.codePointAt(0)!))
						},
						CLUSTER_OPTS,
					),
				)

				printComparison(`Grapheme Boundaries - ${name} (${text.length} chars)`, results, "text-shaper")
				expect(results.length).toBe(1)
			})
		}
	})

	describe("Word Boundary Detection", () => {
		for (const [name, text] of Object.entries(CLUSTER_TEXTS)) {
			test(`findWordBoundaries - ${name}`, () => {
				const results: BenchResult[] = []

				results.push(
					measure(
						"text-shaper",
						() => {
							findWordBoundaries([...text].map((c) => c.codePointAt(0)!))
						},
						CLUSTER_OPTS,
					),
				)

				printComparison(`Word Boundaries - ${name} (${text.length} chars)`, results, "text-shaper")
				expect(results.length).toBe(1)
			})
		}
	})

	describe("Word Splitting", () => {
		for (const [name, text] of Object.entries(CLUSTER_TEXTS)) {
			test(`splitWords - ${name}`, () => {
				const results: BenchResult[] = []

				results.push(
					measure(
						"text-shaper",
						() => {
							splitWords(text)
						},
						CLUSTER_OPTS,
					),
				)

				const words = splitWords(text)
				printComparison(`Split Words - ${name} (${words.length} words)`, results, "text-shaper")
				expect(results.length).toBe(1)
			})
		}
	})

	describe("Shaped Cluster Iteration", () => {
		test("iterate shaped clusters - ASCII", () => {
			const text = CLUSTER_TEXTS.ascii
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					const shaped = shape(notoSans, buffer)
					// Iterate through clusters
					let lastCluster = -1
					let clusterCount = 0
					for (const info of shaped.infos) {
						if (info.cluster !== lastCluster) {
							clusterCount++
							lastCluster = info.cluster
						}
					}
				}, CLUSTER_OPTS),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer)
					const output = buffer.json()
					let lastCluster = -1
					let clusterCount = 0
					for (const glyph of output) {
						if (glyph.cl !== lastCluster) {
							clusterCount++
							lastCluster = glyph.cl
						}
					}
					buffer.destroy()
				}, CLUSTER_OPTS),
			)

			printComparison("Shaped Cluster Iteration - ASCII", results, "text-shaper")
			expect(results.length).toBe(2)
		})

		test("iterate shaped clusters - combining marks", () => {
			const text = CLUSTER_TEXTS.combining
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					const shaped = shape(notoSans, buffer)
					let lastCluster = -1
					let clusterCount = 0
					for (const info of shaped.infos) {
						if (info.cluster !== lastCluster) {
							clusterCount++
							lastCluster = info.cluster
						}
					}
				}, CLUSTER_OPTS),
			)

			results.push(
				measure("harfbuzzjs", () => {
					const buffer = hb.createBuffer()
					buffer.addText(text)
					buffer.guessSegmentProperties()
					hb.shape(hbNotoSans.font, buffer)
					const output = buffer.json()
					let lastCluster = -1
					let clusterCount = 0
					for (const glyph of output) {
						if (glyph.cl !== lastCluster) {
							clusterCount++
							lastCluster = glyph.cl
						}
					}
					buffer.destroy()
				}, CLUSTER_OPTS),
			)

			printComparison("Shaped Cluster Iteration - Combining", results, "text-shaper")
			expect(results.length).toBe(2)
		})
	})

	describe("Cluster to Glyph Mapping", () => {
		test("build cluster-to-glyph map - short text", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					const shaped = shape(notoSans, buffer)

					// Build cluster to glyph indices map
					const clusterMap = new Map<number, number[]>()
					for (let i = 0; i < shaped.infos.length; i++) {
						const cluster = shaped.infos[i].cluster
						if (!clusterMap.has(cluster)) {
							clusterMap.set(cluster, [])
						}
						clusterMap.get(cluster)!.push(i)
					}
				}, CLUSTER_OPTS),
			)

			printComparison("Cluster-to-Glyph Map - short", results, "text-shaper")
			expect(results.length).toBe(1)
		})

		test("build cluster-to-glyph map - long text", () => {
			const text = CLUSTER_TEXTS.long_ascii
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						const buffer = new UnicodeBuffer()
						buffer.addStr(text)
						const shaped = shape(notoSans, buffer)

						const clusterMap = new Map<number, number[]>()
						for (let i = 0; i < shaped.infos.length; i++) {
							const cluster = shaped.infos[i].cluster
							if (!clusterMap.has(cluster)) {
								clusterMap.set(cluster, [])
							}
							clusterMap.get(cluster)!.push(i)
						}
					},
					CLUSTER_OPTS,
				),
			)

			printComparison("Cluster-to-Glyph Map - long", results, "text-shaper")
			expect(results.length).toBe(1)
		})
	})

	describe("Cursor Position Calculation", () => {
		test("calculate cursor positions - short text", () => {
			const text = "Hello World"
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					const shaped = shape(notoSans, buffer)

					// Calculate cursor positions based on clusters
					const positions: number[] = [0]
					let xPos = 0
					let lastCluster = shaped.infos[0]?.cluster ?? 0

					for (let i = 0; i < shaped.infos.length; i++) {
						if (shaped.infos[i].cluster !== lastCluster) {
							positions.push(xPos)
							lastCluster = shaped.infos[i].cluster
						}
						xPos += shaped.positions[i].xAdvance
					}
					positions.push(xPos)
				}, CLUSTER_OPTS),
			)

			printComparison("Cursor Positions - short text", results, "text-shaper")
			expect(results.length).toBe(1)
		})

		test("calculate cursor positions - mixed text", () => {
			const text = CLUSTER_TEXTS.mixed
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					const shaped = shape(notoSans, buffer)

					const positions: number[] = [0]
					let xPos = 0
					let lastCluster = shaped.infos[0]?.cluster ?? 0

					for (let i = 0; i < shaped.infos.length; i++) {
						if (shaped.infos[i].cluster !== lastCluster) {
							positions.push(xPos)
							lastCluster = shaped.infos[i].cluster
						}
						xPos += shaped.positions[i].xAdvance
					}
					positions.push(xPos)
				}, CLUSTER_OPTS),
			)

			printComparison("Cursor Positions - mixed text", results, "text-shaper")
			expect(results.length).toBe(1)
		})
	})

	describe("Hit Testing", () => {
		test("find cluster at position - multiple queries", () => {
			const text = "Hello World, this is a test string for hit testing."
			const results: BenchResult[] = []

			// Pre-shape and build position map
			const buffer = new UnicodeBuffer()
			buffer.addStr(text)
			const shaped = shape(notoSans, buffer)

			// Build cluster positions
			const clusterPositions: { cluster: number; start: number; end: number }[] = []
			let xPos = 0
			let lastCluster = shaped.infos[0]?.cluster ?? 0
			let clusterStart = 0

			for (let i = 0; i < shaped.infos.length; i++) {
				if (shaped.infos[i].cluster !== lastCluster) {
					clusterPositions.push({ cluster: lastCluster, start: clusterStart, end: xPos })
					clusterStart = xPos
					lastCluster = shaped.infos[i].cluster
				}
				xPos += shaped.positions[i].xAdvance
			}
			clusterPositions.push({ cluster: lastCluster, start: clusterStart, end: xPos })

			const totalWidth = xPos

			results.push(
				measure(
					"hit test",
					() => {
						// Simulate 100 random hit tests
						for (let i = 0; i < 100; i++) {
							const testX = Math.random() * totalWidth
							// Find cluster containing this position
							for (const cp of clusterPositions) {
								if (testX >= cp.start && testX < cp.end) {
									break
								}
							}
						}
					},
					CLUSTER_OPTS,
				),
			)

			printComparison("Hit Testing - 100 queries", results, "hit test")
			expect(results.length).toBe(1)
		})
	})

	describe("Emoji Cluster Handling", () => {
		test("emoji ZWJ sequences", () => {
			const text = CLUSTER_TEXTS.emoji_zwj
			const results: BenchResult[] = []

			results.push(
				measure(
					"grapheme split",
					() => {
						splitGraphemes(text)
					},
					CLUSTER_OPTS,
				),
			)

			results.push(
				measure(
					"grapheme count",
					() => {
						countGraphemes(text)
					},
					CLUSTER_OPTS,
				),
			)

			const graphemes = splitGraphemes(text)
			console.log(`\nEmoji ZWJ: "${text}"`)
			console.log(`  Chars: ${text.length}, Graphemes: ${graphemes.length}`)
			console.log(`  Graphemes: ${graphemes.map((g) => `[${g}]`).join(" ")}`)

			printComparison("Emoji ZWJ Sequences", results, "grapheme split")
			expect(results.length).toBe(2)
		})

		test("emoji skin tone modifiers", () => {
			const text = CLUSTER_TEXTS.emoji_skin
			const results: BenchResult[] = []

			results.push(
				measure(
					"grapheme split",
					() => {
						splitGraphemes(text)
					},
					CLUSTER_OPTS,
				),
			)

			const graphemes = splitGraphemes(text)
			console.log(`\nEmoji Skin Tones: "${text}"`)
			console.log(`  Chars: ${text.length}, Graphemes: ${graphemes.length}`)

			printComparison("Emoji Skin Tone Modifiers", results, "grapheme split")
			expect(results.length).toBe(1)
		})
	})
})
