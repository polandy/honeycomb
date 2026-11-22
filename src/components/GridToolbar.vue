<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ToolbarFolders, ToolbarProgress, ToolbarSelection, ToolbarTasks, ToolbarView } from '../grid-toolbar.ts'
import type { Flag } from '../logic/decision.ts'
import type { SortOrder } from '../logic/picture-order.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, ref } from 'vue'
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
	folders: ToolbarFolders
	view: ToolbarView
	progress: ToolbarProgress
	selection: ToolbarSelection
	tasks: ToolbarTasks
}>()

const emit = defineEmits<{
	changeFolders: []
	/** Back to *Folders*, which opened the cull. */
	back: []
	'update:tileSize': [size: number]
	'update:groupByFolder': [group: boolean]
	'update:fileNames': [shown: boolean]
	'update:flags': [flags: ReadonlySet<Flag>]
	'update:filtersOpen': [open: boolean]
	'update:sortOrder': [order: SortOrder]
	'update:selecting': [selecting: boolean]
	selectAll: []
	selectNone: []
	reviewRejects: []
	compareSeries: []
	reduceSeries: []
	removeRaws: []
	clearFlags: []
	writeXmp: []
	move: []
	resume: []
	openSettings: []
}>()

const moreShown = ref(false)

/** Closes the More menu, then runs the chosen action, so no menu stays above the dialog it opens. */
function fromMenu(action: () => void) {
	moreShown.value = false
	action()
}

const filtersLabel = computed(() => (props.view.activeFilters > 0
	? t('honeycomb', 'Filters ({count})', { count: formatNumber(props.view.activeFilters) })
	: t('honeycomb', 'Filters')))

const setName = computed(() => {
	const { paths, subfolders } = props.folders.set
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
				v-if="props.folders.back"
				variant="tertiary"
				:ariaLabel="t('honeycomb', 'Back to folders')"
				v-bind="tip(t('honeycomb', 'Back to folders'))"
				@click="emit('back')">
				<template #icon>
					<AppIcon name="back" />
				</template>
			</NcButton>
			<NcButton
				v-else
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
				:aria-label="t('honeycomb', 'Change folders: {paths}', { paths: props.folders.set.paths.join(', ') }, undefined, PLAIN_TEXT)"
				@click="emit('changeFolders')">
				{{ setName }}
			</button>
		</nav>
		<FlagFilter :flags="props.view.flags" @update:flags="emit('update:flags', $event)" />
		<CullProgress v-bind="props.progress" />
		<NcButton
			variant="tertiary"
			:ariaLabel="filtersLabel"
			v-bind="tip(t('honeycomb', 'Filter'), keyCap('filter-bar'))"
			:aria-pressed="props.view.filtersOpen"
			:aria-expanded="props.view.filtersOpen"
			@click="emit('update:filtersOpen', !props.view.filtersOpen)">
			<template #icon>
				<AppIcon name="filter" />
			</template>
			<span
				v-if="props.view.activeFilters > 0"
				class="grid-toolbar__badge"
				:class="{ 'grid-toolbar__badge--pressed': props.view.filtersOpen }"
				aria-hidden="true">
				{{ formatNumber(props.view.activeFilters) }}
			</span>
		</NcButton>
		<NcButton
			variant="tertiary"
			:ariaLabel="props.selection.selecting && props.selection.selected > 0 ? t('honeycomb', 'Select: {count} selected', { count: formatNumber(props.selection.selected) }) : t('honeycomb', 'Select')"
			v-bind="tip(t('honeycomb', 'Select'))"
			:aria-pressed="props.selection.selecting"
			@click="emit('update:selecting', !props.selection.selecting)">
			<template #icon>
				<AppIcon name="select" />
			</template>
			<span v-if="props.selection.selecting && props.selection.selected > 0" class="grid-toolbar__badge grid-toolbar__badge--pressed" aria-hidden="true">{{ formatNumber(props.selection.selected) }}</span>
		</NcButton>
		<NcButton
			class="grid-toolbar__wide"
			variant="tertiary"
			:ariaLabel="props.tasks.rejected > 0 ? t('honeycomb', 'Review rejects: {count}', { count: formatNumber(props.tasks.rejected) }) : t('honeycomb', 'Review rejects')"
			v-bind="tip(t('honeycomb', 'Review rejects'), keyCap('review-rejects'))"
			:disabled="props.tasks.rejected === 0"
			@click="emit('reviewRejects')">
			<template #icon>
				<AppIcon name="trash" />
			</template>
			<span v-if="props.tasks.rejected > 0" class="grid-toolbar__badge" aria-hidden="true">{{ formatNumber(props.tasks.rejected) }}</span>
		</NcButton>
		<NcButton
			class="grid-toolbar__wide"
			variant="tertiary"
			:ariaLabel="props.tasks.series > 0 ? t('honeycomb', 'Compare series: {count}', { count: formatNumber(props.tasks.series) }) : t('honeycomb', 'Compare series')"
			v-bind="tip(t('honeycomb', 'Compare series'), keyCap('compare'))"
			:disabled="props.tasks.series === 0"
			@click="emit('compareSeries')">
			<template #icon>
				<AppIcon name="compare" />
			</template>
			<span v-if="props.tasks.series > 0" class="grid-toolbar__badge" aria-hidden="true">{{ formatNumber(props.tasks.series) }}</span>
		</NcButton>
		<NcPopover v-model:shown="moreShown">
			<template #trigger>
				<NcButton variant="tertiary" :ariaLabel="t('honeycomb', 'More')" v-bind="tip(t('honeycomb', 'More'))">
					<template #icon>
						<AppIcon name="more" />
					</template>
				</NcButton>
			</template>
			<GridMoreMenu
				:folders="props.folders.count"
				:tileSize="props.view.tileSize"
				:groupByFolder="props.view.groupByFolder"
				:fileNames="props.view.fileNames"
				:sortOrder="props.view.sortOrder"
				:rawRemovable="props.tasks.rawRemovable"
				:clearable="props.tasks.clearable"
				:xmpToWrite="props.tasks.xmpToWrite"
				:movable="props.tasks.movable"
				:moveFiltered="props.view.activeFilters > 0"
				:resumeName="props.tasks.resumeName"
				:rejected="props.tasks.rejected"
				:series="props.tasks.series"
				:reducible="props.tasks.reducible"
				@update:tileSize="emit('update:tileSize', $event)"
				@update:groupByFolder="emit('update:groupByFolder', $event)"
				@update:fileNames="emit('update:fileNames', $event)"
				@update:sortOrder="emit('update:sortOrder', $event)"
				@removeRaws="fromMenu(() => emit('removeRaws'))"
				@clearFlags="fromMenu(() => emit('clearFlags'))"
				@writeXmp="fromMenu(() => emit('writeXmp'))"
				@move="fromMenu(() => emit('move'))"
				@resume="fromMenu(() => emit('resume'))"
				@reviewRejects="fromMenu(() => emit('reviewRejects'))"
				@compareSeries="fromMenu(() => emit('compareSeries'))"
				@reduceSeries="fromMenu(() => emit('reduceSeries'))"
				@openSettings="fromMenu(() => emit('openSettings'))" />
		</NcPopover>
		<div v-if="props.selection.selecting" class="grid-toolbar__selection">
			<span class="grid-toolbar__count">{{ n('honeycomb', '{count} selected', '{count} selected', props.selection.selected, { count: formatNumber(props.selection.selected) }) }}</span>
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

<style scoped src="./grid-toolbar.css" />
