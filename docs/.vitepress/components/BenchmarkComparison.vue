<script setup lang="ts">
import benchmarkData from "../data/benchmarks.json"

interface Props {
	ours: string // e.g., "path.extraction.textShaper"
	theirs: string // e.g., "path.extraction.harfbuzzjs"
	label?: string // e.g., "HarfBuzz"
}

const props = defineProps<Props>()

function getValue(path: string): number {
	const keys = path.split(".")
	let data: any = benchmarkData.benchmarks
	for (const key of keys) {
		if (data && typeof data === "object" && key in data) {
			data = data[key]
		} else {
			return 0
		}
	}
	return typeof data === "number" ? data : 0
}

function formatRatio(ours: number, theirs: number): string {
	if (theirs === 0 || ours === 0) return "N/A"
	const ratio = ours / theirs
	if (ratio >= 1) {
		return `${ratio.toFixed(1)}x faster`
	} else {
		return `${(1 / ratio).toFixed(1)}x slower`
	}
}

const oursValue = getValue(props.ours)
const theirsValue = getValue(props.theirs)
const comparison = formatRatio(oursValue, theirsValue)
</script>

<template>
	<span class="comparison">{{ comparison }}</span>
	<span v-if="label" class="label"> than {{ label }}</span>
</template>

<style scoped>
.comparison {
	font-weight: 600;
	color: var(--vp-c-brand-1);
}
.label {
	color: var(--vp-c-text-1);
}
</style>
