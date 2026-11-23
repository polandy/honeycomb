<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderRow } from '../logic/folder-row.ts'

import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { folderName, isRateable } from '../logic/folder-row.ts'

const props = defineProps<{ row: FolderRow }>()

const emit = defineEmits<{
	/** Cull the folder, with its subfolders or without. */
	cull: [subfolders: boolean]
	/** Mark the open folder done, or reopen the done one, without a dialog (FOLDERS-008.2, .4). */
	markDone: []
	reopen: []
	close: []
}>()

const name = computed(() => folderName(props.row))
const readOnly = computed(() => !isRateable(props.row))
/** The folder in the Files app. */
const filesHref = computed(() => `${generateUrl('/apps/files/')}?dir=${encodeURIComponent(props.row.path)}`)
</script>

<template>
	<ConfirmDialog
		:title="name"
		:confirmLabel="t('honeycomb', 'Cull')"
		:confirmDisabled="readOnly"
		cancel
		@confirm="emit('cull', false)"
		@cancel="emit('close')">
		<div class="folder-menu">
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="readOnly"
				@click="emit('cull', true)">
				<template #icon>
					<AppIcon name="subfolders" />
				</template>
				{{ t('honeycomb', 'Cull with subfolders') }}
			</NcButton>
			<NcButton
				v-if="!readOnly"
				variant="tertiary"
				alignment="start"
				wide
				@click="props.row.done === null ? emit('markDone') : emit('reopen')">
				<template #icon>
					<AppIcon :name="props.row.done === null ? 'check' : 'undo'" />
				</template>
				{{ props.row.done === null ? t('honeycomb', 'Mark done') : t('honeycomb', 'Reopen') }}
			</NcButton>
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:href="filesHref">
				<template #icon>
					<AppIcon name="open" />
				</template>
				{{ t('honeycomb', 'Open in Files') }}
			</NcButton>
		</div>
	</ConfirmDialog>
</template>

<style scoped>
.folder-menu {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}
</style>
