import { describe, test, beforeAll, expect } from "bun:test"
import { heapStats } from "bun:jsc"
import { loadFontBuffer } from "./utils"
import { Font, shape, UnicodeBuffer, rasterizeGlyph, getGlyphPath, PixelMode } from "../src"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

interface MemoryResult {
	name: string
	heapBefore: number
	heapAfter: number
	heapDelta: number
	objectCountBefore: number
	objectCountAfter: number
	objectCountDelta: number
}

function measureMemory(name: string, fn: () => void, iterations = 100): MemoryResult {
	// Force GC before measurement
	Bun.gc(true)

	const statsBefore = heapStats()
	const heapBefore = statsBefore.heapSize
	const objectCountBefore = statsBefore.objectCount

	for (let i = 0; i < iterations; i++) {
		fn()
	}

	// Force GC after measurement to see retained memory
	Bun.gc(true)

	const statsAfter = heapStats()
	const heapAfter = statsAfter.heapSize
	const objectCountAfter = statsAfter.objectCount

	return {
		name,
		heapBefore,
		heapAfter,
		heapDelta: heapAfter - heapBefore,
		objectCountBefore,
		objectCountAfter,
		objectCountDelta: objectCountAfter - objectCountBefore,
	}
}

function formatBytes(bytes: number): string {
	if (Math.abs(bytes) >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	if (Math.abs(bytes) >= 1024) return `${(bytes / 1024).toFixed(2)} KB`
	return `${bytes} B`
}

function printMemoryResult(title: string, result: MemoryResult): void {
	console.log(`\n${title}`)
	console.log(`┌─────────────────────┬──────────────────┐`)
	console.log(`│ Metric              │ Value            │`)
	console.log(`├─────────────────────┼──────────────────┤`)
	console.log(`│ Heap Before         │ ${formatBytes(result.heapBefore).padStart(16)} │`)
	console.log(`│ Heap After          │ ${formatBytes(result.heapAfter).padStart(16)} │`)
	console.log(`│ Heap Delta          │ ${formatBytes(result.heapDelta).padStart(16)} │`)
	console.log(`│ Objects Before      │ ${result.objectCountBefore.toString().padStart(16)} │`)
	console.log(`│ Objects After       │ ${result.objectCountAfter.toString().padStart(16)} │`)
	console.log(`│ Objects Delta       │ ${result.objectCountDelta.toString().padStart(16)} │`)
	console.log(`└─────────────────────┴──────────────────┘`)
}

describe("Memory Usage Benchmark", () => {
	let notoSansBuffer: ArrayBuffer
	let notoSansArabicBuffer: ArrayBuffer
	let variableFontBuffer: ArrayBuffer

	beforeAll(async () => {
		notoSansBuffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-Regular.ttf`)
		notoSansArabicBuffer = await loadFontBuffer(`${FONTS_DIR}/NotoSansArabic-Regular.ttf`)
		variableFontBuffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-VariableFont.ttf`)
	})

	describe("Font Loading Memory", () => {
		test("NotoSans-Regular.ttf loading", () => {
			const result = measureMemory(
				"Font.load",
				() => {
					Font.load(notoSansBuffer)
				},
				10,
			)

			printMemoryResult("Font Loading - NotoSans-Regular.ttf (10 loads)", result)
			expect(result).toBeDefined()
		})

		test("NotoSansArabic-Regular.ttf loading", () => {
			const result = measureMemory(
				"Font.load",
				() => {
					Font.load(notoSansArabicBuffer)
				},
				10,
			)

			printMemoryResult("Font Loading - NotoSansArabic-Regular.ttf (10 loads)", result)
			expect(result).toBeDefined()
		})

		test("Variable font loading", () => {
			const result = measureMemory(
				"Font.load",
				() => {
					Font.load(variableFontBuffer)
				},
				10,
			)

			printMemoryResult("Font Loading - Variable Font (10 loads)", result)
			expect(result).toBeDefined()
		})
	})

	describe("Text Shaping Memory", () => {
		let font: Font

		beforeAll(() => {
			font = Font.load(notoSansBuffer)
		})

		test("short text shaping", () => {
			const text = "Hello World"
			const result = measureMemory(
				"shape",
				() => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(font, buffer)
				},
				1000,
			)

			printMemoryResult(`Text Shaping - "${text}" (1000 iterations)`, result)
			expect(result).toBeDefined()
		})

		test("medium text shaping", () => {
			const text = "The quick brown fox jumps over the lazy dog."
			const result = measureMemory(
				"shape",
				() => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(font, buffer)
				},
				500,
			)

			printMemoryResult(`Text Shaping - medium text (500 iterations)`, result)
			expect(result).toBeDefined()
		})

		test("long text shaping", () => {
			const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10)
			const result = measureMemory(
				"shape",
				() => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
					shape(font, buffer)
				},
				100,
			)

			printMemoryResult(`Text Shaping - long text (100 iterations)`, result)
			expect(result).toBeDefined()
		})
	})

	describe("Glyph Path Memory", () => {
		let font: Font

		beforeAll(() => {
			font = Font.load(notoSansBuffer)
		})

		test("single glyph path extraction", () => {
			const result = measureMemory(
				"getGlyphPath",
				() => {
					getGlyphPath(font, 36) // 'A'
				},
				1000,
			)

			printMemoryResult("Glyph Path - single glyph (1000 iterations)", result)
			expect(result).toBeDefined()
		})

		test("multiple glyph paths", () => {
			const glyphs = Array.from({ length: 26 }, (_, i) => 36 + i) // A-Z
			const result = measureMemory(
				"getGlyphPath",
				() => {
					for (const gid of glyphs) {
						getGlyphPath(font, gid)
					}
				},
				100,
			)

			printMemoryResult("Glyph Path - 26 glyphs (100 iterations)", result)
			expect(result).toBeDefined()
		})
	})

	describe("Rasterization Memory", () => {
		let font: Font

		beforeAll(() => {
			font = Font.load(notoSansBuffer)
		})

		test("grayscale rasterization", () => {
			const result = measureMemory(
				"rasterizeGlyph",
				() => {
					rasterizeGlyph(font, 36, 24, { pixelMode: PixelMode.Gray })
				},
				500,
			)

			printMemoryResult("Rasterization - Grayscale 24px (500 iterations)", result)
			expect(result).toBeDefined()
		})

		test("LCD rasterization", () => {
			const result = measureMemory(
				"rasterizeGlyph",
				() => {
					rasterizeGlyph(font, 36, 24, { pixelMode: PixelMode.LCD })
				},
				500,
			)

			printMemoryResult("Rasterization - LCD 24px (500 iterations)", result)
			expect(result).toBeDefined()
		})

		test("large size rasterization", () => {
			const result = measureMemory(
				"rasterizeGlyph",
				() => {
					rasterizeGlyph(font, 36, 96, { pixelMode: PixelMode.Gray })
				},
				100,
			)

			printMemoryResult("Rasterization - Grayscale 96px (100 iterations)", result)
			expect(result).toBeDefined()
		})
	})

	describe("Buffer Allocation Memory", () => {
		test("UnicodeBuffer creation", () => {
			const result = measureMemory(
				"UnicodeBuffer",
				() => {
					const buffer = new UnicodeBuffer()
					buffer.addStr("Hello World")
				},
				1000,
			)

			printMemoryResult("UnicodeBuffer Creation (1000 iterations)", result)
			expect(result).toBeDefined()
		})

		test("UnicodeBuffer with long text", () => {
			const text = "A".repeat(10000)
			const result = measureMemory(
				"UnicodeBuffer",
				() => {
					const buffer = new UnicodeBuffer()
					buffer.addStr(text)
				},
				100,
			)

			printMemoryResult("UnicodeBuffer - 10000 chars (100 iterations)", result)
			expect(result).toBeDefined()
		})
	})

	describe("Sustained Load Memory", () => {
		let font: Font

		beforeAll(() => {
			font = Font.load(notoSansBuffer)
		})

		test("sustained shaping - memory stability", () => {
			const text = "The quick brown fox jumps over the lazy dog."

			// Warm up
			for (let i = 0; i < 100; i++) {
				const buffer = new UnicodeBuffer()
				buffer.addStr(text)
				shape(font, buffer)
			}

			Bun.gc(true)
			const initialStats = heapStats()

			// Run sustained load
			for (let i = 0; i < 5000; i++) {
				const buffer = new UnicodeBuffer()
				buffer.addStr(text)
				shape(font, buffer)
			}

			Bun.gc(true)
			const finalStats = heapStats()

			const heapGrowth = finalStats.heapSize - initialStats.heapSize
			const objectGrowth = finalStats.objectCount - initialStats.objectCount

			console.log(`\nSustained Shaping - 5000 iterations`)
			console.log(`┌─────────────────────┬──────────────────┐`)
			console.log(`│ Metric              │ Value            │`)
			console.log(`├─────────────────────┼──────────────────┤`)
			console.log(`│ Initial Heap        │ ${formatBytes(initialStats.heapSize).padStart(16)} │`)
			console.log(`│ Final Heap          │ ${formatBytes(finalStats.heapSize).padStart(16)} │`)
			console.log(`│ Heap Growth         │ ${formatBytes(heapGrowth).padStart(16)} │`)
			console.log(`│ Initial Objects     │ ${initialStats.objectCount.toString().padStart(16)} │`)
			console.log(`│ Final Objects       │ ${finalStats.objectCount.toString().padStart(16)} │`)
			console.log(`│ Object Growth       │ ${objectGrowth.toString().padStart(16)} │`)
			console.log(`└─────────────────────┴──────────────────┘`)

			// Memory should not grow significantly (allow some variance)
			expect(Math.abs(heapGrowth)).toBeLessThan(10 * 1024 * 1024) // Less than 10MB growth
		})
	})

	describe("Peak Memory Usage", () => {
		test("font loading peak memory", () => {
			Bun.gc(true)
			const baseline = heapStats().heapSize

			// Load multiple fonts
			const fonts: Font[] = []
			fonts.push(Font.load(notoSansBuffer))
			fonts.push(Font.load(notoSansArabicBuffer))
			fonts.push(Font.load(variableFontBuffer))

			const peakWithFonts = heapStats().heapSize

			// Clear references
			fonts.length = 0
			Bun.gc(true)

			const afterClear = heapStats().heapSize

			console.log(`\nPeak Memory - Font Loading`)
			console.log(`┌─────────────────────┬──────────────────┐`)
			console.log(`│ Metric              │ Value            │`)
			console.log(`├─────────────────────┼──────────────────┤`)
			console.log(`│ Baseline            │ ${formatBytes(baseline).padStart(16)} │`)
			console.log(`│ With 3 Fonts        │ ${formatBytes(peakWithFonts).padStart(16)} │`)
			console.log(`│ After Clear + GC    │ ${formatBytes(afterClear).padStart(16)} │`)
			console.log(`│ Memory per Font     │ ${formatBytes((peakWithFonts - baseline) / 3).padStart(16)} │`)
			console.log(`└─────────────────────┴──────────────────┘`)

			expect(peakWithFonts).toBeGreaterThanOrEqual(baseline)
		})
	})
})
