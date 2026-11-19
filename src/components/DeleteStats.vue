<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
/** One figure of a delete, e.g. "3" and "photos". */
export interface DeleteStat {
	readonly value: string
	readonly label: string
}

const props = defineProps<{
	stats: readonly DeleteStat[]
	/** Two columns of framed tiles, as on *Cull finished*, instead of one row. */
	tiles?: boolean
}>()
</script>

<template>
	<dl class="delete-stats" :class="{ 'delete-stats--tiles': props.tiles }">
		<div v-for="stat in props.stats" :key="stat.label" class="delete-stats__item">
			<dt class="delete-stats__value">
				{{ stat.value }}
			</dt>
			<dd class="delete-stats__label">
				{{ stat.label }}
			</dd>
		</div>
	</dl>
</template>

<style scoped>
.delete-stats {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--default-grid-baseline) * 6);
	margin: 0 0 calc(var(--default-grid-baseline) * 3);
}

.delete-stats--tiles {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: calc(var(--default-grid-baseline) * 2);
}

.delete-stats--tiles .delete-stats__item {
	display: grid;
	align-content: start;
	padding: calc(var(--default-grid-baseline) * 2) calc(var(--default-grid-baseline) * 3);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
}

.delete-stats--tiles :is(.delete-stats__value, .delete-stats__label) {
	display: block;
	margin: 0;
	text-align: start;
}

.delete-stats__value {
	font-size: 1.6em;
	font-weight: bold;
}

.delete-stats__label {
	margin: 0;
	color: var(--color-text-maxcontrast);
}
</style>
