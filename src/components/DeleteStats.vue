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

const props = defineProps<{ stats: readonly DeleteStat[] }>()
</script>

<template>
	<dl class="delete-stats">
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

.delete-stats__value {
	font-size: 1.6em;
	font-weight: bold;
}

.delete-stats__label {
	margin: 0;
	color: var(--color-text-maxcontrast);
}
</style>
