<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import SharpestMark from './SharpestMark.vue'

const props = defineProps<{
	name: string
	/** The series' and the photo's place, as the viewer words it. */
	place: string
	/** Whether the shown photo is its series' sharpest (SERIES-007.3). */
	sharpest: boolean
}>()
</script>

<template>
	<div class="series-viewer__title">
		<h2 class="series-viewer__name">
			{{ props.name }}
		</h2>
		<span class="series-viewer__place">{{ props.place }}<SharpestMark v-if="props.sharpest" /></span>
	</div>
</template>

<style scoped>
.series-viewer__title {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
}

.series-viewer__name {
	margin: 0;
	overflow: hidden;
	font-size: inherit;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.series-viewer__place {
	display: flex;
	align-items: center;
	gap: var(--default-grid-baseline);
	color: var(--color-text-maxcontrast);
}
</style>
