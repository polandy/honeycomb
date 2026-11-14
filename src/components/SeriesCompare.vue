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
import PickRestButton from './PickRestButton.vue'
import SeriesCompareCard from './SeriesCompareCard.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { CARD_FRAME, CARD_GAP, compareGrid } from '../logic/compare-grid.ts'
import { doubleTaps } from '../logic/double-tap.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { SERIES_GAP_SECONDS } from '../logic/series.ts'
import { observeElementSize } from '../observe-size.ts'

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
	/** The clock that times a double tap, in ms. */
	now?: () => number
}>(), { imageUrl: apiImageUrl, observeSize: observeElementSize, now: () => performance.now() })

const emit = defineEmits<{
	decide: [intent: DecisionIntent, picture: Picture<ListingEntry>]
	pickRest: [picture: Picture<ListingEntry>]
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
			<SeriesCompareCard
				v-for="(picture, index) in props.series"
				:key="imageMember(picture).fileId"
				:picture="picture"
				:index="index"
				:active="index === props.active"
				:decision="props.decisionOf(picture)"
				:imageUrl="props.imageUrl"
				:photoWidth="photoWidth"
				@tap="onPhotoTap(index, $event)"
				@view="emit('view', index)"
				@flag="emit('decide', { kind: 'flag', flag: $event }, picture)" />
		</ul>
		<template #actions>
			<div class="series-compare__bar">
				<template v-if="props.series !== null">
					<p class="series-compare__hint">
						{{ t('honeycomb', 'Tap a photo to make it active, double-tap it or press ⤢ to view it full screen, or decide right here.') }}
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
