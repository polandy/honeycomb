<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { BracketAttributes } from '../grid-series.ts'

defineProps<{
	/** The brackets of one grid row (SERIES-002.12). */
	brackets: readonly BracketAttributes[]
}>()
</script>

<template>
	<div
		v-for="bracket in brackets"
		:key="bracket.key"
		:class="bracket.class"
		:style="bracket.style"
		aria-hidden="true" />
</template>

<style scoped>
/* A series run's bracket in the gap above its tiles, like the filmstrip frame; it takes no room. */
.photo-grid__bracket {
	position: absolute;
	top: -7px;
	height: 6px;
	box-sizing: border-box;
	border-top: 2px solid var(--color-primary-element);
	pointer-events: none;
}

.photo-grid__bracket--start {
	border-inline-start: 2px solid var(--color-primary-element);
	border-start-start-radius: 6px;
}

.photo-grid__bracket--end {
	border-inline-end: 2px solid var(--color-primary-element);
	border-start-end-radius: 6px;
}

.photo-grid__bracket--settled {
	opacity: 0.4;
}

.photo-grid__bracket--open {
	border-style: dashed;
}
</style>
