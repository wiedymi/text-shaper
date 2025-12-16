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
				if (name && opsStr && !name.includes("(first)") && name !== "(first call)") {
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

// Get result by title pattern
function getResult(averages: Map<string, Map<string, number>>, pattern: string | RegExp): Map<string, number> | undefined {
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

	// Caching
	const cachingHello = getResult(averages, /Repeated Shaping - "Hello"/)
	const cachingPara = getResult(averages, /Repeated Shaping - paragraph/)
	const uiSim = getResult(averages, "UI Simulation - 8 labels")

	// Rasterization
	const raster12 = getResult(averages, /12px grayscale/)
	const raster24 = getResult(averages, /24px grayscale/)
	const raster48 = getResult(averages, /48px grayscale/)
	const raster96 = getResult(averages, /96px grayscale/)
	const raster200 = getResult(averages, /200px grayscale|Very large/)

	// Shaping - find English and Myanmar paragraphs
	let englishOps = { ts: 0, hb: 0 }
	let myanmarOps = { ts: 0, hb: 0 }
	let arabicOps = { ts: 0, hb: 0 }

	for (const [title, results] of averages) {
		if ((title.includes("English") || title.includes("1056")) && title.includes("paragraph")) {
			englishOps.ts = results.get("text-shaper") || 0
			englishOps.hb = results.get("harfbuzzjs") || 0
		}
		if (title.includes("Myanmar") && title.includes("paragraph")) {
			myanmarOps.ts = results.get("text-shaper") || 0
			myanmarOps.hb = results.get("harfbuzzjs") || 0
		}
		if (title.includes("Arabic") && title.includes("paragraph")) {
			arabicOps.ts = results.get("text-shaper") || 0
			arabicOps.hb = results.get("harfbuzzjs") || 0
		}
	}

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
				textShaper: r(englishOps.ts),
				harfbuzzjs: r(englishOps.hb),
			},
			myanmar984: {
				textShaper: r(myanmarOps.ts),
				harfbuzzjs: r(myanmarOps.hb),
			},
			arabic1121: {
				textShaper: r(arabicOps.ts),
				harfbuzzjs: r(arabicOps.hb),
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
