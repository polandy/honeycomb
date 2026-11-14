<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script lang="ts">
/** The mockup's stroke icons (docs/mockup/index.html, IC), drawn in the current text colour. */
const PATHS = {
	back: 'M19 12H5M11 6l-6 6 6 6',
	check: 'M5 12l5 5 9-10',
	chevronLeft: 'M15 6l-6 6 6 6',
	chevronRight: 'M9 6l6 6-6 6',
	close: 'M6 6l12 12M18 6 6 18',
	compare: 'M3 5h8v14H3zM13 5h8v14h-8z',
	expand: 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7',
	film: 'M3 6h18v12H3zM8 6v12M16 6v12',
	filter: 'M3 5h18l-7 8v6l-4-2v-4z',
	flag: 'M5 3v18M5 4h11l-2 4 2 4H5',
	flagPick: 'M5 3v18M5 4h11l-2 4 2 4H5z',
	flagX: 'M5 3v18M5 4h11l-2 4 2 4H5M8 6l3 4M11 6l-3 4',
	flagOutline: 'M5 3v18M5 4h11l-2 4 2 4H5z',
	flagCross: 'M5 3v18M5 4h11l-2 4 2 4H5M8 6l3 4M11 6l-3 4M3 20 21 4',
	fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
	folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
	home: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
	info: 'M12 11v6M12 7.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
	menu: 'M4 6h16M4 12h16M4 18h16',
	more: 'M5 12h.01M12 12h.01M19 12h.01',
	pin: 'M9 4h6M10 4v6l-3 4h10l-3-4V4M12 14v7',
	move: 'M3 12h14M13 7l5 5-5 5M21 5v14',
	select: 'M4 4h16v16H4zM8 12l3 3 5-6',
	tag: 'M3 12V4h8l10 10-8 8zM7.5 8h.01',
	settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
	zoom: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 20 20M8 10.5h5M10.5 8v5',
	trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const

/** The icons drawn filled. */
const FILLED: ReadonlySet<IconName> = new Set(['flagPick'])

/** The name of one of the app's icons. */
export type IconName = keyof typeof PATHS
</script>

<script setup lang="ts">
const props = defineProps<{ name: IconName }>()
</script>

<template>
	<svg
		class="app-icon"
		:class="{ 'app-icon--filled': FILLED.has(props.name) }"
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

.app-icon--filled {
	fill: currentColor;
}
</style>
