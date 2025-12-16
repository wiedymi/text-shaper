<script setup lang="ts">
import benchmarkData from "../data/benchmarks.json"
import BenchmarkChart from "./BenchmarkChart.vue"

interface Props {
	dataKey: string
	title?: string
}

const props = defineProps<Props>()

function getData() {
	const keys = props.dataKey.split(".")
	let data: any = benchmarkData.benchmarks
	for (const key of keys) {
		if (data && typeof data === "object" && key in data) {
			data = data[key]
		} else {
			return null
		}
	}
	return data
}

function getResults() {
	const data = getData()
	if (!data || typeof data !== "object") return []

	return Object.entries(data).map(([name, opsPerSec]) => ({
		name: formatName(name),
		opsPerSec: opsPerSec as number,
	}))
}

function formatName(key: string): string {
	const nameMap: Record<string, string> = {
		textShaper: "text-shaper",
		opentypeJs: "opentype.js",
		harfbuzzjs: "harfbuzzjs",
		freetype2: "freetype2",
		firstCall: "(first call)",
		textShaperRepeat: "text-shaper",
	}
	return nameMap[key] || key
}

const results = getResults()
</script>

<template>
	<BenchmarkChart v-if="results.length > 0" :title="title" :results="results" />
	<div v-else class="bench-missing">Missing data for: {{ dataKey }}</div>
</template>

<style scoped>
.bench-missing {
	padding: 8px 12px;
	background: var(--vp-c-danger-soft);
	border-radius: 4px;
	font-size: 12px;
	color: var(--vp-c-danger-1);
}
</style>
