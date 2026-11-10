<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { RawRemoval } from '../logic/raw-removal.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import DeleteStats from './DeleteStats.vue'
import PictureThumbs from './PictureThumbs.vue'
import TrashFileList from './TrashFileList.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { formatFileSize, formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { rawFilesOf } from '../logic/raw-removal.ts'

const props = withDefaults(defineProps<{
	removal: RawRemoval
	folderSet: FolderSet
	/** Whether the removal runs. */
	busy: boolean
	imageUrl?: ImageUrlFor
}>(), { imageUrl: apiImageUrl })

const emit = defineEmits<{
	toggle: [picture: Picture<ListingEntry>]
	cancel: []
	confirm: []
}>()

const files = computed(() => props.removal.removed.flatMap(rawFilesOf))
const stats = computed(() => [
	{ value: formatNumber(props.removal.removed.length), label: n('honeycomb', 'photo', 'photos', props.removal.removed.length) },
	{ value: formatNumber(files.value.length), label: n('honeycomb', 'file', 'files', files.value.length) },
	{ value: formatFileSize(files.value.reduce((sum, file) => sum + file.entry.size, 0)), label: t('honeycomb', 'freed') },
])
const skipped = computed(() => {
	const { kept, rejected, singles } = props.removal
	return t('honeycomb', 'Skipped: {kept} · {rejected} · {singles}.', {
		kept: n('honeycomb', '{count} marked Keep RAW', '{count} marked Keep RAW', kept.length, { count: formatNumber(kept.length) }, PLAIN_TEXT),
		rejected: n('honeycomb', '{count} rejected', '{count} rejected', rejected, { count: formatNumber(rejected) }, PLAIN_TEXT),
		singles: n('honeycomb', '{count} single', '{count} singles', singles, { count: formatNumber(singles) }, PLAIN_TEXT),
	}, undefined, PLAIN_TEXT)
})
const groups = computed(() => [
	{
		heading: t('honeycomb', 'RAW will be removed'),
		pictures: props.removal.removed,
		hint: t('honeycomb', 'Tap a photo to keep its RAW instead.'),
		action: t('honeycomb', 'Keep RAW'),
		label: (picture: Picture<ListingEntry>) => t('honeycomb', 'Keep RAW: {name}', { name: picture.baseName }, undefined, PLAIN_TEXT),
		tone: 'error' as const,
	},
	{
		heading: t('honeycomb', 'RAW stays (Keep RAW)'),
		pictures: props.removal.kept,
		hint: t('honeycomb', 'Tap a photo to remove its RAW after all.'),
		action: t('honeycomb', 'Remove RAW'),
		label: (picture: Picture<ListingEntry>) => t('honeycomb', 'Remove RAW: {name}', { name: picture.baseName }, undefined, PLAIN_TEXT),
		tone: 'primary' as const,
	},
])
</script>

<template>
	<ConfirmDialog
		:title="n('honeycomb', 'Remove the RAW of {count} photo', 'Remove the RAWs of {count} photos', props.removal.removed.length, { count: formatNumber(props.removal.removed.length) }, PLAIN_TEXT)"
		:confirmLabel="n('honeycomb', 'Move {count} file to trash', 'Move {count} files to trash', files.length, { count: formatNumber(files.length) }, PLAIN_TEXT)"
		:confirmDisabled="props.busy || files.length === 0"
		cancel
		wide
		danger
		@cancel="emit('cancel')"
		@confirm="emit('confirm')">
		<DeleteStats :stats="stats" />
		<p>{{ t('honeycomb', 'Only the RAW file and its own sidecar go. The JPEG, its sidecar and a shared sidecar stay, and every photo keeps its rating, label and flag.') }} {{ skipped }}</p>
		<section v-for="group in groups" :key="group.heading" class="raw-removal__group">
			<h3>{{ group.heading }} · {{ formatNumber(group.pictures.length) }}</h3>
			<template v-if="group.pictures.length > 0">
				<p class="raw-removal__hint">
					{{ group.hint }}
				</p>
				<PictureThumbs
					class="raw-removal__thumbs"
					:pictures="group.pictures"
					:action="group.action"
					:label="group.label"
					:tone="group.tone"
					:imageUrl="props.imageUrl"
					@tap="emit('toggle', $event)" />
			</template>
			<p v-else class="raw-removal__hint">
				{{ t('honeycomb', 'None') }}
			</p>
		</section>
		<details class="raw-removal__files">
			<summary>{{ t('honeycomb', 'Files that will be deleted') }}</summary>
			<TrashFileList :rows="files.map((file) => ({ file }))" :folderSet="props.folderSet" :label="t('honeycomb', 'Files that will be deleted')" />
		</details>
		<p class="raw-removal__hint">
			{{ t('honeycomb', 'Files move to the Nextcloud trash bin and can be restored from there. Nothing is deleted for good; the space returns when the trash bin is emptied.') }}
		</p>
	</ConfirmDialog>
</template>

<style scoped>
.raw-removal__group {
	margin-top: calc(var(--default-grid-baseline) * 3);
}

.raw-removal__thumbs {
	max-height: 40vh;
	overflow-y: auto;
}

.raw-removal__hint {
	color: var(--color-text-maxcontrast);
}

.raw-removal__files {
	margin-top: calc(var(--default-grid-baseline) * 3);
}
</style>
