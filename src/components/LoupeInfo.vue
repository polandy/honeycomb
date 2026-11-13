<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Tag } from '../logic/tag.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { colourLabelName } from '../colour-labels.ts'
import { formatDateTime, formatFileSize, formatNumber } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { parseFileName } from '../logic/file-name.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { badgeExtension } from '../logic/pair-badge.ts'
import { sidecarTargets } from '../logic/xmp/targets.ts'

const props = withDefaults(defineProps<{
	picture: Picture<ListingEntry>
	folderSet: FolderSet
	decision: Decision
	/** The picture's tags, sorted (TAGS-004.8). */
	tags?: readonly Tag[]
	/** Whether tag changes are written through to the sidecars; false in a shared folder (TAGS-004.9). */
	writesSidecars?: boolean
}>(), {
	tags: () => [],
	writesSidecars: true,
})

/** Shown for a fact the picture lacks. */
const EMPTY = '—'
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
		{ term: t('honeycomb', 'Sidecars'), value: props.picture.sidecars.map(({ path }) => parseFileName(path).name).join(', ') || EMPTY },
	]
})
const decisionRows = computed(() => {
	const { rating, colourLabel, flag, keepRaw } = props.decision
	return [
		{ term: t('honeycomb', 'Rating'), value: rating > 0 ? n('honeycomb', '{count} star', '{count} stars', rating, { count: formatNumber(rating) }) : EMPTY },
		{ term: t('honeycomb', 'Colour label'), value: colourLabel === null ? EMPTY : colourLabelName(colourLabel) },
		{ term: t('honeycomb', 'Flag'), value: FLAG_NAMES[flag]() },
		...(props.picture.raw !== null && props.picture.rendered !== null ? [{ term: t('honeycomb', 'Keep RAW'), value: keepRaw ? t('honeycomb', 'yes') : t('honeycomb', 'no') }] : []),
	]
})
const writtenTo = computed(() => {
	const { existing, created } = sidecarTargets(props.picture)
	return props.writesSidecars
		? [...existing.map(({ path }) => path), ...created].map((path) => parseFileName(path).name).join(', ')
		: t('honeycomb', 'Not written, shared folder')
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
		<h3>{{ t('honeycomb', 'Tags') }}</h3>
		<ul v-if="props.tags.length > 0" class="loupe-info__tags">
			<li v-for="tag in props.tags" :key="tag">
				{{ tag }}
			</li>
		</ul>
		<p v-else class="loupe-info__tags">
			{{ EMPTY }}
		</p>
		<dl v-if="props.tags.length > 0">
			<dt>{{ t('honeycomb', 'Written to') }}</dt>
			<dd>{{ writtenTo }}</dd>
		</dl>
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
	grid-auto-rows: minmax(calc(8 * var(--default-grid-baseline)), auto);
	align-items: center;
	column-gap: calc(3 * var(--default-grid-baseline));
	margin: 0;
}

.loupe-info__tags {
	margin: 0 0 calc(2 * var(--default-grid-baseline));
	padding: 0;
	list-style: none;
	overflow-wrap: anywhere;
}

.loupe-info dt,
.loupe-info dd {
	margin: 0;
	padding: 0;
	line-height: 1.4;
}

.loupe-info dt {
	color: var(--color-text-maxcontrast);
	text-align: start;
}

.loupe-info dd {
	overflow-wrap: anywhere;
}
</style>
