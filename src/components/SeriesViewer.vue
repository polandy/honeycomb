<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { HotkeyHandlers } from '../hotkeys.ts'
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Decision } from '../logic/decision.ts'
import type { HotkeyIntent } from '../logic/hotkeys.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Schedule } from '../logic/long-press.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Settings } from '../logic/settings.ts'
import type { ObserveSize } from '../observe-size.ts'
import type { Toast } from '../toast.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ActionBar from './ActionBar.vue'
import AppIcon from './AppIcon.vue'
import FlagButtonsToggle from './FlagButtonsToggle.vue'
import LoupeNavButtons from './LoupeNavButtons.vue'
import LoupeStage from './LoupeStage.vue'
import PickRestButton from './PickRestButton.vue'
import { imageUrl as apiImageUrl } from '../api.ts'
import { keyCap } from '../hotkeys.ts'
import { LOUPE_IDLE_MS, useIdle } from '../idle.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { imageMember, loupeSources } from '../logic/image-tiers.ts'
import { FLAG_RAIL } from '../logic/panel-width.ts'
import { useLoupeDecisions } from '../loupe-decisions.ts'
import { decodeSource, usePrefetch } from '../loupe-prefetch.ts'
import { observeElementSize } from '../observe-size.ts'
import { browserSchedule } from '../tile-selection.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	/** The series without its rejected pictures. */
	pictures: readonly Picture<ListingEntry>[]
	index: number
	/** The series' place among the offered ones, from 0. */
	position: number
	count: number
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	settings: Settings
	imageUrl?: ImageUrlFor
	decode?: (src: string) => Promise<void>
	schedule?: Schedule
	devicePixelRatio?: number
	observeSize?: ObserveSize
}>(), {
	imageUrl: apiImageUrl,
	decode: decodeSource,
	schedule: browserSchedule,
	devicePixelRatio: () => window.devicePixelRatio,
	observeSize: observeElementSize,
})

const emit = defineEmits<{
	'update:index': [index: number]
	decide: [intent: DecisionIntent, picture: Picture<ListingEntry>]
	pickRest: [picture: Picture<ListingEntry>]
	toast: [toast: Toast]
	updateSettings: [patch: Partial<Settings>]
	tag: [picture: Picture<ListingEntry>]
	close: []
}>()

const root = useTemplateRef<HTMLElement>('root')
const stage = useTemplateRef<InstanceType<typeof LoupeStage>>('stage')
const zoom = ref<number | null>(null)
const overlays = useIdle(props.schedule, LOUPE_IDLE_MS, () => Boolean(document.activeElement?.closest('.series-viewer__overlay, .action-bar__row')))
const prefetcher = usePrefetch(props.decode)
const decisions = useLoupeDecisions({
	pictures: () => props.pictures,
	index: () => props.index,
	decisionOf: props.decisionOf,
	decide: (intent, shown) => emit('decide', intent, shown),
	go: (index) => go(index),
	setFlagButtonsShown: (shown) => emit('updateSettings', { flagButtonsShown: shown }),
	swipes: () => props.settings.swipes,
	autoAdvance: () => false,
	toast: (toast) => emit('toast', toast),
	allDecided: () => undefined,
})

const picture = computed(() => props.pictures[props.index]!)
const place = computed(() => t('honeycomb', 'Series {series} of {count} · photo {photo} of {photos}', {
	series: formatNumber(props.position + 1),
	count: formatNumber(props.count),
	photo: formatNumber(props.index + 1),
	photos: formatNumber(props.pictures.length),
}, undefined, PLAIN_TEXT))
const synced = computed(() => (zoom.value === null
	? ''
	: n('honeycomb', 'Zoom synced on all {count} photo', 'Zoom synced on all {count} photos', props.pictures.length, { count: formatNumber(props.pictures.length) })))

watch(() => props.pictures, (pictures) => {
	const sources = pictures.map((each) => loupeSources(imageMember(each), props.imageUrl))
	prefetcher.prefetch(sources.map((each) => each.loupe), sources.map((each) => each.full))
}, { immediate: true })

/** Shows the picture at `index` if there is one. */
function go(index: number) {
	if (index >= 0 && index < props.pictures.length && index !== props.index) {
		emit('update:index', index)
	}
}

/** Decides by a key; with `Shift` it moves on, unless a reject already took the photo out (SERIES-002.5). */
function decideByKey(intent: HotkeyIntent, advance: boolean) {
	decisions.decideByKey(intent, advance && !(intent.kind === 'flag' && intent.flag === 'rejected'))
}

/** The viewer's keys (`docs/plan.md` Keyboard shortcuts); the app's dispatcher runs them. */
const hotkeys: HotkeyHandlers = {
	previous: () => go(props.index - 1),
	next: () => go(props.index + 1),
	close: () => emit('close'),
	zoom: () => stage.value!.toggleZoom(),
	'zoom-in': () => stage.value!.toggleZoom(false),
	'zoom-out': () => stage.value!.toggleZoom(true),
	'flag-buttons': () => decisions.setFlagButtonsShown(!props.settings.flagButtonsShown, true),
	'pick-rest': () => emit('pickRest', picture.value),
	tag: () => emit('tag', picture.value),
	decide: decideByKey,
}

defineExpose({ hotkeys })

onMounted(() => root.value!.focus())
</script>

<template>
	<div
		ref="root"
		class="series-viewer"
		:class="{ 'series-viewer--idle': overlays.idle.value }"
		:data-tips-off="overlays.idle.value || undefined"
		:style="{ '--photo-loupe-panel': '0px', '--photo-loupe-rail': `${settings.flagButtonsShown ? FLAG_RAIL : 0}px` }"
		role="dialog"
		aria-modal="true"
		:aria-label="t('honeycomb', 'Series viewer')"
		tabindex="-1"
		data-hotkeys-screen
		@pointermove="$event.pointerType === 'mouse' && overlays.wake()">
		<header class="series-viewer__top series-viewer__overlay" @pointerdown="overlays.wake">
			<NcButton
				variant="tertiary"
				:aria-label="t('honeycomb', 'Close series viewer')"
				v-bind="tip(t('honeycomb', 'Close series viewer'), keyCap('close'))"
				@click="emit('close')">
				<template #icon>
					<AppIcon name="close" />
				</template>
			</NcButton>
			<div class="series-viewer__title">
				<h2 class="series-viewer__name">
					{{ picture.baseName }}
				</h2>
				<span class="series-viewer__place">{{ place }}</span>
			</div>
			<FlagButtonsToggle :shown="settings.flagButtonsShown" @update:shown="decisions.setFlagButtonsShown" />
			<NcButton :aria-label="t('honeycomb', 'Toggle fit and 100 percent')" v-bind="tip(t('honeycomb', 'Fit / 100 %'), keyCap('zoom', 1))" @click="stage!.toggleZoom()">
				{{ zoom === null ? t('honeycomb', 'Fit') : t('honeycomb', '{percent} %', { percent: formatNumber(zoom) }, undefined, PLAIN_TEXT) }}
			</NcButton>
		</header>
		<div class="series-viewer__main">
			<LoupeStage
				ref="stage"
				class="series-viewer__stage"
				keepZoom
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
				@chromeFree="stage!.toggleZoom()"
				@swipe="decisions.swipe"
				@update:zoom="zoom = $event" />
			<LoupeNavButtons
				class="series-viewer__overlay"
				:index="props.index"
				:count="props.pictures.length"
				@page="go(props.index + $event)" />
			<p class="series-viewer__sync series-viewer__overlay" aria-live="polite">
				{{ synced }}
			</p>
		</div>
		<ActionBar
			layout="loupe"
			:common="decisions.common.value"
			:flags="settings.flagButtonsShown"
			:idle="overlays.idle.value"
			@pointerdown="overlays.wake"
			@decide="decisions.decide"
			@tag="emit('tag', picture)">
			<template #end>
				<PickRestButton @pick="emit('pickRest', picture)" />
			</template>
		</ActionBar>
	</div>
</template>

<style scoped>
.series-viewer {
	position: fixed;
	z-index: 10000;
	inset: 0;
	display: flex;
	flex-direction: column;
	background-color: var(--color-main-background);
	color: var(--color-main-text);
}

.series-viewer:focus {
	outline: none;
}

.series-viewer__top {
	display: flex;
	align-items: center;
	gap: var(--default-grid-baseline);
	padding: var(--default-grid-baseline);
}

.series-viewer__title {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
}

.series-viewer__name {
	margin: 0;
	overflow: hidden;
	font-size: inherit;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.series-viewer__place {
	color: var(--color-text-maxcontrast);
}

.series-viewer__main {
	position: relative;
	display: flex;
	flex: 1;
	min-height: 0;
}

.series-viewer__stage {
	flex: 1;
	min-width: 0;
}

.series-viewer__sync {
	position: absolute;
	bottom: var(--default-grid-baseline);
	inset-inline-start: calc(var(--photo-loupe-rail) + var(--default-grid-baseline));
	margin: 0;
	padding: 0 var(--default-grid-baseline);
	border-radius: var(--border-radius);
	background-color: var(--color-main-background-blur);
	color: var(--color-primary-element-light-text);
	pointer-events: none;
}

@media (orientation: landscape) {
	.series-viewer__top {
		position: absolute;
		z-index: 1;
		top: 0;
		inset-inline: var(--photo-loupe-rail);
		background-color: color-mix(in srgb, var(--color-main-background) 80%, transparent);
	}

	.series-viewer__sync {
		bottom: calc(var(--photo-loupe-row, 56px) + var(--default-grid-baseline));
	}

	.series-viewer__overlay {
		transition: opacity 0.2s;
	}

	.series-viewer--idle .series-viewer__overlay {
		opacity: 0;
		pointer-events: none;
	}
}
</style>
