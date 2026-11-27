<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'

/** The blocks of the page in the order it draws them: the hero, the chart, the tiles and the calendar. */
const BLOCKS = ['hero', 'chart', 'tile', 'tile', 'tile', 'tile', 'calendar', 'cleanup'] as const
</script>

<template>
	<div class="statistics-skeleton" aria-busy="true">
		<p class="hidden-visually" role="status">
			{{ t('honeycomb', 'Loading the statistics…') }}
		</p>
		<div class="statistics-skeleton__period skeleton-tile" aria-hidden="true" />
		<div
			v-for="(block, index) in BLOCKS"
			:key="index"
			class="statistics-skeleton__block skeleton-tile"
			:class="`statistics-skeleton__block--${block}`"
			aria-hidden="true" />
	</div>
</template>

<style src="../grid/skeleton-tile.css" />

<style scoped>
.statistics-skeleton {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: calc(4 * var(--default-grid-baseline));
}

.statistics-skeleton__period {
	grid-column: 1 / -1;
	height: var(--clickable-area-large, 44px);
	max-width: 380px;
	border-radius: var(--border-radius-element);
}

.statistics-skeleton__block {
	border-radius: var(--border-radius-large);
}

.statistics-skeleton__block--hero {
	grid-column: span 1;
	height: 220px;
}

.statistics-skeleton__block--chart {
	grid-column: span 3;
	height: 220px;
}

.statistics-skeleton__block--tile {
	height: 70px;
}

.statistics-skeleton__block--calendar,
.statistics-skeleton__block--cleanup {
	grid-column: span 2;
	height: 200px;
}

@container (max-width: 959px) {
	.statistics-skeleton__block--hero,
	.statistics-skeleton__block--chart,
	.statistics-skeleton__block--calendar,
	.statistics-skeleton__block--cleanup {
		grid-column: 1 / -1;
	}

	.statistics-skeleton__block--tile {
		grid-column: span 2;
	}
}
</style>
