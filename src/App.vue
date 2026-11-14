<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { AppSeams } from './app-seams.ts'
import type { ResumePosition } from './logic/resume-position.ts'

import { computed, ref, useTemplateRef, watch } from 'vue'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcContent from '@nextcloud/vue/components/NcContent'
import AppNavigation from './components/AppNavigation.vue'
import AppTooltip from './components/AppTooltip.vue'
import CullDialogs from './components/CullDialogs.vue'
import CullEmptyState from './components/CullEmptyState.vue'
import FilterBar from './components/FilterBar.vue'
import FolderPicker from './components/FolderPicker.vue'
import GridNotices from './components/GridNotices.vue'
import GridSkeleton from './components/GridSkeleton.vue'
import GridToolbar from './components/GridToolbar.vue'
import NoFolderState from './components/NoFolderState.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import PhotoLoupe from './components/PhotoLoupe.vue'
import SelectionBar from './components/SelectionBar.vue'
import SeriesCompareFlow from './components/SeriesCompareFlow.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import ShortcutSheet from './components/ShortcutSheet.vue'
import TagEntry from './components/TagEntry.vue'
import UndoToast from './components/UndoToast.vue'
import { APP_SEAMS } from './app-seams.ts'
import { useCull } from './cull.ts'
import { useDeleteFlow } from './delete-flow.ts'
import { gridHotkeys } from './grid-hotkeys.ts'
import { useHotkeys } from './hotkeys.ts'
import { DEFAULT_FILTERS } from './logic/picture-filter.ts'
import { useLoupeOpening } from './loupe-opening.ts'
import { useMoveFlow } from './move-flow.ts'
import { useRecent } from './recent.ts'
import { useResume } from './resume.ts'
import { useSelectionMode } from './selection-mode.ts'
import { useSeriesCompare } from './series-compare.ts'
import { useSettings } from './settings.ts'
import { useSidecarFlow } from './sidecar-flow.ts'
import { useTagEntryTargets } from './tag-entry-targets.ts'
import { useToast } from './toast.ts'
import { useToastedDecisions } from './toasted-decisions.ts'
import { useViewState } from './view-state.ts'

const props = withDefaults(defineProps<AppSeams>(), APP_SEAMS)

const toast = useToast(props.schedule)
const { settings, update: updateSettings } = useSettings({ loadSettings: props.loadSettings, saveSettings: props.saveSettings }, (message) => toast.show(message))
const viewState = useViewState(props.viewState, props.storage)
const settingsOpen = ref(false)
const sidecarFlow = useSidecarFlow(props.sidecars, toast.show)
const cull = useCull({ hashImage: props.hashImage, warmPreviews: props.warmPreviews, lookupDecisions: props.lookupDecisions, saveDecisions: props.saveDecisions, tags: props.tags }, props.storage, () => settings.value, sidecarFlow.sync)
const { folderSet, pictures, folderPaths, folders, grouped, view, progress, shownProgress, filters, activeFilters, empty, sortOrder, filtersOpen, pickerOpen, groupByFolder, tileSize, saveFailed } = cull
const grid = useTemplateRef<InstanceType<typeof PhotoGrid>>('grid')
const { loupe, shown: loupeShown, page: pageLoupe, land: landInLoupe, close: closeLoupe } = useLoupeOpening((index) => grid.value?.reveal(index), cull.passes)
const loupeView = useTemplateRef<InstanceType<typeof PhotoLoupe>>('loupeView')
const filterBar = useTemplateRef<InstanceType<typeof FilterBar>>('filterBar')
const headerShown = ref(true)
/** Opens the loupe on the shown picture at the index. */
const openLoupe = (index: number) => (loupe.value = { pictures: view.value, index })
const shortcutsOpen = ref(false)
const selection = useSelectionMode(() => view.value, pictures)
const { selecting, selected } = selection
const common = computed(() => cull.common(selected.value))
watch(cull.pairing, selection.selectNone)

const { decide, pickRest, tag, undo, redo } = useToastedDecisions(cull, toast.show)
const tagEntry = useTagEntryTargets()
const seriesCompare = useSeriesCompare({ series: () => cull.series.value, decisionOf: cull.decisionOf, decide: (intent, picture) => decide(intent, [picture]), pickRest, settings: () => settings.value, updateSettings, toast: (shown) => toast.show(shown.message, shown.action), holdHashes: cull.holdHashes })
const seriesFlow = useTemplateRef<InstanceType<typeof SeriesCompareFlow>>('seriesFlow')
const overlayScreen = computed(() => (loupe.value !== null ? '.photo-loupe' : seriesCompare.viewer.open.value ? '.series-viewer' : undefined))
const deleting = useDeleteFlow({ pictures: () => pictures.value, view: () => view.value, decisionOf: cull.decisionOf, decide, trash: props.trashPictures, removeFiles: cull.removeFiles, loupe, toast: toast.show })
const { dialog: deleteDialog, rejected, rawRemovable } = deleting
const moving = useMoveFlow({ view: () => view.value, settings: () => settings.value, updateSettings, probe: props.move.probeTargets, move: props.move.movePictures, removeFiles: cull.removeFiles, restoreFiles: cull.restoreFiles, listing: () => folderSet.value, loupe, toast: toast.show })
const recent = useRecent(props.positions, props.listEntries, { folderSet: () => folderSet.value, progress: () => progress.value, pairing: () => cull.pairing.value }, (message) => toast.show(message))
const shownInLoupe = () => (loupe.value === null ? null : loupe.value.pictures[loupe.value.index] ?? null)
const resume = useResume(recent.positions, { folderSet: () => folderSet.value, pictures: () => pictures.value, view: () => view.value, progress: () => progress.value, decisionOf: cull.decisionOf, shown: shownInLoupe, openLoupe }, toast.show)
/** Opens a folder set from *Recent* at its position. */
function openRecent(position: ResumePosition) {
	void recent.open(position, { open: cull.open, resumeAt: resume.resumeAt, resumeOpen: () => {
		pickerOpen.value = false
		resume.resume()
	} })
}
recent.refresh()
watch(pickerOpen, (open) => open && recent.refresh())
const movable = computed(() => (activeFilters.value > 0 ? view.value : pictures.value.filter((picture) => cull.decisionOf(picture).flag === 'picked')))

const gridKeys = gridHotkeys({
	grid: () => grid.value,
	view: () => view.value,
	selection,
	common: cull.common,
	decide,
	toggleFiltersOff: cull.toggleFiltersOff,
	openLoupe,
	openTags: tagEntry.open,
	headerShown,
	filtersOpen,
	filterBar: () => filterBar.value?.$el,
	toggleFullscreen: () => props.toggleFullscreen(document.documentElement),
})

/** Opens the confirmed folder set and offers its resume position. */
function openFolderSet(...opened: Parameters<typeof cull.open>) {
	cull.open(...opened)
	resume.offer()
}

/** Opens or closes the shortcut sheet. */
const toggleShortcuts = () => (shortcutsOpen.value = !shortcutsOpen.value)

useHotkeys(() => {
	if (pickerOpen.value || settingsOpen.value || tagEntry.targets.value !== null || deleteDialog.value !== null || sidecarFlow.open.value || moving.pictures.value !== null || moving.report.value !== null) {
		return null
	}
	if (shortcutsOpen.value || folderSet.value === null) {
		return { shortcuts: toggleShortcuts }
	}
	if (seriesCompare.open.value) {
		return { undo, redo, shortcuts: toggleShortcuts, ...(seriesFlow.value?.hotkeys() ?? seriesCompare.hotkeys) }
	}
	return { undo, redo, shortcuts: toggleShortcuts, 'review-rejects': deleting.review, delete: () => deleting.summariseShown(selected.value, () => grid.value?.focusedIndex() ?? 0), move: () => moving.openShown(selected.value, () => grid.value?.focusedIndex() ?? 0), ...(loupe.value === null ? { ...gridKeys, compare: seriesCompare.start } : loupeView.value?.hotkeys) }
}, () => settings.value.viKeys)
</script>

<template>
	<NcContent appName="honeycomb">
		<AppNavigation
			:items="recent.items.value"
			:storage="props.storage"
			@chooseFolders="pickerOpen = true"
			@openRecent="openRecent"
			@openSettings="settingsOpen = true" />
		<NcAppContent class="honeycomb">
			<GridSkeleton v-if="recent.listing.value" class="honeycomb__grid" :tileSize="tileSize" />
			<template v-else-if="folderSet !== null">
				<GridToolbar
					v-if="headerShown"
					:folderSet="folderSet"
					:folders="folders"
					:tileSize="tileSize"
					:groupByFolder="groupByFolder"
					:flags="filters.flags"
					:decided="shownProgress.decided"
					:total="shownProgress.total"
					:filtered="shownProgress.total < progress.total"
					:activeFilters="activeFilters"
					:filtersOpen="filtersOpen"
					:sortOrder="sortOrder"
					:selecting="selecting"
					:selected="selected.length"
					:rejected="rejected.length"
					:series="cull.series.value.length"
					:rawRemovable="rawRemovable"
					:movable="movable.length"
					:sidecarsShared="cull.sharedPictures.value.length > 0"
					:resumeName="resume.resumeName.value"
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
					@writeSidecars="sidecarFlow.ask(cull.sharedDecided())"
					@openSettings="settingsOpen = true" />
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
					class="honeycomb__grid"
					:pictures="view"
					:folderSet="folderSet"
					:groupByFolder="grouped"
					:tileSize="tileSize"
					:selecting="selecting"
					:selection="selection.selection.value"
					:decisionOf="cull.decisionOf"
					:tagsOf="cull.tags.tagsOf"
					:seriesSizes="cull.seriesSizes.value"
					@update:tileSize="cull.setTileSize"
					@update:selecting="selection.setSelecting"
					@update:selection="selection.select"
					@open="openLoupe"
					@scroll="resume.dismiss" />
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
			<NoFolderState v-else @chooseFolder="pickerOpen = true" />
			<FolderPicker
				v-if="pickerOpen"
				:current="folderSet"
				:listFolders="props.listFolders"
				:listEntries="props.listEntries"
				:pairing="cull.pairing.value"
				:recent="recent.items.value"
				@confirm="openFolderSet"
				@openRecent="openRecent"
				@cancel="pickerOpen = false" />
			<CullDialogs
				v-if="folderSet !== null"
				:deleting="deleting"
				:moving="moving"
				:sidecars="sidecarFlow"
				:folderSet="folderSet"
				:folders="folders"
				:decisionOf="cull.decisionOf"
				:listFolders="props.listFolders"
				:container="loupe !== null ? '.photo-loupe' : undefined" />
			<SeriesCompareFlow
				ref="seriesFlow"
				:flow="seriesCompare"
				:container="seriesCompare.oneSeries.value ? '.photo-loupe' : 'body'"
				:decisionOf="cull.decisionOf"
				@tag="tagEntry.open([$event])" />
			<SettingsDialog
				v-model:open="settingsOpen"
				:settings="settings"
				:gestureGuideSeen="viewState.gestureGuideSeen.value"
				@update="updateSettings"
				@showGestureGuide="viewState.showGestureGuide" />
			<Teleport to="body">
				<PhotoLoupe
					v-if="loupeShown !== null && folderSet !== null"
					ref="loupeView"
					:index="loupeShown.index"
					:pictures="loupeShown.pictures"
					:folderSet="folderSet"
					:decisionOf="cull.decisionOf"
					:seriesOf="cull.seriesOf.value"
					:tagsOf="cull.tags.tagsOf"
					:writesSidecars="cull.tags.writable"
					:storage="props.storage"
					:viewState="viewState"
					:settings="settings"
					@update:index="pageLoupe"
					@updateSettings="updateSettings"
					@decide="(intent, picture) => decide(intent, [picture])"
					@toast="toast.show($event.message, $event.action)"
					@allDecided="deleting.allDecided"
					@move="moving.openShown([], () => 0)"
					@tag="tagEntry.open([$event])"
					@compareSeries="(series, picture) => seriesCompare.startOn(series, picture, landInLoupe)"
					@close="closeLoupe" />
				<TagEntry
					v-if="tagEntry.targets.value !== null"
					:targets="tagEntry.targets.value.map(cull.tags.tagsOf)"
					:known="cull.tags.known.value"
					@change="tag($event, tagEntry.targets.value!)"
					@close="tagEntry.close" />
				<ShortcutSheet v-if="shortcutsOpen" :container="overlayScreen" @close="shortcutsOpen = false" />
				<UndoToast
					v-if="toast.current.value !== null"
					:toast="toast.current.value"
					:top="overlayScreen !== undefined"
					v-bind="toast.listeners" />
			</Teleport>
		</NcAppContent>
		<AppTooltip :container="overlayScreen" :schedule="props.schedule" />
	</NcContent>
</template>

<style src="./flag-fills.css" />

<style scoped src="./app.css" />
