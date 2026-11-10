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
import { formatNumber } from '../l10n.ts'
import { MAX_TILE_SIZE, MIN_TILE_SIZE } from '../logic/tile-size.ts'

defineProps<{
	/** How many folders the cull's pictures are in. */
	folders: number
	tileSize: number
	groupByFolder: boolean
	sortOrder: SortOrder
	/** How many pictures of the view would lose their RAW to *Remove RAWs*. */
	rawRemovable: number
}>()

const emit = defineEmits<{
	'update:tileSize': [size: number]
	'update:groupByFolder': [group: boolean]
	'update:sortOrder': [order: SortOrder]
	removeRaws: []
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

@media (pointer: coarse) {
	.grid-more-menu__size input {
		min-height: 44px;
	}
}
</style>
