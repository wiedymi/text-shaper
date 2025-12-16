#!/usr/bin/env bun
/**
 * Automatically runs benchmarks and exports results to JSON.
 * Usage: bun scripts/update-benchmarks.ts [--runs=3] [--commit]
 */

import { $ } from "bun"

interface BenchmarkResult {
	title: string
	results: Map<string, number> // library -> ops/sec
}

// Parse command line args
const args = process.argv.slice(2)
const runs = parseInt(args.find((a) => a.startsWith("--runs="))?.split("=")[1] || "3")
const shouldCommit = args.includes("--commit")

console.log(`Running benchmarks ${runs} time(s)...`)

// Benchmark files and their important tests
const BENCHMARK_FILES = [
	"bench/path.test.ts",
	"bench/shaping.test.ts",
	"bench/caching.test.ts",
	"bench/raster.test.ts",
	"bench/cjk.test.ts",
	"bench/features.test.ts",
	"bench/clusters.test.ts",
]

// Parse ops/sec from formatted string like "1.93M", "138.05k", "33500"
function parseOps(str: string): number {
	str = str.trim()
	if (str.endsWith("M")) return parseFloat(str) * 1_000_000
	if (str.endsWith("k")) return parseFloat(str) * 1_000
	return parseFloat(str)
}

// Parse benchmark output to extract results
function parseBenchmarkOutput(output: string): BenchmarkResult[] {
	const results: BenchmarkResult[] = []
	const lines = output.split("\n")

	let currentTitle = ""
	let currentResults = new Map<string, number>()

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		// Look for title line (line before the table border)
		if (line && !line.startsWith("│") && !line.startsWith("├") && !line.startsWith("┌") && !line.startsWith("└") && line.trim() && !line.includes("PASS") && !line.includes("FAIL") && !line.includes("bun test")) {
			// Check if next line is a table border
			const nextLine = lines[i + 1] || ""
			if (nextLine.startsWith("┌")) {
				// Save previous result if exists
				if (currentTitle && currentResults.size > 0) {
					results.push({ title: currentTitle, results: new Map(currentResults) })
				}
				currentTitle = line.trim()
				currentResults = new Map()
			}
		}

		// Parse table rows
		if (line.startsWith("│") && !line.includes("Library") && !line.includes("ops/sec")) {
			const parts = line.split("│").map((p) => p.trim()).filter(Boolean)
			if (parts.length >= 2) {
				const name = parts[0]
				const opsStr = parts[1]
				if (name && opsStr) {
					const ops = parseOps(opsStr)
					if (!isNaN(ops) && ops > 0) {
						currentResults.set(name, ops)
					}
				}
			}
		}
	}

	// Save last result
	if (currentTitle && currentResults.size > 0) {
		results.push({ title: currentTitle, results: currentResults })
	}

	return results
}

// Run benchmarks and collect results
async function runBenchmarks(numRuns: number): Promise<Map<string, Map<string, number[]>>> {
	// Map: title -> library -> array of ops/sec values
	const allResults = new Map<string, Map<string, number[]>>()

	for (let run = 1; run <= numRuns; run++) {
		console.log(`\nRun ${run}/${numRuns}...`)

		for (const file of BENCHMARK_FILES) {
			console.log(`  Running ${file}...`)
			try {
				// Use .nothrow() since bun test may return non-zero even on success
				const result = await $`bun test ./${file} 2>&1`.nothrow().text()
				const parsed = parseBenchmarkOutput(result)

				for (const bench of parsed) {
					if (!allResults.has(bench.title)) {
						allResults.set(bench.title, new Map())
					}
					const titleMap = allResults.get(bench.title)!

					for (const [lib, ops] of bench.results) {
						if (!titleMap.has(lib)) {
							titleMap.set(lib, [])
						}
						titleMap.get(lib)!.push(ops)
					}
				}
			} catch (e) {
				console.error(`  Error running ${file}:`, e)
			}
		}
	}

	return allResults
}

// Calculate averages from multiple runs
function calculateAverages(allResults: Map<string, Map<string, number[]>>): Map<string, Map<string, number>> {
	const averages = new Map<string, Map<string, number>>()

	for (const [title, libResults] of allResults) {
		const titleAvg = new Map<string, number>()
		for (const [lib, values] of libResults) {
			if (values.length > 0) {
				const avg = values.reduce((a, b) => a + b, 0) / values.length
				titleAvg.set(lib, avg)
			}
		}
		averages.set(title, titleAvg)
	}

	return averages
}

// Get result by title pattern - returns LAST match (longest text variant)
function getResult(averages: Map<string, Map<string, number>>, pattern: string | RegExp): Map<string, number> | undefined {
	let lastMatch: Map<string, number> | undefined
	for (const [title, results] of averages) {
		if (typeof pattern === "string" ? title.includes(pattern) : pattern.test(title)) {
			lastMatch = results
		}
	}
	return lastMatch
}

// Get result by exact title match or first match
function getResultFirst(averages: Map<string, Map<string, number>>, pattern: string | RegExp): Map<string, number> | undefined {
	for (const [title, results] of averages) {
		if (typeof pattern === "string" ? title.includes(pattern) : pattern.test(title)) {
			return results
		}
	}
	return undefined
}

// Build the JSON data structure
function buildJsonData(averages: Map<string, Map<string, number>>): object {
	const r = (n: number) => Math.round(n)

	// Path benchmarks
	const pathExtract = getResult(averages, "Glyph Path Extraction")
	const svgGen = getResult(averages, "SVG Path Generation")
	const textSvgHello = getResult(averages, "Text to SVG - 'Hello World'")
	const textSvgPara = getResult(averages, "Text to SVG - Paragraph")

	// Basic shaping - from features.test.ts
	const ltrNoFeatures = getResultFirst(averages, /No Features - mixed text/i)
	const ligaKern = getResultFirst(averages, /All Common Features - mixed text/i)
	const manyFeatures = getResultFirst(averages, /Standard Ligatures - mixed text/i)

	// Cyrillic
	const russian = getResult(averages, /Russian paragraph_long/i)
	const ukrainian = getResult(averages, /Ukrainian paragraph_long/i)
	const belarusian = getResult(averages, /Belarusian paragraph_long/i)

	// CJK
	const chinese = getResult(averages, /Chinese.*paragraph_long/i)
	const japanese = getResult(averages, /Japanese paragraph_long/i)
	const korean = getResult(averages, /Korean paragraph_long/i)

	// Latin
	const english = getResult(averages, /English paragraph_long/i)

	// RTL
	const arabic = getResult(averages, /Arabic paragraph_long/i)
	const hebrew = getResult(averages, /Hebrew paragraph_long/i)

	// Complex scripts
	const hindi = getResult(averages, /Hindi paragraph_long/i)
	const myanmar = getResult(averages, /Myanmar paragraph_long/i)
	const khmer = getResult(averages, /Khmer paragraph_long/i)
	const thai = getResult(averages, /Thai paragraph_long/i)

	// Greek
	const greek = getResult(averages, /Greek paragraph_long/i)

	// Caching
	const cachingHello = getResult(averages, /Repeated Shaping - "Hello"/i)
	const cachingPara = getResult(averages, /Repeated Shaping - paragraph/i)
	const glyphPathSame = getResultFirst(averages, /Glyph Path - same glyph/i)
	const uiSim = getResult(averages, "UI Simulation - 8 labels")
	const docSim = getResultFirst(averages, /Document Simulation/i)

	// Rasterization
	const raster12 = getResultFirst(averages, /Rasterization - 12px Grayscale/i)
	const raster24 = getResultFirst(averages, /Rasterization - 24px Grayscale/i)
	const raster48 = getResultFirst(averages, /Rasterization - 48px Grayscale/i)
	const raster96 = getResultFirst(averages, /Rasterization - 96px Grayscale/i)
	const raster200 = getResultFirst(averages, /Very large - 5 glyphs at 200px/i)
	const lcd24 = getResultFirst(averages, /Rasterization - LCD \(24px/i)
	const hinted12 = getResultFirst(averages, /Rasterization - Hinted \(12px/i)
	const throughput62 = getResultFirst(averages, /Throughput - 62 glyphs at 16px/i)
	const varyingSizes = getResultFirst(averages, /Varying sizes - 15 sizes/i)

	// Features
	const noFeatures = getResultFirst(averages, /No Features - mixed text/i)
	const liga = getResultFirst(averages, /Standard Ligatures - liga text/i)
	const kern = getResultFirst(averages, /Kerning - pairs text/i)
	const smcp = getResultFirst(averages, /Small Caps - text/i)
	const onum = getResultFirst(averages, /Oldstyle Figures - numbers/i)
	const tnum = getResultFirst(averages, /Tabular Figures - numbers/i)
	const frac = getResultFirst(averages, /Fractions - text/i)
	const allCommon = getResultFirst(averages, /All Common Features - mixed text/i)

	// Grapheme clusters
	const graphAscii = getResultFirst(averages, /Count Graphemes - ascii/i)
	const graphEmojiSimple = getResultFirst(averages, /Count Graphemes - emoji_simple/i)
	const graphEmojiZwj = getResultFirst(averages, /Count Graphemes - emoji_zwj/i)
	const graphDevanagari = getResultFirst(averages, /Count Graphemes - devanagari/i)
	const graphMixed = getResultFirst(averages, /Count Graphemes - mixed/i)
	const graphSplit = getResultFirst(averages, /Split Graphemes - emoji_zwj/i)

	return {
		meta: {
			generatedAt: new Date().toISOString(),
			runs,
			environment: {
				platform: "MacBook Pro M1 Pro",
				memory: "16 GB",
				runtime: "Bun 1.3.4",
			},
		},
		path: {
			extraction: {
				textShaper: r(pathExtract?.get("text-shaper") || 0),
				opentypeJs: r(pathExtract?.get("opentype.js") || 0),
				harfbuzzjs: r(pathExtract?.get("harfbuzzjs") || 0),
			},
			svgGeneration: {
				textShaper: r(svgGen?.get("text-shaper") || 0),
				opentypeJs: r(svgGen?.get("opentype.js") || 0),
				harfbuzzjs: r(svgGen?.get("harfbuzzjs") || 0),
			},
			textToSvgHello: {
				textShaper: r(textSvgHello?.get("text-shaper") || 0),
				opentypeJs: r(textSvgHello?.get("opentype.js") || 0),
				harfbuzzjs: r(textSvgHello?.get("harfbuzzjs") || 0),
			},
			textToSvgParagraph: {
				textShaper: r(textSvgPara?.get("text-shaper") || 0),
				opentypeJs: r(textSvgPara?.get("opentype.js") || 0),
				harfbuzzjs: r(textSvgPara?.get("harfbuzzjs") || 0),
			},
		},
		shaping: {
			english1056: {
				textShaper: r(english?.get("text-shaper") || 0),
				harfbuzzjs: r(english?.get("harfbuzzjs") || 0),
			},
			myanmar1916: {
				textShaper: r(myanmar?.get("text-shaper") || 0),
				harfbuzzjs: r(myanmar?.get("harfbuzzjs") || 0),
			},
			arabic1121: {
				textShaper: r(arabic?.get("text-shaper") || 0),
				harfbuzzjs: r(arabic?.get("harfbuzzjs") || 0),
			},
		},
		caching: {
			hello: {
				textShaper: r(cachingHello?.get("text-shaper (repeat)") || 0),
				harfbuzzjs: r(cachingHello?.get("harfbuzzjs") || 0),
			},
			paragraph: {
				textShaper: r(cachingPara?.get("text-shaper (repeat)") || 0),
				harfbuzzjs: r(cachingPara?.get("harfbuzzjs") || 0),
			},
			uiSimulation: {
				textShaper: r(uiSim?.get("text-shaper") || 0),
				harfbuzzjs: r(uiSim?.get("harfbuzzjs") || 0),
			},
		},
		rasterization: {
			"12px": {
				textShaper: r(raster12?.get("text-shaper") || 0),
				freetype2: r(raster12?.get("freetype2") || 0),
			},
			"24px": {
				textShaper: r(raster24?.get("text-shaper") || 0),
				freetype2: r(raster24?.get("freetype2") || 0),
			},
			"48px": {
				textShaper: r(raster48?.get("text-shaper") || 0),
				freetype2: r(raster48?.get("freetype2") || 0),
			},
			"96px": {
				textShaper: r(raster96?.get("text-shaper") || 0),
				freetype2: r(raster96?.get("freetype2") || 0),
			},
			"200px": {
				textShaper: r(raster200?.get("text-shaper") || 0),
				freetype2: r(raster200?.get("freetype2") || 0),
			},
		},
		benchmarks: {
			path: {
				extraction: {
					textShaper: r(pathExtract?.get("text-shaper") || 0),
					opentypeJs: r(pathExtract?.get("opentype.js") || 0),
					harfbuzzjs: r(pathExtract?.get("harfbuzzjs") || 0),
				},
				svgGeneration: {
					textShaper: r(svgGen?.get("text-shaper") || 0),
					opentypeJs: r(svgGen?.get("opentype.js") || 0),
					harfbuzzjs: r(svgGen?.get("harfbuzzjs") || 0),
				},
				textToSvgHello: {
					textShaper: r(textSvgHello?.get("text-shaper") || 0),
					opentypeJs: r(textSvgHello?.get("opentype.js") || 0),
					harfbuzzjs: r(textSvgHello?.get("harfbuzzjs") || 0),
				},
				textToSvgParagraph: {
					textShaper: r(textSvgPara?.get("text-shaper") || 0),
					opentypeJs: r(textSvgPara?.get("opentype.js") || 0),
					harfbuzzjs: r(textSvgPara?.get("harfbuzzjs") || 0),
				},
			},
			basic: {
				ltrNoFeatures: {
					textShaper: r(ltrNoFeatures?.get("text-shaper") || 0),
					harfbuzzjs: r(ltrNoFeatures?.get("harfbuzzjs") || 0),
				},
				ligaKern: {
					textShaper: r(ligaKern?.get("text-shaper") || 0),
					harfbuzzjs: r(ligaKern?.get("harfbuzzjs") || 0),
				},
				manyFeatures: {
					textShaper: r(manyFeatures?.get("text-shaper") || 0),
					harfbuzzjs: r(manyFeatures?.get("harfbuzzjs") || 0),
				},
			},
			cyrillic: {
				russian: {
					textShaper: r(russian?.get("text-shaper") || 0),
					harfbuzzjs: r(russian?.get("harfbuzzjs") || 0),
					opentypeJs: r(russian?.get("opentype.js") || 0),
				},
				ukrainian: {
					textShaper: r(ukrainian?.get("text-shaper") || 0),
					harfbuzzjs: r(ukrainian?.get("harfbuzzjs") || 0),
					opentypeJs: r(ukrainian?.get("opentype.js") || 0),
				},
				belarusian: {
					textShaper: r(belarusian?.get("text-shaper") || 0),
					harfbuzzjs: r(belarusian?.get("harfbuzzjs") || 0),
					opentypeJs: r(belarusian?.get("opentype.js") || 0),
				},
			},
			cjk: {
				chinese: {
					textShaper: r(chinese?.get("text-shaper") || 0),
					harfbuzzjs: r(chinese?.get("harfbuzzjs") || 0),
					opentypeJs: r(chinese?.get("opentype.js") || 0),
				},
				japanese: {
					textShaper: r(japanese?.get("text-shaper") || 0),
					harfbuzzjs: r(japanese?.get("harfbuzzjs") || 0),
					opentypeJs: r(japanese?.get("opentype.js") || 0),
				},
				korean: {
					textShaper: r(korean?.get("text-shaper") || 0),
					harfbuzzjs: r(korean?.get("harfbuzzjs") || 0),
					opentypeJs: r(korean?.get("opentype.js") || 0),
				},
			},
			latin: {
				english: {
					textShaper: r(english?.get("text-shaper") || 0),
					harfbuzzjs: r(english?.get("harfbuzzjs") || 0),
					opentypeJs: r(english?.get("opentype.js") || 0),
				},
			},
			rtl: {
				arabic: {
					textShaper: r(arabic?.get("text-shaper") || 0),
					harfbuzzjs: r(arabic?.get("harfbuzzjs") || 0),
					opentypeJs: r(arabic?.get("opentype.js") || 0),
				},
				hebrew: {
					textShaper: r(hebrew?.get("text-shaper") || 0),
					harfbuzzjs: r(hebrew?.get("harfbuzzjs") || 0),
					opentypeJs: r(hebrew?.get("opentype.js") || 0),
				},
			},
			complex: {
				hindi: {
					textShaper: r(hindi?.get("text-shaper") || 0),
					harfbuzzjs: r(hindi?.get("harfbuzzjs") || 0),
					opentypeJs: r(hindi?.get("opentype.js") || 0),
				},
				myanmar: {
					textShaper: r(myanmar?.get("text-shaper") || 0),
					harfbuzzjs: r(myanmar?.get("harfbuzzjs") || 0),
					opentypeJs: r(myanmar?.get("opentype.js") || 0),
				},
				khmer: {
					textShaper: r(khmer?.get("text-shaper") || 0),
					harfbuzzjs: r(khmer?.get("harfbuzzjs") || 0),
					opentypeJs: r(khmer?.get("opentype.js") || 0),
				},
				thai: {
					textShaper: r(thai?.get("text-shaper") || 0),
					harfbuzzjs: r(thai?.get("harfbuzzjs") || 0),
					opentypeJs: r(thai?.get("opentype.js") || 0),
				},
			},
			greek: {
				greek: {
					textShaper: r(greek?.get("text-shaper") || 0),
					harfbuzzjs: r(greek?.get("harfbuzzjs") || 0),
					opentypeJs: r(greek?.get("opentype.js") || 0),
				},
			},
			caching: {
				hello: {
					textShaper: r(cachingHello?.get("text-shaper (repeat)") || 0),
					harfbuzzjs: r(cachingHello?.get("harfbuzzjs") || 0),
					firstCall: r(cachingHello?.get("text-shaper (first)") || 0),
				},
				paragraph: {
					textShaper: r(cachingPara?.get("text-shaper (repeat)") || 0),
					harfbuzzjs: r(cachingPara?.get("harfbuzzjs") || 0),
					firstCall: r(cachingPara?.get("text-shaper (first)") || 0),
				},
				glyphPath: {
					textShaper: r(glyphPathSame?.get("repeated access") || 0),
					firstCall: r(glyphPathSame?.get("first access") || 0),
				},
			},
			simulation: {
				ui: {
					textShaper: r(uiSim?.get("text-shaper") || 0),
					harfbuzzjs: r(uiSim?.get("harfbuzzjs") || 0),
				},
				document: {
					textShaper: r(docSim?.get("text-shaper") || 0),
					harfbuzzjs: r(docSim?.get("harfbuzzjs") || 0),
				},
			},
			raster: {
				"12px": {
					textShaper: r(raster12?.get("text-shaper") || 0),
					freetype2: r(raster12?.get("freetype2") || 0),
				},
				"24px": {
					textShaper: r(raster24?.get("text-shaper") || 0),
					freetype2: r(raster24?.get("freetype2") || 0),
				},
				"48px": {
					textShaper: r(raster48?.get("text-shaper") || 0),
					freetype2: r(raster48?.get("freetype2") || 0),
				},
				"96px": {
					textShaper: r(raster96?.get("text-shaper") || 0),
					freetype2: r(raster96?.get("freetype2") || 0),
				},
				"200px": {
					textShaper: r(raster200?.get("text-shaper") || 0),
					freetype2: r(raster200?.get("freetype2") || 0),
				},
			},
			rasterModes: {
				lcd24px: {
					textShaper: r(lcd24?.get("text-shaper") || 0),
					freetype2: r(lcd24?.get("freetype2") || 0),
				},
				hinted12px: {
					textShaper: r(hinted12?.get("text-shaper") || 0),
					freetype2: r(hinted12?.get("freetype2") || 0),
				},
			},
			throughput: {
				"62glyphs16px": {
					textShaper: r(throughput62?.get("text-shaper") || 0),
					freetype2: r(throughput62?.get("freetype2") || 0),
				},
				varyingSizes: {
					textShaper: r(varyingSizes?.get("text-shaper") || 0),
					freetype2: r(varyingSizes?.get("freetype2") || 0),
				},
				veryLarge: {
					textShaper: r(raster200?.get("text-shaper") || 0),
					freetype2: r(raster200?.get("freetype2") || 0),
				},
			},
			features: {
				noFeatures: {
					textShaper: r(noFeatures?.get("text-shaper") || 0),
					harfbuzzjs: r(noFeatures?.get("harfbuzzjs") || 0),
				},
				liga: {
					textShaper: r(liga?.get("text-shaper") || 0),
					harfbuzzjs: r(liga?.get("harfbuzzjs") || 0),
				},
				kern: {
					textShaper: r(kern?.get("text-shaper") || 0),
					harfbuzzjs: r(kern?.get("harfbuzzjs") || 0),
				},
				smcp: {
					textShaper: r(smcp?.get("text-shaper") || 0),
					harfbuzzjs: r(smcp?.get("harfbuzzjs") || 0),
				},
				onum: {
					textShaper: r(onum?.get("text-shaper") || 0),
					harfbuzzjs: r(onum?.get("harfbuzzjs") || 0),
				},
				tnum: {
					textShaper: r(tnum?.get("text-shaper") || 0),
					harfbuzzjs: r(tnum?.get("harfbuzzjs") || 0),
				},
				frac: {
					textShaper: r(frac?.get("text-shaper") || 0),
					harfbuzzjs: r(frac?.get("harfbuzzjs") || 0),
				},
				allCommon: {
					textShaper: r(allCommon?.get("text-shaper") || 0),
					harfbuzzjs: r(allCommon?.get("harfbuzzjs") || 0),
				},
			},
			graphemes: {
				ascii: {
					textShaper: r(graphAscii?.get("text-shaper") || 0),
				},
				emojiSimple: {
					textShaper: r(graphEmojiSimple?.get("text-shaper") || 0),
				},
				emojiZwj: {
					textShaper: r(graphEmojiZwj?.get("text-shaper") || 0),
				},
				devanagari: {
					textShaper: r(graphDevanagari?.get("text-shaper") || 0),
				},
				mixed: {
					textShaper: r(graphMixed?.get("text-shaper") || 0),
				},
				splitEmojiZwj: {
					textShaper: r(graphSplit?.get("text-shaper") || 0),
				},
			},
		},
	}
}

// Main
async function main() {
	// Run benchmarks
	const allResults = await runBenchmarks(runs)
	const averages = calculateAverages(allResults)

	console.log("\nCalculated averages:")
	for (const [title, results] of averages) {
		console.log(`\n${title}:`)
		for (const [lib, ops] of results) {
			console.log(`  ${lib}: ${Math.round(ops)} ops/s`)
		}
	}

	// Build and write JSON
	const jsonData = buildJsonData(averages)
	const outputPath = "docs/.vitepress/data/benchmarks.json"

	await Bun.write(outputPath, JSON.stringify(jsonData, null, "\t"))
	console.log(`\nWritten to ${outputPath}`)

	// Optionally commit
	if (shouldCommit) {
		console.log("\nCommitting changes...")
		await $`git add ${outputPath}`
		await $`git commit -m "update benchmark data"`
		console.log("Committed!")
	}

	console.log("\nDone!")
}

main().catch(console.error)
