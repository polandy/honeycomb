<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
/** One figure of a delete, e.g. "3" and "photos". */
export interface DeleteStat {
	readonly value: string
	readonly label: string
	/** A further line under the label, e.g. "Longest 4". */
	readonly note?: string | undefined
}

const props = defineProps<{
	stats: readonly DeleteStat[]
	/** Two columns of framed tiles, as on *Cull finished*, instead of one row. */
	tiles?: boolean
	/** As many columns of tiles as fit, up to four, as on the statistics page. */
	fit?: boolean
}>()
</script>

<template>
	<dl class="delete-stats" :class="{ 'delete-stats--tiles': props.tiles, 'delete-stats--fit': props.fit }">
		<div v-for="stat in props.stats" :key="stat.label" class="delete-stats__item">
			<dt class="delete-stats__value">
				{{ stat.value }}
			</dt>
			<dd class="delete-stats__label">
				{{ stat.label }}
			</dd>
			<dd v-if="stat.note" class="delete-stats__note">
				{{ stat.note }}
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

.delete-stats--fit {
	grid-template-columns: repeat(auto-fit, minmax(max(160px, calc(25% - 2 * var(--default-grid-baseline))), 1fr));
}

.delete-stats--tiles .delete-stats__item {
	display: grid;
	align-content: start;
	padding: calc(var(--default-grid-baseline) * 2) calc(var(--default-grid-baseline) * 3);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
}

.delete-stats--tiles :is(.delete-stats__value, .delete-stats__label, .delete-stats__note) {
	display: block;
	margin: 0;
	text-align: start;
}

.delete-stats__value {
	font-size: 1.6em;
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}

.delete-stats__label {
	margin: 0;
	color: var(--color-text-maxcontrast);
}

.delete-stats__note {
	margin: 0;
	font-size: 0.9em;
	color: var(--color-text-maxcontrast);
}
</style>
