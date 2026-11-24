<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderPreview } from '../logic/folder-row.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'

import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import { smallSource } from '../logic/image-tiers.ts'

const props = defineProps<{
	previews: readonly FolderPreview[]
	done: boolean
	imageUrl: ImageUrlFor
}>()

/** The previews whose image failed to load; they leave the cover. */
const failed = ref<ReadonlySet<number>>(new Set())
const shown = computed(() => props.previews.filter((preview) => !failed.value.has(preview.fileId)))

/**
 *
 */
/** Drops the preview whose image failed to load. */
function fail(fileId: number) {
	failed.value = new Set([...failed.value, fileId])
}
</script>

<template>
	<span class="folder-cover" :class="shown.length > 0 ? `folder-cover--${shown.length}` : 'folder-cover--none'" aria-hidden="true">
		<template v-if="shown.length > 0">
			<img
				v-for="preview in shown"
				:key="preview.fileId"
				:src="smallSource(preview, props.imageUrl)"
				alt=""
				loading="lazy"
				draggable="false"
				@error="fail(preview.fileId)">
			<span v-if="props.done" class="folder-cover__done"><AppIcon name="check" /></span>
		</template>
		<span v-else class="folder-cover__icon">
			<AppIcon :name="props.done ? 'check' : 'folder'" />
		</span>
	</span>
</template>

<style scoped>
.folder-cover {
	position: relative;
	display: grid;
	overflow: hidden;
	width: var(--folder-cover-size);
	height: var(--folder-cover-size);
	gap: 2px;
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
}

.folder-cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.folder-cover--2 {
	grid-template-columns: 1fr 1fr;
}

.folder-cover--3 {
	grid-template-columns: 2fr 1fr;
	grid-template-rows: 1fr 1fr;
}

.folder-cover--3 img:first-of-type {
	grid-row: 1 / 3;
}

.folder-cover__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--color-text-maxcontrast);
}

.folder-cover__done {
	position: absolute;
	right: 2px;
	bottom: 2px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--color-success);
	color: var(--color-main-background);
}
</style>
