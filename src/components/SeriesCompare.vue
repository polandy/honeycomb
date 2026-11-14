<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Decision } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import ConfirmDialog from './ConfirmDialog.vue'
import FlagButtons from './FlagButtons.vue'
import FlagMark from './FlagMark.vue'
import PickRestButton from './PickRestButton.vue'
import StarRating from './StarRating.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { gridSrcset, imageMember, smallSource } from '../logic/image-tiers.ts'
import { SERIES_GAP_SECONDS } from '../logic/series.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	/** The shown series, or null once none is left. */
	series: readonly Picture<ListingEntry>[] | null
	/** The shown series' place among `count`, from 0. */
	position: number
	count: number
	/** The active picture's place in the series. */
	active: number
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	imageUrl?: ImageUrlFor
}>(), { imageUrl: apiImageUrl })

const emit = defineEmits<{
	decide: [intent: DecisionIntent, picture: Picture<ListingEntry>]
	pickRest: [picture: Picture<ListingEntry>]
	view: [index: number]
	skip: []
	close: []
}>()

const title = computed(() => (props.series === null
	? t('honeycomb', 'Compare series')
	: t('honeycomb', 'Compare series {i} of {count} · photo {photo} of {photos}', {
			i: formatNumber(props.position + 1),
			count: formatNumber(props.count),
			photo: formatNumber(props.active + 1),
			photos: formatNumber(props.series.length),
		}, undefined, PLAIN_TEXT)))
const row = useTemplateRef<HTMLUListElement>('row')
// A long series scrolls sideways; keys and the closing viewer move the active card (SERIES-001.21).
/** Scrolls the active card into view. */
function showActive() {
	row.value?.children[props.active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
onMounted(showActive)
watch([() => props.active, () => props.series], showActive, { flush: 'post' })

/** The picture's flag, or null while it is unflagged. */
function flaggedOf(picture: Picture<ListingEntry>) {
	const { flag } = props.decisionOf(picture)
	return flag === 'unflagged' ? null : flag
}
</script>

<template>
	<ConfirmDialog
		class="series-compare-dialog"
		:title="title"
		:confirmLabel="props.series === null ? t('honeycomb', 'Close') : t('honeycomb', 'Skip')"
		:cancel="props.series !== null"
		:secondary="props.series !== null"
		:cancelLabel="t('honeycomb', 'Close')"
		wide
		@cancel="emit('close')"
		@confirm="props.series === null ? emit('close') : emit('skip')">
		<NcEmptyContent
			v-if="props.series === null"
			:name="t('honeycomb', 'All series compared')"
			:description="n('honeycomb', 'No more photos taken within {count} second of each other are left to decide.', 'No more photos taken within {count} seconds of each other are left to decide.', SERIES_GAP_SECONDS, { count: formatNumber(SERIES_GAP_SECONDS) }, PLAIN_TEXT)" />
		<template v-else>
			<p class="series-compare__hint">
				{{ t('honeycomb', 'Tap a photo to open the series fullscreen, or decide right here.') }}
			</p>
			<ul
				ref="row"
				class="series-compare"
				:class="`series-compare--${props.series.length}`"
				:style="{ '--series-compare-count': props.series.length }">
				<li v-for="(picture, index) in props.series" :key="imageMember(picture).fileId" class="series-compare__card">
					<button
						type="button"
						class="series-compare__photo"
						:class="{ 'series-compare__photo--active': index === props.active }"
						:aria-pressed="index === props.active"
						:aria-label="t('honeycomb', 'Open photo {i}: {name}', { i: formatNumber(index + 1), name: picture.baseName }, undefined, PLAIN_TEXT)"
						v-bind="tip(t('honeycomb', 'Open in the series viewer'))"
						@click="emit('view', index)">
						<img
							:src="smallSource(imageMember(picture), props.imageUrl)"
							:srcset="gridSrcset(imageMember(picture), props.imageUrl)"
							sizes="(max-width: 700px) 50vw, 25vw"
							alt="">
						<span class="series-compare__name">{{ formatNumber(index + 1) }} · {{ picture.baseName }}</span>
						<span class="series-compare__state">
							<StarRating :rating="props.decisionOf(picture).rating" readonly />
							<FlagMark v-if="flaggedOf(picture) !== null" :flag="flaggedOf(picture)!" />
						</span>
					</button>
					<FlagButtons :flag="props.decisionOf(picture).flag" @flag="emit('decide', { kind: 'flag', flag: $event }, picture)" />
					<PickRestButton :secondary="index !== props.active" @pick="emit('pickRest', picture)" />
				</li>
			</ul>
		</template>
	</ConfirmDialog>
</template>

<style scoped>
.series-compare__hint {
	margin-top: 0;
	color: var(--color-text-maxcontrast);
}

.series-compare {
	/* The dialog's height (NcModal's large size) and what it holds beside one row of photos. */
	--series-compare-room: min(90dvh, 100dvh - 2 * var(--header-height, 50px) - 2 * var(--body-container-margin, 8px));
	--series-compare-chrome: 300px;
	--series-compare-photo-height: calc(var(--series-compare-room) - var(--series-compare-chrome));
	/* Narrower cards would squeeze the flag buttons; a longer series scrolls instead. */
	--series-compare-card-min: 180px;
	--series-compare-gap: 8px;
	display: grid;
	grid-auto-columns: max(var(--series-compare-card-min), (100% - (var(--series-compare-count) - 1) * var(--series-compare-gap)) / var(--series-compare-count));
	grid-auto-flow: column;
	gap: var(--series-compare-gap);
	margin: 0;
	padding: 0;
	overflow-x: auto;
	scroll-snap-type: x proximity;
	list-style: none;
}

@media (max-width: 700px) {
	.series-compare {
		--series-compare-card-min: calc((100% - var(--series-compare-gap)) / 2);
	}

	.series-compare--3,
	.series-compare--4 {
		grid-template-columns: repeat(2, 1fr);
		grid-auto-flow: row;
		--series-compare-photo-height: calc((var(--series-compare-room) - var(--series-compare-chrome)) / 2 - 90px);
	}
}

.series-compare__card {
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-width: 0;
	scroll-snap-align: start;
	container: card / inline-size;
}

.series-compare__card :deep(.pick-rest-button .button-vue__text) {
	line-height: 1.2;
	text-align: center;
	text-wrap: balance;
	white-space: normal;
}

@container card (max-width: 200px) {
	.series-compare__card :deep(.pick-rest-button) {
		padding-inline: calc(2 * var(--default-grid-baseline));
	}

	.series-compare__card :deep(.pick-rest-button .button-vue__icon) {
		display: none;
	}
}

.series-compare__photo {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 4px;
	border: 2px solid transparent;
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
	color: var(--color-main-text);
	text-align: start;
	cursor: pointer;
}

.series-compare__photo--active {
	border-color: var(--color-primary-element);
}

.series-compare__photo img {
	width: 100%;
	/* As high as the room allows, no higher than a 2:3 portrait photo at the card's width. */
	height: min(150cqi, max(96px, var(--series-compare-photo-height)));
	object-fit: contain;
}

.series-compare__name {
	overflow: hidden;
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.series-compare__state {
	display: flex;
	align-items: center;
	gap: 6px;
	min-height: 24px;
}
</style>

<style>
/* Unscoped: NcDialog teleports the dialog; wider than its large size so the photos can grow, above ConfirmDialog's phone sheet. */
@media (min-width: 521px) {
	.confirm-dialog.series-compare-dialog.modal-mask .modal-wrapper .modal-container {
		width: 1400px;
	}
}
</style>
