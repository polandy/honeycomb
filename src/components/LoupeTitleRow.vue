<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import AppIcon from './AppIcon.vue'
import FlagButtonsToggle from './FlagButtonsToggle.vue'
import { keyCap } from '../hotkeys.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
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
}>()

const emit = defineEmits<{
	close: []
	move: []
	toggleZoom: []
	'update:infoOpen': [open: boolean]
	'update:filmstripOpen': [open: boolean]
	'update:navigationShown': [shown: boolean]
	'update:flagButtonsShown': [shown: boolean]
}>()
</script>

<template>
	<header class="loupe-title-row">
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
		<NcButton :aria-label="t('honeycomb', 'Toggle fit and 100 percent')" v-bind="tip(t('honeycomb', 'Fit / 100 %'), keyCap('zoom', 1))" @click="emit('toggleZoom')">
			{{ props.zoom === null ? t('honeycomb', 'Fit') : t('honeycomb', '{percent} %', { percent: formatNumber(props.zoom) }, undefined, PLAIN_TEXT) }}
		</NcButton>
		<NcButton :aria-label="t('honeycomb', 'Move this photo')" v-bind="tip(t('honeycomb', 'Move this photo'), keyCap('move'))" @click="emit('move')">
			{{ t('honeycomb', 'Move…') }}
		</NcButton>
		<FlagButtonsToggle :shown="props.flagButtonsShown" @update:shown="emit('update:flagButtonsShown', $event)" />
		<NcButton
			:aria-label="t('honeycomb', 'Toggle info panel')"
			v-bind="tip(t('honeycomb', 'Info panel'), keyCap('info'))"
			:pressed="props.infoOpen"
			@update:pressed="emit('update:infoOpen', $event)">
			{{ t('honeycomb', 'Info') }}
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
	color: var(--color-text-maxcontrast);
}
</style>
