<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
	/** The bar's accessible name. */
	label: string
	value: number
	max: number
}>()

const percent = computed(() => (props.max > 0 ? Math.round(100 * props.value / props.max) : 0))
</script>

<template>
	<div
		class="progress-bar"
		role="progressbar"
		:aria-label="props.label"
		aria-valuemin="0"
		:aria-valuemax="props.max"
		:aria-valuenow="props.value">
		<span class="progress-bar__done" :style="{ width: `${percent}%` }" />
	</div>
</template>

<style scoped>
.progress-bar {
	overflow: hidden;
	width: 80px;
	height: 4px;
	border-radius: 2px;
	background: var(--color-background-darker);
}

.progress-bar__done {
	display: block;
	height: 100%;
	background: var(--color-primary-element);
}
</style>
