<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'

const props = defineProps<{
	/** The tile's edge in CSS pixels. */
	tileSize: number
}>()

/** Enough tiles to fill a large screen at the smallest tile size; the rest is clipped. */
const TILES = 60
</script>

<template>
	<div class="grid-skeleton" aria-busy="true" :style="{ '--grid-skeleton-size': `${props.tileSize}px` }">
		<p class="hidden-visually" role="status">
			{{ t('honeycomb', 'Loading photos…') }}
		</p>
		<div
			v-for="tile in TILES"
			:key="tile"
			class="grid-skeleton__tile skeleton-tile"
			aria-hidden="true" />
	</div>
</template>

<style src="../skeleton-tile.css" />

<style scoped>
.grid-skeleton {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(var(--grid-skeleton-size), 1fr));
	grid-auto-rows: var(--grid-skeleton-size);
	gap: calc(2 * var(--default-grid-baseline));
	overflow: hidden;
	height: 100%;
	padding: 0 var(--default-grid-baseline);
}

.grid-skeleton__tile {
	border-radius: var(--border-radius-large);
}
</style>
