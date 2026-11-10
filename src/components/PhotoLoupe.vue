<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { BrowserStorage } from '../browser-storage.ts'
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Schedule } from '../logic/long-press.ts'
import type { LoupeKeyAction } from '../logic/loupe-keys.ts'
import type { Picture } from '../logic/pairing.ts'
import type { ObserveSize } from '../observe-size.ts'

import { t } from '@nextcloud/l10n'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import LoupeFilmstrip from './LoupeFilmstrip.vue'
import LoupeInfo from './LoupeInfo.vue'
import LoupeStage from './LoupeStage.vue'
import LoupeTitleRow from './LoupeTitleRow.vue'
import PanelDivider from './PanelDivider.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { toggleBrowserFullscreen } from '../fullscreen.ts'
import { LOUPE_IDLE_MS, useIdle } from '../idle.ts'
import { imageMember, loupeSources } from '../logic/image-tiers.ts'
import { loupeKey } from '../logic/loupe-keys.ts'
import { INFO_PANEL } from '../logic/panel-width.ts'
import { prefetchOrder } from '../logic/prefetch.ts'
import { useLoupePanels } from '../loupe-panels.ts'
import { decodeSource, usePrefetch } from '../loupe-prefetch.ts'
import { observeElementSize } from '../observe-size.ts'
import { browserSchedule } from '../tile-selection.ts'

const props = withDefaults(defineProps<{
	/** The pictures the loupe pages through, the grid's order when it opened. */
	pictures: readonly Picture<ListingEntry>[]
	index: number
	folderSet: FolderSet
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	storage: BrowserStorage
	imageUrl?: ImageUrlFor
	decode?: (src: string) => Promise<void>
	schedule?: Schedule
	toggleFullscreen?: (element: HTMLElement) => void
	devicePixelRatio?: number
	observeSize?: ObserveSize
}>(), {
	imageUrl: apiImageUrl,
	decode: decodeSource,
	schedule: browserSchedule,
	toggleFullscreen: toggleBrowserFullscreen,
	devicePixelRatio: () => window.devicePixelRatio,
	observeSize: observeElementSize,
})

const emit = defineEmits<{
	'update:index': [index: number]
	close: []
}>()

/** The divider's width in the layout, its 12 px less the negative margins. */
const DIVIDER_WIDTH = 4

const root = useTemplateRef<HTMLElement>('root')
const stage = useTemplateRef<InstanceType<typeof LoupeStage>>('stage')
const panels = useLoupePanels(props.storage)
const { infoOpen, infoWidth, navigationShown } = panels
const filmstripOpen = ref(true)
const chromeFree = ref(false)
const zoom = ref<number | null>(null)
const overlays = useIdle(props.schedule, LOUPE_IDLE_MS, () => Boolean(document.activeElement?.closest('.photo-loupe__overlay')))
const prefetcher = usePrefetch(props.decode)

const picture = computed(() => props.pictures[props.index]!)
const sourcesAt = (index: number) => loupeSources(imageMember(props.pictures[index]!), props.imageUrl)
const neighbours = computed(() => prefetchOrder(props.index, props.pictures.length).map((index) => sourcesAt(index).loupe))
const preloaded = computed(() => neighbours.value.filter((src) => prefetcher.ready.has(src)).length)
const navigation = computed(() => [
	{ step: -1, shown: props.index > 0, icon: 'chevronLeft', label: t('honeycomb', 'Previous photo') },
	{ step: 1, shown: props.index < props.pictures.length - 1, icon: 'chevronRight', label: t('honeycomb', 'Next photo') },
] as const)

watch(() => props.index, (index) => {
	const current = sourcesAt(index)
	prefetcher.prefetch([current.loupe, ...neighbours.value], [current.full])
}, { immediate: true })

/** Shows the picture at `index` if there is one. */
function go(index: number) {
	if (index >= 0 && index < props.pictures.length && index !== props.index) {
		emit('update:index', index)
	}
}

const KEY_ACTIONS: Record<LoupeKeyAction, () => void> = {
	previous: () => go(props.index - 1),
	next: () => go(props.index + 1),
	first: () => go(0),
	last: () => go(props.pictures.length - 1),
	close: () => emit('close'),
	'chrome-free': () => {
		chromeFree.value = !chromeFree.value
	},
	fullscreen: () => props.toggleFullscreen(root.value!),
	zoom: () => stage.value!.toggleZoom(),
	info: () => panels.setInfoOpen(!infoOpen.value),
}

/** Runs a loupe key; Tab and Space keep their meaning on a focused control. */
function onKeydown(event: KeyboardEvent) {
	const onControl = event.target !== root.value && (event.key === 'Tab' || event.key === ' ')
	const action = event.defaultPrevented || onControl ? null : loupeKey(event)
	if (action !== null) {
		event.preventDefault()
		KEY_ACTIONS[action]()
	}
}

onMounted(() => root.value!.focus())
</script>

<template>
	<div
		ref="root"
		class="photo-loupe"
		:class="{ 'photo-loupe--idle': overlays.idle.value, 'photo-loupe--chrome-free': chromeFree, 'photo-loupe--below-header': navigationShown && !chromeFree }"
		:style="{ '--photo-loupe-panel': `${infoOpen ? infoWidth + DIVIDER_WIDTH : 0}px` }"
		role="dialog"
		:aria-modal="!navigationShown"
		:aria-label="t('honeycomb', 'Loupe')"
		tabindex="-1"
		@keydown="onKeydown"
		@pointermove="$event.pointerType === 'mouse' && overlays.wake()">
		<LoupeTitleRow
			class="photo-loupe__top photo-loupe__overlay"
			:name="picture.baseName"
			:index="props.index"
			:count="props.pictures.length"
			:zoom="zoom"
			:infoOpen="infoOpen"
			:filmstripOpen="filmstripOpen"
			:navigationShown="navigationShown"
			@pointerdown="overlays.wake"
			@close="emit('close')"
			@toggleZoom="stage!.toggleZoom()"
			@update:infoOpen="panels.setInfoOpen"
			@update:filmstripOpen="filmstripOpen = $event"
			@update:navigationShown="panels.setNavigationShown" />
		<div class="photo-loupe__main">
			<LoupeStage
				ref="stage"
				class="photo-loupe__stage"
				:pictures="props.pictures"
				:index="props.index"
				:imageUrl="props.imageUrl"
				:load="prefetcher.load"
				:ready="prefetcher.ready"
				:devicePixelRatio="props.devicePixelRatio"
				:observeSize="props.observeSize"
				@page="go(props.index + $event)"
				@overlays="overlays.toggle"
				@chromeFree="chromeFree = !chromeFree"
				@update:zoom="zoom = $event" />
			<template v-for="nav in navigation" :key="nav.step">
				<NcButton
					v-if="nav.shown"
					class="photo-loupe__nav photo-loupe__overlay"
					:class="`photo-loupe__nav--${nav.step < 0 ? 'previous' : 'next'}`"
					variant="tertiary"
					:aria-label="nav.label"
					@click="go(props.index + nav.step)">
					<template #icon>
						<AppIcon :name="nav.icon" />
					</template>
				</NcButton>
			</template>
			<template v-if="infoOpen">
				<PanelDivider
					class="photo-loupe__panel"
					:width="infoWidth"
					:limits="INFO_PANEL"
					:label="t('honeycomb', 'Resize info panel')"
					@update:width="panels.setInfoWidth" />
				<LoupeInfo
					class="photo-loupe__panel"
					:style="{ width: `${infoWidth}px` }"
					:picture="picture"
					:folderSet="props.folderSet"
					:decision="props.decisionOf(picture)"
					:preloaded="preloaded"
					:neighbours="neighbours.length" />
			</template>
		</div>
		<LoupeFilmstrip
			v-if="filmstripOpen"
			class="photo-loupe__filmstrip photo-loupe__overlay"
			:pictures="props.pictures"
			:index="props.index"
			:decisionOf="props.decisionOf"
			:imageUrl="props.imageUrl"
			@pointerdown="overlays.wake"
			@select="go" />
	</div>
</template>

<style scoped>
.photo-loupe {
	position: fixed;
	z-index: 10000;
	inset: 0;
	display: flex;
	flex-direction: column;
	background-color: var(--color-main-background);
	color: var(--color-main-text);
}

.photo-loupe--below-header {
	top: var(--header-height);
}

.photo-loupe:focus {
	outline: none;
}

.photo-loupe__main {
	position: relative;
	display: flex;
	flex: 1;
	min-height: 0;
}

.photo-loupe__stage {
	flex: 1;
	min-width: 0;
}

.photo-loupe__nav {
	position: absolute;
	top: 50%;
	transform: translateY(-50%);
}

.photo-loupe__nav--previous {
	inset-inline-start: var(--default-grid-baseline);
}

.photo-loupe__nav--next {
	inset-inline-end: calc(var(--photo-loupe-panel) + var(--default-grid-baseline));
}

.photo-loupe--chrome-free .photo-loupe__overlay,
.photo-loupe--chrome-free .photo-loupe__panel {
	display: none;
}

@media (orientation: landscape) {
	.photo-loupe__top,
	.photo-loupe__filmstrip {
		position: absolute;
		z-index: 1;
		inset-inline: 0 var(--photo-loupe-panel);
		background-color: color-mix(in srgb, var(--color-main-background) 80%, transparent);
	}

	.photo-loupe__top {
		top: 0;
	}

	.photo-loupe__filmstrip {
		bottom: 0;
	}

	.photo-loupe__overlay {
		transition: opacity 0.2s;
	}

	.photo-loupe--idle .photo-loupe__overlay {
		opacity: 0;
		pointer-events: none;
	}
}
</style>
