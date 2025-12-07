<script setup lang="ts">
interface SummaryItem {
	category: string
	vsHarfbuzz?: string
	vsOpentype?: string
	vsFreetype?: string
	highlight?: boolean
}

defineProps<{
	items: SummaryItem[]
}>()

function getClass(value: string | undefined): string {
	if (!value || value === "-") return ""
	if (value.includes("faster")) return "faster"
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
		<div v-for="item in items" :key="item.category" class="summary-row" :class="{ highlight: item.highlight }">
			<span class="summary-cat">{{ item.category }}</span>
			<span class="summary-col" :class="getClass(item.vsHarfbuzz)">{{ item.vsHarfbuzz || "-" }}</span>
			<span class="summary-col" :class="getClass(item.vsOpentype)">{{ item.vsOpentype || "-" }}</span>
			<span class="summary-col" :class="getClass(item.vsFreetype)">{{ item.vsFreetype || "-" }}</span>
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
