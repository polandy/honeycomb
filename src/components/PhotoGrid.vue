<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Frame } from '../auto-scroll.ts'
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { FocusMove } from '../logic/grid-layout.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Schedule } from '../logic/long-press.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Selection } from '../logic/selection.ts'
import type { Tag } from '../logic/tag.ts'
import type { ObserveSize } from '../observe-size.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import PhotoTile from './PhotoTile.vue'
import { browserFrame } from '../auto-scroll.ts'
import { formatNumber } from '../l10n.ts'
import { autoScrollStep } from '../logic/auto-scroll.ts'
import { folderLabel } from '../logic/cull.ts'
import { UNDECIDED } from '../logic/decision.ts'
import { focusStep, gridLayout, revealScrollTop, rowOfItem, stickyHeader, tileAt, visibleRows } from '../logic/grid-layout.ts'
import { IMAGE_LOADS_IN_FLIGHT, imageMember } from '../logic/image-tiers.ts'
import { createLoadQueue } from '../logic/load-queue.ts'
import { groupByFolder as folderGroups } from '../logic/picture-order.ts'
import { NO_SELECTION } from '../logic/selection.ts'
import { pinchTileSize, wheelTileSize } from '../logic/tile-size.ts'
import { decodeSource } from '../loupe-prefetch.ts'
import { observeElementSize } from '../observe-size.ts'
import { browserSchedule, useTileSelection } from '../tile-selection.ts'

const props = withDefaults(defineProps<{
	/** The pictures in the grid's order. */
	pictures: readonly Picture<ListingEntry>[]
	folderSet: FolderSet
	groupByFolder: boolean
	/** The target tile size in CSS pixels. */
	tileSize: number
	observeSize?: ObserveSize
	imageUrl?: ImageUrlFor
	/** Resolves once the image at the URL is decoded, rejects if it cannot be. */
	loadImage?: (url: string) => Promise<void>
	selecting?: boolean
	/** The selected pictures by grid key, the file id of the member the tile shows. */
	selection?: Selection
	decisionOf?: (picture: Picture<ListingEntry>) => Decision
	/** The picture's tags, counted on its tile. */
	tagsOf?: (picture: Picture<ListingEntry>) => readonly Tag[]
	/** Times the long-press. */
	schedule?: Schedule
	/** Times the auto-scroll of a drag selection. */
	frame?: Frame
	seriesSizes?: ReadonlyMap<Picture<ListingEntry>, number>
}>(), {
	observeSize: observeElementSize,
	loadImage: decodeSource,
	selecting: false,
	selection: () => NO_SELECTION,
	decisionOf: () => UNDECIDED,
	tagsOf: () => [],
	schedule: browserSchedule,
	frame: browserFrame,
})

const emit = defineEmits<{
	'update:tileSize': [size: number]
	'update:selecting': [selecting: boolean]
	'update:selection': [selection: Selection]
	open: [index: number]
	/** The user scrolled the grid; a scroll it made itself does not count. */
	scroll: []
}>()

const GAP = 8
const HEADER_HEIGHT = 40

const scroller = useTemplateRef<HTMLElement>('scroller')
const spacer = useTemplateRef<HTMLElement>('spacer')
const width = ref(0)
const height = ref(0)
const scrollTop = ref(0)
const focused = ref(0)

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
}))
const loads = createLoadQueue(props.loadImage, IMAGE_LOADS_IN_FLIGHT)
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

/** Scrolls the grid by `step` within its ends; false when it is already at that end. */
function scrollBy(step: number): boolean {
	const next = Math.max(0, Math.min(layout.value.totalHeight - height.value, scrollTop.value + step))
	if (next === scrollTop.value) {
		return false
	}
	scroller.value!.scrollTop = scrollTop.value = next
	return true
}

const rendered = computed(() => {
	const overscan = Math.ceil(height.value / (layout.value.tileWidth + GAP))
	const { start, end } = visibleRows(layout.value, scrollTop.value, height.value, overscan)
	const shown = visibleRows(layout.value, scrollTop.value, height.value, 0)
	const rows = layout.value.rows.slice(start, end).map((row, offset) => ({ ...row, offscreen: start + offset < shown.start || start + offset >= shown.end }))
	const origin = tiles.dragOrigin.value
	const pinned = origin === null ? -1 : rowOfItem(layout.value, origin)
	// The drag's pressed tile stays in the DOM: a touch's events keep going to the element it started on.
	return pinned >= 0 && (pinned < start || pinned >= end) ? [...rows, { ...layout.value.rows[pinned]!, offscreen: true }] : rows
})

watch(() => props.pictures, () => {
	scroller.value!.scrollTop = 0
	scrollTop.value = 0
	focused.value = 0
})

/** The name a group's header shows. */
function groupName(group: number): string {
	return folderLabel(groups.value[group]!.folder, props.folderSet)
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

/** Resizes the tiles on a trackpad pinch, which arrives as a wheel event with Ctrl. */
function onWheel(event: WheelEvent) {
	if (event.ctrlKey) {
		event.preventDefault()
		emit('update:tileSize', wheelTileSize(props.tileSize, event.deltaY))
	}
}

let pinch: { size: number, distance: number } | null = null
const fingerDistance = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY)

/** Starts a two-finger pinch that resizes the tiles. */
function onTouchStart(event: TouchEvent) {
	if (event.touches.length === 2) {
		pinch = { size: props.tileSize, distance: fingerDistance(event.touches) }
	}
}

/** Resizes the tiles while the pinch lasts. */
function onTouchMove(event: TouchEvent) {
	if (tiles.dragOrigin.value !== null) {
		event.preventDefault()
	} else if (pinch !== null && event.touches.length === 2) {
		event.preventDefault()
		emit('update:tileSize', pinchTileSize(pinch.size, pinch.distance, fingerDistance(event.touches)))
	}
}

/** Ends the pinch when fewer than two fingers remain. */
function onTouchEnd(event: TouchEvent) {
	if (event.touches.length < 2) {
		pinch = null
	}
}

let stopObserving = () => undefined as void
onMounted(() => {
	const element = scroller.value!
	stopObserving = props.observeSize(element, (newWidth, newHeight) => {
		width.value = newWidth
		height.value = newHeight
	})
	element.addEventListener('wheel', onWheel, { passive: false })
	element.addEventListener('touchmove', onTouchMove, { passive: false })
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
})
</script>

<template>
	<div class="photo-grid">
		<div v-if="sticky !== null" class="photo-grid__sticky" aria-hidden="true">
			{{ groupName(sticky) }}
		</div>
		<div
			ref="scroller"
			class="photo-grid__scroller"
			role="grid"
			:aria-label="t('honeycomb', 'Photos')"
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
						<PhotoTile
							v-for="{ picture, index, column } in rowPictures(row.first, row.count)"
							:key="imageMember(picture).fileId"
							role="gridcell"
							class="photo-grid__tile"
							:tabindex="index === focused ? 0 : -1"
							:style="{ left: `${column * (layout.tileWidth + GAP)}px`, width: `${layout.tileWidth}px` }"
							:picture="picture"
							:size="layout.tileWidth"
							:decision="props.decisionOf(picture)"
							:tags="props.tagsOf(picture).length"
							:selecting="props.selecting"
							:selected="props.selection.ids.has(imageMember(picture).fileId)"
							:loads="loads"
							:offscreen="row.offscreen"
							v-bind="{ ...(props.imageUrl && { imageUrl: props.imageUrl }), series: props.seriesSizes?.get(picture) ?? 0 }"
							@focus="focused = index"
							@click="tiles.onClick(imageMember(picture).fileId, $event)"
							@keydown="tiles.onKeydown(imageMember(picture).fileId, $event)"
							@pointerdown="tiles.onPointerDown(imageMember(picture).fileId, $event)" />
					</div>
				</template>
			</div>
		</div>
	</div>
</template>

<style scoped src="./photo-grid.css" />
