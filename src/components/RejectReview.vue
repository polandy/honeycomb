<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import ConfirmDialog from './ConfirmDialog.vue'
import DeleteStats from './DeleteStats.vue'
import PictureThumbs from './PictureThumbs.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { formatFileSize, formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { deleteSummary, filesOf } from '../logic/delete-summary.ts'
import { badgeExtension } from '../logic/pair-badge.ts'

const props = withDefaults(defineProps<{
	/** The rejected pictures. */
	pictures: readonly Picture<ListingEntry>[]
	folderSet: FolderSet
	/** How many folders the cull shows; a tile names its folder when there is more than one. */
	folders: number
	imageUrl?: ImageUrlFor
}>(), { imageUrl: apiImageUrl })

const emit = defineEmits<{
	rescue: [picture: Picture<ListingEntry>]
	cancel: []
	confirm: []
}>()

const summary = computed(() => deleteSummary(props.pictures))
const stats = computed(() => [
	{ value: formatNumber(summary.value.pictures), label: n('honeycomb', 'photo', 'photos', summary.value.pictures) },
	{ value: formatNumber(summary.value.files), label: n('honeycomb', 'file', 'files', summary.value.files) },
	{ value: formatFileSize(summary.value.bytes), label: t('honeycomb', 'to free') },
])

/** The tile's caption: its folder when the cull has several, and the kinds of its files. */
function caption(picture: Picture<ListingEntry>): string {
	const kinds = filesOf(picture).map((file) => badgeExtension(file.entry)).join(' + ')
	return props.folders > 1 ? `${folderLabel(picture.folder, props.folderSet)} · ${kinds}` : kinds
}
</script>

<template>
	<ConfirmDialog
		:title="t('honeycomb', 'Review rejects')"
		:confirmLabel="n('honeycomb', 'Continue: delete {count}', 'Continue: delete {count}', props.pictures.length, { count: formatNumber(props.pictures.length) }, PLAIN_TEXT)"
		:confirmDisabled="props.pictures.length === 0"
		cancel
		wide
		danger
		@cancel="emit('cancel')"
		@confirm="emit('confirm')">
		<NcEmptyContent
			v-if="props.pictures.length === 0"
			:name="t('honeycomb', 'No rejected photos')"
			:description="t('honeycomb', 'Nothing to delete.')" />
		<template v-else>
			<DeleteStats :stats="stats" />
			<p>{{ t('honeycomb', 'Tap a photo to rescue it. A rescued photo becomes undecided again.') }}</p>
			<PictureThumbs
				:pictures="props.pictures"
				:action="t('honeycomb', 'Rescue')"
				:label="(picture) => t('honeycomb', 'Rescue {name}', { name: picture.baseName }, undefined, PLAIN_TEXT)"
				:caption="caption"
				tone="error"
				:imageUrl="props.imageUrl"
				@tap="emit('rescue', $event)" />
		</template>
	</ConfirmDialog>
</template>
