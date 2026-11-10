<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script lang="ts">
/** The mockup's stroke icons (docs/mockup/index.html, IC), drawn in the current text colour. */
const PATHS = {
	check: 'M5 12l5 5 9-10',
	chevronLeft: 'M15 6l-6 6 6 6',
	chevronRight: 'M9 6l6 6-6 6',
	close: 'M6 6l12 12M18 6 6 18',
	film: 'M3 6h18v12H3zM8 6v12M16 6v12',
	filter: 'M3 5h18l-7 8v6l-4-2v-4z',
	flag: 'M5 3v18M5 4h11l-2 4 2 4H5',
	flagPick: 'M5 3v18M5 4h11l-2 4 2 4H5z',
	flagX: 'M5 3v18M5 4h11l-2 4 2 4H5M8 6l3 4M11 6l-3 4',
	flagCross: 'M5 3v18M5 4h11l-2 4 2 4H5M8 6l3 4M11 6l-3 4M3 20 21 4',
	folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
	home: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
	menu: 'M4 6h16M4 12h16M4 18h16',
	more: 'M5 12h.01M12 12h.01M19 12h.01',
	select: 'M4 4h16v16H4zM8 12l3 3 5-6',
	trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const

/** The name of one of the app's icons. */
export type IconName = keyof typeof PATHS
</script>

<script setup lang="ts">
const props = defineProps<{ name: IconName }>()
</script>

<template>
	<svg
		class="app-icon"
		viewBox="0 0 24 24"
		aria-hidden="true"
		focusable="false">
		<path :d="PATHS[props.name]" />
	</svg>
</template>

<style scoped>
.app-icon {
	width: 20px;
	height: 20px;
	flex-shrink: 0;
	fill: none;
	stroke: currentColor;
	stroke-width: 2;
	stroke-linecap: round;
	stroke-linejoin: round;
}
</style>
