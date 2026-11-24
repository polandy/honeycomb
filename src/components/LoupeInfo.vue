<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SharpnessPlace } from '../logic/sharpness.ts'
import type { Tag } from '../logic/tag.ts'
import type { LockReason, Writability } from '../logic/writability.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { colourLabelName } from '../cull/colour-labels.ts'
import { measureById } from '../hashes/quality-measures.ts'
import { folderLabel } from '../logic/cull.ts'
import { parseFileName } from '../logic/file-name.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { isListingPicture } from '../logic/listing.ts'
import { badgeExtension } from '../logic/pair-badge.ts'
import { exposureText, exposureTimeText, pictureExposure, shakeRisk } from '../logic/shake-risk.ts'
import { sidecarTargets } from '../logic/xmp/targets.ts'
import { formatDateTime, formatFileSize, formatNumber } from '../shared/l10n.ts'

const props = withDefaults(defineProps<{
	picture: Picture<SourceEntry>
	/** The folder set the Folder row names the folder within; a source without folders has no Folder row. */
	folderSet?: FolderSet | undefined
	decision: Decision
	/** The picture's tags, sorted (TAGS-004.8). */
	tags?: readonly Tag[]
	/** Whether the picture's decisions and tags are written to its sidecars, or why not (TAGS-004.9, XMP-008). */
	writability?: Writability
	/** The picture's rank by sharpness within its series, without a section while null (SERIES-007.5). */
	sharpness?: SharpnessPlace | null
}>(), {
	tags: () => [],
	writability: 'writable',
	sharpness: null,
})

/** Shown for a fact the picture lacks. */
const EMPTY = '—'
const FLAG_NAMES = { picked: () => t('honeycomb', 'Picked'), rejected: () => t('honeycomb', 'Rejected'), unflagged: () => t('honeycomb', 'Unflagged') }

const member = computed(() => imageMember(props.picture))
const exposure = computed(() => pictureExposure(props.picture))
/** The shake risk's rule applied to the picture, null while it is not at risk (SERIES-009). */
const risk = computed(() => shakeRisk(exposure.value))
const exposureRows = computed(() => {
	const facts = exposure.value
	const text = facts === null ? null : exposureText(facts)
	const length = facts?.focalLength ?? null
	const fullFrame = facts?.focalLength35 ?? null
	return [
		...(text === null ? [] : [{ term: t('honeycomb', 'Exposure'), value: text }]),
		...(length === null && fullFrame === null
			? []
			: [{ term: t('honeycomb', 'Focal length'), value: focalLengthText(length, fullFrame) }]),
	]
})
/** The reason the hint gives, `1/15 s at 300 mm full frame; slower than 1/300 s`. */
const riskReason = computed(() => {
	if (risk.value === null) {
		return null
	}
	const params = {
		time: exposureTimeText(risk.value.exposureTime),
		length: formatNumber(risk.value.focalLength),
		limit: exposureTimeText(1 / risk.value.focalLength),
	}
	return risk.value.fullFrame
		? t('honeycomb', '{time} at {length} mm full frame; slower than {limit}', params)
		: t('honeycomb', '{time} at {length} mm; slower than {limit}', params)
})
const rows = computed(() => {
	const { rendered, raw } = isListingPicture(props.picture) ? props.picture : { rendered: null, raw: null }
	const { captureTime, width, height } = member.value
	return [
		{ term: t('honeycomb', 'Name'), value: props.picture.baseName },
		...(props.folderSet === undefined ? [] : [{ term: t('honeycomb', 'Folder'), value: folderLabel(props.picture.folder, props.folderSet) }]),
		...(captureTime === null ? [] : [{ term: t('honeycomb', 'Captured'), value: formatDateTime(captureTime) }]),
		...exposureRows.value,
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
const sharpnessLabel = measureById('sharpness').label(t)
const sharpnessText = computed(() => {
	if (props.sharpness === null) {
		return null
	}
	const { rank, count, sharpest } = props.sharpness
	return sharpest
		? t('honeycomb', 'Sharpest of {count}', { count: formatNumber(count) })
		: t('honeycomb', 'Rank {rank} of {count}', { rank: formatNumber(rank), count: formatNumber(count) })
})
/** `200 mm`, with `(300 mm full frame)` where the camera reports a different full-frame length. */
function focalLengthText(length: number | null, fullFrame: number | null): string {
	if (length === null || fullFrame === null) {
		return t('honeycomb', '{length} mm', { length: formatNumber(length ?? fullFrame!) })
	}
	return length === fullFrame
		? t('honeycomb', '{length} mm', { length: formatNumber(length) })
		: t('honeycomb', '{length} mm ({fullFrame} mm full frame)', { length: formatNumber(length), fullFrame: formatNumber(fullFrame) })
}
const NOT_WRITTEN: Record<LockReason, () => string> = {
	readOnly: () => t('honeycomb', 'Read only: you may not change this folder'),
}
const writtenTo = computed(() => {
	if (props.writability !== 'writable') {
		return NOT_WRITTEN[props.writability]()
	}
	const { existing, created } = sidecarTargets(props.picture)
	return [...existing.map(({ path }) => path), ...created].map((path) => parseFileName(path).name).join(', ')
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
		<template v-if="sharpnessText !== null || riskReason !== null">
			<h3>{{ t('honeycomb', 'Quality') }}</h3>
			<template v-if="sharpnessText !== null">
				<dl>
					<dt>{{ sharpnessLabel }}</dt>
					<dd>{{ sharpnessText }}</dd>
				</dl>
				<p class="loupe-info__note">
					{{ t('honeycomb', 'Compared within its series only') }}
				</p>
			</template>
			<template v-if="riskReason !== null">
				<dl>
					<dt>{{ t('honeycomb', 'Hints') }}</dt>
					<dd>{{ t('honeycomb', 'Shake risk') }}</dd>
				</dl>
				<p class="loupe-info__note">
					{{ riskReason }}
				</p>
			</template>
		</template>
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

.loupe-info__note {
	margin: 0;
	font-size: var(--font-size-small, 13px);
	color: var(--color-text-maxcontrast);
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
