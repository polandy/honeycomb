<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script lang="ts">
/** Decodes the image the browser picks from `srcset` at `sizes`, off the page. */
async function decodeImage(srcset: string, sizes: string): Promise<void> {
	const image = new Image()
	image.sizes = sizes
	image.srcset = srcset
	await image.decode()
}
</script>

<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import FlagMark from './FlagMark.vue'
import StarRating from './StarRating.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { COLOUR_LABEL_SWATCHES, colourLabelName } from '../colour-labels.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { UNDECIDED } from '../logic/decision.ts'
import { GRID_TIERS, gridSrcset, imageMember, sharpTier, smallSource } from '../logic/image-tiers.ts'
import { pairBadge } from '../logic/pair-badge.ts'

const props = withDefaults(defineProps<{
	picture: Picture<ListingEntry>
	/** The tile's edge in CSS pixels. */
	size: number
	imageUrl?: ImageUrlFor
	/** Resolves once the image of `srcset` at `sizes` is decoded, rejects if it cannot be. */
	loadImage?: (srcset: string, sizes: string) => Promise<void>
	devicePixelRatio?: number
	decision?: Decision
	selecting?: boolean
	selected?: boolean
}>(), {
	decision: () => UNDECIDED,
	selecting: false,
	selected: false,
	imageUrl: apiImageUrl,
	loadImage: decodeImage,
	devicePixelRatio: () => window.devicePixelRatio,
})

const member = computed(() => imageMember(props.picture))
const small = computed(() => smallSource(member.value, props.imageUrl))
const srcset = computed(() => gridSrcset(member.value, props.imageUrl))
const sizes = computed(() => `${Math.round(props.size)}px`)
/** The srcset whose sharp image has decoded; null while the tile shows the small one. */
const decoded = ref<string | null>(null)

const badge = computed(() => {
	const shown = pairBadge(props.picture)
	return shown.kind === 'pair'
		? { text: props.decision.keepRaw ? `${shown.label} ✓` : shown.label, single: false, keepRaw: props.decision.keepRaw }
		: { text: t('honeycomb', '{extension} only', { extension: shown.extension }, undefined, PLAIN_TEXT), single: true, keepRaw: false }
})

const FLAG_NAMES = { picked: () => t('honeycomb', 'Picked'), rejected: () => t('honeycomb', 'Rejected'), unflagged: () => null }

/** The decision as the label reads it; an undecided field says nothing. */
const decisionLabel = computed(() => {
	const { rating, colourLabel, flag } = props.decision
	return [
		rating > 0 ? n('honeycomb', '{count} star', '{count} stars', rating, { count: formatNumber(rating) }) : null,
		colourLabel === null ? null : t('honeycomb', 'Colour label: {name}', { name: colourLabelName(colourLabel) }, undefined, PLAIN_TEXT),
		FLAG_NAMES[flag](),
		badge.value.keepRaw ? t('honeycomb', 'Keep RAW') : null,
	].filter((part) => part !== null)
})

const label = computed(() => [
	props.picture.baseName,
	badge.value.text.replace(' ✓', ''),
	...(props.picture.ambiguous ? [t('honeycomb', 'ambiguous name')] : []),
	...decisionLabel.value,
].join(', '))

let latestLoad = 0
watch([srcset, sizes, () => props.devicePixelRatio], async () => {
	const load = ++latestLoad
	if (decoded.value === srcset.value || sharpTier(props.size, props.devicePixelRatio) === GRID_TIERS[0]) {
		return
	}
	const wanted = srcset.value
	try {
		await props.loadImage(wanted, sizes.value)
	} catch {
		return
	}
	if (load === latestLoad) {
		decoded.value = wanted
	}
}, { immediate: true })
</script>

<template>
	<div
		class="photo-tile"
		:class="{ 'photo-tile--selected': props.selected }"
		:aria-label="label"
		:aria-selected="props.selecting ? props.selected : undefined">
		<img
			class="photo-tile__image"
			alt=""
			draggable="false"
			:src="small"
			:srcset="decoded ?? undefined"
			:sizes="decoded === null ? undefined : sizes">
		<span class="photo-tile__pair" :class="{ 'photo-tile__pair--single': badge.single, 'photo-tile__pair--keep-raw': badge.keepRaw }">{{ badge.text }}</span>
		<span v-if="props.picture.ambiguous" class="photo-tile__ambiguous" aria-hidden="true">!</span>
		<span v-if="props.selecting" class="photo-tile__check" aria-hidden="true"><AppIcon v-if="props.selected" name="check" /></span>
		<FlagMark v-if="props.decision.flag !== 'unflagged'" :flag="props.decision.flag" :class="`photo-tile__flag photo-tile__flag--${props.decision.flag}`" />
		<span v-if="props.decision.colourLabel !== null" class="photo-tile__colour" :style="{ backgroundColor: COLOUR_LABEL_SWATCHES[props.decision.colourLabel] }" />
		<StarRating
			v-if="props.decision.rating > 0"
			readonly
			class="photo-tile__stars"
			:rating="props.decision.rating" />
	</div>
</template>

<style scoped>
.photo-tile {
	position: relative;
	overflow: hidden;
	width: 100%;
	height: 100%;
	border-radius: var(--border-radius-large);
	background-color: var(--color-background-dark);
}

.photo-tile__image {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: cover;
	user-select: none;
	-webkit-touch-callout: none;
}

.photo-tile__pair,
.photo-tile__ambiguous {
	position: absolute;
	top: 6px;
	padding: 2px 6px;
	border-radius: var(--border-radius);
	font-size: 11px;
	font-weight: bold;
	line-height: 1.3;
}

.photo-tile__pair {
	inset-inline-start: 6px;
	background-color: var(--color-main-background-blur);
	color: var(--color-main-text);
}

.photo-tile__pair--single {
	border: 1px dashed var(--color-warning);
	background-color: var(--color-main-background);
	color: var(--color-warning-text);
}

.photo-tile__ambiguous {
	inset-inline-end: 6px;
	background-color: var(--color-warning);
	color: var(--color-main-background);
}

.photo-tile__pair--keep-raw {
	background-color: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

.photo-tile--selected {
	outline: 3px solid var(--color-primary-element);
	outline-offset: -3px;
}

.photo-tile__check {
	position: absolute;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	inset-inline-end: 6px;
	bottom: 6px;
	border: 2px solid var(--color-main-background);
	background-color: var(--color-main-background-blur);
}

.photo-tile--selected .photo-tile__check {
	background-color: var(--color-primary-element);
	color: var(--color-primary-element-text);
}

.photo-tile__check .app-icon {
	width: 16px;
	height: 16px;
}

.photo-tile__flag {
	position: absolute;
	inset-inline-start: 6px;
	bottom: 6px;
}

.photo-tile__colour {
	position: absolute;
	top: 30px;
	inset-inline-start: 6px;
	width: 12px;
	height: 12px;
	border: 1px solid var(--color-main-background);
	border-radius: 50%;
}

.photo-tile__stars {
	position: absolute;
	inset-inline-start: 36px;
	bottom: 8px;
	font-size: 14px;
	text-shadow: 0 0 2px var(--color-main-background);
}
</style>
