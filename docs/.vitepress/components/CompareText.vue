<script setup lang="ts">
import { computed } from "vue"
import benchmarkData from "../data/benchmarks.json"

interface Props {
	keys: string[] // e.g., ["path.extraction", "path.svgGeneration"]
	vs: "harfbuzzjs" | "opentypeJs" | "freetype2" | "intlSegmenter" | "graphemer"
}

const props = defineProps<Props>()

const data = benchmarkData.benchmarks as any

function getValue(basePath: string, lib: string): number {
	const keys = basePath.split(".")
	let d: any = data
	for (const key of keys) {
		if (d && typeof d === "object" && key in d) {
			d = d[key]
		} else {
			return 0
		}
	}
	if (d && typeof d === "object" && lib in d) {
		return d[lib] as number
	}
	return 0
}

const result = computed(() => {
	const ratios = props.keys.map(key => {
		const ours = getValue(key, "textShaper")
		const theirs = getValue(key, props.vs)
		if (theirs === 0 || ours === 0) return 0
		return ours / theirs
	}).filter(r => r > 0)

	if (ratios.length === 0) return "N/A"

	const min = Math.min(...ratios)
	const max = Math.max(...ratios)

	const formatNum = (n: number) => {
		if (n >= 10) return Math.round(n).toString()
		return n.toFixed(1).replace(/\.0$/, "")
	}

	const labels: Record<string, string> = {
		harfbuzzjs: "HarfBuzz",
		opentypeJs: "opentype.js",
		freetype2: "FreeType2",
		intlSegmenter: "Intl.Segmenter",
		graphemer: "graphemer",
	}
	const label = labels[props.vs]

	if (Math.abs(max - min) < 0.2) {
		const avg = (min + max) / 2
		if (avg >= 0.95 && avg <= 1.05) return `1.0x vs ${label}`
		if (avg >= 1.05) return `${formatNum(avg)}x faster than ${label}`
		return `${formatNum(1 / avg)}x slower than ${label}`
	}

	if (min >= 0.95) {
		return `${formatNum(min)}-${formatNum(max)}x faster than ${label}`
	}
	if (max <= 1.05) {
		return `${formatNum(1 / max)}-${formatNum(1 / min)}x slower than ${label}`
	}
	return `${formatNum(min)}-${formatNum(max)}x vs ${label}`
})
</script>

<template><span>{{ result }}</span></template>
