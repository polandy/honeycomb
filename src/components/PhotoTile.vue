<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { LoadQueue, QueuedLoad } from '../logic/load-queue.ts'
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import FlagMark from './FlagMark.vue'
import StarRating from './StarRating.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { COLOUR_LABEL_SWATCHES, colourLabelName } from '../colour-labels.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { UNDECIDED } from '../logic/decision.ts'
import { GRID_TIERS, imageMember, loadPriority, sharpTier, smallSource, tierSource } from '../logic/image-tiers.ts'
import { pairBadge } from '../logic/pair-badge.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	picture: Picture<ListingEntry>
	/** The tile's edge in CSS pixels. */
	size: number
	imageUrl?: ImageUrlFor
	/** The grid's image loads, shared by its tiles (GRID-001.15). */
	loads: LoadQueue
	/** Whether the tile is only near the viewport, not in it; its loads wait for the visible ones. */
	offscreen?: boolean
	devicePixelRatio?: number
	decision?: Decision
	selecting?: boolean
	selected?: boolean
	/** The size of the offered series the picture is in, 0 outside one (SERIES-002.10). */
	series?: number
	/** How many tags the picture has (TAGS-004.7). */
	tags?: number
}>(), {
	decision: () => UNDECIDED,
	series: 0,
	tags: 0,
	selecting: false,
	selected: false,
	offscreen: false,
	imageUrl: apiImageUrl,
	devicePixelRatio: () => window.devicePixelRatio,
})

const member = computed(() => imageMember(props.picture))
const small = computed(() => smallSource(member.value, props.imageUrl))
const sharp = computed(() => {
	const tier = sharpTier(props.size, props.devicePixelRatio)
	return tier === GRID_TIERS[0] ? null : tierSource(member.value, tier, props.imageUrl)
})
/** The source the tile shows; null until the small preview has arrived. */
const shown = ref<string | null>(null)
/** Whether the small preview is still on its way (GRID-001.12). */
const waiting = ref(true)

/** The members as the label names them: both extensions of a pair, else the single's. */
const members = computed(() => {
	const shown = pairBadge(props.picture)
	return shown.kind === 'pair'
		? { name: shown.label, single: false }
		: { name: t('honeycomb', '{extension} only', { extension: shown.extension }, undefined, PLAIN_TEXT), single: true }
})

/** The tile's badge; a complete pair has none unless it keeps its RAW (GRID-001.4). */
const badge = computed(() => {
	if (members.value.single) {
		return { text: members.value.name, single: true, keepRaw: false }
	}
	return props.decision.keepRaw ? { text: `${members.value.name} ✓`, single: false, keepRaw: true } : null
})

const FLAG_NAMES = { picked: () => t('honeycomb', 'Picked'), rejected: () => t('honeycomb', 'Rejected'), unflagged: () => null }

/** The decision as the label reads it; an undecided field says nothing. */
const decisionLabel = computed(() => {
	const { rating, colourLabel, flag } = props.decision
	return [
		rating > 0 ? n('honeycomb', '{count} star', '{count} stars', rating, { count: formatNumber(rating) }) : null,
		colourLabel === null ? null : t('honeycomb', 'Colour label: {name}', { name: colourLabelName(colourLabel) }, undefined, PLAIN_TEXT),
		FLAG_NAMES[flag](),
		badge.value?.keepRaw === true ? t('honeycomb', 'Keep RAW') : null,
	].filter((part) => part !== null)
})

/** Whether the tile shows a flag, a colour label or stars. */
const marked = computed(() => props.decision.flag !== 'unflagged' || props.decision.colourLabel !== null || props.decision.rating > 0 || props.tags > 0)

const seriesText = computed(() => n('honeycomb', 'Series of {count}', 'Series of {count}', props.series, { count: formatNumber(props.series) }))

/** The badge's symbol and the series' size, as the mockup draws it. */
const seriesBadge = computed(() => `⧉ ${formatNumber(props.series)}`)

const label = computed(() => [
	props.picture.baseName,
	members.value.name,
	...(props.picture.ambiguous ? [t('honeycomb', 'ambiguous name')] : []),
	...(props.series > 1 ? [seriesText.value] : []),
	...decisionLabel.value,
	...(props.tags > 0 ? [n('honeycomb', '{count} tag', '{count} tags', props.tags, { count: formatNumber(props.tags) })] : []),
].join(', '))

let pending: { load: QueuedLoad, sharp: boolean } | null = null

/** Queues `url` in place of the tile's pending load and reports whether it loaded. */
function request(url: string, isSharp: boolean, settled: (loaded: boolean) => void): void {
	pending?.load.cancel()
	const current = {
		sharp: isSharp,
		load: props.loads.enqueue(url, loadPriority(!props.offscreen, isSharp), (loaded) => {
			pending = null
			settled(loaded)
		}),
	}
	pending = current
}

/** Requests the sharp tier once the small one shows; a failed one keeps the small (GRID-001.3). */
function requestSharp(): void {
	const url = sharp.value
	if (url !== null && pending === null && shown.value === small.value) {
		request(url, true, (loaded) => {
			if (loaded) {
				shown.value = url
			}
		})
	}
}

watch(small, (url) => {
	shown.value = null
	waiting.value = true
	request(url, false, (loaded) => {
		waiting.value = false
		shown.value = loaded ? url : null
		requestSharp()
	})
}, { immediate: true })
watch(sharp, requestSharp)
watch(() => props.offscreen, (offscreen) => pending?.load.prioritise(loadPriority(!offscreen, pending.sharp)))
onBeforeUnmount(() => pending?.load.cancel())
</script>

<template>
	<div
		class="photo-tile"
		:class="{ 'photo-tile--selected': props.selected, 'skeleton-tile': waiting }"
		:aria-label="label"
		data-tip-hover-only
		:aria-selected="props.selecting ? props.selected : undefined">
		<img
			v-if="shown !== null"
			class="photo-tile__image"
			alt=""
			draggable="false"
			:src="shown">
		<span v-if="badge !== null" class="photo-tile__pair" :class="{ 'photo-tile__pair--single': badge.single, 'photo-tile__pair--keep-raw': badge.keepRaw }">{{ badge.text }}</span>
		<span v-if="props.picture.ambiguous" class="photo-tile__ambiguous" aria-hidden="true">!</span>
		<span
			v-if="props.series > 1"
			class="photo-tile__series"
			aria-hidden="true"
			v-bind="tip(seriesText)">{{ seriesBadge }}</span>
		<span v-if="props.selecting" class="photo-tile__check" aria-hidden="true"><AppIcon v-if="props.selected" name="check" /></span>
		<span v-if="marked" class="photo-tile__marks">
			<FlagMark v-if="props.decision.flag !== 'unflagged'" :flag="props.decision.flag" :class="`photo-tile__flag photo-tile__flag--${props.decision.flag}`" />
			<StarRating
				v-if="props.decision.rating > 0"
				readonly
				class="photo-tile__stars"
				:rating="props.decision.rating" />
			<span v-if="props.decision.colourLabel !== null" class="photo-tile__colour" :style="{ backgroundColor: COLOUR_LABEL_SWATCHES[props.decision.colourLabel] }" />
			<span v-if="props.tags > 0" class="photo-tile__tags" aria-hidden="true"><AppIcon name="tag" />{{ formatNumber(props.tags) }}</span>
		</span>
	</div>
</template>

<style src="../skeleton-tile.css" />

<style scoped src="./photo-tile.css" />
