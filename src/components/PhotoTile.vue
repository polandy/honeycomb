<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { LoadQueue, QueuedLoad } from '../logic/load-queue.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SeriesStatus } from '../logic/stored-series.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import FlagMark from './FlagMark.vue'
import StarRating from './StarRating.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { COLOUR_LABEL_SWATCHES, colourLabelName } from '../colour-labels.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { isDecided, UNDECIDED } from '../logic/decision.ts'
import { GRID_TIERS, imageMember, loadPriority, sharpTier, smallSource, tierSource } from '../logic/image-tiers.ts'
import { nameParts } from '../logic/name-bar.ts'
import { pairBadge } from '../logic/pair-badge.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	picture: Picture<SourceEntry>
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
	/** The picture's place in its series, on the first tile of a run the run's length, and a stored series' status; null outside a series (SERIES-002.10, SERIES-005.17). */
	series?: { readonly position: number, readonly size: number, readonly run: number | null, readonly stored?: SeriesStatus | null } | null
	/** Whether the series is settled, so the compare no longer offers it (SERIES-002.10). */
	seriesSettled?: boolean
	/** Whether a member of the series is still without its visual hash (SERIES-003.25). */
	seriesOpen?: boolean
	/** How many tags the picture has (TAGS-004.7). */
	tags?: number
	/** Whether the picture's sidecar writes still wait (XMP-003.28). */
	unsaved?: boolean
	/** Whether the user may not change the picture, which the lock shows (GRID-001.20). */
	readOnly?: boolean
	/** Whether the name bar above the photo shows the base name (GRID-004.4). */
	nameBar?: boolean
	/** Whether the name bar ends in the ⓘ button that opens the tile info, on touch (GRID-004.12). */
	infoButton?: boolean
	/** Raised by the grid to load a failed small preview again (GRID-001.23). */
	retry?: number
}>(), {
	decision: () => UNDECIDED,
	series: null,
	seriesSettled: false,
	seriesOpen: false,
	tags: 0,
	unsaved: false,
	readOnly: false,
	nameBar: false,
	infoButton: false,
	retry: 0,
	selecting: false,
	selected: false,
	offscreen: false,
	imageUrl: apiImageUrl,
	devicePixelRatio: () => window.devicePixelRatio,
})

const emit = defineEmits<{
	/** The badge was tapped: compare the series, or select it in selection mode (SERIES-002.13). */
	compareSeries: []
	/** The ⓘ button was tapped; the tile's element is where the tile info points (GRID-004.12). */
	info: [tile: HTMLElement]
	/** Whether the small preview failed to load, on each change (GRID-001.23). */
	imageFailed: [failed: boolean]
}>()

const member = computed(() => imageMember(props.picture))
const name = computed(() => nameParts(props.picture.baseName))
const small = computed(() => smallSource(member.value, props.imageUrl))
const sharp = computed(() => {
	const tier = sharpTier(props.size, props.devicePixelRatio)
	return tier === GRID_TIERS[0] ? null : tierSource(member.value, tier, props.imageUrl)
})
/** The source the tile shows; null until the small preview has arrived. */
const shown = ref<string | null>(null)
/** Whether the small preview is still on its way (GRID-001.12). */
const waiting = ref(true)
/** Whether the small preview failed and the tile waits for a retry (GRID-001.23). */
const failed = ref(false)

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

/** Whether the tile shows a flag, a colour label, stars, tags or the *Not saved yet* marker. */
const marked = computed(() => isDecided(props.decision) || props.decision.colourLabel !== null || props.decision.rating > 0 || props.tags > 0 || props.unsaved)

/** The tile's place in its series as the label says it (SERIES-002.10). */
const seriesText = computed(() => props.series === null
	? []
	: [
			t('honeycomb', 'Series, photo {position} of {size}', { position: formatNumber(props.series.position), size: formatNumber(props.series.size) }, undefined, PLAIN_TEXT),
			...(props.seriesOpen ? [t('honeycomb', 'Series may still change')] : []),
			...(props.series.stored === 'open' ? [t('honeycomb', 'Series edited by hand')] : []),
			...(props.series.stored === 'done' ? [t('honeycomb', 'Series done')] : []),
		])

/** The badge on the first tile of a run: the series' size, or the run's length of it when the series is split. */
const seriesBadge = computed(() => {
	const series = props.series
	if (series === null || series.run === null) {
		return null
	}
	const size = formatNumber(series.size)
	return {
		text: series.run < series.size ? t('honeycomb', '⧉ {run} of {size}', { run: formatNumber(series.run), size }, undefined, PLAIN_TEXT) : `⧉ ${size}`,
		icon: series.stored === 'done' ? 'check' as const : series.stored === 'open' ? 'pin' as const : null,
		label: n('honeycomb', 'Series of {count} – compare', 'Series of {count} – compare', series.size, { count: size }, PLAIN_TEXT),
	}
})

const label = computed(() => [
	props.picture.baseName,
	members.value.name,
	...(props.picture.ambiguous ? [t('honeycomb', 'ambiguous name')] : []),
	...seriesText.value,
	...decisionLabel.value,
	...(props.tags > 0 ? [n('honeycomb', '{count} tag', '{count} tags', props.tags, { count: formatNumber(props.tags) })] : []),
	...(props.unsaved ? [t('honeycomb', 'Not saved yet')] : []),
	...(props.readOnly ? [t('honeycomb', 'Read only')] : []),
	...(failed.value ? [t('honeycomb', 'Preview failed to load')] : []),
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

/** Loads the small preview and settles the tile on its outcome. */
function loadSmall(url: string): void {
	shown.value = null
	waiting.value = true
	failed.value = false
	request(url, false, (loaded) => {
		waiting.value = false
		shown.value = loaded ? url : null
		failed.value = !loaded
		requestSharp()
	})
}

watch(small, loadSmall, { immediate: true })
watch(failed, (isFailed, wasFailed) => {
	if (isFailed || wasFailed) {
		emit('imageFailed', isFailed)
	}
})
watch(() => props.retry, () => {
	if (failed.value) {
		loadSmall(small.value)
	}
})
watch(sharp, requestSharp)
watch(() => props.offscreen, (offscreen) => pending?.load.prioritise(loadPriority(!offscreen, pending.sharp)))
onBeforeUnmount(() => {
	pending?.load.cancel()
	if (failed.value) {
		emit('imageFailed', false)
	}
})
</script>

<template>
	<div
		class="photo-tile"
		:class="{ 'photo-tile--selected': props.selected, 'photo-tile--failed': failed, 'skeleton-tile': waiting }"
		:aria-label="label"
		data-tip-hover-only
		:aria-selected="props.selecting ? props.selected : undefined">
		<div
			v-if="props.nameBar"
			class="photo-tile__name"
			:class="{ 'photo-tile__name--info': props.infoButton }"
			aria-hidden="true">
			<span class="photo-tile__name-head">{{ name.head }}</span><span class="photo-tile__name-tail">{{ name.tail }}</span>
		</div>
		<div class="photo-tile__photo">
			<img
				v-if="shown !== null"
				class="photo-tile__image"
				alt=""
				draggable="false"
				:src="shown">
			<span v-if="failed" class="photo-tile__failed" aria-hidden="true">
				<AppIcon name="imageBroken" />
				<span class="photo-tile__failed-name">{{ props.picture.baseName }}</span>
			</span>
			<span v-if="badge !== null" class="photo-tile__pair" :class="{ 'photo-tile__pair--single': badge.single, 'photo-tile__pair--keep-raw': badge.keepRaw }">{{ badge.text }}</span>
			<span v-if="props.picture.ambiguous" class="photo-tile__ambiguous" aria-hidden="true">!</span>
			<span v-if="props.readOnly" class="photo-tile__lock" aria-hidden="true"><AppIcon name="lock" /></span>
			<button
				v-if="seriesBadge !== null"
				type="button"
				class="photo-tile__series"
				:class="{ 'photo-tile__series--settled': props.seriesSettled, 'photo-tile__series--open': props.seriesOpen }"
				tabindex="-1"
				:aria-label="seriesBadge.label"
				v-bind="tip(t('honeycomb', 'Compare this series'))"
				@pointerdown.stop
				@click.stop="emit('compareSeries')">
				{{ seriesBadge.text }}<AppIcon v-if="seriesBadge.icon !== null" :name="seriesBadge.icon" />
			</button>
			<span v-if="props.selecting" class="photo-tile__check" aria-hidden="true"><AppIcon v-if="props.selected" name="check" /></span>
			<span v-if="marked" class="photo-tile__marks">
				<FlagMark v-if="isDecided(props.decision)" :flag="props.decision.flag" :class="`photo-tile__flag photo-tile__flag--${props.decision.flag}`" />
				<StarRating
					v-if="props.decision.rating > 0"
					readonly
					class="photo-tile__stars"
					:rating="props.decision.rating" />
				<span v-if="props.decision.colourLabel !== null" class="photo-tile__colour" :style="{ backgroundColor: COLOUR_LABEL_SWATCHES[props.decision.colourLabel] }" />
				<span v-if="props.tags > 0" class="photo-tile__tags" aria-hidden="true"><AppIcon name="tag" />{{ formatNumber(props.tags) }}</span>
				<span v-if="props.unsaved" class="photo-tile__unsaved" aria-hidden="true" />
			</span>
		</div>
		<button
			v-if="props.infoButton"
			type="button"
			class="photo-tile__info"
			data-tile-info-button
			tabindex="-1"
			:aria-label="t('honeycomb', 'Tile info')"
			@pointerdown.stop
			@click.stop="emit('info', ($event.currentTarget as HTMLElement).closest<HTMLElement>('.photo-tile')!)">
			<AppIcon name="info" />
		</button>
	</div>
</template>

<style src="../skeleton-tile.css" />

<style scoped src="./photo-tile.css" />
