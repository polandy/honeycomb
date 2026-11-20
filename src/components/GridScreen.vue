<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { ToolbarFolders, ToolbarProgress, ToolbarSelection, ToolbarTasks, ToolbarView } from '../grid-toolbar.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Series } from '../logic/series.ts'

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
import { imageMember } from '../logic/image-tiers.ts'
import { landingTarget } from '../logic/loupe-pictures.ts'
import { DEFAULT_FILTERS } from '../logic/picture-filter.ts'
import { toggleGroup } from '../logic/selection.ts'
import { seriesOffer } from '../logic/series-menu.ts'

const { cull, selection, decide, clearFlags, xmpExport, editSeries, deleting, moving, resume, seriesCompare, tagEntry, headerShown, openLoupe, openSettings, unsaved, settings, updateSettings, imageUrl } = useCullContext()
const { folderSet, pictures, folderPaths, folders, grouped, view, progress, shownProgress, filters, activeFilters, empty, sortOrder, filtersOpen, pickerOpen, groupByFolder, tileSize } = cull
const { selecting, selected } = selection
const { rejected, rawRemovable } = deleting
const grid = useTemplateRef<InstanceType<typeof PhotoGrid>>('grid')
const filterBar = useTemplateRef<InstanceType<typeof FilterBar>>('filterBar')

const common = computed(() => cull.common(selected.value))
const offer = computed(() => seriesOffer(selected.value, cull.seriesOf.value))
const movable = computed(() => (activeFilters.value > 0 ? view.value : pictures.value.filter((picture) => isPicked(cull.decisionOf(picture)))))

const toolbarFolders = computed<ToolbarFolders | null>(() => folderSet.value && { set: folderSet.value, count: folders.value })
const toolbarView = computed<ToolbarView>(() => ({ tileSize: tileSize.value, groupByFolder: groupByFolder.value, fileNames: settings.value.showFileNames, sortOrder: sortOrder.value, flags: filters.value.flags, filtersOpen: filtersOpen.value, activeFilters: activeFilters.value }))
const toolbarProgress = computed<ToolbarProgress>(() => ({ decided: shownProgress.value.decided, total: shownProgress.value.total, filtered: shownProgress.value.total < progress.value.total }))
const toolbarSelection = computed<ToolbarSelection>(() => ({ selecting: selecting.value, selected: selected.value.length }))
const toolbarTasks = computed<ToolbarTasks>(() => ({
	rejected: rejected.value.length,
	series: cull.series.value.length,
	rawRemovable: rawRemovable.value,
	clearable: cull.clearable.value,
	xmpToWrite: xmpExport.count.value,
	movable: movable.value.length,
	resumeName: resume.resumeName.value,
}))

const offeredSeries = computed(() => new Set(cull.series.value.map((series) => series.key)))

/** A badge tap opens the compare on its series and lands the grid where it closes; in selection mode it selects the series instead (SERIES-002.13, SERIES-002.14). */
function onCompareSeries(series: Series<Picture<ListingEntry>>, picture: Picture<ListingEntry>) {
	if (selecting.value) {
		const shown = series.members.filter((member) => view.value.includes(member))
		selection.select(toggleGroup(selection.selection.value, shown.map((member) => imageMember(member).fileId)))
		return
	}
	seriesCompare.startOn(series, picture, (landing) => {
		const at = view.value.indexOf(landingTarget(view.value, view.value, landing))
		if (at >= 0) {
			void grid.value?.reveal(at)
		}
	}, 'grid')
}

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
			@update:fileNames="updateSettings({ showFileNames: $event })"
			@update:flags="cull.setFlags"
			@update:filtersOpen="filtersOpen = $event"
			@update:sortOrder="sortOrder = $event"
			@update:selecting="selection.setSelecting"
			@selectAll="selection.selectAll"
			@selectNone="selection.selectNone"
			@reviewRejects="deleting.review"
			@compareSeries="seriesCompare.start"
			@removeRaws="deleting.removeRaws"
			@clearFlags="clearFlags"
			@writeXmp="xmpExport.run"
			@move="moving.open(movable)"
			@resume="resume.resume"
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
		<GridNotices :pictures="view" />
		<PhotoGrid
			v-if="view.length > 0"
			ref="grid"
			class="grid-screen__grid"
			:pictures="view"
			:folderSet="folderSet"
			:groupByFolder="grouped"
			:fileNames="settings.showFileNames"
			:tileSize="tileSize"
			:selecting="selecting"
			:selection="selection.selection.value"
			:decisionOf="cull.decisionOf"
			:tagsOf="cull.tags.tagsOf"
			:readOnly="(picture) => cull.writabilityOf(picture) === 'readOnly'"
			:seriesOf="cull.seriesOf.value"
			:offeredSeries="offeredSeries"
			:openSeries="cull.openSeries.value"
			:busy="cull.seriesLoading.value"
			:unsaved="unsaved"
			:imageUrl="imageUrl"
			@update:tileSize="cull.setTileSize"
			@update:selecting="selection.setSelecting"
			@update:selection="selection.select"
			@open="openLoupe"
			@compareSeries="onCompareSeries"
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
			:readOnly="selected.length > 0 && selected.every((picture) => cull.writabilityOf(picture) === 'readOnly')"
			:seriesOffer="offer"
			@decide="decide($event, selected)"
			@tag="tagEntry.open(selected)"
			@move="moving.open(selected)"
			@delete="deleting.summarise(selected)"
			@series="editSeries($event, selected)" />
	</template>
</template>

<style scoped>
.grid-screen__grid {
	flex: 1;
}
</style>
