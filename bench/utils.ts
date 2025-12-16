export interface BenchResult {
	name: string
	opsPerSec: number
	avgMs: number
	minMs: number
	maxMs: number
	samples: number
}

export function measure(
	name: string,
	fn: () => void,
	options: { warmup?: number; iterations?: number; batchSize?: number } = {},
): BenchResult {
	const { warmup = 100, iterations = 3, batchSize = 1000 } = options

	// Warmup - more iterations to ensure JIT optimization
	for (let i = 0; i < warmup; i++) {
		fn()
	}

	// Measure using batch timing to reduce per-call overhead
	// Each iteration measures a batch of operations
	const times: number[] = []
	for (let i = 0; i < iterations; i++) {
		const start = performance.now()
		for (let j = 0; j < batchSize; j++) {
			fn()
		}
		times.push((performance.now() - start) / batchSize)
	}

	times.sort((a, b) => a - b)
	const minMs = times[0]
	const maxMs = times[times.length - 1]
	const avgMs = times.reduce((a, b) => a + b, 0) / times.length
	const opsPerSec = 1000 / avgMs

	return { name, opsPerSec, avgMs, minMs, maxMs, samples: iterations * batchSize }
}

export async function measureAsync(
	name: string,
	fn: () => Promise<void>,
	options: { warmup?: number; iterations?: number } = {},
): Promise<BenchResult> {
	const { warmup = 50, iterations = 500 } = options

	// Warmup
	for (let i = 0; i < warmup; i++) {
		await fn()
	}

	// Measure
	const times: number[] = []
	for (let i = 0; i < iterations; i++) {
		const start = performance.now()
		await fn()
		times.push(performance.now() - start)
	}

	times.sort((a, b) => a - b)
	const minMs = times[0]
	const maxMs = times[times.length - 1]
	const avgMs = times.reduce((a, b) => a + b, 0) / times.length
	const opsPerSec = 1000 / avgMs

	return { name, opsPerSec, avgMs, minMs, maxMs, samples: iterations }
}

function formatNumber(n: number, decimals = 2): string {
	if (n >= 1000000) return `${(n / 1000000).toFixed(decimals)}M`
	if (n >= 1000) return `${(n / 1000).toFixed(decimals)}k`
	return n.toFixed(decimals)
}

function padRight(str: string, len: number): string {
	return str + " ".repeat(Math.max(0, len - str.length))
}

function padLeft(str: string, len: number): string {
	return " ".repeat(Math.max(0, len - str.length)) + str
}

export function printComparison(title: string, results: BenchResult[], baseline?: string): void {
	console.log(`\n${title}`)

	const baselineResult = baseline
		? results.find((r) => r.name === baseline)
		: results[0]

	const rows = results.map((r) => {
		let comparison = "baseline"
		if (baselineResult && r.name !== baselineResult.name) {
			const ratio = r.opsPerSec / baselineResult.opsPerSec
			if (ratio > 1) {
				comparison = `${ratio.toFixed(2)}x faster`
			} else {
				comparison = `${(1 / ratio).toFixed(2)}x slower`
			}
		}
		return {
			name: r.name,
			opsPerSec: formatNumber(r.opsPerSec),
			avgMs: r.avgMs.toFixed(3),
			comparison,
		}
	})

	const cols = {
		name: Math.max(8, ...rows.map((r) => r.name.length)),
		opsPerSec: Math.max(8, ...rows.map((r) => r.opsPerSec.length)),
		avgMs: Math.max(8, ...rows.map((r) => r.avgMs.length)),
		comparison: Math.max(12, ...rows.map((r) => r.comparison.length)),
	}

	const line = `├${"─".repeat(cols.name + 2)}┼${"─".repeat(cols.opsPerSec + 2)}┼${"─".repeat(cols.avgMs + 2)}┼${"─".repeat(cols.comparison + 2)}┤`
	const top = `┌${"─".repeat(cols.name + 2)}┬${"─".repeat(cols.opsPerSec + 2)}┬${"─".repeat(cols.avgMs + 2)}┬${"─".repeat(cols.comparison + 2)}┐`
	const bottom = `└${"─".repeat(cols.name + 2)}┴${"─".repeat(cols.opsPerSec + 2)}┴${"─".repeat(cols.avgMs + 2)}┴${"─".repeat(cols.comparison + 2)}┘`

	console.log(top)
	console.log(
		`│ ${padRight("Library", cols.name)} │ ${padLeft("ops/sec", cols.opsPerSec)} │ ${padLeft("avg (ms)", cols.avgMs)} │ ${padRight("vs baseline", cols.comparison)} │`,
	)
	console.log(line)
	for (const row of rows) {
		console.log(
			`│ ${padRight(row.name, cols.name)} │ ${padLeft(row.opsPerSec, cols.opsPerSec)} │ ${padLeft(row.avgMs, cols.avgMs)} │ ${padRight(row.comparison, cols.comparison)} │`,
		)
	}
	console.log(bottom)
}

export async function loadTextFile(path: string): Promise<string> {
	return await Bun.file(path).text()
}

export async function loadFontBuffer(path: string): Promise<ArrayBuffer> {
	return await Bun.file(path).arrayBuffer()
}
