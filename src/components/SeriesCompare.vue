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
import type { ObserveSize } from '../observe-size.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import FlagButtons from './FlagButtons.vue'
import FlagMark from './FlagMark.vue'
import PickRestButton from './PickRestButton.vue'
import StarRating from './StarRating.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { CARD_FRAME, CARD_GAP, compareGrid } from '../logic/compare-grid.ts'
import { gridSrcset, imageMember, smallSource } from '../logic/image-tiers.ts'
import { SERIES_GAP_SECONDS } from '../logic/series.ts'
import { observeElementSize } from '../observe-size.ts'
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
	observeSize?: ObserveSize
}>(), { imageUrl: apiImageUrl, observeSize: observeElementSize })

const emit = defineEmits<{
	decide: [intent: DecisionIntent, picture: Picture<ListingEntry>]
	pickRest: [picture: Picture<ListingEntry>]
	view: [index: number]
	/** The grid's column count, which `↑` `↓` step by. */
	columns: [count: number]
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

const grid = useTemplateRef<HTMLUListElement>('grid')
const area = shallowRef<{ width: number, height: number } | null>(null)
watch(grid, (element, _, onCleanup) => {
	if (element !== null) {
		onCleanup(props.observeSize(element, (width, height) => {
			area.value = { width, height }
		}))
	}
}, { flush: 'post' })
const layout = computed(() => (area.value === null || props.series === null ? null : compareGrid({ count: props.series.length, ...area.value })))
const photoWidth = computed(() => (layout.value === null ? null : Math.floor(layout.value.photoWidth)))
const gridStyle = computed(() => (layout.value === null || photoWidth.value === null
	? { '--series-compare-gap': `${CARD_GAP}px` }
	: {
			'--series-compare-gap': `${CARD_GAP}px`,
			'--series-compare-photo-width': `${photoWidth.value}px`,
			gridTemplateColumns: `repeat(${layout.value.columns}, ${photoWidth.value + CARD_FRAME}px)`,
		}))
watch(() => layout.value?.columns, (columns) => columns !== undefined && emit('columns', columns))

/** Scrolls the active card into view; keys, the closing viewer and a new layout move it (SERIES-001.21). */
function showActive() {
	grid.value?.children[props.active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
// The focus trap keeps focus that is already inside; else it focuses card 1 and scrolls back to it.
onMounted(() => grid.value?.children[props.active]?.querySelector<HTMLElement>('.series-compare__photo')?.focus({ preventScroll: true }))
watch([() => props.active, () => props.series, () => layout.value?.columns], showActive, { flush: 'post' })

/** The picture's flag, or null while it is unflagged. */
function flaggedOf(picture: Picture<ListingEntry>) {
	const { flag } = props.decisionOf(picture)
	return flag === 'unflagged' ? null : flag
}

/** Picks the active picture and rejects the rest (SERIES-001.9). */
function pickActive() {
	const picture = props.series?.[props.active]
	if (picture !== undefined) {
		emit('pickRest', picture)
	}
}

/** Closing the dialog by its close button or Escape closes the compare. */
function onOpen(open: boolean) {
	if (!open) {
		emit('close')
	}
}
</script>

<template>
	<NcDialog
		class="series-compare-dialog"
		:name="title"
		size="full"
		container="body"
		@update:open="onOpen">
		<NcEmptyContent
			v-if="props.series === null"
			:name="t('honeycomb', 'All series compared')"
			:description="n('honeycomb', 'No more photos taken within {count} second of each other are left to decide.', 'No more photos taken within {count} seconds of each other are left to decide.', SERIES_GAP_SECONDS, { count: formatNumber(SERIES_GAP_SECONDS) }, PLAIN_TEXT)" />
		<ul
			v-else
			ref="grid"
			class="series-compare"
			:style="gridStyle">
			<li
				v-for="(picture, index) in props.series"
				:key="imageMember(picture).fileId"
				class="series-compare__card"
				:class="{ 'series-compare__card--active': index === props.active }">
				<button
					type="button"
					class="series-compare__photo"
					:aria-pressed="index === props.active"
					:aria-label="t('honeycomb', 'Open photo {i}: {name}', { i: formatNumber(index + 1), name: picture.baseName }, undefined, PLAIN_TEXT)"
					v-bind="tip(t('honeycomb', 'Open in the series viewer'))"
					@click="emit('view', index)">
					<img
						:src="smallSource(imageMember(picture), props.imageUrl)"
						:srcset="gridSrcset(imageMember(picture), props.imageUrl)"
						:sizes="photoWidth === null ? '33vw' : `${photoWidth}px`"
						alt="">
				</button>
				<span class="series-compare__label">
					<span class="series-compare__name">{{ formatNumber(index + 1) }} · {{ picture.baseName }}</span>
					<StarRating :rating="props.decisionOf(picture).rating" readonly />
					<FlagMark v-if="flaggedOf(picture) !== null" :flag="flaggedOf(picture)!" />
				</span>
				<FlagButtons :flag="props.decisionOf(picture).flag" @flag="emit('decide', { kind: 'flag', flag: $event }, picture)" />
			</li>
		</ul>
		<template #actions>
			<div class="series-compare__bar">
				<template v-if="props.series !== null">
					<p class="series-compare__hint">
						{{ t('honeycomb', 'Tap a photo to open the series fullscreen, or decide right here.') }}
					</p>
					<NcButton variant="secondary" @click="emit('skip')">
						{{ t('honeycomb', 'Skip') }}
					</NcButton>
					<PickRestButton @pick="pickActive" />
				</template>
				<NcButton v-else variant="primary" @click="emit('close')">
					{{ t('honeycomb', 'Close') }}
				</NcButton>
			</div>
		</template>
	</NcDialog>
</template>

<style scoped>
.series-compare {
	box-sizing: border-box;
	display: grid;
	/* Until the first measure; then the grid sizing rule sets the columns. */
	grid-template-columns: repeat(auto-fill, minmax(232px, 1fr));
	align-content: center;
	justify-content: center;
	gap: var(--series-compare-gap);
	height: 100%;
	margin: 0;
	padding: 0;
	overflow: hidden auto;
	scrollbar-gutter: stable;
	list-style: none;
}

/* Border and padding make up CARD_FRAME; with the label row and the flag buttons, CARD_CHROME_HEIGHT. */
.series-compare__card {
	display: flex;
	flex-direction: column;
	gap: 4px;
	min-width: 0;
	padding: 4px;
	border: 2px solid transparent;
	border-radius: var(--border-radius-element);
	background: var(--color-background-dark);
}

.series-compare__card--active {
	border-color: var(--color-primary-element);
}

.series-compare__photo {
	display: block;
	padding: 0;
	border: 0;
	background: none;
	cursor: pointer;
}

.series-compare__photo img {
	display: block;
	width: var(--series-compare-photo-width, 100%);
	aspect-ratio: 3 / 2;
	object-fit: contain;
}

.series-compare__label {
	display: flex;
	align-items: center;
	gap: 6px;
	min-height: 24px;
	color: var(--color-main-text);
}

.series-compare__name {
	flex: 1;
	overflow: hidden;
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.series-compare__bar {
	display: flex;
	flex: 1;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
}

.series-compare__hint {
	flex: 1;
	margin: 0;
	color: var(--color-text-maxcontrast);
}

.series-compare__bar :deep(.pick-rest-button) {
	width: auto;
	min-width: 0;
}

.series-compare__bar :deep(.pick-rest-button .button-vue__text) {
	line-height: 1.2;
	text-align: center;
	text-wrap: balance;
	white-space: normal;
}

@media (max-width: 520px) {
	.series-compare__hint {
		display: none;
	}
}
</style>
