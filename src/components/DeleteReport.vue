<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { SkippedPicture } from '../logic/fresh-check.ts'
import type { SendProgress } from '../logic/request-chunks.ts'
import type { TrashReport } from '../logic/trash-report.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import DeleteStats from './DeleteStats.vue'
import TrashFileList from './TrashFileList.vue'
import { formatNumber } from '../l10n.ts'
import { filesOf } from '../logic/delete-summary.ts'
import { failureReason, runningText, skipReason } from '../trash-text.ts'

const props = defineProps<{
	report: TrashReport
	/** The photos a delete by decision skipped, and why. */
	skipped: readonly SkippedPicture[]
	folderSet: FolderSet
	/** Whether a retry runs. */
	busy: boolean
	/** How many photos the running delete has sent. */
	progress?: SendProgress | null | undefined
}>()

const emit = defineEmits<{
	close: []
	retry: []
}>()

const rows = computed(() => props.report.failed.map(({ file, result }) => ({ file, reason: failureReason(result) })))
const skippedRows = computed(() => props.skipped.flatMap(({ picture, reason }) => filesOf(picture).slice(0, 1).map((file) => ({ file, reason: skipReason(reason) }))))
const failed = computed(() => props.report.failed.length > 0)
const stats = computed(() => [
	{ value: formatNumber(props.report.trashed.length), label: n('honeycomb', 'file moved to trash', 'files moved to trash', props.report.trashed.length) },
	...(props.report.deleted.length > 0 ? [{ value: formatNumber(props.report.deleted.length), label: n('honeycomb', 'file deleted permanently', 'files deleted permanently', props.report.deleted.length) }] : []),
	{ value: formatNumber(props.report.failed.length), label: t('honeycomb', 'failed') },
	...(props.skipped.length > 0 ? [{ value: formatNumber(props.skipped.length), label: n('honeycomb', 'photo skipped', 'photos skipped', props.skipped.length) }] : []),
])
</script>

<template>
	<ConfirmDialog
		:title="failed ? t('honeycomb', 'Deletion finished with errors') : t('honeycomb', 'Some photos were skipped')"
		:confirmLabel="props.busy ? runningText(props.progress) : t('honeycomb', 'Retry failed files')"
		:progress="props.progress"
		:confirmDisabled="props.busy || !failed"
		:cancelLabel="t('honeycomb', 'Close')"
		cancel
		wide
		@cancel="emit('close')"
		@confirm="emit('retry')">
		<DeleteStats :stats="stats" />
		<TrashFileList
			v-if="failed"
			:rows="rows"
			:folderSet="props.folderSet"
			:label="t('honeycomb', 'Files that failed')" />
		<p v-if="failed">
			{{ t('honeycomb', 'The failed files stay in the grid (the item now shows as a single). Everything else is in the Nextcloud trash bin and can be restored from there.') }}
		</p>
		<TrashFileList
			v-if="props.skipped.length > 0"
			:rows="skippedRows"
			:folderSet="props.folderSet"
			:label="t('honeycomb', 'Photos skipped')" />
		<p v-if="props.skipped.length > 0">
			{{ t('honeycomb', 'A skipped photo stays in the grid because a sidecar changed or does not say what this delete needs. Reload the folder to see its current state.') }}
		</p>
	</ConfirmDialog>
</template>
