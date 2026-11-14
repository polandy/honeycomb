<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { BrowserStorage } from '../browser-storage.ts'
import type { HotkeyHandlers } from '../hotkeys.ts'
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Schedule } from '../logic/long-press.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Settings } from '../logic/settings.ts'
import type { Tag } from '../logic/tag.ts'
import type { ObserveSize } from '../observe-size.ts'
import type { Toast } from '../toast.ts'
import type { ViewStateStore } from '../view-state.ts'

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
import { toggleBrowserFullscreen } from '../fullscreen.ts'
import { LOUPE_IDLE_MS, useIdle } from '../idle.ts'
import { FILMSTRIP_THUMB } from '../logic/filmstrip.ts'
import { imageMember, loupeSources } from '../logic/image-tiers.ts'
import { DIVIDER_WIDTH, FLAG_RAIL, INFO_PANEL } from '../logic/panel-width.ts'
import { useLoupeDecisions } from '../loupe-decisions.ts'
import { useLoupePanels } from '../loupe-panels.ts'
import { decodeSource, usePrefetch } from '../loupe-prefetch.ts'
import { observeElementSize } from '../observe-size.ts'
import { useSeriesHint } from '../series-hint.ts'
import { browserSchedule } from '../tile-selection.ts'

const props = withDefaults(defineProps<{
	/** The pictures the loupe pages through, the grid's order when it opened. */
	pictures: readonly Picture<ListingEntry>[]
	index: number
	folderSet: FolderSet
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	/** Each picture of a series mapped to its whole series, for the filmstrip's frame (LOUPE-001.19). */
	seriesOf?: ReadonlyMap<Picture<ListingEntry>, readonly Picture<ListingEntry>[]>
	/** The picture's tags for the info panel (TAGS-004.8). */
	tagsOf?: (picture: Picture<ListingEntry>) => readonly Tag[]
	/** Whether the picture's tag changes are written to its sidecars (TAGS-004.9). */
	writesSidecars?: (picture: Picture<ListingEntry>) => boolean
	storage: BrowserStorage
	viewState: ViewStateStore
	settings: Settings
	imageUrl?: ImageUrlFor
	decode?: (src: string) => Promise<void>
	schedule?: Schedule
	toggleFullscreen?: (element: HTMLElement) => void
	devicePixelRatio?: number
	observeSize?: ObserveSize
}>(), {
	seriesOf: () => new Map(),
	tagsOf: () => [],
	writesSidecars: () => true,
	imageUrl: apiImageUrl,
	decode: decodeSource,
	schedule: browserSchedule,
	toggleFullscreen: toggleBrowserFullscreen,
	devicePixelRatio: () => window.devicePixelRatio,
	observeSize: observeElementSize,
})

const emit = defineEmits<{
	'update:index': [index: number]
	decide: [intent: DecisionIntent, picture: Picture<ListingEntry>]
	toast: [toast: Toast]
	allDecided: []
	move: []
	updateSettings: [patch: Partial<Settings>]
	tag: [picture: Picture<ListingEntry>]
	/** Opens the compare on the series with the picture active (LOUPE-001.25). */
	compareSeries: [series: readonly Picture<ListingEntry>[], picture: Picture<ListingEntry>]
	/** Picks the shown picture and rejects the rest of its series (LOUPE-002.15). */
	pickRest: [series: readonly Picture<ListingEntry>[], picture: Picture<ListingEntry>]
	close: []
}>()

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
	decide: (intent, shown) => emit('decide', intent, shown),
	go: (index) => go(index),
	setFlagButtonsShown: (shown) => emit('updateSettings', { flagButtonsShown: shown }),
	swipes: () => props.settings.swipes,
	autoAdvance: () => props.settings.autoAdvance,
	toast: (toast) => emit('toast', toast),
	allDecided: () => emit('allDecided'),
})

const picture = computed(() => props.pictures[props.index]!)
const series = computed(() => props.seriesOf.get(picture.value) ?? null)
const seriesPlace = computed(() => (series.value === null ? null : { position: series.value.indexOf(picture.value) + 1, count: series.value.length }))
const sourcesAt = (index: number) => loupeSources(imageMember(props.pictures[index]!), props.imageUrl)

watch(() => props.index, (index) => prefetcher.prefetchAround(index, props.pictures.length, sourcesAt), { immediate: true })

/** Shows the picture at `index` if there is one. */
function go(index: number) {
	if (index >= 0 && index < props.pictures.length && index !== props.index) {
		emit('update:index', index)
	}
}

/** Opens the compare on the series of the picture at `index`, the shown picture active while it is in it, else that one. */
function compareSeriesOf(index: number) {
	const at = props.pictures[index]!
	const members = props.seriesOf.get(at)
	if (members !== undefined) {
		seriesHint.dismiss()
		emit('compareSeries', members, members.includes(picture.value) ? picture.value : at)
	}
}

/** Asks to pick the shown picture and reject the rest of its series, if it is in one. */
function pickRest() {
	if (series.value !== null) {
		seriesHint.dismiss()
		emit('pickRest', series.value, picture.value)
	}
}

/** The loupe's keys (`docs/plan.md` Keyboard shortcuts); the app's dispatcher runs them. */
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
	tag: () => emit('tag', picture.value),
	compare: () => compareSeriesOf(props.index),
	'pick-rest': pickRest,
	decide: decisions.decideByKey,
}

defineExpose({ hotkeys })

/** Remembers the gesture guide as seen and gives the keys back to the loupe. */
function dismissGestureGuide() {
	panels.dismissGestureGuide()
	root.value!.focus()
}

/** *Got it* in the first-series hint gives the keys back to the loupe. */
function gotSeriesHint() {
	seriesHint.dismiss()
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
			:zoom="zoom"
			:infoOpen="infoOpen"
			:filmstripOpen="filmstripOpen"
			:navigationShown="navigationShown"
			:flagButtonsShown="settings.flagButtonsShown"
			:series="seriesPlace"
			:seriesHint="seriesHint.shown.value"
			@pointerdown="overlays.wake"
			@compareSeries="compareSeriesOf(props.index)"
			@dismissSeriesHint="gotSeriesHint"
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
					:writesSidecars="props.writesSidecars(picture)" />
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
			:imageUrl="props.imageUrl"
			:observeSize="props.observeSize"
			:pinned="settings.filmstripPinned"
			:onCompareSeries="compareSeriesOf"
			@pointerdown="overlays.wake"
			@select="go"
			@update:pinned="emit('updateSettings', { filmstripPinned: $event })" />
		<ActionBar
			v-if="!chromeFree"
			layout="loupe"
			:common="decisions.common.value"
			:flags="settings.flagButtonsShown"
			:idle="overlays.idle.value"
			:pinned="settings.ratingRowPinned"
			@pointerdown="overlays.wake"
			@decide="decisions.decide"
			@tag="emit('tag', picture)">
			<template v-if="series !== null" #end>
				<PickRestButton class="photo-loupe__pick-rest" secondary @pick="pickRest" />
			</template>
		</ActionBar>
		<GestureGuide v-if="!gestureGuideSeen" :swipes="settings.swipes" @dismiss="dismissGestureGuide" />
	</div>
</template>

<style scoped src="./photo-loupe.css" />
