<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { HotkeyHandlers } from '../hotkeys.ts'
import type { Writability } from '../logic/writability.ts'
import type { PhotoLoupeEmits, PhotoLoupeProps } from '../photo-loupe-props.ts'

import { t } from '@nextcloud/l10n'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import ActionBar from './ActionBar.vue'
import GestureGuide from './GestureGuide.vue'
import LoupeFilmstrip from './LoupeFilmstrip.vue'
import LoupeInfo from './LoupeInfo.vue'
import LoupeNavButtons from './LoupeNavButtons.vue'
import LoupeStage from './LoupeStage.vue'
import LoupeTitleRow from './LoupeTitleRow.vue'
import PanelDivider from './PanelDivider.vue'
import PickRestButton from './PickRestButton.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { browserSchedule } from '../browser-schedule.ts'
import { toggleBrowserFullscreen } from '../fullscreen.ts'
import { LOUPE_IDLE_MS, useIdle } from '../idle.ts'
import { FILMSTRIP_THUMB } from '../logic/filmstrip.ts'
import { imageMember, isEmbeddedPreview, loupeSources } from '../logic/image-tiers.ts'
import { EVERYTHING } from '../logic/opened-source.ts'
import { DIVIDER_WIDTH, FLAG_RAIL, INFO_PANEL } from '../logic/panel-width.ts'
import { useLoupeDecisions } from '../loupe-decisions.ts'
import { useLoupePanels } from '../loupe-panels.ts'
import { decodeSource, usePrefetch } from '../loupe-prefetch.ts'
import { useLoupeSeries } from '../loupe-series.ts'
import { observeElementSize } from '../observe-size.ts'
import { useSeriesHint } from '../series-hint.ts'

const props = withDefaults(defineProps<PhotoLoupeProps>(), {
	seriesOf: () => new Map(),
	qualityOf: () => null,
	tagsOf: () => [],
	writabilityOf: (): Writability => 'writable',
	imageUrl: apiImageUrl,
	decode: decodeSource,
	schedule: browserSchedule,
	toggleFullscreen: toggleBrowserFullscreen,
	devicePixelRatio: () => window.devicePixelRatio,
	observeSize: observeElementSize,
	capabilities: () => EVERYTHING,
	counter: null,
})

const emit = defineEmits<PhotoLoupeEmits>()

const root = useTemplateRef<HTMLElement>('root')
const stage = useTemplateRef<InstanceType<typeof LoupeStage>>('stage')
const panels = useLoupePanels(props.storage, props.viewState)
const { infoOpen, infoWidth, navigationShown, gestureGuideSeen } = panels
const seriesHint = useSeriesHint(panels, () => props.seriesOf.has(props.pictures[props.index]!))
const filmstripOpen = ref(true)
const stripPinned = computed(() => filmstripOpen.value && props.settings.filmstripPinned)
const chromeFree = ref(false)
const zoom = ref<number | null>(null)
const overlays = useIdle(props.schedule, LOUPE_IDLE_MS, () => seriesHint.shown.value || Boolean(document.activeElement?.closest('.photo-loupe__overlay, .action-bar__row')))
const prefetcher = usePrefetch(props.decode)
const decisions = useLoupeDecisions({
	pictures: () => props.pictures,
	index: () => props.index,
	decisionOf: props.decisionOf,
	decidedOf: props.decidedOf,
	decide: (intent, shown) => emit('decide', intent, shown),
	go: (index) => go(index),
	setFlagButtonsShown: (shown) => emit('updateSettings', { flagButtonsShown: shown }),
	swipes: () => props.settings.swipes,
	autoAdvance: () => props.settings.autoAdvance,
	toast: (toast) => emit('toast', toast),
	allDecided: () => emit('allDecided'),
})

const picture = computed(() => props.pictures[props.index]!)
const loupeSeries = useLoupeSeries({
	pictures: () => props.pictures,
	picture: () => picture.value,
	seriesOf: () => props.seriesOf,
	qualityOf: (shown) => props.qualityOf(shown),
	dismissHint: () => seriesHint.dismiss(),
	compare: (series, shown) => emit('compareSeries', series, shown),
	pickRest: (series, shown) => emit('pickRest', series, shown),
})
const sourcesAt = (index: number) => loupeSources(imageMember(props.pictures[index]!), props.imageUrl)

watch(() => props.index, (index) => prefetcher.prefetchAround(index, props.pictures.length, sourcesAt), { immediate: true })
watch(seriesHint.shown, (shown) => shown && overlays.wake())

/** Shows the picture at `index` if there is one. */
function go(index: number) {
	if (index >= 0 && index < props.pictures.length && index !== props.index) {
		emit('update:index', index)
	}
}

/** The loupe's keys (`docs/dev/plan.md` Keyboard shortcuts); the app's dispatcher runs them. */
const hotkeys: HotkeyHandlers = {
	previous: () => go(props.index - 1),
	next: () => go(props.index + 1),
	up: () => go(props.index - 1),
	down: () => go(props.index + 1),
	first: () => go(0),
	last: () => go(props.pictures.length - 1),
	close: () => (seriesHint.shown.value ? seriesHint.dismiss() : emit('close')),
	grid: () => emit('close'),
	header: () => void (chromeFree.value = !chromeFree.value),
	fullscreen: () => props.toggleFullscreen(root.value!),
	zoom: () => stage.value!.toggleZoom(),
	'zoom-in': () => stage.value!.toggleZoom(false),
	'zoom-out': () => stage.value!.toggleZoom(true),
	info: () => panels.setInfoOpen(!infoOpen.value),
	'flag-buttons': () => decisions.setFlagButtonsShown(!props.settings.flagButtonsShown, true),
	...(props.capabilities.tags && { tag: () => emit('tag', picture.value) }),
	...(props.capabilities.series && { compare: () => loupeSeries.compareAt(props.index), 'pick-rest': loupeSeries.pickRest }),
	decide: (intent, advance) => (intent.kind !== 'keepRaw' || props.capabilities.keepRaw) && decisions.decideByKey(intent, advance),
}

defineExpose({ hotkeys })

/** Dismisses the gesture guide or the first-series hint and gives the keys back to the loupe. */
function dismissAndFocus(dismiss: () => void) {
	dismiss()
	root.value!.focus()
}

onMounted(() => gestureGuideSeen.value && root.value!.focus())
</script>

<template>
	<div
		ref="root"
		class="photo-loupe"
		:data-tips-off="overlays.idle.value || undefined"
		:class="{ 'photo-loupe--idle': overlays.idle.value, 'photo-loupe--chrome-free': chromeFree, 'photo-loupe--below-header': navigationShown && !chromeFree }"
		:style="{ '--photo-loupe-panel': `${infoOpen ? infoWidth + DIVIDER_WIDTH : 0}px`, '--photo-loupe-rail': `${settings.flagButtonsShown ? FLAG_RAIL : 0}px`, '--photo-loupe-strip': `${stripPinned ? FILMSTRIP_THUMB : 0}px`, '--photo-loupe-filmstrip': `${filmstripOpen ? FILMSTRIP_THUMB : 0}px` }"
		role="dialog"
		:aria-modal="!navigationShown"
		:aria-label="t('honeycomb', 'Loupe')"
		tabindex="-1"
		data-hotkeys-screen
		@pointermove="$event.pointerType === 'mouse' && overlays.wake()">
		<LoupeTitleRow
			class="photo-loupe__top"
			:class="stripPinned ? 'photo-loupe__top--pinned' : 'photo-loupe__overlay'"
			:name="picture.baseName"
			:index="props.index"
			:count="props.pictures.length"
			:counter="props.counter"
			:movable="props.capabilities.move"
			:zoom="zoom"
			:infoOpen="infoOpen"
			:filmstripOpen="filmstripOpen"
			:navigationShown="navigationShown"
			:flagButtonsShown="settings.flagButtonsShown"
			:series="loupeSeries.place.value"
			:seriesHint="seriesHint.shown.value"
			:unsaved="picture === props.unsaved"
			:embeddedPreview="isEmbeddedPreview(picture)"
			@pointerdown="overlays.wake"
			@compareSeries="loupeSeries.compareAt(props.index)"
			@dismissSeriesHint="dismissAndFocus(seriesHint.dismiss)"
			@close="emit('close')"
			@move="emit('move')"
			@toggleZoom="stage!.toggleZoom()"
			@toggleFullscreen="props.toggleFullscreen(root!)"
			@update:infoOpen="panels.setInfoOpen"
			@update:filmstripOpen="filmstripOpen = $event"
			@update:navigationShown="panels.setNavigationShown"
			@update:flagButtonsShown="decisions.setFlagButtonsShown" />
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
				:swipes="settings.swipes"
				:qualityOf="props.qualityOf"
				@page="go(props.index + $event)"
				@overlays="overlays.toggle"
				@chromeFree="chromeFree = !chromeFree"
				@swipe="decisions.swipe"
				@update:zoom="zoom = $event" />
			<LoupeNavButtons
				class="photo-loupe__overlay"
				:index="props.index"
				:count="props.pictures.length"
				@page="go(props.index + $event)" />
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
					:tags="props.tagsOf(picture)"
					:writability="props.writabilityOf(picture)"
					:sharpness="loupeSeries.sharpness.value" />
			</template>
		</div>
		<LoupeFilmstrip
			v-if="filmstripOpen"
			class="photo-loupe__filmstrip"
			:class="settings.filmstripPinned ? 'photo-loupe__filmstrip--pinned' : 'photo-loupe__overlay'"
			:pictures="props.pictures"
			:index="props.index"
			:decisionOf="props.decisionOf"
			:seriesOf="props.seriesOf"
			:sharpest="loupeSeries.sharpest.value"
			:imageUrl="props.imageUrl"
			:observeSize="props.observeSize"
			:pinned="settings.filmstripPinned"
			:onCompareSeries="loupeSeries.compareAt"
			@pointerdown="overlays.wake"
			@select="go"
			@update:pinned="emit('updateSettings', { filmstripPinned: $event })" />
		<ActionBar
			v-if="!chromeFree"
			layout="loupe"
			:common="decisions.common.value"
			:readOnly="props.writabilityOf(picture) === 'readOnly'"
			:flags="settings.flagButtonsShown"
			:idle="overlays.idle.value"
			:pinned="settings.ratingRowPinned"
			:keepRaw="props.capabilities.keepRaw"
			:tags="props.capabilities.tags"
			@pointerdown="overlays.wake"
			@decide="decisions.decide"
			@tag="emit('tag', picture)">
			<template v-if="loupeSeries.series.value !== null" #end>
				<PickRestButton class="photo-loupe__pick-rest" secondary @pick="loupeSeries.pickRest" />
			</template>
		</ActionBar>
		<GestureGuide v-if="!gestureGuideSeen" :swipes="settings.swipes" @dismiss="dismissAndFocus(panels.dismissGestureGuide)" />
	</div>
</template>

<style scoped src="./photo-loupe.css" />
