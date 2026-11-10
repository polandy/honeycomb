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
import { formatFileSize, formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { deleteSummary, filesOf } from '../logic/delete-summary.ts'
import { imageMember, smallSource } from '../logic/image-tiers.ts'
import { badgeExtension } from '../logic/pair-badge.ts'

const props = defineProps<{
	/** The rejected pictures. */
	pictures: readonly Picture<ListingEntry>[]
	folderSet: FolderSet
	/** How many folders the cull shows; a tile names its folder when there is more than one. */
	folders: number
	imageUrl: ImageUrlFor
}>()

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
		@cancel="emit('cancel')"
		@confirm="emit('confirm')">
		<NcEmptyContent
			v-if="props.pictures.length === 0"
			:name="t('honeycomb', 'No rejected photos')"
			:description="t('honeycomb', 'Nothing to delete.')" />
		<template v-else>
			<DeleteStats :stats="stats" />
			<p>{{ t('honeycomb', 'Tap a photo to rescue it. A rescued photo becomes undecided again.') }}</p>
			<ul class="reject-review__grid">
				<li v-for="picture in props.pictures" :key="imageMember(picture).fileId">
					<button
						type="button"
						class="reject-review__tile"
						:aria-label="t('honeycomb', 'Rescue {name}', { name: picture.baseName }, undefined, PLAIN_TEXT)"
						@click="emit('rescue', picture)">
						<img :src="smallSource(imageMember(picture), props.imageUrl)" alt="" loading="lazy">
						<span class="reject-review__name">{{ picture.baseName }}</span>
						<span class="reject-review__caption">{{ caption(picture) }}</span>
						<span class="reject-review__rescue">{{ t('honeycomb', 'Rescue') }}</span>
					</button>
				</li>
			</ul>
		</template>
	</ConfirmDialog>
</template>

<style scoped>
.reject-review__grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	gap: calc(var(--default-grid-baseline) * 2);
	margin: 0;
	padding: 0;
	list-style: none;
}

.reject-review__tile {
	display: flex;
	flex-direction: column;
	width: 100%;
	min-height: 44px;
	margin: 0;
	padding: calc(var(--default-grid-baseline) * 1);
	border: 2px solid var(--color-error);
	border-radius: var(--border-radius-large);
	background: var(--color-main-background);
	text-align: start;
}

.reject-review__tile img {
	width: 100%;
	aspect-ratio: 1;
	object-fit: cover;
}

.reject-review__name {
	font-weight: bold;
	overflow-wrap: anywhere;
}

.reject-review__caption {
	color: var(--color-text-maxcontrast);
}

.reject-review__rescue {
	align-self: flex-start;
	margin-top: calc(var(--default-grid-baseline) * 1);
	color: var(--color-primary-element);
	font-weight: bold;
}
</style>
