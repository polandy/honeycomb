<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { TrashReport } from '../logic/trash-report.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import DeleteStats from './DeleteStats.vue'
import TrashFileList from './TrashFileList.vue'
import { formatNumber } from '../l10n.ts'
import { failureReason } from '../trash-text.ts'

const props = defineProps<{
	report: TrashReport
	folderSet: FolderSet
	/** Whether a retry runs. */
	busy: boolean
}>()

const emit = defineEmits<{
	close: []
	retry: []
}>()

const rows = computed(() => props.report.failed.map(({ file, result }) => ({ file, reason: failureReason(result) })))
const stats = computed(() => [
	{ value: formatNumber(props.report.trashed.length), label: n('honeycomb', 'file moved to trash', 'files moved to trash', props.report.trashed.length) },
	{ value: formatNumber(props.report.failed.length), label: t('honeycomb', 'failed') },
])
</script>

<template>
	<ConfirmDialog
		:title="t('honeycomb', 'Deletion finished with errors')"
		:confirmLabel="t('honeycomb', 'Retry failed files')"
		:confirmDisabled="props.busy"
		:cancelLabel="t('honeycomb', 'Close')"
		cancel
		wide
		@cancel="emit('close')"
		@confirm="emit('retry')">
		<DeleteStats :stats="stats" />
		<TrashFileList :rows="rows" :folderSet="props.folderSet" :label="t('honeycomb', 'Files that failed')" />
		<p>{{ t('honeycomb', 'The failed files stay in the grid (the item now shows as a single). Everything else is in the Nextcloud trash bin and can be restored from there.') }}</p>
	</ConfirmDialog>
</template>
