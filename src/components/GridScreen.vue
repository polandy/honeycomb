<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ToolbarFolders, ToolbarProgress, ToolbarSelection, ToolbarTasks, ToolbarView } from '../grid-toolbar.ts'

import { computed, useTemplateRef } from 'vue'
import CullEmptyState from './CullEmptyState.vue'
import FilterBar from './FilterBar.vue'
import GridNotices from './GridNotices.vue'
import GridToolbar from './GridToolbar.vue'
import PhotoGrid from './PhotoGrid.vue'
import SelectionBar from './SelectionBar.vue'
import SimilarityStrip from './SimilarityStrip.vue'
import { useCullContext } from '../cull-context.ts'
import { isPicked } from '../logic/decision.ts'
import { DEFAULT_FILTERS } from '../logic/picture-filter.ts'

const { cull, selection, decide, deleting, moving, resume, seriesCompare, sidecars, tagEntry, headerShown, openLoupe, openSettings } = useCullContext()
const { folderSet, pictures, folderPaths, folders, grouped, view, progress, shownProgress, filters, activeFilters, empty, sortOrder, filtersOpen, pickerOpen, groupByFolder, tileSize, saveFailed } = cull
const { selecting, selected } = selection
const { rejected, rawRemovable } = deleting
const grid = useTemplateRef<InstanceType<typeof PhotoGrid>>('grid')
const filterBar = useTemplateRef<InstanceType<typeof FilterBar>>('filterBar')

const common = computed(() => cull.common(selected.value))
const movable = computed(() => (activeFilters.value > 0 ? view.value : pictures.value.filter((picture) => isPicked(cull.decisionOf(picture)))))

const toolbarFolders = computed<ToolbarFolders | null>(() => folderSet.value && { set: folderSet.value, count: folders.value })
const toolbarView = computed<ToolbarView>(() => ({ tileSize: tileSize.value, groupByFolder: groupByFolder.value, sortOrder: sortOrder.value, flags: filters.value.flags, filtersOpen: filtersOpen.value, activeFilters: activeFilters.value }))
const toolbarProgress = computed<ToolbarProgress>(() => ({ decided: shownProgress.value.decided, total: shownProgress.value.total, filtered: shownProgress.value.total < progress.value.total }))
const toolbarSelection = computed<ToolbarSelection>(() => ({ selecting: selecting.value, selected: selected.value.length }))
const toolbarTasks = computed<ToolbarTasks>(() => ({
	rejected: rejected.value.length,
	series: cull.series.value.length,
	rawRemovable: rawRemovable.value,
	movable: movable.value.length,
	sidecarsShared: cull.sharedPictures.value.length > 0,
	resumeName: resume.resumeName.value,
}))

defineExpose({ grid, filterBar })
</script>

<template>
	<template v-if="folderSet !== null && toolbarFolders !== null">
		<GridToolbar
			v-if="headerShown"
			:folders="toolbarFolders"
			:view="toolbarView"
			:progress="toolbarProgress"
			:selection="toolbarSelection"
			:tasks="toolbarTasks"
			@changeFolders="pickerOpen = true"
			@update:tileSize="cull.setTileSize"
			@update:groupByFolder="groupByFolder = $event"
			@update:flags="cull.setFlags"
			@update:filtersOpen="filtersOpen = $event"
			@update:sortOrder="sortOrder = $event"
			@update:selecting="selection.setSelecting"
			@selectAll="selection.selectAll"
			@selectNone="selection.selectNone"
			@reviewRejects="deleting.review"
			@compareSeries="seriesCompare.start"
			@removeRaws="deleting.removeRaws"
			@move="moving.open(movable)"
			@resume="resume.resume"
			@writeSidecars="sidecars.ask(cull.sharedDecided())"
			@openSettings="openSettings" />
		<FilterBar
			v-if="filtersOpen && headerShown"
			ref="filterBar"
			:filters="filters"
			:folders="folderPaths"
			:folderSet="folderSet"
			:shown="view.length"
			:total="pictures.length"
			:known="cull.tags.known.value"
			@update:filters="filters = $event" />
		<GridNotices :pictures="view" :saveFailed="saveFailed" />
		<PhotoGrid
			v-if="view.length > 0"
			ref="grid"
			class="grid-screen__grid"
			:pictures="view"
			:folderSet="folderSet"
			:groupByFolder="grouped"
			:tileSize="tileSize"
			:selecting="selecting"
			:selection="selection.selection.value"
			:decisionOf="cull.decisionOf"
			:tagsOf="cull.tags.tagsOf"
			:seriesSizes="cull.seriesSizes.value"
			:openSeries="cull.openSeries.value"
			@update:tileSize="cull.setTileSize"
			@update:selecting="selection.setSelecting"
			@update:selection="selection.select"
			@open="openLoupe"
			@scroll="resume.dismiss">
			<SimilarityStrip :progress="cull.hashProgress.value" />
		</PhotoGrid>
		<CullEmptyState
			v-else
			:reason="empty"
			:rejected="rejected.length"
			@clearFilters="filters = DEFAULT_FILTERS"
			@showAll="cull.setFlags(new Set())"
			@reviewRejects="deleting.review" />
		<SelectionBar
			v-if="selecting"
			:common="common"
			:selected="selected.length"
			@decide="decide($event, selected)"
			@tag="tagEntry.open(selected)"
			@move="moving.open(selected)"
			@delete="deleting.summarise(selected)" />
	</template>
</template>

<style scoped>
.grid-screen__grid {
	flex: 1;
}
</style>
