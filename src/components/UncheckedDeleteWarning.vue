<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SendProgress } from '../logic/request-chunks.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { uncheckedText } from '../trash-text.ts'

const props = defineProps<{
	/** How many photos the fresh check could not read. */
	count: number
	/** Whether the delete runs. */
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

const title = computed(() => uncheckedText(props.count))
</script>

<template>
	<ConfirmDialog
		:title="title"
		:confirmLabel="props.busy ? t('honeycomb', 'Moving to trash…') : t('honeycomb', 'Delete anyway')"
		:confirmDisabled="props.busy"
		:progress="props.progress"
		:container="props.container"
		cancel
		danger
		focusCancel
		@cancel="emit('cancel')"
		@confirm="emit('confirm')">
		<p>{{ t('honeycomb', 'honeycomb could not read these photos and their sidecars again just now. Deleted anyway, they go as honeycomb knows them; a file changed since the folder was listed stays.') }}</p>
	</ConfirmDialog>
</template>
