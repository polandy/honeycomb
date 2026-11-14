<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Decision } from '../logic/decision.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { ObserveSize } from '../observe-size.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import FlagMark from './FlagMark.vue'
import { keyCap } from '../hotkeys.ts'
import { formatNumber } from '../l10n.ts'
import { FILMSTRIP_THUMB, filmstripFrames, filmstripLayout } from '../logic/filmstrip.ts'
import { imageMember, smallSource } from '../logic/image-tiers.ts'
import { observeElementSize } from '../observe-size.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	pictures: readonly Picture<ListingEntry>[]
	index: number
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	/** Each picture of a series mapped to its whole series; each run in the strip gets a frame. */
	seriesOf: ReadonlyMap<Picture<ListingEntry>, readonly Picture<ListingEntry>[]>
	imageUrl: ImageUrlFor
	/** Whether *Pin the filmstrip* is on; its toggle sits at the strip's end. */
	pinned: boolean
	observeSize?: ObserveSize
	/** Opens the compare on the series of the photo at that index, the frame's first; the frame's tab shows only with it (LOUPE-001.19). */
	onCompareSeries?: (index: number) => void
}>(), { observeSize: observeElementSize })

const emit = defineEmits<{ select: [index: number], 'update:pinned': [pinned: boolean] }>()

const strip = useTemplateRef<HTMLElement>('strip')
const viewport = ref(0)
const offset = ref(0)
const layout = computed(() => filmstripLayout({ index: props.index, count: props.pictures.length, viewport: viewport.value, offset: offset.value }))

const shown = computed(() => props.pictures.slice(layout.value.first, layout.value.end).map((picture, at) => {
	const index = layout.value.first + at
	return { picture, index, left: index * FILMSTRIP_THUMB, member: imageMember(picture), flag: props.decisionOf(picture).flag, framed: props.seriesOf.has(picture) }
}))

const frames = computed(() => filmstripFrames(props.pictures, props.seriesOf)
	.filter((frame) => frame.end > layout.value.first && frame.first < layout.value.end)
	.map((frame) => ({ ...frame, badge: `⧉ ${formatNumber(frame.count)}`, label: n('honeycomb', 'Series of {count} – compare', 'Series of {count} – compare', frame.count, { count: formatNumber(frame.count) }) })))

/** Scrolls the shown picture towards the middle of the strip. */
function centre() {
	offset.value = layout.value.centred
	strip.value!.scrollLeft = offset.value
}

let unobserve = () => {}
onMounted(() => {
	unobserve = props.observeSize(strip.value!, (width) => {
		viewport.value = width
	})
})
onBeforeUnmount(() => unobserve())
watch([() => props.index, viewport], centre, { flush: 'post' })
</script>

<template>
	<div class="loupe-filmstrip" :style="{ '--loupe-filmstrip-thumb': `${FILMSTRIP_THUMB}px` }">
		<nav
			ref="strip"
			class="loupe-filmstrip__strip"
			:aria-label="t('honeycomb', 'Filmstrip')"
			@scroll="offset = ($event.target as HTMLElement).scrollLeft">
			<div class="loupe-filmstrip__track" :style="{ width: `${layout.width}px` }">
				<button
					v-for="item in shown"
					:key="item.member.fileId"
					type="button"
					class="loupe-filmstrip__photo"
					:class="{
						'loupe-filmstrip__photo--current': item.index === props.index,
						'loupe-filmstrip__photo--dimmed': item.flag === 'rejected' && item.index !== props.index,
						'loupe-filmstrip__photo--framed': item.framed,
					}"
					:style="{ left: `${item.left}px` }"
					:aria-label="item.picture.baseName"
					:aria-current="item.index === props.index ? 'true' : undefined"
					@click="emit('select', item.index)">
					<img alt="" draggable="false" :src="smallSource(item.member, props.imageUrl)">
					<FlagMark v-if="item.flag !== 'unflagged'" class="loupe-filmstrip__flag" :flag="item.flag" />
				</button>
				<div
					v-for="frame in frames"
					:key="frame.first"
					class="loupe-filmstrip__frame"
					:style="{ left: `${frame.first * FILMSTRIP_THUMB}px`, width: `${(frame.end - frame.first) * FILMSTRIP_THUMB}px` }">
					<button
						v-if="props.onCompareSeries"
						type="button"
						class="loupe-filmstrip__tab"
						:aria-label="frame.label"
						v-bind="tip(t('honeycomb', 'Compare this series'), keyCap('compare'))"
						@click="props.onCompareSeries(frame.first)">
						{{ frame.badge }}
					</button>
				</div>
			</div>
		</nav>
		<button
			type="button"
			class="loupe-filmstrip__pin"
			:aria-label="t('honeycomb', 'Pin filmstrip')"
			:aria-pressed="props.pinned"
			v-bind="tip(props.pinned ? t('honeycomb', 'Unpin filmstrip') : t('honeycomb', 'Pin filmstrip'))"
			@click="emit('update:pinned', !props.pinned)">
			<AppIcon name="pin" />
		</button>
	</div>
</template>

<style scoped>
.loupe-filmstrip {
	--loupe-filmstrip-frame: 2px;
	display: flex;
	flex: none;
	height: var(--loupe-filmstrip-thumb);
	background-color: #111;
}

.loupe-filmstrip__strip {
	flex: 1;
	min-width: 0;
	overflow-x: auto;
	overflow-y: hidden;
	scrollbar-width: none;
}

@media (prefers-reduced-motion: no-preference) {
	.loupe-filmstrip__strip {
		scroll-behavior: smooth;
	}
}

.loupe-filmstrip__track {
	position: relative;
	height: 100%;
}

.loupe-filmstrip__photo {
	position: absolute;
	top: 0;
	width: var(--loupe-filmstrip-thumb);
	height: var(--loupe-filmstrip-thumb);
	min-width: 0;
	min-height: 0;
	margin: 0;
	padding: 0;
	border: 0;
	border-radius: 0;
	background: none;
}

.loupe-filmstrip__photo--dimmed {
	opacity: .45;
}

/* White reads on a dark photo, the black inner edge on a bright one. */
.loupe-filmstrip__photo--current::before {
	content: '';
	position: absolute;
	inset: 0;
	z-index: 1;
	box-shadow: inset 0 0 0 3px #fff, inset 0 0 0 4px #000;
	pointer-events: none;
}

/* The frame's border is drawn over the photos' edges, so the ring moves inside it. */
.loupe-filmstrip__photo--framed::before {
	inset: var(--loupe-filmstrip-frame);
}

.loupe-filmstrip__frame {
	position: absolute;
	top: 0;
	z-index: 3;
	height: 100%;
	box-sizing: border-box;
	border: var(--loupe-filmstrip-frame) solid var(--color-primary-element);
	border-radius: 8px;
	pointer-events: none;
}

/* Nextcloud's own button sizes outrank a single class. */
.loupe-filmstrip .loupe-filmstrip__tab {
	position: absolute;
	top: 2px;
	left: 2px;
	min-width: 0;
	height: 20px;
	min-height: 0;
	margin: 0;
	padding: 0 7px;
	border: 0;
	border-radius: 10px;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-size: 12px;
	font-weight: bold;
	line-height: 20px;
	pointer-events: auto;
}

/* The hit area reaches 44 px, 34 px with a fine pointer. */
.loupe-filmstrip__tab::before {
	content: '';
	position: absolute;
	inset: -12px -8px;
}

@media (pointer: fine) {
	.loupe-filmstrip__tab::before {
		inset: -7px -4px;
	}
}

.loupe-filmstrip__photo img {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: cover;
}

/* Nextcloud's own button margins outrank a single class. */
.loupe-filmstrip .loupe-filmstrip__pin {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 44px;
	height: 100%;
	min-height: 0;
	margin: 0;
	padding: 0;
	border: 0;
	border-inline-start: 1px solid #333;
	border-radius: 0;
	background: #111;
	color: #fff;
	opacity: .6;
}

.loupe-filmstrip__pin[aria-pressed='true'] {
	background: #333;
	opacity: 1;
}

/* In portrait the filmstrip always sits below the photo, so there is nothing to pin. */
@media (orientation: portrait) {
	.loupe-filmstrip .loupe-filmstrip__pin {
		display: none;
	}
}

.loupe-filmstrip__flag {
	position: absolute;
	z-index: 2;
	inset-block-end: 4px;
	inset-inline-end: 4px;
}
</style>
