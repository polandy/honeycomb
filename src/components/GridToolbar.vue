<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { Flag } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { SortOrder } from '../logic/picture-order.ts'

import { n, t } from '@nextcloud/l10n'
import { computed } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcPopover from '@nextcloud/vue/components/NcPopover'
import AppIcon from './AppIcon.vue'
import CullProgress from './CullProgress.vue'
import FlagFilter from './FlagFilter.vue'
import GridMoreMenu from './GridMoreMenu.vue'
import { keyCap } from '../hotkeys.ts'
import { formatNumber, PLAIN_TEXT } from '../l10n.ts'
import { tip } from '../tooltip.ts'

const props = defineProps<{
	folderSet: FolderSet
	/** How many folders the cull's pictures are in. */
	folders: number
	tileSize: number
	groupByFolder: boolean
	/** The pressed flags of the flag filter. */
	flags: ReadonlySet<Flag>
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
	/** How many series are left to compare. */
	series: number
	rawRemovable: number
	sidecarsShared: boolean
	/** How many pictures *Move picks* or, while a filter is on, *Move filtered* opens the move dialog on. */
	movable: number
	/** The base name of the picture *Resume* opens the loupe at, null when there is none. */
	resumeName: string | null
}>()

const emit = defineEmits<{
	changeFolders: []
	'update:tileSize': [size: number]
	'update:groupByFolder': [group: boolean]
	'update:flags': [flags: ReadonlySet<Flag>]
	'update:filtersOpen': [open: boolean]
	'update:sortOrder': [order: SortOrder]
	'update:selecting': [selecting: boolean]
	selectAll: []
	selectNone: []
	reviewRejects: []
	compareSeries: []
	removeRaws: []
	move: []
	resume: []
	writeSidecars: []
	openSettings: []
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
			<NcButton
				variant="tertiary"
				:ariaLabel="t('honeycomb', 'Change folders')"
				v-bind="tip(t('honeycomb', 'Change folders'))"
				@click="emit('changeFolders')">
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
		<FlagFilter :flags="props.flags" @update:flags="emit('update:flags', $event)" />
		<CullProgress :decided="props.decided" :total="props.total" />
		<NcButton
			variant="tertiary"
			:ariaLabel="filtersLabel"
			v-bind="tip(t('honeycomb', 'Filter'), keyCap('filter-bar'))"
			:aria-pressed="props.filtersOpen"
			:aria-expanded="props.filtersOpen"
			@click="emit('update:filtersOpen', !props.filtersOpen)">
			<template #icon>
				<AppIcon name="filter" />
			</template>
			<span
				v-if="props.activeFilters > 0"
				class="grid-toolbar__badge"
				:class="{ 'grid-toolbar__badge--pressed': props.filtersOpen }"
				aria-hidden="true">
				{{ formatNumber(props.activeFilters) }}
			</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			:ariaLabel="t('honeycomb', 'Select')"
			v-bind="tip(t('honeycomb', 'Select'))"
			:aria-pressed="props.selecting"
			@click="emit('update:selecting', !props.selecting)">
			<template #icon>
				<AppIcon name="select" />
			</template>
			<span v-if="props.selecting && props.selected > 0" class="grid-toolbar__badge grid-toolbar__badge--pressed" aria-hidden="true">{{ formatNumber(props.selected) }}</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			:ariaLabel="props.rejected > 0 ? t('honeycomb', 'Review rejects ({count})', { count: formatNumber(props.rejected) }) : t('honeycomb', 'Review rejects')"
			v-bind="tip(t('honeycomb', 'Review rejects'), keyCap('review-rejects'))"
			:disabled="props.rejected === 0"
			@click="emit('reviewRejects')">
			<template #icon>
				<AppIcon name="trash" />
			</template>
			<span v-if="props.rejected > 0" class="grid-toolbar__badge" aria-hidden="true">{{ formatNumber(props.rejected) }}</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			:ariaLabel="props.series > 0 ? t('honeycomb', 'Compare series ({count})', { count: formatNumber(props.series) }) : t('honeycomb', 'Compare series')"
			v-bind="tip(t('honeycomb', 'Compare series'), keyCap('compare'))"
			:disabled="props.series === 0"
			@click="emit('compareSeries')">
			<template #icon>
				<AppIcon name="compare" />
			</template>
			<span v-if="props.series > 0" class="grid-toolbar__badge" aria-hidden="true">{{ formatNumber(props.series) }}</span>
		</NcButton>
		<NcPopover>
			<template #trigger>
				<NcButton variant="tertiary" :ariaLabel="t('honeycomb', 'More')" v-bind="tip(t('honeycomb', 'More'))">
					<template #icon>
						<AppIcon name="more" />
					</template>
				</NcButton>
			</template>
			<GridMoreMenu
				:folders="props.folders"
				:tileSize="props.tileSize"
				:groupByFolder="props.groupByFolder"
				:sortOrder="props.sortOrder"
				:rawRemovable="props.rawRemovable"
				:sidecarsShared="props.sidecarsShared"
				:movable="props.movable"
				:moveFiltered="props.activeFilters > 0"
				:resumeName="props.resumeName"
				@update:tileSize="emit('update:tileSize', $event)"
				@update:groupByFolder="emit('update:groupByFolder', $event)"
				@update:sortOrder="emit('update:sortOrder', $event)"
				@removeRaws="emit('removeRaws')"
				@move="emit('move')"
				@resume="emit('resume')"
				@writeSidecars="emit('writeSidecars')"
				@openSettings="emit('openSettings')" />
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
	flex: 1 1 160px;
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

.grid-toolbar__badge {
	min-width: 18px;
	padding: 0 4px;
	border-radius: 9px;
	background: var(--color-background-darker);
	color: var(--color-main-text);
	font-size: 12px;
	font-weight: bold;
	line-height: 18px;
	text-align: center;
}

.grid-toolbar__badge--pressed {
	background: var(--color-primary-element);
	color: var(--color-primary-element-text);
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

@media (pointer: coarse) {
	.grid-toolbar__set {
		min-height: 44px;
	}
}
</style>
