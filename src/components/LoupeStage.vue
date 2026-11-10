<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { GestureAction, GesturePointer, SwipeDirection } from '../logic/loupe-gesture.ts'
import type { PinchCentre, Size, Zoom } from '../logic/loupe-zoom.ts'
import type { Picture } from '../logic/pairing.ts'
import type { ObserveSize } from '../observe-size.ts'

import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue'
import { fullLongEdge, imageMember, loupeSources } from '../logic/image-tiers.ts'
import { loupeGestures } from '../logic/loupe-gesture.ts'
import { FIT, fitSize, fullScale, isZoomed, panBy, pinchZoom, toggleZoom, zoomPercent } from '../logic/loupe-zoom.ts'

const props = defineProps<{
	pictures: readonly Picture<ListingEntry>[]
	index: number
	imageUrl: ImageUrlFor
	/** Loads a source once; the loupe's prefetch shares it. */
	load: (src: string) => Promise<void>
	/** The sources that have loaded. */
	ready: ReadonlySet<string>
	devicePixelRatio: number
	observeSize: ObserveSize
}>()

const emit = defineEmits<{
	page: [step: -1 | 1]
	overlays: []
	chromeFree: []
	swipe: [direction: SwipeDirection]
	/** The zoom in percent of the full image, null when fitted. */
	'update:zoom': [percent: number | null]
}>()

/** The aspect a photo is drawn at before its size is known. */
const DEFAULT_ASPECT = 3 / 2

const stage = useTemplateRef<HTMLElement>('stage')
const size = ref<Size>({ width: 0, height: 0 })
const zoom = ref<Zoom>(FIT)
const dragX = ref(0)
const liftY = ref(0)
/** Aspects learnt from loaded images whose listing had no size, by file id. */
const aspects = reactive(new Map<number, number>())

const member = computed(() => imageMember(props.pictures[props.index]!))
const sources = computed(() => loupeSources(member.value, props.imageUrl))
const fitted = computed(() => fitSize(aspectOf(member.value), size.value))
const maxScale = computed(() => fullScale(fullLongEdge(member.value), fitted.value, props.devicePixelRatio))
const zoomed = computed(() => isZoomed(zoom.value))
const slides = computed(() => [-1, 0, 1]
	.filter((offset) => props.pictures[props.index + offset] !== undefined)
	.map((offset) => {
		const shown = imageMember(props.pictures[props.index + offset]!)
		const fit = fitSize(aspectOf(shown), size.value)
		return { offset, member: shown, src: sourceOf(shown, offset === 0), width: fit.width, height: fit.height }
	}))

/** The listing's aspect, else the loaded image's, else the default. */
function aspectOf(shown: ListingEntry): number {
	return shown.width !== null && shown.height !== null ? shown.width / shown.height : aspects.get(shown.fileId) ?? DEFAULT_ASPECT
}

/** The sharpest loaded source: the full image while zoomed, else the loupe tier, else the grid's. */
function sourceOf(shown: ListingEntry, current: boolean): string {
	const tiers = loupeSources(shown, props.imageUrl)
	if (current && zoomed.value && props.ready.has(tiers.full)) {
		return tiers.full
	}
	return props.ready.has(tiers.loupe) ? tiers.loupe : tiers.preview
}

watch(() => props.index, () => {
	zoom.value = FIT
	dragX.value = 0
	liftY.value = 0
})
watch(() => (zoomed.value ? zoomPercent(zoom.value, maxScale.value) : null), (percent) => emit('update:zoom', percent), { immediate: true })
watch(() => zoomed.value && sources.value.full, (full) => {
	if (full) {
		props.load(full).catch(() => undefined)
	}
})

const gestures = loupeGestures(() => ({ ...size.value, zoomed: zoomed.value }))
let panFrom: Zoom = FIT
let pinchFrom: { zoom: Zoom, centre: PinchCentre } = { zoom: FIT, centre: { x: 0, y: 0, distance: 0 } }

/** A centre relative to the stage's middle, as zooming counts it. */
function centred(centre: PinchCentre): PinchCentre {
	return { ...centre, x: centre.x - size.value.width / 2, y: centre.y - size.value.height / 2 }
}

/** Carries out what a gesture asks for. */
function act(action: GestureAction | null) {
	switch (action?.kind) {
		case 'page':
			dragX.value = 0
			emit('page', action.step)
			break
		case 'drag':
			dragX.value = action.dx
			break
		case 'settle':
			dragX.value = 0
			liftY.value = 0
			break
		case 'lift':
			liftY.value = action.dy
			break
		case 'swipe':
			liftY.value = 0
			emit('swipe', action.direction)
			break
		case 'overlays':
			emit('overlays')
			break
		case 'chrome-free':
			emit('chromeFree')
			break
		case 'pan-start':
			panFrom = zoom.value
			break
		case 'pan':
			zoom.value = panBy(panFrom, action.dx, action.dy, fitted.value, size.value)
			break
		case 'pinch-start':
			pinchFrom = { zoom: zoom.value, centre: centred(action.centre) }
			break
		case 'pinch':
			zoom.value = pinchZoom(pinchFrom.zoom, pinchFrom.centre, centred(action.centre), maxScale.value, fitted.value, size.value)
			break
		case 'pinch-end':
			zoom.value = zoomed.value ? zoom.value : FIT
			break
	}
}

/** The pointer as the gestures take it, relative to the stage. */
function pointerOf(event: PointerEvent): GesturePointer {
	const rect = stage.value!.getBoundingClientRect()
	const type = event.pointerType === 'mouse' || event.pointerType === 'pen' ? event.pointerType : 'touch'
	return { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top, time: event.timeStamp, type }
}

/** Starts a gesture and keeps its pointer when it leaves the stage. */
function onPointerDown(event: PointerEvent) {
	stage.value!.setPointerCapture?.(event.pointerId)
	act(gestures.down(pointerOf(event)))
}

/** Learns the aspect of a photo whose listing had no size. */
function onLoad(fileId: number, event: Event) {
	const image = event.target as HTMLImageElement
	if (image.naturalWidth > 0 && image.naturalHeight > 0) {
		aspects.set(fileId, image.naturalWidth / image.naturalHeight)
	}
}

let stopObserving = () => undefined as void
onMounted(() => {
	stopObserving = props.observeSize(stage.value!, (width, height) => {
		size.value = { width, height }
	})
})
onBeforeUnmount(() => stopObserving())

defineExpose({
	/** Toggles between fit and 100 % around the stage's middle. */
	toggleZoom() {
		zoom.value = toggleZoom(zoom.value, { x: 0, y: 0 }, maxScale.value, fitted.value, size.value)
	},
})
</script>

<template>
	<div
		ref="stage"
		class="loupe-stage"
		@pointerdown="onPointerDown"
		@pointermove="act(gestures.move(pointerOf($event)))"
		@pointerup="act(gestures.up(pointerOf($event)))"
		@pointercancel="act(gestures.cancel(pointerOf($event)))"
		@contextmenu.prevent>
		<div class="loupe-stage__track" :style="{ transform: `translateX(${dragX}px) translateY(${liftY}px)` }">
			<div
				v-for="slide in slides"
				:key="slide.member.fileId"
				class="loupe-stage__slide"
				:style="{ left: `${slide.offset * 100}%` }">
				<img
					class="loupe-stage__image"
					:alt="slide.offset === 0 ? props.pictures[props.index]!.baseName : ''"
					draggable="false"
					:src="slide.src"
					:style="{
						width: `${slide.width}px`,
						height: `${slide.height}px`,
						transform: slide.offset === 0 ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` : undefined,
					}"
					@load="onLoad(slide.member.fileId, $event)">
			</div>
		</div>
	</div>
</template>

<style scoped>
.loupe-stage {
	position: relative;
	overflow: hidden;
	touch-action: none;
	-webkit-user-select: none;
	user-select: none;
}

.loupe-stage__track,
.loupe-stage__slide {
	position: absolute;
	inset: 0;
}

.loupe-stage__slide {
	display: flex;
	align-items: center;
	justify-content: center;
}

.loupe-stage__image {
	flex: none;
	max-width: none;
	transform-origin: center;
}
</style>
