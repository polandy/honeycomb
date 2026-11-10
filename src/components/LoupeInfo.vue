<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { colourLabelName } from '../colour-labels.ts'
import { formatDateTime, formatFileSize, formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { badgeExtension } from '../logic/pair-badge.ts'

const props = defineProps<{
	picture: Picture<ListingEntry>
	folderSet: FolderSet
	decision: Decision
	/** How many of the prefetched neighbours have loaded. */
	preloaded: number
	/** How many neighbours the loupe prefetches here. */
	neighbours: number
}>()

const FLAG_NAMES = { picked: () => t('honeycomb', 'Picked'), rejected: () => t('honeycomb', 'Rejected'), unflagged: () => t('honeycomb', 'Unflagged') }

const member = computed(() => imageMember(props.picture))
const rows = computed(() => {
	const { rendered, raw } = props.picture
	const { captureTime, width, height } = member.value
	return [
		{ term: t('honeycomb', 'Name'), value: props.picture.baseName },
		{ term: t('honeycomb', 'Folder'), value: folderLabel(props.picture.folder, props.folderSet) },
		...(captureTime === null ? [] : [{ term: t('honeycomb', 'Captured'), value: formatDateTime(captureTime) }]),
		...(width === null || height === null ? [] : [{ term: t('honeycomb', 'Size'), value: `${formatNumber(width)} × ${formatNumber(height)}` }]),
		...(rendered === null ? [] : [{ term: badgeExtension(rendered), value: formatFileSize(rendered.size) }]),
		...(raw === null ? [] : [{ term: badgeExtension(raw), value: formatFileSize(raw.size) }]),
		{ term: t('honeycomb', 'Sidecar'), value: props.picture.sidecars.map((sidecar) => badgeExtension(sidecar)).join(', ') || t('honeycomb', 'none') },
	]
})
const decisionRows = computed(() => {
	const { rating, colourLabel, flag, keepRaw } = props.decision
	return [
		{ term: t('honeycomb', 'Rating'), value: rating > 0 ? n('honeycomb', '{count} star', '{count} stars', rating, { count: formatNumber(rating) }) : t('honeycomb', 'none') },
		{ term: t('honeycomb', 'Colour label'), value: colourLabel === null ? t('honeycomb', 'none') : colourLabelName(colourLabel) },
		{ term: t('honeycomb', 'Flag'), value: FLAG_NAMES[flag]() },
		...(props.picture.raw !== null && props.picture.rendered !== null ? [{ term: t('honeycomb', 'Keep RAW'), value: keepRaw ? t('honeycomb', 'yes') : t('honeycomb', 'no') }] : []),
	]
})
</script>

<template>
	<aside class="loupe-info" :aria-label="t('honeycomb', 'Photo info')">
		<h3>{{ t('honeycomb', 'File') }}</h3>
		<dl>
			<template v-for="row in rows" :key="row.term">
				<dt>{{ row.term }}</dt>
				<dd>{{ row.value }}</dd>
			</template>
		</dl>
		<h3>{{ t('honeycomb', 'Decision') }}</h3>
		<dl>
			<template v-for="row in decisionRows" :key="row.term">
				<dt>{{ row.term }}</dt>
				<dd>{{ row.value }}</dd>
			</template>
		</dl>
		<h3>{{ t('honeycomb', 'Preloading') }}</h3>
		<p>{{ t('honeycomb', '{ready} of {count} neighbours loaded', { ready: formatNumber(props.preloaded), count: formatNumber(props.neighbours) }, undefined, PLAIN_TEXT) }}</p>
	</aside>
</template>

<style scoped>
.loupe-info {
	box-sizing: border-box;
	flex: none;
	overflow: auto;
	padding: calc(3 * var(--default-grid-baseline));
	background-color: var(--color-main-background);
	color: var(--color-main-text);
}

.loupe-info h3 {
	margin: calc(4 * var(--default-grid-baseline)) 0 calc(2 * var(--default-grid-baseline));
	font-size: var(--font-size-small, 13px);
	color: var(--color-text-maxcontrast);
	text-transform: uppercase;
}

.loupe-info h3:first-child {
	margin-top: 0;
}

.loupe-info dl {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: calc(1.5 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline));
	margin: 0;
}

.loupe-info dt {
	color: var(--color-text-maxcontrast);
}

.loupe-info dd {
	margin: 0;
	overflow-wrap: anywhere;
}
</style>
