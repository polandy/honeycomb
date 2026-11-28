<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
const props = defineProps<{
	/** The assets of one kind of change, shown as a row of thumbnails (IMMICH-004.28). */
	assetIds: readonly string[]
	thumbnailUrl: (assetId: string) => string
}>()
</script>

<template>
	<ul v-if="props.assetIds.length > 0" class="immich-write-strip">
		<li v-for="assetId in props.assetIds" :key="assetId">
			<img alt="" loading="lazy" :src="props.thumbnailUrl(assetId)">
		</li>
	</ul>
</template>

<style scoped>
.immich-write-strip {
	display: flex;
	gap: var(--default-grid-baseline);
	overflow-x: auto;
}

.immich-write-strip img {
	display: block;
	width: 44px;
	height: 44px;
	border-radius: var(--border-radius);
	object-fit: cover;
	background: var(--color-background-dark);
}
</style>
