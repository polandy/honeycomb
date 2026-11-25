<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderNode } from '../logic/folder-hierarchy.ts'

import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { batchMarks, scopeSums, subtreeState } from '../logic/folder-hierarchy.ts'

/** The ⋯ menu of a row with subfolders: *Cull*, *Mark all done*, *Reopen all* (FOLDERS-008.13). */
const props = defineProps<{ node: FolderNode, label: string, includeSubfolders: boolean }>()

const emit = defineEmits<{
	cull: []
	markAllDone: []
	reopenAll: []
	close: []
}>()

const cullable = computed(() => subtreeState(scopeSums(props.node, props.includeSubfolders)) === 'open')
const reopenable = computed(() => batchMarks(props.node).reopen.length > 0)
/** The folder in the Files app. */
const filesHref = computed(() => `${generateUrl('/apps/files/')}?dir=${encodeURIComponent(props.node.path)}`)
</script>

<template>
	<ConfirmDialog
		:title="props.label"
		:confirmLabel="t('honeycomb', 'Cull')"
		:confirmDisabled="!cullable"
		cancel
		@confirm="emit('cull')"
		@cancel="emit('close')">
		<div class="folder-subtree-menu">
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				@click="emit('markAllDone')">
				<template #icon>
					<AppIcon name="check" />
				</template>
				{{ t('honeycomb', 'Mark all done') }}
			</NcButton>
			<NcButton
				variant="tertiary"
				alignment="start"
				wide
				:disabled="!reopenable"
				@click="emit('reopenAll')">
				<template #icon>
					<AppIcon name="undo" />
				</template>
				{{ t('honeycomb', 'Reopen all') }}
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
.folder-subtree-menu {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}
</style>
