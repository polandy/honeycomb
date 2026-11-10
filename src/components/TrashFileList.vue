<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { PictureFile } from '../logic/delete-summary.ts'
import type { FolderSet } from '../logic/folder-set.ts'

import { formatFileSize } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { badgeExtension } from '../logic/pair-badge.ts'

/** A file of a delete, with why it stayed when it failed. */
export interface TrashFileRow {
	readonly file: PictureFile
	readonly reason?: string
}

const props = defineProps<{
	rows: readonly TrashFileRow[]
	folderSet: FolderSet
	/** The list's accessible name. */
	label: string
}>()

/** The file's path as the grid names its folder. */
function pathOf({ entry, picture }: PictureFile): string {
	return `${folderLabel(picture.folder, props.folderSet)}/${entry.path.slice(entry.path.lastIndexOf('/') + 1)}`
}
</script>

<template>
	<ul class="trash-files" :aria-label="props.label">
		<li v-for="row in props.rows" :key="row.file.entry.fileId" class="trash-files__row">
			<span class="trash-files__kind">{{ badgeExtension(row.file.entry) }}</span>
			<span class="trash-files__path">{{ pathOf(row.file) }}</span>
			<span v-if="row.reason" class="trash-files__reason">{{ row.reason }}</span>
			<span class="trash-files__size">{{ formatFileSize(row.file.entry.size) }}</span>
		</li>
	</ul>
</template>

<style scoped>
.trash-files {
	max-height: 40vh;
	overflow-y: auto;
	margin: 0;
	padding: 0;
	list-style: none;
}

.trash-files__row {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--default-grid-baseline) * 2);
	padding: calc(var(--default-grid-baseline) * 2) 0;
	border-bottom: 1px solid var(--color-border);
}

.trash-files__kind {
	min-width: 3em;
	font-weight: bold;
}

.trash-files__path {
	flex: 1;
	overflow-wrap: anywhere;
}

.trash-files__reason {
	flex-basis: 100%;
	order: 1;
	color: var(--color-error-text);
}

.trash-files__size {
	color: var(--color-text-maxcontrast);
}
</style>
