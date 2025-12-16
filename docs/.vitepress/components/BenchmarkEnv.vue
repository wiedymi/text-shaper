<script setup lang="ts">
import benchmarkData from "../data/benchmarks.json"

const env = benchmarkData.meta.environment
</script>

<template>
	<div class="env-info">
		<span>{{ env.platform }}</span>
		<span>{{ env.memory }}</span>
		<span>{{ env.runtime }}</span>
		<span>text-shaper 0.1.4</span>
	</div>
</template>

<style scoped>
.env-info {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 16px 0;
	font-size: 12px;
}

.env-info span {
	padding: 4px 10px;
	background: var(--vp-c-bg-soft);
	border: 1px solid var(--vp-c-border);
	border-radius: 4px;
	color: var(--vp-c-text-2);
	font-family: var(--vp-font-family-mono);
}
</style>
