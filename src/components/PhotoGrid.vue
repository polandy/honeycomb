<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FocusMove } from '../logic/grid-layout.ts'
import type { PhotoGridEmits, PhotoGridProps } from '../photo-grid-props.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useSlots, useTemplateRef, watch } from 'vue'
import PhotoTile from './PhotoTile.vue'
import SeriesBrackets from './SeriesBrackets.vue'
import TileInfo from './TileInfo.vue'
import { browserFrame } from '../auto-scroll.ts'
import { browserSchedule } from '../browser-schedule.ts'
import { useGridPinch } from '../grid-pinch.ts'
import { useGridSeries } from '../grid-series.ts'
import { formatNumber } from '../l10n.ts'
import { logger } from '../logger.ts'
import { isAppended } from '../logic/appended.ts'
import { autoScrollStep } from '../logic/auto-scroll.ts'
import { folderLabel } from '../logic/cull.ts'
import { UNDECIDED } from '../logic/decision.ts'
import { anchoredScrollTop, focusStep, gridLayout, renderedRows, revealScrollTop, stickyHeader, tileAt } from '../logic/grid-layout.ts'
import { IMAGE_LOADS_IN_FLIGHT, imageMember } from '../logic/image-tiers.ts'
import { createLoadQueue } from '../logic/load-queue.ts'
import { groupByFolder as folderGroups } from '../logic/picture-order.ts'
import { NO_SELECTION } from '../logic/selection.ts'
import { decodeSource } from '../loupe-prefetch.ts'
import { observeElementSize } from '../observe-size.ts'
import { useTileInfo } from '../tile-info.ts'
import { useTileSelection } from '../tile-selection.ts'

const props = withDefaults(defineProps<PhotoGridProps>(), {
	observeSize: observeElementSize,
	loadImage: decodeSource,
	selecting: false,
	selection: () => NO_SELECTION,
	decisionOf: () => UNDECIDED,
	tagsOf: () => [],
	readOnly: () => false,
	unsaved: null,
	busy: false,
	fileNames: false,
	touch: () => window.matchMedia('(pointer: coarse)').matches,
	schedule: browserSchedule,
	frame: browserFrame,
})
const emit = defineEmits<PhotoGridEmits>()

const GAP = 8
const HEADER_HEIGHT = 40
const OVERLAY_HEIGHT = 22
const NAME_BAR = 24

const scroller = useTemplateRef<HTMLElement>('scroller')
const spacer = useTemplateRef<HTMLElement>('spacer')
const width = ref(0)
const height = ref(0)
const scrollTop = ref(0)
const focused = ref(0)
// The overlay keeps its band free, and a gap below it holds the first row's series bracket.
const overlayHeight = useSlots().default === undefined ? 0 : OVERLAY_HEIGHT

const groups = computed(() => (props.groupByFolder
	? folderGroups(props.pictures)
	: [{ folder: '', start: 0, count: props.pictures.length }]))
const layout = computed(() => gridLayout({
	width: width.value,
	tileSize: props.tileSize,
	gap: GAP,
	headerHeight: HEADER_HEIGHT,
	groups: groups.value.map((group) => group.count),
	showHeaders: props.groupByFolder,
	top: overlayHeight + GAP,
	nameBar: props.fileNames ? NAME_BAR : 0,
}))
const series = useGridSeries({ pictures: () => props.pictures, seriesOf: () => props.seriesOf, offered: () => props.offeredSeries, open: () => props.openSeries, groupStarts: () => groups.value.map((group) => group.start) })
const loads = createLoadQueue(props.loadImage, IMAGE_LOADS_IN_FLIGHT, (error) => logger.error('A tile image callback failed', { error }))
const sticky = computed(() => stickyHeader(layout.value, scrollTop.value))
const order = computed(() => props.pictures.map((picture) => imageMember(picture).fileId))
const tiles = useTileSelection({
	selecting: () => props.selecting,
	selection: () => props.selection,
	order: () => order.value,
	select: (selection) => emit('update:selection', selection),
	enterSelecting: () => emit('update:selecting', true),
	open: (id) => emit('open', order.value.indexOf(id)),
	indexAt: (x, y) => tileAt(layout.value, GAP, x - spacer.value!.getBoundingClientRect().left, y - scroller.value!.getBoundingClientRect().top + scrollTop.value),
	stepAt: (y) => autoScrollStep(y - scroller.value!.getBoundingClientRect().top, height.value),
	scrollBy,
}, props.schedule, props.frame)

/** The tiles whose small preview failed, and how often each was asked to load it again (GRID-001.23). */
const failed = new Set<number>()
const retries = reactive(new Map<number, number>())

/** Loads a failed tile again, unless the click or key is for the selection or the tile is fine; true when it did. */
function retryFailed(id: number, event: MouseEvent | KeyboardEvent): boolean {
	if (props.selecting || !failed.has(id) || event.shiftKey || event.ctrlKey || event.metaKey) {
		return false
	}
	retries.set(id, (retries.get(id) ?? 0) + 1)
	return true
}

/** A tile's click: a retry of a failed preview, else the selection's or the loupe's. */
function onTileClick(id: number, event: MouseEvent): void {
	if (!retryFailed(id, event)) {
		tiles.onClick(id, event)
	}
}

/** A tile's Enter or Space: a retry of a failed preview, else the selection's or the loupe's. */
function onTileKeydown(id: number, event: KeyboardEvent): void {
	if ((event.key === 'Enter' || event.key === ' ') && retryFailed(id, event)) {
		event.preventDefault()
		return
	}
	tiles.onKeydown(id, event)
}

/** Records whether a tile's small preview failed. */
function markFailed(id: number, isFailed: boolean): void {
	failed[isFailed ? 'add' : 'delete'](id)
}

/** Scrolls the grid by `step` within its ends; false when it is already at that end. */
function scrollBy(step: number): boolean {
	const next = Math.max(0, Math.min(layout.value.totalHeight - height.value, scrollTop.value + step))
	if (next === scrollTop.value) {
		return false
	}
	scroller.value!.scrollTop = scrollTop.value = next
	return true
}

// The drag's pressed tile stays in the DOM: a touch's events keep going to the element it started on.
const rendered = computed(() => renderedRows(layout.value, scrollTop.value, height.value, Math.ceil(height.value / (layout.value.tileWidth + GAP)), tiles.dragOrigin.value))

watch(() => props.pictures, (next, previous) => {
	if (isAppended(previous, next)) {
		return
	}
	scroller.value!.scrollTop = 0
	scrollTop.value = 0
	focused.value = 0
})
watch(rendered, (rows) => {
	const last = rows.findLast((row) => row.kind === 'tiles')
	if (last?.kind === 'tiles') {
		emit('shown', last.first + last.count - 1)
	}
})

/** The name a group's header shows. */
function groupName(group: number): string {
	const { folder } = groups.value[group]!
	return props.folderSet === undefined ? folder : folderLabel(folder, props.folderSet)
}

/** The pictures of a tile row with their indexes. */
function rowPictures(first: number, count: number) {
	return props.pictures.slice(first, first + count).map((picture, column) => ({ picture, index: first + column, column }))
}

/** Follows the scroll position for the rendered rows; the grid's own scrolls already set it. */
function onScroll(event: Event) {
	const top = (event.target as HTMLElement).scrollTop
	if (top !== scrollTop.value) {
		scrollTop.value = top
		emit('scroll')
	}
}

const { onTouchStart, onTouchEnd } = useGridPinch({
	scroller: () => scroller.value,
	tileSize: () => props.tileSize,
	dragging: () => tiles.dragOrigin.value !== null,
	resize: (size) => emit('update:tileSize', size),
})
const { shown: info, toggle: toggleInfo } = useTileInfo(() => scroller.value, props.schedule)

// Toggling the name bars keeps the focused or the top tile in place (GRID-004.6).
watch([layout, () => props.fileNames], ([next, names], [previous, hadNames]) => {
	if (names !== hadNames) {
		const anchor = focused.value < props.pictures.length ? focused.value : null
		scroller.value!.scrollTop = scrollTop.value = anchoredScrollTop(previous, next, scrollTop.value, height.value, anchor)
	}
}, { flush: 'post' })

let stopObserving = () => undefined as void
onMounted(() => {
	const element = scroller.value!
	stopObserving = props.observeSize(element, (newWidth, newHeight) => {
		width.value = newWidth
		height.value = newHeight
	})
})
onBeforeUnmount(() => stopObserving())

/** Scrolls the tile at `index` into view and focuses it, as after closing the loupe. */
async function reveal(index: number) {
	scroller.value!.scrollTop = scrollTop.value = revealScrollTop(layout.value, index, scrollTop.value, height.value)
	focused.value = index
	await nextTick()
	scroller.value!.querySelector<HTMLElement>('[tabindex="0"]')!.focus()
}

defineExpose({
	reveal,
	/** The index of the tile that has, or last had, the focus. */
	focusedIndex: () => focused.value,
	/** Moves the focus one step, as an arrow, Home or End key does. */
	step: (move: FocusMove) => reveal(focusStep(layout.value, focused.value, move)),
	/** Moves the focus to the first photo of the previous or next series; it stays at either end (SERIES-002.15). */
	jumpSeries: (direction: 'previous' | 'next') => reveal(series.jump(focused.value, direction) ?? focused.value),
})
</script>

<template>
	<div class="photo-grid">
		<div class="photo-grid__overlay" :style="{ height: `${overlayHeight}px` }">
			<slot />
		</div>
		<div v-if="sticky !== null" class="photo-grid__sticky" aria-hidden="true">
			{{ groupName(sticky) }}
		</div>
		<div
			ref="scroller"
			class="photo-grid__scroller"
			role="grid"
			:aria-label="t('honeycomb', 'Photos')"
			:aria-busy="props.busy || undefined"
			@scroll.passive="onScroll"
			@touchstart.passive="onTouchStart"
			@touchend.passive="onTouchEnd"
			@touchcancel.passive="onTouchEnd"
			@pointermove="tiles.onPointerMove"
			@pointerup="tiles.onPointerEnd"
			@pointercancel="tiles.onPointerEnd"
			@contextmenu.prevent>
			<div ref="spacer" class="photo-grid__spacer" :style="{ height: `${layout.totalHeight}px` }">
				<template v-for="row in rendered" :key="row.kind === 'header' ? `header-${row.group}` : `row-${row.first}`">
					<div
						v-if="row.kind === 'header'"
						role="row"
						class="photo-grid__header"
						:style="{ top: `${row.top}px`, height: `${row.height}px` }">
						<span role="rowheader">{{ groupName(row.group) }}</span> <small>{{ formatNumber(groups[row.group]!.count) }}</small>
					</div>
					<div
						v-else
						role="row"
						class="photo-grid__row"
						:style="{ top: `${row.top}px`, height: `${row.height}px` }">
						<SeriesBrackets :brackets="series.brackets(row.first, row.count, layout.tileWidth + GAP, GAP)" />
						<PhotoTile
							v-for="{ picture, index, column } in rowPictures(row.first, row.count)"
							:key="imageMember(picture).fileId"
							role="gridcell"
							class="photo-grid__tile"
							:tabindex="index === focused ? 0 : -1"
							:style="{ left: `${column * (layout.tileWidth + GAP)}px`, width: `${layout.tileWidth}px` }"
							:data-index="index"
							:picture="picture"
							:size="layout.tileWidth"
							:nameBar="props.fileNames"
							:infoButton="props.fileNames && props.touch"
							:decision="props.decisionOf(picture)"
							:tags="props.tagsOf(picture).length"
							:unsaved="picture === props.unsaved"
							:readOnly="props.readOnly(picture)"
							:selecting="props.selecting"
							:selected="props.selection.ids.has(imageMember(picture).fileId)"
							:loads="loads"
							:offscreen="row.offscreen"
							v-bind="{ ...(props.imageUrl && { imageUrl: props.imageUrl }), ...series.tileProps(index, picture) }"
							:retry="retries.get(imageMember(picture).fileId) ?? 0"
							@focus="focused = index"
							@click="onTileClick(imageMember(picture).fileId, $event)"
							@keydown="onTileKeydown(imageMember(picture).fileId, $event)"
							@imageFailed="markFailed(imageMember(picture).fileId, $event)"
							@pointerdown="tiles.onPointerDown(imageMember(picture).fileId, $event)"
							@info="toggleInfo"
							@compareSeries="emit('compareSeries', props.seriesOf!.get(picture)!, picture)" />
					</div>
				</template>
			</div>
		</div>
		<TileInfo
			v-if="info !== null"
			:key="info.index"
			:picture="props.pictures[info.index]!"
			:decision="props.decisionOf(props.pictures[info.index]!)"
			:anchor="info.anchor" />
	</div>
</template>

<style scoped src="./photo-grid.css" />
