<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { FolderSet } from '../logic/folder-set.ts'
import type { Scope } from '../logic/picture-filter.ts'
import type { SortOrder } from '../logic/picture-order.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcPopover from '@nextcloud/vue/components/NcPopover'
import AppIcon from './AppIcon.vue'
import ScopeProgress from './ScopeProgress.vue'
import { keyCap } from '../hotkeys.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { MAX_TILE_SIZE, MIN_TILE_SIZE } from '../logic/tile-size.ts'

const props = defineProps<{
	folderSet: FolderSet
	/** How many folders the cull's pictures are in. */
	folders: number
	tileSize: number
	groupByFolder: boolean
	scope: Scope
	/** Whether a flag filter overrides the scope. */
	scopeLocked: boolean
	decided: number
	total: number
	/** How many filter groups have a choice. */
	activeFilters: number
	filtersOpen: boolean
	sortOrder: SortOrder
	selecting: boolean
	/** How many pictures are selected. */
	selected: number
	/** How many pictures are rejected. */
	rejected: number
}>()

const emit = defineEmits<{
	changeFolders: []
	'update:tileSize': [size: number]
	'update:groupByFolder': [group: boolean]
	'update:scope': [scope: Scope]
	'update:filtersOpen': [open: boolean]
	'update:sortOrder': [order: SortOrder]
	'update:selecting': [selecting: boolean]
	selectAll: []
	selectNone: []
	reviewRejects: []
}>()

const filtersLabel = computed(() => (props.activeFilters > 0
	? t('honeycomb', 'Filters ({count})', { count: formatNumber(props.activeFilters) })
	: t('honeycomb', 'Filters')))

const setName = computed(() => {
	const { paths, subfolders } = props.folderSet
	if (paths.length === 1) {
		const name = paths[0]!.split('/').pop()!
		return subfolders ? t('honeycomb', '{name} + subfolders', { name }, undefined, PLAIN_TEXT) : name
	}
	const count = formatNumber(paths.length)
	return subfolders
		? n('honeycomb', '{count} folder + subfolders', '{count} folders + subfolders', paths.length, { count })
		: n('honeycomb', '{count} folder', '{count} folders', paths.length, { count })
})
</script>

<template>
	<div class="grid-toolbar">
		<nav class="grid-toolbar__crumbs" :aria-label="t('honeycomb', 'Breadcrumb')">
			<NcButton variant="tertiary" :ariaLabel="t('honeycomb', 'Change folders')" @click="emit('changeFolders')">
				<template #icon>
					<AppIcon name="home" />
				</template>
			</NcButton>
			<span class="grid-toolbar__separator" aria-hidden="true">/</span>
			<button
				type="button"
				class="grid-toolbar__set"
				:aria-label="t('honeycomb', 'Change folders: {paths}', { paths: props.folderSet.paths.join(', ') }, undefined, PLAIN_TEXT)"
				@click="emit('changeFolders')">
				{{ setName }}
			</button>
		</nav>
		<ScopeProgress
			:scope="props.scope"
			:locked="props.scopeLocked"
			:decided="props.decided"
			:total="props.total"
			@update:scope="emit('update:scope', $event)" />
		<NcButton
			variant="tertiary"
			:ariaLabel="filtersLabel"
			:aria-pressed="props.filtersOpen"
			:aria-expanded="props.filtersOpen"
			@click="emit('update:filtersOpen', !props.filtersOpen)">
			<template #icon>
				<AppIcon name="filter" />
			</template>
			<span v-if="props.activeFilters > 0" class="grid-toolbar__badge" aria-hidden="true">{{ formatNumber(props.activeFilters) }}</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			:ariaLabel="t('honeycomb', 'Select')"
			:aria-pressed="props.selecting"
			@click="emit('update:selecting', !props.selecting)">
			<template #icon>
				<AppIcon name="select" />
			</template>
			<span v-if="props.selecting && props.selected > 0" class="grid-toolbar__badge" aria-hidden="true">{{ formatNumber(props.selected) }}</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			:ariaLabel="props.rejected > 0 ? t('honeycomb', 'Review rejects ({count})', { count: formatNumber(props.rejected) }) : t('honeycomb', 'Review rejects')"
			:title="t('honeycomb', 'Review rejects ({key})', { key: keyCap('review-rejects') })"
			:disabled="props.rejected === 0"
			@click="emit('reviewRejects')">
			<template #icon>
				<AppIcon name="trash" />
			</template>
			<span v-if="props.rejected > 0" class="grid-toolbar__badge" aria-hidden="true">{{ formatNumber(props.rejected) }}</span>
		</NcButton>
		<NcPopover>
			<template #trigger>
				<NcButton variant="tertiary" :ariaLabel="t('honeycomb', 'More')">
					<template #icon>
						<AppIcon name="more" />
					</template>
				</NcButton>
			</template>
			<div class="grid-toolbar__menu">
				<label class="grid-toolbar__size">
					<span>{{ t('honeycomb', 'Thumbnail size') }}</span>
					<input
						type="range"
						:min="MIN_TILE_SIZE"
						:max="MAX_TILE_SIZE"
						step="1"
						:value="Math.round(props.tileSize)"
						:aria-label="t('honeycomb', 'Thumbnail size')"
						@input="emit('update:tileSize', Number(($event.target as HTMLInputElement).value))">
				</label>
				<NcCheckboxRadioSwitch
					v-if="props.folders > 1"
					:modelValue="props.groupByFolder"
					@update:modelValue="emit('update:groupByFolder', $event)">
					{{ t('honeycomb', 'Group by folder') }}
				</NcCheckboxRadioSwitch>
				<fieldset class="grid-toolbar__sort">
					<legend>{{ t('honeycomb', 'Sort by') }}</legend>
					<NcCheckboxRadioSwitch
						type="radio"
						name="sort-order"
						value="file-name"
						:modelValue="props.sortOrder"
						@update:modelValue="emit('update:sortOrder', $event)">
						{{ t('honeycomb', 'File name') }}
					</NcCheckboxRadioSwitch>
					<NcCheckboxRadioSwitch
						type="radio"
						name="sort-order"
						value="capture-time"
						:modelValue="props.sortOrder"
						@update:modelValue="emit('update:sortOrder', $event)">
						{{ t('honeycomb', 'Capture time') }}
					</NcCheckboxRadioSwitch>
				</fieldset>
			</div>
		</NcPopover>
		<div v-if="props.selecting" class="grid-toolbar__selection">
			<span class="grid-toolbar__count">{{ n('honeycomb', '{count} selected', '{count} selected', props.selected, { count: formatNumber(props.selected) }) }}</span>
			<NcButton variant="tertiary" @click="emit('selectAll')">
				{{ t('honeycomb', 'Select all (filtered)') }}
			</NcButton>
			<NcButton variant="tertiary" @click="emit('selectNone')">
				{{ t('honeycomb', 'None') }}
			</NcButton>
			<NcButton variant="primary" @click="emit('update:selecting', false)">
				{{ t('honeycomb', 'Done') }}
			</NcButton>
		</div>
	</div>
</template>

<style scoped>
.grid-toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline);
	padding: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
}

.grid-toolbar__crumbs {
	display: flex;
	flex: 1;
	align-items: center;
	gap: var(--default-grid-baseline);
	min-width: 0;
}

.grid-toolbar__separator {
	color: var(--color-text-maxcontrast);
}

.grid-toolbar__set {
	overflow: hidden;
	min-height: 34px;
	padding: 0 calc(2 * var(--default-grid-baseline));
	border: none;
	border-radius: var(--border-radius-element);
	background: none;
	color: var(--color-main-text);
	font-weight: bold;
	text-overflow: ellipsis;
	white-space: nowrap;
	cursor: pointer;
}

.grid-toolbar__set:focus-visible {
	outline: 2px solid var(--color-primary-element);
}

.grid-toolbar__menu {
	display: flex;
	flex-direction: column;
	gap: calc(2 * var(--default-grid-baseline));
	padding: calc(2 * var(--default-grid-baseline));
}

.grid-toolbar__badge {
	min-width: 18px;
	padding: 0 4px;
	border-radius: 9px;
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
	font-size: 12px;
	font-weight: bold;
	line-height: 18px;
	text-align: center;
}

.grid-toolbar__selection {
	display: flex;
	flex-basis: 100%;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--default-grid-baseline);
}

.grid-toolbar__count {
	flex: 1;
	font-weight: bold;
}

.grid-toolbar__sort {
	margin: 0;
	padding: 0;
	border: none;
}

.grid-toolbar__sort legend {
	font-weight: bold;
}

.grid-toolbar__size {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}

.grid-toolbar__size input {
	min-height: 34px;
	accent-color: var(--color-primary-element);
}

@media (pointer: coarse) {
	.grid-toolbar__set,
	.grid-toolbar__size input {
		min-height: 44px;
	}
}
</style>
