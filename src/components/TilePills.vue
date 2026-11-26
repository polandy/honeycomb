<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { TilePill } from './tile-badges.ts'

import AppIcon from './AppIcon.vue'

const props = defineProps<{
	pills: readonly TilePill[]
}>()
</script>

<template>
	<span class="photo-tile__pills" aria-hidden="true">
		<span v-for="pill in props.pills" :key="pill.icon" class="photo-tile__pill"><AppIcon :name="pill.icon" />{{ pill.text }}</span>
	</span>
</template>

<style scoped>
/* The mockup's pills on the photo, so dark like the tile's marks in either theme. */
.photo-tile__pills {
	position: absolute;
	top: 6px;
	inset-inline-start: 6px;
	display: flex;
	gap: 4px;
	pointer-events: none;
}

.photo-tile__pill {
	display: inline-flex;
	align-items: center;
	gap: 3px;
	padding: 2px 6px;
	border-radius: 6px;
	background-color: rgba(0, 0, 0, 0.6);
	color: #fff;
	font-size: 11px;
	font-weight: bold;
	line-height: 1.3;
}

.photo-tile__pill .app-icon {
	width: 12px;
	height: 12px;
	stroke-width: 2.4;
}
</style>
