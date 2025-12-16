<script setup lang="ts">
import { computed } from "vue"
import benchmarkData from "../data/benchmarks.json"

interface Props {
	keys: string[] // Array of benchmark keys to compare, e.g., ["path.extraction", "path.svgGeneration"]
	vs: "harfbuzzjs" | "opentypeJs" | "freetype2"
	label?: string
}

const props = defineProps<Props>()

function getValue(basePath: string, lib: string): number {
	const keys = basePath.split(".")
	let data: any = benchmarkData.benchmarks
	for (const key of keys) {
		if (data && typeof data === "object" && key in data) {
			data = data[key]
		} else {
			return 0
		}
	}
	if (data && typeof data === "object" && lib in data) {
		return data[lib] as number
	}
	return 0
}

const ratios = computed(() => {
	return props.keys.map(key => {
		const ours = getValue(key, "textShaper")
		const theirs = getValue(key, props.vs)
		if (theirs === 0 || ours === 0) return 0
		return ours / theirs
	}).filter(r => r > 0)
})

const formattedRatio = computed(() => {
	if (ratios.value.length === 0) return "N/A"

	const min = Math.min(...ratios.value)
	const max = Math.max(...ratios.value)

	const formatNum = (n: number) => {
		if (n >= 10) return Math.round(n).toString()
		return n.toFixed(1).replace(/\.0$/, "")
	}

	if (Math.abs(max - min) < 0.2) {
		// Single value
		const avg = (min + max) / 2
		if (avg >= 0.95 && avg <= 1.05) return "1.0x"
		return `${formatNum(avg)}x`
	} else {
		// Range
		return `${formatNum(min)}-${formatNum(max)}x`
	}
})

const comparison = computed(() => {
	const minRatio = Math.min(...ratios.value)
	if (minRatio >= 0.95) {
		return ratios.value.some(r => r > 1.05) ? "faster" : ""
	}
	return "slower"
})

const labelText = computed(() => {
	const labels: Record<string, string> = {
		harfbuzzjs: "HarfBuzz",
		opentypeJs: "opentype.js",
		freetype2: "FreeType2",
	}
	return props.label || labels[props.vs] || props.vs
})
</script>

<template>
	<span class="ratio">{{ formattedRatio }}</span>
	<span v-if="comparison" class="comparison"> {{ comparison }}</span>
	<span class="label"> than {{ labelText }}</span>
</template>

<style scoped>
.ratio {
	font-weight: 600;
	color: var(--vp-c-brand-1);
}
.comparison, .label {
	color: inherit;
}
</style>
