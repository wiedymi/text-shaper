<script setup lang="ts">
import { computed } from "vue"

interface Result {
	name: string
	value: number
	unit: string
}

interface Benchmark {
	title: string
	results: Result[]
}

const benchmarks: Benchmark[] = [
	{
		title: "Glyph path extraction",
		results: [
			{ name: "text-shaper", value: 831300, unit: "ops/s" },
			{ name: "opentype.js", value: 86850, unit: "ops/s" },
			{ name: "harfbuzzjs", value: 52350, unit: "ops/s" },
		],
	},
	{
		title: "English shaping (1056 chars)",
		results: [
			{ name: "text-shaper", value: 7890, unit: "ops/s" },
			{ name: "harfbuzzjs", value: 5300, unit: "ops/s" },
		],
	},
	{
		title: "Myanmar shaping (1916 chars)",
		results: [
			{ name: "text-shaper", value: 4000, unit: "ops/s" },
			{ name: "harfbuzzjs", value: 380, unit: "ops/s" },
		],
	},
	{
		title: "UI Simulation (8 labels)",
		results: [
			{ name: "text-shaper", value: 95550, unit: "ops/s" },
			{ name: "harfbuzzjs", value: 19980, unit: "ops/s" },
		],
	},
	{
		title: "Rasterization @ 96px",
		results: [
			{ name: "text-shaper", value: 13260, unit: "ops/s" },
			{ name: "freetype2", value: 2040, unit: "ops/s" },
		],
	},
]

function sortResults(results: Result[]): Result[] {
	return [...results].sort((a, b) => b.value - a.value)
}

function getMaxValue(results: Result[]): number {
	return Math.max(...results.map((r) => r.value))
}

function getBarWidth(value: number, max: number): number {
	return (value / max) * 100
}

function formatValue(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
	return value.toFixed(0)
}

function isOurs(name: string): boolean {
	return name === "text-shaper"
}
</script>

<template>
	<div class="hero-bench">
		<div class="charts-side">
			<div v-for="bench in benchmarks" :key="bench.title" class="chart-block">
				<div class="chart-title">{{ bench.title }}</div>
				<div class="chart-rows">
					<div v-for="result in sortResults(bench.results)" :key="result.name" class="chart-row">
						<span class="chart-name" :class="{ ours: isOurs(result.name) }">{{ result.name }}</span>
						<div class="chart-bar-wrap">
							<div
								class="chart-bar"
								:class="{ ours: isOurs(result.name) }"
								:style="{ width: `${getBarWidth(result.value, getMaxValue(bench.results))}%` }"
							></div>
						</div>
						<span class="chart-value" :class="{ ours: isOurs(result.name) }">{{ formatValue(result.value) }} {{ result.unit }}</span>
					</div>
				</div>
			</div>
			<div class="chart-footer">
				MacBook Pro M1 Pro, 16 GB, Bun 1.3.3
			</div>
		</div>
		<div class="info-side">
			<h2 class="info-title">High performance</h2>
			<p class="info-desc">
				By using lazy table parsing, pure TypeScript optimization, and efficient data structures,
				TextShaper delivers exceptional performance for font loading, text shaping, and glyph rasterization.
			</p>
			<a href="/benchmarks" class="info-link">View all benchmarks →</a>
		</div>
	</div>
</template>

<style scoped>
.hero-bench {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 48px;
	max-width: 1100px;
	margin: 48px auto;
	padding: 0 24px;
	align-items: center;
}

.charts-side {
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.chart-block {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.chart-title {
	font-size: 14px;
	font-weight: 600;
	color: var(--vp-c-text-1);
	text-align: center;
	margin-bottom: 4px;
}

.chart-rows {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.chart-row {
	display: grid;
	grid-template-columns: 130px 1fr auto;
	align-items: center;
	gap: 12px;
	height: 24px;
}

.chart-name {
	font-size: 13px;
	font-weight: 500;
	color: var(--vp-c-text-2);
	text-align: right;
}

.chart-name.ours {
	color: #8b5cf6;
	font-weight: 600;
}

.chart-bar-wrap {
	height: 20px;
	position: relative;
}

.chart-bar {
	height: 100%;
	border-radius: 3px;
	background: linear-gradient(90deg, #64748b 0%, #94a3b8 100%);
	min-width: 4px;
}

.chart-bar.ours {
	background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%);
}

.chart-value {
	font-size: 13px;
	color: var(--vp-c-text-2);
	min-width: 90px;
}

.chart-value.ours {
	color: #8b5cf6;
	font-weight: 600;
}

.chart-footer {
	font-size: 11px;
	color: var(--vp-c-text-3);
	text-align: center;
	margin-top: 8px;
}

.info-side {
	padding-left: 24px;
}

.info-title {
	font-size: 36px;
	font-weight: 700;
	color: #8b5cf6;
	margin: 0 0 16px 0;
	line-height: 1.2;
}

.info-desc {
	font-size: 16px;
	line-height: 1.6;
	color: var(--vp-c-text-1);
	margin: 0 0 24px 0;
}

.info-link {
	font-size: 14px;
	font-weight: 600;
	color: #8b5cf6;
	text-decoration: none;
}

.info-link:hover {
	text-decoration: underline;
}

@media (max-width: 768px) {
	.hero-bench {
		grid-template-columns: 1fr;
		gap: 32px;
	}

	.info-side {
		padding-left: 0;
		text-align: center;
	}

	.chart-row {
		grid-template-columns: 100px 1fr auto;
	}

	.chart-name {
		font-size: 11px;
	}

	.chart-value {
		font-size: 11px;
		min-width: 70px;
	}

	.info-title {
		font-size: 28px;
	}
}
</style>
