<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import { useTemplateRef } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import FlagButtonsToggle from './FlagButtonsToggle.vue'
import SeriesHint from './SeriesHint.vue'
import { useFullscreenState } from '../fullscreen.ts'
import { keyCap } from '../hotkeys.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { tip } from '../tooltip.ts'

const props = withDefaults(defineProps<{
	name: string
	/** The shown picture's index. */
	index: number
	count: number
	/** The zoom in percent of the full image, null when fitted. */
	zoom: number | null
	infoOpen: boolean
	filmstripOpen: boolean
	/** Whether Nextcloud's header shows above the loupe. */
	navigationShown: boolean
	flagButtonsShown: boolean
	/** The shown picture's place in its series, from 1, and the series' count; null outside a series (LOUPE-001.25). */
	series?: { position: number, count: number } | null
	/** Whether the first-series hint shows under the chip, which then pulses (LOUPE-001.26). */
	seriesHint?: boolean
}>(), { series: null, seriesHint: false })

const emit = defineEmits<{
	close: []
	compareSeries: []
	dismissSeriesHint: []
	move: []
	toggleZoom: []
	toggleFullscreen: []
	'update:infoOpen': [open: boolean]
	'update:filmstripOpen': [open: boolean]
	'update:navigationShown': [shown: boolean]
	'update:flagButtonsShown': [shown: boolean]
}>()

const fullscreen = useFullscreenState()
const row = useTemplateRef<HTMLElement>('row')
const chip = useTemplateRef<HTMLButtonElement>('chip')

/** The mark that stands for a series, as on the filmstrip's frame tab. */
const SERIES_MARK = '⧉'
</script>

<template>
	<header ref="row" class="loupe-title-row">
		<NcButton
			variant="tertiary"
			:aria-label="t('honeycomb', 'Close loupe')"
			v-bind="tip(t('honeycomb', 'Close loupe'), keyCap('close'))"
			@click="emit('close')">
			<template #icon>
				<AppIcon name="close" />
			</template>
		</NcButton>
		<h2 class="loupe-title-row__name">
			{{ props.name }}
		</h2>
		<span class="loupe-title-row__count">{{ t('honeycomb', '{position} of {count}', { position: formatNumber(props.index + 1), count: formatNumber(props.count) }, undefined, PLAIN_TEXT) }}</span>
		<span v-if="props.series !== null" class="loupe-title-row__series-anchor">
			<button
				ref="chip"
				type="button"
				class="loupe-title-row__series"
				:class="{ 'loupe-title-row__series--pulse': props.seriesHint }"
				:aria-label="t('honeycomb', 'Photo {position} of a series of {count} – compare', { position: formatNumber(props.series.position), count: formatNumber(props.series.count) }, undefined, PLAIN_TEXT)"
				v-bind="tip(t('honeycomb', 'Compare this series'), keyCap('compare'))"
				@click="emit('compareSeries')">
				{{ SERIES_MARK }} <span class="loupe-title-row__series-word">{{ t('honeycomb', 'Series') }}</span> {{ t('honeycomb', '{position}/{count}', { position: formatNumber(props.series.position), count: formatNumber(props.series.count) }, undefined, PLAIN_TEXT) }}
			</button>
			<SeriesHint
				v-if="props.seriesHint && row && chip"
				:count="props.series.count"
				:anchor="chip"
				:box="row"
				@dismiss="emit('dismissSeriesHint')" />
		</span>
		<NcButton
			variant="tertiary"
			:aria-label="t('honeycomb', 'Toggle fit and 100 percent')"
			v-bind="tip(t('honeycomb', 'Fit / 100 %'), keyCap('zoom', 1))"
			:pressed="props.zoom !== null"
			@update:pressed="emit('toggleZoom')">
			<template #icon>
				<AppIcon name="zoom" />
			</template>
		</NcButton>
		<NcButton
			variant="tertiary"
			:aria-label="t('honeycomb', 'Move this photo')"
			v-bind="tip(t('honeycomb', 'Move this photo'), keyCap('move'))"
			@click="emit('move')">
			<template #icon>
				<AppIcon name="move" />
			</template>
		</NcButton>
		<FlagButtonsToggle :shown="props.flagButtonsShown" @update:shown="emit('update:flagButtonsShown', $event)" />
		<NcButton
			variant="tertiary"
			:aria-label="t('honeycomb', 'Toggle info panel')"
			v-bind="tip(t('honeycomb', 'Info panel'), keyCap('info'))"
			:pressed="props.infoOpen"
			@update:pressed="emit('update:infoOpen', $event)">
			<template #icon>
				<AppIcon name="info" />
			</template>
		</NcButton>
		<NcButton
			v-if="fullscreen.available"
			variant="tertiary"
			:aria-label="fullscreen.active.value ? t('honeycomb', 'Leave fullscreen') : t('honeycomb', 'Enter fullscreen')"
			v-bind="tip(fullscreen.active.value ? t('honeycomb', 'Leave fullscreen') : t('honeycomb', 'Enter fullscreen'), keyCap('fullscreen'))"
			:pressed="fullscreen.active.value"
			@update:pressed="emit('toggleFullscreen')">
			<template #icon>
				<AppIcon name="fullscreen" />
			</template>
		</NcButton>
		<NcButton
			variant="tertiary"
			:aria-label="t('honeycomb', 'Toggle filmstrip')"
			v-bind="tip(t('honeycomb', 'Filmstrip'))"
			:pressed="props.filmstripOpen"
			@update:pressed="emit('update:filmstripOpen', $event)">
			<template #icon>
				<AppIcon name="film" />
			</template>
		</NcButton>
		<NcButton
			variant="tertiary"
			:aria-label="t('honeycomb', 'Toggle Nextcloud navigation')"
			v-bind="tip(t('honeycomb', 'Nextcloud navigation'))"
			:pressed="props.navigationShown"
			@update:pressed="emit('update:navigationShown', $event)">
			<template #icon>
				<AppIcon name="menu" />
			</template>
		</NcButton>
	</header>
</template>

<style scoped>
/* A honey outline, never filled: a fill marks a pressed state (LOUPE-001.25). */
.loupe-title-row__series {
	flex-shrink: 0;
	min-height: 44px;
	margin: 0;
	padding: 0 12px;
	border: 2px solid var(--color-primary-element);
	border-radius: 22px;
	background: transparent;
	color: var(--color-primary-element);
	font-weight: bold;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
	cursor: pointer;
}

@media (pointer: fine) {
	.loupe-title-row__series {
		min-height: 34px;
	}
}

.loupe-title-row__series-anchor {
	position: relative;
	display: flex;
	flex-shrink: 0;
}

/* A honey pulse, run twice, calls the eye to the chip the first-series hint explains (LOUPE-001.26). */
.loupe-title-row__series--pulse {
	animation: loupe-title-row-pulse 1.2s ease-out 2;
}

@keyframes loupe-title-row-pulse {
	from {
		box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary-element) 80%, transparent);
	}

	to {
		box-shadow: 0 0 0 14px transparent;
	}
}

@media (prefers-reduced-motion: reduce) {
	.loupe-title-row__series--pulse {
		animation: none;
	}
}

/* A phone shows the mark and the numbers only, either way round. */
@media (max-width: 520px), (max-height: 520px) {
	.loupe-title-row__series-word {
		display: none;
	}
}

.loupe-title-row {
	display: flex;
	align-items: center;
	gap: var(--default-grid-baseline);
	padding: var(--default-grid-baseline);
}

.loupe-title-row__name {
	flex: 1;
	min-width: 0;
	margin: 0;
	overflow: hidden;
	font-size: inherit;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.loupe-title-row__count {
	flex-shrink: 0;
	color: var(--color-text-maxcontrast);
	white-space: nowrap;
}
</style>
