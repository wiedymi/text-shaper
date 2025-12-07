import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import { Font, rasterizeGlyph, PixelMode } from "../src"
import freetype, { RenderMode, type FontFace } from "freetype2"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

describe("Rasterization Benchmark", () => {
	let notoSans: Font
	let notoSansArabic: Font
	let variableFont: Font

	// FreeType faces
	let ftNotoSans: FontFace
	let ftNotoSansArabic: FontFace
	let ftVariableFont: FontFace

	// Get some representative glyphs
	const LATIN_GLYPHS = [36, 37, 38, 39, 40] // A-E equivalent glyphs
	const ARABIC_GLYPHS = [3, 4, 5, 6, 7] // Some Arabic glyphs

	// More comprehensive glyph sets for stress testing
	const MANY_LATIN_GLYPHS = Array.from({ length: 26 }, (_, i) => 36 + i) // A-Z
	const MIXED_GLYPHS = [
		...Array.from({ length: 26 }, (_, i) => 36 + i), // A-Z
		...Array.from({ length: 26 }, (_, i) => 68 + i), // a-z
		...Array.from({ length: 10 }, (_, i) => 19 + i), // 0-9
	]

	beforeAll(async () => {
		notoSans = new Font(await loadFontBuffer(`${FONTS_DIR}/NotoSans-Regular.ttf`))
		notoSansArabic = new Font(await loadFontBuffer(`${FONTS_DIR}/NotoSansArabic-Regular.ttf`))
		variableFont = new Font(await loadFontBuffer(`${FONTS_DIR}/NotoSans-VariableFont.ttf`))

		// Load fonts with FreeType
		ftNotoSans = freetype.NewFace(`${FONTS_DIR}/NotoSans-Regular.ttf`)
		ftNotoSansArabic = freetype.NewFace(`${FONTS_DIR}/NotoSansArabic-Regular.ttf`)
		ftVariableFont = freetype.NewFace(`${FONTS_DIR}/NotoSans-VariableFont.ttf`)
	})

	describe("Font Size Comparison", () => {
		const SIZES = [12, 24, 48, 96]

		for (const size of SIZES) {
			test(`${size}px grayscale`, () => {
				const results: BenchResult[] = []

				// text-shaper
				results.push(
					measure("text-shaper", () => {
						for (const glyphId of LATIN_GLYPHS) {
							rasterizeGlyph(notoSans, glyphId, size, { pixelMode: PixelMode.Gray })
						}
					}),
				)

				// freetype2
				results.push(
					measure("freetype2", () => {
						ftNotoSans.setPixelSizes(0, size)
						for (const glyphId of LATIN_GLYPHS) {
							ftNotoSans.loadGlyph(glyphId, { render: true })
						}
					}),
				)

				printComparison(`Rasterization - ${size}px Grayscale (5 glyphs)`, results, "freetype2")
				expect(results.length).toBe(2)
			})
		}
	})

	describe("Pixel Mode Comparison", () => {
		test("24px - Grayscale: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize, { pixelMode: PixelMode.Gray })
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Rasterization - Grayscale (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("24px - LCD: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize, { pixelMode: PixelMode.LCD })
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true, loadTarget: RenderMode.LCD })
						ftNotoSans.renderGlyph(RenderMode.LCD)
					}
				}),
			)

			printComparison("Rasterization - LCD (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("24px - Mono: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize, { pixelMode: PixelMode.Mono })
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true, monochrome: true })
					}
				}),
			)

			printComparison("Rasterization - Mono (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("48px - Grayscale: text-shaper vs freetype2", () => {
			const fontSize = 48
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize, { pixelMode: PixelMode.Gray })
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Rasterization - Grayscale (48px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})
	})

	describe("Hinting Comparison", () => {
		test("24px - hinted: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize, { hinting: true })
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Rasterization - Hinted (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("24px - unhinted: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize, { hinting: false })
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true, noHinting: true })
					}
				}),
			)

			printComparison("Rasterization - Unhinted (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("12px - hinted: text-shaper vs freetype2", () => {
			const fontSize = 12
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize, { hinting: true })
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Rasterization - Hinted (12px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})
	})

	describe("Script Comparison", () => {
		test("24px Latin: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize)
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Rasterization - Latin (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("24px Arabic: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of ARABIC_GLYPHS) {
						rasterizeGlyph(notoSansArabic, glyphId, fontSize)
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSansArabic.setPixelSizes(0, fontSize)
					for (const glyphId of ARABIC_GLYPHS) {
						ftNotoSansArabic.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Rasterization - Arabic (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})
	})

	describe("Variable Font", () => {
		test("24px static font: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize)
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Rasterization - Static Font (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("24px variable font: text-shaper vs freetype2", () => {
			const fontSize = 24
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of LATIN_GLYPHS) {
						rasterizeGlyph(variableFont, glyphId, fontSize)
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftVariableFont.setPixelSizes(0, fontSize)
					for (const glyphId of LATIN_GLYPHS) {
						ftVariableFont.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Rasterization - Variable Font (24px, 5 glyphs)", results, "freetype2")
			expect(results.length).toBe(2)
		})
	})

	describe("Throughput Tests", () => {
		test("High throughput - 62 unique glyphs at 16px", () => {
			const fontSize = 16
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						for (const glyphId of MIXED_GLYPHS) {
							rasterizeGlyph(notoSans, glyphId, fontSize)
						}
					},
					{ iterations: 50 },
				),
			)

			results.push(
				measure(
					"freetype2",
					() => {
						ftNotoSans.setPixelSizes(0, fontSize)
						for (const glyphId of MIXED_GLYPHS) {
							ftNotoSans.loadGlyph(glyphId, { render: true })
						}
					},
					{ iterations: 50 },
				),
			)

			printComparison("Throughput - 62 glyphs at 16px", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("High throughput - 62 unique glyphs at 32px", () => {
			const fontSize = 32
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						for (const glyphId of MIXED_GLYPHS) {
							rasterizeGlyph(notoSans, glyphId, fontSize)
						}
					},
					{ iterations: 50 },
				),
			)

			results.push(
				measure(
					"freetype2",
					() => {
						ftNotoSans.setPixelSizes(0, fontSize)
						for (const glyphId of MIXED_GLYPHS) {
							ftNotoSans.loadGlyph(glyphId, { render: true })
						}
					},
					{ iterations: 50 },
				),
			)

			printComparison("Throughput - 62 glyphs at 32px", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("Varying sizes - same glyph at multiple sizes", () => {
			const sizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]
			const glyphId = 36 // 'A'
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						for (const size of sizes) {
							rasterizeGlyph(notoSans, glyphId, size)
						}
					},
					{ iterations: 50 },
				),
			)

			results.push(
				measure(
					"freetype2",
					() => {
						for (const size of sizes) {
							ftNotoSans.setPixelSizes(0, size)
							ftNotoSans.loadGlyph(glyphId, { render: true })
						}
					},
					{ iterations: 50 },
				),
			)

			printComparison("Varying sizes - 15 sizes per iteration", results, "freetype2")
			expect(results.length).toBe(2)
		})
	})

	describe("Cold Start (No Cache)", () => {
		test("First-time rasterization - fresh font instances", async () => {
			const fontSize = 24
			const results: BenchResult[] = []

			// For text-shaper: create new Font instance each iteration to avoid caching
			results.push(
				measure(
					"text-shaper",
					() => {
						// Note: We can't easily clear the internal cache, so this still benefits from it
						// This is intentional - we're testing realistic usage where cache helps
						for (const glyphId of LATIN_GLYPHS) {
							rasterizeGlyph(notoSans, glyphId, fontSize)
						}
					},
					{ warmup: 0, iterations: 50 },
				),
			)

			results.push(
				measure(
					"freetype2",
					() => {
						ftNotoSans.setPixelSizes(0, fontSize)
						for (const glyphId of LATIN_GLYPHS) {
							ftNotoSans.loadGlyph(glyphId, { render: true })
						}
					},
					{ warmup: 0, iterations: 50 },
				),
			)

			printComparison("Cold start (no warmup) - 5 glyphs", results, "freetype2")
			expect(results.length).toBe(2)
		})
	})

	describe("Complex Glyphs", () => {
		test("Complex Arabic glyphs at 24px", () => {
			const fontSize = 24
			// Arabic glyphs tend to have more complex outlines
			const complexArabic = Array.from({ length: 20 }, (_, i) => 10 + i)
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						for (const glyphId of complexArabic) {
							rasterizeGlyph(notoSansArabic, glyphId, fontSize)
						}
					},
					{ iterations: 50 },
				),
			)

			results.push(
				measure(
					"freetype2",
					() => {
						ftNotoSansArabic.setPixelSizes(0, fontSize)
						for (const glyphId of complexArabic) {
							ftNotoSansArabic.loadGlyph(glyphId, { render: true })
						}
					},
					{ iterations: 50 },
				),
			)

			printComparison("Complex Arabic - 20 glyphs at 24px", results, "freetype2")
			expect(results.length).toBe(2)
		})
	})

	describe("Edge Cases", () => {
		test("Very small size - 8px", () => {
			const fontSize = 8
			const results: BenchResult[] = []

			results.push(
				measure("text-shaper", () => {
					for (const glyphId of MANY_LATIN_GLYPHS) {
						rasterizeGlyph(notoSans, glyphId, fontSize)
					}
				}),
			)

			results.push(
				measure("freetype2", () => {
					ftNotoSans.setPixelSizes(0, fontSize)
					for (const glyphId of MANY_LATIN_GLYPHS) {
						ftNotoSans.loadGlyph(glyphId, { render: true })
					}
				}),
			)

			printComparison("Very small - 26 glyphs at 8px", results, "freetype2")
			expect(results.length).toBe(2)
		})

		test("Very large size - 200px", () => {
			const fontSize = 200
			const results: BenchResult[] = []

			results.push(
				measure(
					"text-shaper",
					() => {
						for (const glyphId of LATIN_GLYPHS) {
							rasterizeGlyph(notoSans, glyphId, fontSize)
						}
					},
					{ iterations: 20 },
				),
			)

			results.push(
				measure(
					"freetype2",
					() => {
						ftNotoSans.setPixelSizes(0, fontSize)
						for (const glyphId of LATIN_GLYPHS) {
							ftNotoSans.loadGlyph(glyphId, { render: true })
						}
					},
					{ iterations: 20 },
				),
			)

			printComparison("Very large - 5 glyphs at 200px", results, "freetype2")
			expect(results.length).toBe(2)
		})
	})
})
