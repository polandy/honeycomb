<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { SortOrder } from '../logic/picture-order.ts'

import { t } from '@nextcloud/l10n'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import GridMoreGroup from './GridMoreGroup.vue'
import { keyCap } from '../hotkeys.ts'
import { MAX_TILE_SIZE, MIN_TILE_SIZE } from '../logic/tile-size.ts'

defineProps<{
	/** How many folders the cull's pictures are in. */
	folders: number
	tileSize: number
	groupByFolder: boolean
	fileNames: boolean
	sortOrder: SortOrder
}>()

const emit = defineEmits<{
	'update:tileSize': [size: number]
	'update:groupByFolder': [group: boolean]
	'update:fileNames': [shown: boolean]
	'update:sortOrder': [order: SortOrder]
}>()
</script>

<template>
	<GridMoreGroup :heading="t('honeycomb', 'View')">
		<label class="grid-view-options__size">
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
			<kbd class="grid-view-options__key" translate="no">{{ keyCap('file-names') }}</kbd>
		</NcCheckboxRadioSwitch>
		<fieldset class="grid-view-options__sort">
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
	</GridMoreGroup>
</template>

<style scoped>
.grid-view-options__sort {
	margin: 0;
	padding: 0;
	border: none;
}

.grid-view-options__sort legend {
	font-weight: bold;
}

.grid-view-options__size {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}

.grid-view-options__size input {
	min-height: 34px;
	accent-color: var(--color-primary-element);
}

.grid-view-options__key {
	margin-inline-start: calc(2 * var(--default-grid-baseline));
	color: var(--color-text-maxcontrast);
	font-family: inherit;
}

@media (pointer: coarse) {
	.grid-view-options__size input {
		min-height: 44px;
	}
}
</style>
