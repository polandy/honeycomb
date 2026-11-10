<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { FocusMove } from '../logic/grid-layout.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Schedule } from '../logic/long-press.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Selection } from '../logic/selection.ts'
import type { ObserveSize } from '../observe-size.ts'

import { t } from '@nextcloud/l10n'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import PhotoTile from './PhotoTile.vue'
import { formatNumber } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { UNDECIDED } from '../logic/decision.ts'
import { focusStep, gridLayout, revealScrollTop, stickyHeader, visibleRows } from '../logic/grid-layout.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { groupByFolder as folderGroups } from '../logic/picture-order.ts'
import { NO_SELECTION } from '../logic/selection.ts'
import { pinchTileSize, wheelTileSize } from '../logic/tile-size.ts'
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
	loadImage?: (srcset: string, sizes: string) => Promise<void>
	selecting?: boolean
	/** The selected pictures by grid key, the file id of the member the tile shows. */
	selection?: Selection
	decisionOf?: (picture: Picture<ListingEntry>) => Decision
	/** Times the long-press. */
	schedule?: Schedule
}>(), {
	observeSize: observeElementSize,
	selecting: false,
	selection: () => NO_SELECTION,
	decisionOf: () => UNDECIDED,
	schedule: browserSchedule,
})

const emit = defineEmits<{
	'update:tileSize': [size: number]
	'update:selecting': [selecting: boolean]
	'update:selection': [selection: Selection]
	open: [index: number]
}>()

const GAP = 8
const HEADER_HEIGHT = 40

const scroller = useTemplateRef<HTMLElement>('scroller')
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
const rendered = computed(() => {
	const overscan = Math.ceil(height.value / (layout.value.tileWidth + GAP))
	const { start, end } = visibleRows(layout.value, scrollTop.value, height.value, overscan)
	return layout.value.rows.slice(start, end)
})
const sticky = computed(() => stickyHeader(layout.value, scrollTop.value))
const order = computed(() => props.pictures.map((picture) => imageMember(picture).fileId))
const tiles = useTileSelection({
	selecting: () => props.selecting,
	selection: () => props.selection,
	order: () => order.value,
	select: (selection) => emit('update:selection', selection),
	enterSelecting: () => emit('update:selecting', true),
	open: (id) => emit('open', order.value.indexOf(id)),
}, props.schedule)

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

/** Follows the scroll position for the rendered rows. */
function onScroll(event: Event) {
	scrollTop.value = (event.target as HTMLElement).scrollTop
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
	if (pinch !== null && event.touches.length === 2) {
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
			@contextmenu.prevent>
			<div class="photo-grid__spacer" :style="{ height: `${layout.totalHeight}px` }">
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
							:selecting="props.selecting"
							:selected="props.selection.ids.has(imageMember(picture).fileId)"
							v-bind="{ ...(props.imageUrl && { imageUrl: props.imageUrl }), ...(props.loadImage && { loadImage: props.loadImage }) }"
							@focus="focused = index"
							@click="tiles.onClick(imageMember(picture).fileId, $event)"
							@keydown="tiles.onKeydown(imageMember(picture).fileId, $event)"
							@pointerdown="tiles.onPointerDown(imageMember(picture).fileId, $event)"
							@pointermove="tiles.onPointerMove"
							@pointerup="tiles.onPointerEnd"
							@pointercancel="tiles.onPointerEnd" />
					</div>
				</template>
			</div>
		</div>
	</div>
</template>

<style scoped>
.photo-grid {
	position: relative;
	height: 100%;
	min-height: 0;
}

.photo-grid__scroller {
	height: 100%;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding: 0 var(--default-grid-baseline);
	-webkit-user-select: none;
	user-select: none;
}

.photo-grid__spacer {
	position: relative;
}

.photo-grid__header,
.photo-grid__sticky {
	display: flex;
	align-items: center;
	gap: calc(2 * var(--default-grid-baseline));
	padding: 0 var(--default-grid-baseline);
	font-weight: bold;
}

.photo-grid__header {
	position: absolute;
	inset-inline: 0;
}

.photo-grid__header small {
	color: var(--color-text-maxcontrast);
	font-weight: normal;
}

.photo-grid__sticky {
	position: absolute;
	z-index: 1;
	top: 0;
	inset-inline: 0;
	height: 40px;
	background-color: var(--color-main-background);
}

.photo-grid__row {
	position: absolute;
	inset-inline: 0;
}

.photo-grid__tile {
	position: absolute;
	top: 0;
	height: 100%;
}

.photo-grid__tile:focus-visible {
	outline: 2px solid var(--color-primary-element);
	outline-offset: 2px;
}
</style>
