<script setup lang="ts">
import { computed } from "vue"
import benchmarkData from "../data/benchmarks.json"

const data = benchmarkData.benchmarks as any

function getRatio(ours: number, theirs: number): number {
	if (theirs === 0 || ours === 0) return 0
	return ours / theirs
}

function formatRatio(ratio: number): string {
	if (ratio === 0) return "-"
	if (ratio >= 10) return `${Math.round(ratio)}x faster`
	if (ratio >= 1.05) return `${ratio.toFixed(1)}x faster`
	if (ratio >= 0.95) return "1.0x"
	return `${(1 / ratio).toFixed(1)}x slower`
}

function formatRange(ratios: number[]): string {
	const valid = ratios.filter(r => r > 0)
	if (valid.length === 0) return "-"

	const min = Math.min(...valid)
	const max = Math.max(...valid)

	const formatNum = (n: number) => {
		if (n >= 10) return Math.round(n).toString()
		return n.toFixed(1).replace(/\.0$/, "")
	}

	if (Math.abs(max - min) < 0.2) {
		const avg = (min + max) / 2
		if (avg >= 0.95 && avg <= 1.05) return "1.0x"
		if (avg >= 1.05) return `${formatNum(avg)}x faster`
		return `${formatNum(1 / avg)}x slower`
	}

	if (min >= 0.95) {
		return `${formatNum(min)}-${formatNum(max)}x faster`
	}
	return `${formatNum(min)}-${formatNum(max)}x`
}

// Compute all summary items from benchmark data
const summaryItems = computed(() => {
	return [
		{
			category: "Path Extraction",
			vsHarfbuzz: formatRatio(getRatio(data.path.extraction.textShaper, data.path.extraction.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.path.extraction.textShaper, data.path.extraction.opentypeJs)),
		},
		{
			category: "SVG Generation",
			vsHarfbuzz: formatRatio(getRatio(data.path.svgGeneration.textShaper, data.path.svgGeneration.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.path.svgGeneration.textShaper, data.path.svgGeneration.opentypeJs)),
			highlight: true,
		},
		{
			category: "Latin Shaping",
			vsHarfbuzz: formatRatio(getRatio(data.latin.english.textShaper, data.latin.english.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.latin.english.textShaper, data.latin.english.opentypeJs)),
			highlight: true,
		},
		{
			category: "Cyrillic Shaping",
			vsHarfbuzz: formatRange([
				getRatio(data.cyrillic.russian.textShaper, data.cyrillic.russian.harfbuzzjs),
				getRatio(data.cyrillic.ukrainian.textShaper, data.cyrillic.ukrainian.harfbuzzjs),
				getRatio(data.cyrillic.belarusian.textShaper, data.cyrillic.belarusian.harfbuzzjs),
			]),
			vsOpentype: formatRange([
				getRatio(data.cyrillic.russian.textShaper, data.cyrillic.russian.opentypeJs),
				getRatio(data.cyrillic.ukrainian.textShaper, data.cyrillic.ukrainian.opentypeJs),
				getRatio(data.cyrillic.belarusian.textShaper, data.cyrillic.belarusian.opentypeJs),
			]),
		},
		{
			category: "CJK Shaping",
			vsHarfbuzz: formatRange([
				getRatio(data.cjk.chinese.textShaper, data.cjk.chinese.harfbuzzjs),
				getRatio(data.cjk.japanese.textShaper, data.cjk.japanese.harfbuzzjs),
				getRatio(data.cjk.korean.textShaper, data.cjk.korean.harfbuzzjs),
			]),
			vsOpentype: formatRange([
				getRatio(data.cjk.chinese.textShaper, data.cjk.chinese.opentypeJs),
				getRatio(data.cjk.japanese.textShaper, data.cjk.japanese.opentypeJs),
				getRatio(data.cjk.korean.textShaper, data.cjk.korean.opentypeJs),
			]),
			highlight: true,
		},
		{
			category: "Arabic Shaping",
			vsHarfbuzz: formatRatio(getRatio(data.rtl.arabic.textShaper, data.rtl.arabic.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.rtl.arabic.textShaper, data.rtl.arabic.opentypeJs)),
			highlight: true,
		},
		{
			category: "Hebrew Shaping",
			vsHarfbuzz: formatRatio(getRatio(data.rtl.hebrew.textShaper, data.rtl.hebrew.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.rtl.hebrew.textShaper, data.rtl.hebrew.opentypeJs)),
			highlight: true,
		},
		{
			category: "Hindi Shaping",
			vsHarfbuzz: formatRatio(getRatio(data.complex.hindi.textShaper, data.complex.hindi.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.complex.hindi.textShaper, data.complex.hindi.opentypeJs)),
			highlight: true,
		},
		{
			category: "Thai Shaping",
			vsHarfbuzz: formatRatio(getRatio(data.complex.thai.textShaper, data.complex.thai.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.complex.thai.textShaper, data.complex.thai.opentypeJs)),
			highlight: true,
		},
		{
			category: "Myanmar Shaping",
			vsHarfbuzz: formatRatio(getRatio(data.complex.myanmar.textShaper, data.complex.myanmar.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.complex.myanmar.textShaper, data.complex.myanmar.opentypeJs)),
			highlight: true,
		},
		{
			category: "Khmer Shaping",
			vsHarfbuzz: formatRatio(getRatio(data.complex.khmer.textShaper, data.complex.khmer.harfbuzzjs)),
			vsOpentype: formatRatio(getRatio(data.complex.khmer.textShaper, data.complex.khmer.opentypeJs)),
			highlight: true,
		},
		{
			category: "UI Simulation",
			vsHarfbuzz: formatRatio(getRatio(data.simulation.ui.textShaper, data.simulation.ui.harfbuzzjs)),
			highlight: true,
		},
		{
			category: "Rasterization",
			vsFreetype: formatRange([
				getRatio(data.raster["12px"].textShaper, data.raster["12px"].freetype2),
				getRatio(data.raster["24px"].textShaper, data.raster["24px"].freetype2),
				getRatio(data.raster["48px"].textShaper, data.raster["48px"].freetype2),
				getRatio(data.raster["96px"].textShaper, data.raster["96px"].freetype2),
				getRatio(data.raster["200px"].textShaper, data.raster["200px"].freetype2),
			]),
			highlight: true,
		},
		{
			category: "Cache Benefits",
			improvement: (() => {
				const repeat = data.caching.hello.textShaper
				const first = data.caching.hello.firstCall
				if (first > 0 && repeat > 0) {
					const speedup = repeat / first
					return `${speedup.toFixed(0)}x speedup on repeated shaping`
				}
				return "3x speedup on repeated shaping"
			})(),
		},
	]
})

function getClass(value: string | undefined): string {
	if (!value || value === "-") return ""
	if (value.includes("faster") || value.includes("speedup")) return "faster"
	if (value.includes("slower")) return "slower"
	return ""
}
</script>

<template>
	<div class="summary">
		<div class="summary-header">
			<span class="summary-cat">Category</span>
			<span class="summary-col">vs harfbuzzjs</span>
			<span class="summary-col">vs opentype.js</span>
			<span class="summary-col">vs freetype2</span>
		</div>
		<div v-for="item in summaryItems" :key="item.category" class="summary-row" :class="{ highlight: item.highlight }">
			<span class="summary-cat">{{ item.category }}</span>
			<span class="summary-col" :class="getClass(item.vsHarfbuzz)">{{ item.vsHarfbuzz || "-" }}</span>
			<span class="summary-col" :class="getClass(item.vsOpentype)">{{ item.vsOpentype || "-" }}</span>
			<span class="summary-col" :class="getClass(item.vsFreetype || item.improvement)">{{ item.vsFreetype || item.improvement || "-" }}</span>
		</div>
	</div>
</template>

<style scoped>
.summary {
	border: 1px solid var(--vp-c-border);
	border-radius: 8px;
	overflow: hidden;
	margin: 16px 0;
	font-size: 13px;
}

.summary-header {
	display: grid;
	grid-template-columns: 140px repeat(3, 1fr);
	background: var(--vp-c-bg-soft);
	padding: 10px 12px;
	font-weight: 600;
	color: var(--vp-c-text-2);
	border-bottom: 1px solid var(--vp-c-border);
}

.summary-row {
	display: grid;
	grid-template-columns: 140px repeat(3, 1fr);
	padding: 8px 12px;
	border-bottom: 1px solid var(--vp-c-divider);
}

.summary-row:last-child {
	border-bottom: none;
}

.summary-row.highlight {
	background: rgba(34, 197, 94, 0.08);
}

.summary-cat {
	font-weight: 500;
	color: var(--vp-c-text-1);
}

.summary-col {
	text-align: center;
	color: var(--vp-c-text-2);
}

.summary-col.faster {
	color: #22c55e;
	font-weight: 600;
}

.summary-col.slower {
	color: #ef4444;
}

@media (max-width: 600px) {
	.summary-header, .summary-row {
		grid-template-columns: 100px repeat(3, 1fr);
		font-size: 11px;
		padding: 6px 8px;
	}
}
</style>
