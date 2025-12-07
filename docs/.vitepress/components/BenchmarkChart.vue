<script setup lang="ts">
import { computed } from "vue"

interface BenchmarkResult {
	name: string
	opsPerSec: number
}

interface Props {
	title?: string
	results: BenchmarkResult[]
}

const props = defineProps<Props>()

const sortedResults = computed(() => {
	return [...props.results].sort((a, b) => b.opsPerSec - a.opsPerSec)
})

const maxOps = computed(() => Math.max(...props.results.map((r) => r.opsPerSec)))

function getBarWidth(opsPerSec: number): number {
	return (opsPerSec / maxOps.value) * 100
}

function getBarClass(name: string): string {
	return name === "text-shaper" ? "bar ours" : "bar other"
}

function formatOps(ops: number): string {
	if (ops >= 1_000_000) return `${(ops / 1_000_000).toFixed(1)}M`
	if (ops >= 1_000) return `${(ops / 1_000).toFixed(1)}k`
	return ops.toFixed(0)
}

function isSmallBar(opsPerSec: number): boolean {
	return getBarWidth(opsPerSec) < 15
}
</script>

<template>
	<div class="bench">
		<div class="bench-header" v-if="title">{{ title }}</div>
		<div class="bench-rows">
			<div v-for="result in sortedResults" :key="result.name" class="bench-row">
				<span class="bench-name" :class="{ ours: result.name === 'text-shaper' }">{{ result.name }}</span>
				<div class="bench-bar-wrap">
					<div :class="getBarClass(result.name)" :style="{ width: `${getBarWidth(result.opsPerSec)}%` }"></div>
					<span class="bench-ops" :class="isSmallBar(result.opsPerSec) ? 'outside' : 'inside'" :style="{ left: `${Math.max(getBarWidth(result.opsPerSec), 1)}%` }">{{ formatOps(result.opsPerSec) }}</span>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.bench {
	margin: 8px 0;
}

.bench-header {
	font-size: 13px;
	font-weight: 500;
	color: var(--vp-c-text-2);
	margin-bottom: 6px;
}

.bench-rows {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.bench-row {
	display: grid;
	grid-template-columns: 90px 1fr;
	align-items: center;
	gap: 8px;
	height: 24px;
}

.bench-name {
	font-size: 12px;
	font-weight: 500;
	color: var(--vp-c-text-2);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.bench-name.ours {
	color: #8b5cf6;
	font-weight: 600;
}

.bench-bar-wrap {
	height: 20px;
	background: var(--vp-c-bg-soft);
	border-radius: 3px;
	position: relative;
}

.bar {
	height: 100%;
	border-radius: 3px;
	display: flex;
	align-items: center;
	padding-left: 8px;
	min-width: 8px;
}

.bar.ours {
	background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%);
}

.bar.other {
	background: linear-gradient(90deg, #64748b 0%, #94a3b8 100%);
}

.bench-ops {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
	font-size: 11px;
	font-weight: 600;
	white-space: nowrap;
}

.bench-ops.inside {
	transform: translate(-100%, -50%);
	padding-right: 8px;
	color: white;
	text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
}

.bench-ops.outside {
	padding-left: 8px;
	color: var(--vp-c-text-2);
}

@media (max-width: 500px) {
	.bench-row {
		grid-template-columns: 70px 1fr;
	}
	.bench-name {
		font-size: 10px;
	}
}
</style>
