<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script lang="ts">
/** Calls `onSize` with the element's content size now and on every change; returns the stop function. */
function observeElementSize(element: Element, onSize: (width: number, height: number) => void): () => void {
	const observer = new ResizeObserver(([entry]) => entry && onSize(entry.contentRect.width, entry.contentRect.height))
	observer.observe(element)
	return () => observer.disconnect()
}
</script>

<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import PhotoTile from './PhotoTile.vue'
import { formatNumber } from '../l10n.ts'
import { folderLabel } from '../logic/cull.ts'
import { gridLayout, stickyHeader, visibleRows } from '../logic/grid-layout.ts'
import { imageMember } from '../logic/image-tiers.ts'
import { groupByFolder as folderGroups } from '../logic/picture-order.ts'
import { pinchTileSize, wheelTileSize } from '../logic/tile-size.ts'

const props = withDefaults(defineProps<{
	/** The pictures in the grid's order. */
	pictures: readonly Picture<ListingEntry>[]
	folderSet: FolderSet
	groupByFolder: boolean
	/** The target tile size in CSS pixels. */
	tileSize: number
	observeSize?: (element: Element, onSize: (width: number, height: number) => void) => () => void
	imageUrl?: ImageUrlFor
	loadImage?: (srcset: string, sizes: string) => Promise<void>
}>(), {
	observeSize: observeElementSize,
})

const emit = defineEmits<{
	'update:tileSize': [size: number]
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

/**
 *
 */
function onScroll(event: Event) {
	scrollTop.value = (event.target as HTMLElement).scrollTop
}

/**
 *
 */
function onWheel(event: WheelEvent) {
	if (event.ctrlKey) {
		event.preventDefault()
		emit('update:tileSize', wheelTileSize(props.tileSize, event.deltaY))
	}
}

let pinch: { size: number, distance: number } | null = null
const fingerDistance = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY)

/**
 *
 */
function onTouchStart(event: TouchEvent) {
	if (event.touches.length === 2) {
		pinch = { size: props.tileSize, distance: fingerDistance(event.touches) }
	}
}

/**
 *
 */
function onTouchMove(event: TouchEvent) {
	if (pinch !== null && event.touches.length === 2) {
		event.preventDefault()
		emit('update:tileSize', pinchTileSize(pinch.size, pinch.distance, fingerDistance(event.touches)))
	}
}

/**
 *
 */
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
			@touchcancel.passive="onTouchEnd">
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
							v-bind="{ ...(props.imageUrl && { imageUrl: props.imageUrl }), ...(props.loadImage && { loadImage: props.loadImage }) }"
							@focus="focused = index" />
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
