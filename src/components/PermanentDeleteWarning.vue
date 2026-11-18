<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { SendProgress } from '../logic/request-chunks.ts'
import type { UnkeptFile } from '../logic/trash-report.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import TrashFileList from './TrashFileList.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { unkeptReason } from '../trash-text.ts'

const props = defineProps<{
	/** The files the trash bin would not keep, and why. */
	files: readonly UnkeptFile[]
	folderSet: FolderSet
	/** Whether the delete for good runs. */
	busy: boolean
	/** How many photos the running delete has sent. */
	progress?: SendProgress | null | undefined
	/** Where the dialog opens, e.g. inside the loupe; the page body by default. */
	container?: string | undefined
}>()

const emit = defineEmits<{
	cancel: []
	confirm: []
}>()

const rows = computed(() => props.files.map(({ file, result }) => ({ file, reason: unkeptReason(result) })))
const title = computed(() => n('honeycomb', '{count} file will be deleted permanently', '{count} files will be deleted permanently', props.files.length, { count: formatNumber(props.files.length) }, PLAIN_TEXT))
</script>

<template>
	<ConfirmDialog
		:title="title"
		:confirmLabel="props.busy ? t('honeycomb', 'Deleting permanently…') : t('honeycomb', 'Delete permanently')"
		:confirmDisabled="props.busy"
		:progress="props.progress"
		:container="props.container"
		cancel
		danger
		focusCancel
		wide
		@cancel="emit('cancel')"
		@confirm="emit('confirm')">
		<p>{{ t('honeycomb', 'The Nextcloud trash bin cannot keep these files. Deleted, they cannot be restored.') }}</p>
		<TrashFileList
			:rows="rows"
			:folderSet="props.folderSet"
			:label="t('honeycomb', 'Files to delete permanently')" />
	</ConfirmDialog>
</template>
