import { describe, test, beforeAll, expect } from "bun:test"
import { measure, printComparison, loadFontBuffer, type BenchResult } from "./utils"
import { Font } from "../src"
import opentype from "opentype.js"

const FONTS_DIR = "reference/rustybuzz/benches/fonts"

describe("Font Loading Benchmark", () => {
	let hb: any
	let notoSansBuffer: ArrayBuffer
	let notoSansArabicBuffer: ArrayBuffer
	let notoSansDevanagariBuffer: ArrayBuffer
	let variableFontBuffer: ArrayBuffer

	beforeAll(async () => {
		// Load harfbuzzjs
		hb = await import("harfbuzzjs").then((m) => m.default)

		// Load fonts
		notoSansBuffer = await loadFontBuffer(`${FONTS_DIR}/NotoSans-Regular.ttf`)
		notoSansArabicBuffer = await loadFontBuffer(
			`${FONTS_DIR}/NotoSansArabic-Regular.ttf`,
		)
		notoSansDevanagariBuffer = await loadFontBuffer(
			`${FONTS_DIR}/NotoSansDevanagari-Regular.ttf`,
		)
		variableFontBuffer = await loadFontBuffer(
			`${FONTS_DIR}/NotoSans-VariableFont.ttf`,
		)
	})

	test("NotoSans-Regular.ttf", () => {
		const results: BenchResult[] = []

		// text-shaper
		results.push(
			measure("text-shaper", () => {
				Font.load(notoSansBuffer)
			}),
		)

		// opentype.js
		results.push(
			measure("opentype.js", () => {
				opentype.parse(notoSansBuffer)
			}),
		)

		// harfbuzzjs
		results.push(
			measure("harfbuzzjs", () => {
				const blob = hb.createBlob(notoSansBuffer)
				const face = hb.createFace(blob, 0)
				const font = hb.createFont(face)
				font.destroy()
				face.destroy()
				blob.destroy()
			}),
		)

		printComparison("Font Loading - NotoSans-Regular.ttf", results, "text-shaper")
		expect(results.length).toBe(3)
	})

	test("NotoSansArabic-Regular.ttf", () => {
		const results: BenchResult[] = []

		results.push(
			measure("text-shaper", () => {
				Font.load(notoSansArabicBuffer)
			}),
		)

		results.push(
			measure("opentype.js", () => {
				opentype.parse(notoSansArabicBuffer)
			}),
		)

		results.push(
			measure("harfbuzzjs", () => {
				const blob = hb.createBlob(notoSansArabicBuffer)
				const face = hb.createFace(blob, 0)
				const font = hb.createFont(face)
				font.destroy()
				face.destroy()
				blob.destroy()
			}),
		)

		printComparison(
			"Font Loading - NotoSansArabic-Regular.ttf",
			results,
			"text-shaper",
		)
		expect(results.length).toBe(3)
	})

	test("NotoSansDevanagari-Regular.ttf", () => {
		const results: BenchResult[] = []

		results.push(
			measure("text-shaper", () => {
				Font.load(notoSansDevanagariBuffer)
			}),
		)

		results.push(
			measure("opentype.js", () => {
				opentype.parse(notoSansDevanagariBuffer)
			}),
		)

		results.push(
			measure("harfbuzzjs", () => {
				const blob = hb.createBlob(notoSansDevanagariBuffer)
				const face = hb.createFace(blob, 0)
				const font = hb.createFont(face)
				font.destroy()
				face.destroy()
				blob.destroy()
			}),
		)

		printComparison(
			"Font Loading - NotoSansDevanagari-Regular.ttf",
			results,
			"text-shaper",
		)
		expect(results.length).toBe(3)
	})

	test("NotoSans-VariableFont.ttf", () => {
		const results: BenchResult[] = []

		results.push(
			measure("text-shaper", () => {
				Font.load(variableFontBuffer)
			}),
		)

		results.push(
			measure("opentype.js", () => {
				opentype.parse(variableFontBuffer)
			}),
		)

		results.push(
			measure("harfbuzzjs", () => {
				const blob = hb.createBlob(variableFontBuffer)
				const face = hb.createFace(blob, 0)
				const font = hb.createFont(face)
				font.destroy()
				face.destroy()
				blob.destroy()
			}),
		)

		printComparison(
			"Font Loading - NotoSans-VariableFont.ttf",
			results,
			"text-shaper",
		)
		expect(results.length).toBe(3)
	})
})
