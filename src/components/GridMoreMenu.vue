<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SortOrder } from '../logic/picture-order.ts'

import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import AppIcon from './AppIcon.vue'
import { keyCap } from '../hotkeys.ts'
import { formatNumber } from '../l10n.ts'
import { MAX_TILE_SIZE, MIN_TILE_SIZE } from '../logic/tile-size.ts'

defineProps<{
	/** How many folders the cull's pictures are in. */
	folders: number
	tileSize: number
	groupByFolder: boolean
	fileNames: boolean
	sortOrder: SortOrder
	/** How many pictures of the view would lose their RAW to *Remove RAWs*. */
	rawRemovable: number
	/** How many rateable pictures *Clear picks/rejects* resets. */
	clearable: number
	/** How many XMP files *Write picks/rejects to XMP* writes. */
	xmpToWrite: number
	/** How many pictures the move item opens the move dialog on. */
	movable: number
	/** Whether a filter is on, which makes *Move picks* *Move filtered*. */
	moveFiltered: boolean
	/** The base name of the picture *Resume* opens the loupe at, null when there is none. */
	resumeName: string | null
	/** How many pictures are rejected. */
	rejected: number
	/** How many series are left to compare. */
	series: number
}>()

const emit = defineEmits<{
	'update:tileSize': [size: number]
	'update:groupByFolder': [group: boolean]
	'update:fileNames': [shown: boolean]
	'update:sortOrder': [order: SortOrder]
	removeRaws: []
	clearFlags: []
	writeXmp: []
	move: []
	resume: []
	reviewRejects: []
	compareSeries: []
	openSettings: []
}>()
</script>

<template>
	<div class="grid-more-menu">
		<label class="grid-more-menu__size">
			<span>{{ t('honeycomb', 'Thumbnail size') }}</span>
			<input
				type="range"
				:min="MIN_TILE_SIZE"
				:max="MAX_TILE_SIZE"
				step="1"
				:value="Math.round(tileSize)"
				:aria-label="t('honeycomb', 'Thumbnail size')"
				@input="emit('update:tileSize', Number(($event.target as HTMLInputElement).value))">
		</label>
		<NcCheckboxRadioSwitch
			v-if="folders > 1"
			:modelValue="groupByFolder"
			@update:modelValue="emit('update:groupByFolder', $event)">
			{{ t('honeycomb', 'Group by folder') }}
		</NcCheckboxRadioSwitch>
		<NcCheckboxRadioSwitch
			:modelValue="fileNames"
			@update:modelValue="emit('update:fileNames', $event)">
			{{ t('honeycomb', 'Show file names') }}
			<kbd class="grid-more-menu__key" translate="no">{{ keyCap('file-names') }}</kbd>
		</NcCheckboxRadioSwitch>
		<fieldset class="grid-more-menu__sort">
			<legend>{{ t('honeycomb', 'Sort by') }}</legend>
			<NcCheckboxRadioSwitch
				type="radio"
				name="sort-order"
				value="file-name"
				:modelValue="sortOrder"
				@update:modelValue="emit('update:sortOrder', $event)">
				{{ t('honeycomb', 'File name') }}
			</NcCheckboxRadioSwitch>
			<NcCheckboxRadioSwitch
				type="radio"
				name="sort-order"
				value="capture-time"
				:modelValue="sortOrder"
				@update:modelValue="emit('update:sortOrder', $event)">
				{{ t('honeycomb', 'Capture time') }}
			</NcCheckboxRadioSwitch>
		</fieldset>
		<hr class="grid-more-menu__separator">
		<NcButton
			variant="tertiary"
			alignment="start"
			wide
			:disabled="rejected === 0"
			@click="emit('reviewRejects')">
			<template #icon>
				<AppIcon name="trash" />
			</template>
			{{ t('honeycomb', 'Review rejects') }}
			<span class="grid-more-menu__count">{{ formatNumber(rejected) }}</span>
			<kbd class="grid-more-menu__key" translate="no">{{ keyCap('review-rejects') }}</kbd>
		</NcButton>
		<NcButton
			class="grid-more-menu__narrow"
			variant="tertiary"
			alignment="start"
			wide
			:disabled="series === 0"
			@click="emit('compareSeries')">
			<template #icon>
				<AppIcon name="compare" />
			</template>
			{{ t('honeycomb', 'Compare series') }}
			<span class="grid-more-menu__count">{{ formatNumber(series) }}</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			alignment="start"
			wide
			:disabled="rawRemovable === 0"
			@click="emit('removeRaws')">
			<template #icon>
				<AppIcon name="trash" />
			</template>
			{{ t('honeycomb', 'Remove RAWs…') }}
			<span class="grid-more-menu__count">{{ formatNumber(rawRemovable) }}</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			alignment="start"
			wide
			:disabled="movable === 0"
			@click="emit('move')">
			<template #icon>
				<AppIcon name="folder" />
			</template>
			{{ moveFiltered ? t('honeycomb', 'Move filtered…') : t('honeycomb', 'Move picks…') }}
			<span class="grid-more-menu__count">{{ formatNumber(movable) }}</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			alignment="start"
			wide
			:disabled="clearable === 0"
			@click="emit('clearFlags')">
			<template #icon>
				<AppIcon name="undo" />
			</template>
			{{ t('honeycomb', 'Clear picks/rejects') }}
			<span class="grid-more-menu__count">{{ formatNumber(clearable) }}</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			alignment="start"
			wide
			:disabled="xmpToWrite === 0"
			@click="emit('writeXmp')">
			<template #icon>
				<AppIcon name="flagPick" />
			</template>
			{{ t('honeycomb', 'Write picks/rejects to XMP') }}
			<span class="grid-more-menu__count">{{ formatNumber(xmpToWrite) }}</span>
		</NcButton>
		<NcButton
			v-if="resumeName !== null"
			variant="tertiary"
			alignment="start"
			wide
			@click="emit('resume')">
			<template #icon>
				<AppIcon name="folder" />
			</template>
			{{ t('honeycomb', 'Resume at {name}', { name: resumeName }) }}
		</NcButton>
		<NcButton
			variant="tertiary"
			alignment="start"
			wide
			@click="emit('openSettings')">
			<template #icon>
				<AppIcon name="settings" />
			</template>
			{{ t('honeycomb', 'Settings') }}
		</NcButton>
	</div>
</template>

<style scoped>
.grid-more-menu {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
}

.grid-more-menu__count {
	margin-inline-start: calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
}

.grid-more-menu__key {
	margin-inline-start: calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
	font-family: inherit;
}

.grid-more-menu__separator {
	width: 100%;
	margin: 0;
	border: none;
	border-top: 1px solid var(--color-border);
}

.grid-more-menu__sort {
	margin: 0;
	padding: 0;
	border: none;
}

.grid-more-menu__sort legend {
	font-weight: bold;
}

.grid-more-menu__size {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}

.grid-more-menu__size input {
	min-height: 34px;
	accent-color: var(--color-primary-element);
}

/* From 900 px the toolbar shows these itself (GridToolbar). */
@media (min-width: 900px) {
	.grid-more-menu__narrow {
		display: none;
	}
}

@media (pointer: coarse) {
	.grid-more-menu__size input {
		min-height: 44px;
	}
}
</style>
