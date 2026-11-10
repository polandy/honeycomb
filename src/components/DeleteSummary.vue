<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import DeleteStats from './DeleteStats.vue'
import TrashFileList from './TrashFileList.vue'
import { formatFileSize, formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { deleteSummary, filesOf } from '../logic/delete-summary.ts'

const props = defineProps<{
	/** The pictures to delete, each with all of its files. */
	pictures: readonly Picture<ListingEntry>[]
	folderSet: FolderSet
	/** Whether the summary was opened from the reject review, which *Back to review* returns to. */
	fromReview: boolean
	/** Whether a delete runs. */
	busy: boolean
}>()

const emit = defineEmits<{
	back: []
	cancel: []
	confirm: []
}>()

const summary = computed(() => deleteSummary(props.pictures))
const rows = computed(() => props.pictures.flatMap(filesOf).map((file) => ({ file })))
const stats = computed(() => [
	{ value: formatNumber(summary.value.pictures), label: n('honeycomb', 'photo', 'photos', summary.value.pictures) },
	{ value: formatNumber(summary.value.files), label: n('honeycomb', 'file', 'files', summary.value.files) },
	{ value: formatFileSize(summary.value.bytes), label: t('honeycomb', 'freed') },
])

/** "1 pair · 2 singles. …", and the folders when the delete spans several. */
const scope = computed(() => {
	const { pairs, singles, folders } = summary.value
	const counts = t('honeycomb', '{pairs} · {singles}. Every photo goes with all of its files, sidecars included.', {
		pairs: n('honeycomb', '{count} pair', '{count} pairs', pairs, { count: formatNumber(pairs) }, PLAIN_TEXT),
		singles: n('honeycomb', '{count} single', '{count} singles', singles, { count: formatNumber(singles) }, PLAIN_TEXT),
	}, undefined, PLAIN_TEXT)
	if (folders.length < 2) {
		return counts
	}
	const list = folders.map(({ folder, pictures }) => `${folderLabel(folder, props.folderSet)} (${formatNumber(pictures)})`).join(', ')
	return `${counts} ${t('honeycomb', 'From {folders}.', { folders: list }, undefined, PLAIN_TEXT)}`
})
</script>

<template>
	<ConfirmDialog
		:title="n('honeycomb', 'Delete {count} photo', 'Delete {count} photos', summary.pictures, { count: formatNumber(summary.pictures) }, PLAIN_TEXT)"
		:confirmLabel="n('honeycomb', 'Move {count} file to trash', 'Move {count} files to trash', summary.files, { count: formatNumber(summary.files) }, PLAIN_TEXT)"
		:confirmDisabled="props.busy"
		:back="props.fromReview"
		:backLabel="t('honeycomb', 'Back to review')"
		cancel
		wide
		danger
		@back="emit('back')"
		@cancel="emit('cancel')"
		@confirm="emit('confirm')">
		<DeleteStats :stats="stats" />
		<p>{{ scope }}</p>
		<TrashFileList :rows="rows" :folderSet="props.folderSet" :label="t('honeycomb', 'Files that will be deleted')" />
		<p class="delete-summary__note">
			{{ t('honeycomb', 'Files move to the Nextcloud trash bin and can be restored from there. Nothing is deleted for good; the space returns when the trash bin is emptied.') }}
		</p>
	</ConfirmDialog>
</template>

<style scoped>
.delete-summary__note {
	margin-top: calc(var(--default-grid-baseline) * 3);
	color: var(--color-text-maxcontrast);
}
</style>
