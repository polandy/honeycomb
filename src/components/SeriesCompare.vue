<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { QualityOf } from '../hashes/quality-of.ts'
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Decision } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Series } from '../logic/series.ts'
import type { MergeDirection } from '../series/series-compare.ts'
import type { ObserveSize } from '../shared/observe-size.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import ModalPanel from './ModalPanel.vue'
import PickRestButton from './PickRestButton.vue'
import SeriesCompareCard from './SeriesCompareCard.vue'
import SeriesCompareMenu from './SeriesCompareMenu.vue'
import { imageUrl as apiImageUrl } from '../api/index.ts'
import { sharpestPicture } from '../hashes/quality-of.ts'
import { CARD_FRAME, CARD_GAP, compareGrid } from '../logic/compare-grid.ts'
import { doubleTaps } from '../logic/double-tap.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { SERIES_GAP_SECONDS } from '../logic/series.ts'
import { seriesSubtitle } from '../series/series-subtitle.ts'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'
import { observeElementSize } from '../shared/observe-size.ts'

const props = withDefaults(defineProps<{
	/** The shown series, or null once none is left. */
	series: Series<Picture<ListingEntry>> | null
	/** The shown series' place among `count`, from 0. */
	position: number
	count: number
	/** The active picture's place in the series. */
	active: number
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	imageUrl?: ImageUrlFor
	observeSize?: ObserveSize
	/** The clock that times a double tap, in ms. */
	now?: () => number
	/** Opened from the loupe on this one series, without *Skip* (SERIES-001.24). */
	oneSeries?: boolean
	/** Where the dialog mounts: inside the loupe when opened from it. */
	container?: string
	/** The series before and after the shown one, which its title row's menu merges with (SERIES-005.8). */
	previous?: Series<Picture<ListingEntry>> | null
	next?: Series<Picture<ListingEntry>> | null
	/** The members' quality values, which mark the sharpest card (SERIES-007.1). */
	qualityOf?: QualityOf
}>(), { previous: null, next: null, qualityOf: () => null, imageUrl: apiImageUrl, observeSize: observeElementSize, now: () => performance.now(), oneSeries: false, container: 'body' })

const emit = defineEmits<{
	decide: [intent: DecisionIntent, picture: Picture<ListingEntry>]
	pickRest: [picture: Picture<ListingEntry>]
	/** *Remove from this series* in a card's menu (SERIES-005.10). */
	remove: [picture: Picture<ListingEntry>]
	/** *Dissolve this series* in the title row's menu (SERIES-005.13). */
	dissolve: []
	/** Marks the shown series done, or reopens it when false (SERIES-005.14, .15). */
	markDone: [done: boolean]
	/** *Merge with the next* or *previous series* in the title row's menu (SERIES-005.8). */
	merge: [direction: MergeDirection]
	/** A single tap made the card at `index` active. */
	activate: [index: number]
	view: [index: number]
	/** The grid's column count, which `↑` `↓` step by. */
	columns: [count: number]
	skip: []
	close: []
}>()

const title = computed(() => (props.series === null
	? t('honeycomb', 'Compare series')
	: props.oneSeries
		? t('honeycomb', 'Series of {photos} · photo {photo}', { photos: formatNumber(props.series.members.length), photo: formatNumber(props.active + 1) }, undefined, PLAIN_TEXT)
		: t('honeycomb', 'Compare series {i} of {count} · photo {photo} of {photos}', {
				i: formatNumber(props.position + 1),
				count: formatNumber(props.count),
				photo: formatNumber(props.active + 1),
				photos: formatNumber(props.series.members.length),
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
const layout = computed(() => (area.value === null || props.series === null ? null : compareGrid({ count: props.series.members.length, ...area.value })))
const sharpest = computed(() => (props.series === null ? null : sharpestPicture(props.series.members, props.qualityOf)))
const photoWidth = computed(() => (layout.value === null ? null : Math.floor(layout.value.photoWidth)))
const gridStyle = computed(() => (layout.value === null || photoWidth.value === null
	? { '--series-compare-gap': `${CARD_GAP}px` }
	: {
			'--series-compare-gap': `${CARD_GAP}px`,
			'--series-compare-photo-width': `${photoWidth.value}px`,
			gridTemplateColumns: `repeat(${layout.value.columns}, ${photoWidth.value + CARD_FRAME}px)`,
		}))
watch(() => layout.value?.columns, (columns) => columns !== undefined && emit('columns', columns))

const photoAt = (index: number) => grid.value?.children[index]?.querySelector<HTMLElement>('.series-compare__photo')

/** Scrolls the active card into view, its photo taking focus from another card's (SERIES-001.21, SERIES-001.23). */
function showActive() {
	grid.value?.children[props.active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
	if (document.activeElement?.matches('.series-compare__photo')) {
		photoAt(props.active)?.focus({ preventScroll: true })
	}
}
// The focus trap keeps focus that is already inside; else it focuses card 1 and scrolls back to it.
onMounted(() => photoAt(props.active)?.focus({ preventScroll: true }))
// NcModal closes on any Escape while it tops the focus trap stack, and a menu adds no trap of its own.
const openMenus = shallowRef(0)
/** Counts the open menus, so that Escape in one closes only the menu. */
function onMenuOpen(open: boolean) {
	openMenus.value += open ? 1 : -1
}
watch([() => props.active, () => props.series, () => layout.value?.columns], showActive, { flush: 'post' })

const taps = doubleTaps()

/** A tap makes the card active, its second tap of a double tap opens the viewer (SERIES-001.23). */
function onPhotoTap(index: number, event: MouseEvent) {
	if (taps.tap({ time: props.now(), x: event.clientX, y: event.clientY, target: index })) {
		emit('view', index)
	} else {
		emit('activate', index)
	}
}

/** Picks the active picture and rejects the rest (SERIES-001.9). */
function pickActive() {
	const picture = props.series?.members[props.active]
	if (picture !== undefined) {
		emit('pickRest', picture)
	}
}
</script>

<template>
	<ModalPanel
		class="series-compare-dialog"
		:title="title"
		size="full"
		:container="props.container"
		:locked="openMenus > 0"
		@close="emit('close')">
		<NcEmptyContent
			v-if="props.series === null"
			:name="t('honeycomb', 'All series compared')"
			:description="n('honeycomb', 'No more photos taken within {count} second of each other are left to decide.', 'No more photos taken within {count} seconds of each other are left to decide.', SERIES_GAP_SECONDS, { count: formatNumber(SERIES_GAP_SECONDS) }, PLAIN_TEXT)" />
		<div v-if="props.series !== null" class="series-compare__head">
			<p class="series-compare__subtitle">
				{{ seriesSubtitle(props.series) }}
			</p>
			<SeriesCompareMenu
				:series="props.series"
				:previous="props.previous"
				:next="props.next"
				:container="props.container"
				@merge="emit('merge', $event)"
				@dissolve="emit('dissolve')"
				@markDone="emit('markDone', $event)"
				@menu="onMenuOpen" />
		</div>
		<ul
			v-if="props.series !== null"
			ref="grid"
			class="series-compare"
			:style="gridStyle">
			<SeriesCompareCard
				v-for="(picture, index) in props.series.members"
				:key="imageMember(picture).fileId"
				:picture="picture"
				:index="index"
				:active="index === props.active"
				:sharpest="picture === sharpest"
				:decision="props.decisionOf(picture)"
				:imageUrl="props.imageUrl"
				:photoWidth="photoWidth"
				:container="props.container"
				@tap="onPhotoTap(index, $event)"
				@view="emit('view', index)"
				@remove="emit('remove', picture)"
				@menu="onMenuOpen"
				@flag="emit('decide', { kind: 'flag', flag: $event }, picture)" />
		</ul>
		<template #actions>
			<div class="series-compare__bar">
				<template v-if="props.series !== null">
					<p class="series-compare__hint">
						{{ t('honeycomb', 'Tap a photo to make it active, double-tap it or press ⤢ to view it full screen, or decide right here.') }}
					</p>
					<NcButton v-if="!props.oneSeries" variant="secondary" @click="emit('skip')">
						{{ t('honeycomb', 'Skip') }}
					</NcButton>
					<PickRestButton @pick="pickActive" />
				</template>
				<NcButton v-else variant="primary" @click="emit('close')">
					{{ t('honeycomb', 'Close') }}
				</NcButton>
			</div>
		</template>
	</ModalPanel>
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

.series-compare__head {
	display: flex;
	align-items: center;
	height: var(--default-clickable-area);
}

.series-compare__subtitle {
	flex: 1;
	min-width: 0;
	margin: 0;
	overflow: hidden;
	color: var(--color-text-maxcontrast);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.series-compare__head + .series-compare {
	height: calc(100% - var(--default-clickable-area));
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

/* A phone either way round, as in the grid sizing rule's PHONE_SIDE. */
@media (max-width: 520px), (max-height: 520px) {
	.series-compare__hint {
		display: none;
	}
}
</style>
