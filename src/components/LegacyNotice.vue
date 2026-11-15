<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Legacy } from '../legacy.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import ConfirmDialog from './ConfirmDialog.vue'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'

const props = defineProps<{
	legacy: Legacy
}>()

const folders = computed(() => props.legacy.inventory.value?.folders ?? [])
const unreachable = computed(() => props.legacy.inventory.value?.unreachable ?? 0)

const foldersText = computed(() => {
	const photos = folders.value.reduce((sum, folder) => sum + folder.files, 0)
	const listed = folders.value.map((folder) => `${folder.path} (${formatNumber(folder.files)})`).join(', ')
	return n('honeycomb', 'honeycomb still stores decisions and tags of {count} photo in its database. Open each folder and choose Write decisions to sidecars… in the ⋯ menu: {folders}', 'honeycomb still stores decisions and tags of {count} photos in its database. Open each folder and choose Write decisions to sidecars… in the ⋯ menu: {folders}', photos, { count: formatNumber(photos), folders: listed }, PLAIN_TEXT)
})

const unreachableText = computed(() => n('honeycomb', '{count} file with stored decisions is gone or no longer shared with you.', '{count} files with stored decisions are gone or no longer shared with you.', unreachable.value, { count: formatNumber(unreachable.value) }, PLAIN_TEXT))
</script>

<template>
	<NcNoteCard class="legacy-notice" type="info">
		<p v-if="folders.length > 0">
			{{ foldersText }}
		</p>
		<template v-if="unreachable > 0">
			<p>{{ unreachableText }}</p>
			<div class="legacy-notice__actions">
				<NcButton variant="secondary" @click="props.legacy.exportRows">
					{{ t('honeycomb', 'Export') }}
				</NcButton>
				<NcButton variant="tertiary" @click="props.legacy.askDiscard">
					{{ t('honeycomb', 'Discard') }}
				</NcButton>
			</div>
		</template>
	</NcNoteCard>
	<ConfirmDialog
		v-if="props.legacy.discarding.value"
		:title="t('honeycomb', 'Discard the stored decisions of missing files')"
		:confirmLabel="t('honeycomb', 'Discard stored decisions')"
		danger
		cancel
		@cancel="props.legacy.cancelDiscard"
		@confirm="props.legacy.discard">
		<p>{{ unreachableText }} {{ t('honeycomb', 'Their decisions and tags are removed from the database for good. Export them first to keep them.') }}</p>
	</ConfirmDialog>
</template>

<style scoped>
.legacy-notice__actions {
	display: flex;
	gap: var(--default-grid-baseline);
}
</style>
