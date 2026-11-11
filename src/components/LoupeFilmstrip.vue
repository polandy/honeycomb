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

import { t } from '@nextcloud/l10n'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import FlagMark from './FlagMark.vue'
import { FILMSTRIP_THUMB, filmstripLayout } from '../logic/filmstrip.ts'
import { imageMember, smallSource } from '../logic/image-tiers.ts'
import { observeElementSize } from '../observe-size.ts'

const props = withDefaults(defineProps<{
	pictures: readonly Picture<ListingEntry>[]
	index: number
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	imageUrl: ImageUrlFor
	observeSize?: ObserveSize
}>(), { observeSize: observeElementSize })

const emit = defineEmits<{ select: [index: number] }>()

const strip = useTemplateRef<HTMLElement>('strip')
const viewport = ref(0)
const offset = ref(0)
const layout = computed(() => filmstripLayout({ index: props.index, count: props.pictures.length, viewport: viewport.value, offset: offset.value }))

const shown = computed(() => props.pictures.slice(layout.value.first, layout.value.end).map((picture, at) => {
	const index = layout.value.first + at
	return { picture, index, left: layout.value.edge + index * FILMSTRIP_THUMB, member: imageMember(picture), flag: props.decisionOf(picture).flag }
}))

/** Scrolls the shown picture to the middle of the strip. */
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
	<nav
		ref="strip"
		class="loupe-filmstrip"
		:aria-label="t('honeycomb', 'Filmstrip')"
		:style="{ '--loupe-filmstrip-thumb': `${FILMSTRIP_THUMB}px` }"
		@scroll="offset = ($event.target as HTMLElement).scrollLeft">
		<div class="loupe-filmstrip__track" :style="{ width: `${layout.width}px` }">
			<button
				v-for="item in shown"
				:key="item.member.fileId"
				type="button"
				class="loupe-filmstrip__photo"
				:class="{ 'loupe-filmstrip__photo--current': item.index === props.index }"
				:style="{ left: `${item.left}px` }"
				:aria-label="item.picture.baseName"
				:aria-current="item.index === props.index ? 'true' : undefined"
				@click="emit('select', item.index)">
				<img alt="" draggable="false" :src="smallSource(item.member, props.imageUrl)">
				<FlagMark v-if="item.flag !== 'unflagged'" class="loupe-filmstrip__flag" :flag="item.flag" />
			</button>
		</div>
	</nav>
</template>

<style scoped>
.loupe-filmstrip {
	flex: none;
	height: var(--loupe-filmstrip-thumb);
	overflow-x: auto;
	overflow-y: hidden;
	background-color: #111;
	scrollbar-width: none;
}

@media (prefers-reduced-motion: no-preference) {
	.loupe-filmstrip {
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

.loupe-filmstrip__photo--current {
	z-index: 1;
	outline: 2px solid #fff;
	outline-offset: -2px;
}

.loupe-filmstrip__photo img {
	display: block;
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.loupe-filmstrip__flag {
	position: absolute;
	inset-block-end: 2px;
	inset-inline-end: 2px;
}
</style>
