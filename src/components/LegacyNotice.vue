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

const heading = computed(() => {
	const photos = folders.value.reduce((sum, folder) => sum + folder.files, 0)
	return photos === 0 ? undefined : n('honeycomb', 'Move the decisions of {count} photo into its sidecars', 'Move the decisions of {count} photos into their sidecars', photos, { count: formatNumber(photos) }, PLAIN_TEXT)
})

const unreachableText = computed(() => n('honeycomb', '{count} file with stored decisions was deleted or is no longer shared with you, so its sidecar cannot be written. Save a copy of its decisions, or forget them.', '{count} files with stored decisions were deleted or are no longer shared with you, so their sidecars cannot be written. Save a copy of their decisions, or forget them.', unreachable.value, { count: formatNumber(unreachable.value) }, PLAIN_TEXT))

const forgetText = computed(() => n('honeycomb', 'honeycomb removes the stored decisions and tags of {count} file from its database for good. Save a copy first to keep them.', 'honeycomb removes the stored decisions and tags of {count} files from its database for good. Save a copy first to keep them.', unreachable.value, { count: formatNumber(unreachable.value) }, PLAIN_TEXT))
</script>

<template>
	<NcNoteCard class="legacy-notice" type="info" :heading="heading">
		<template v-if="folders.length > 0">
			<p>{{ t('honeycomb', 'honeycomb keeps them in its database, where digiKam, darktable and Lightroom cannot see them. Open a folder and choose ⋯ → Write decisions to sidecars…') }}</p>
			<ul class="legacy-notice__folders">
				<li v-for="folder in folders" :key="folder.path">
					<NcButton variant="tertiary" @click="props.legacy.openFolder(folder.path)">
						{{ `${folder.path} (${formatNumber(folder.files)})` }}
					</NcButton>
				</li>
			</ul>
		</template>
		<template v-if="unreachable > 0">
			<p>{{ unreachableText }}</p>
			<div class="legacy-notice__actions">
				<NcButton variant="secondary" @click="props.legacy.exportRows">
					{{ t('honeycomb', 'Save a copy') }}
				</NcButton>
				<NcButton variant="tertiary" @click="props.legacy.askForget">
					{{ t('honeycomb', 'Forget…') }}
				</NcButton>
			</div>
		</template>
	</NcNoteCard>
	<ConfirmDialog
		v-if="props.legacy.forgetting.value"
		:title="t('honeycomb', 'Forget the decisions of missing files')"
		:confirmLabel="t('honeycomb', 'Forget')"
		danger
		cancel
		@cancel="props.legacy.cancelForget"
		@confirm="props.legacy.forget">
		<p>{{ forgetText }}</p>
	</ConfirmDialog>
</template>

<style scoped>
/* a long folder list scrolls in the notice so the grid keeps room on a phone */
.legacy-notice {
	max-height: 30dvh;
	overflow-y: auto;
}

.legacy-notice__folders {
	display: flex;
	flex-wrap: wrap;
	gap: var(--default-grid-baseline);
	padding: 0;
	list-style: none;
}

.legacy-notice__actions {
	display: flex;
	gap: var(--default-grid-baseline);
}
</style>
