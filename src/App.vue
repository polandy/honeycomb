<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { AppSeams } from './app-seams.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, useTemplateRef, watch } from 'vue'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import ActionBar from './components/ActionBar.vue'
import CullDialogs from './components/CullDialogs.vue'
import CullEmptyState from './components/CullEmptyState.vue'
import FilterBar from './components/FilterBar.vue'
import FolderPicker from './components/FolderPicker.vue'
import GridToolbar from './components/GridToolbar.vue'
import NoFolderState from './components/NoFolderState.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import PhotoLoupe from './components/PhotoLoupe.vue'
import SeriesCompareFlow from './components/SeriesCompareFlow.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import ShortcutSheet from './components/ShortcutSheet.vue'
import UndoToast from './components/UndoToast.vue'
import { APP_SEAMS } from './app-seams.ts'
import { useCull } from './cull.ts'
import { useDeleteFlow } from './delete-flow.ts'
import { gridHotkeys } from './grid-hotkeys.ts'
import { useHotkeys } from './hotkeys.ts'
import { clearFilters } from './logic/picture-filter.ts'
import { useLoupeOpening } from './loupe-opening.ts'
import { useMoveFlow } from './move-flow.ts'
import { useResume } from './resume.ts'
import { useSelectionMode } from './selection-mode.ts'
import { useSeriesCompare } from './series-compare.ts'
import { useSettings } from './settings.ts'
import { useSidecarFlow } from './sidecar-flow.ts'
import { useToast } from './toast.ts'
import { useToastedDecisions } from './toasted-decisions.ts'
import { useViewState } from './view-state.ts'

const props = withDefaults(defineProps<AppSeams>(), APP_SEAMS)

const toast = useToast(props.schedule)
const { settings, update: updateSettings } = useSettings({ loadSettings: props.loadSettings, saveSettings: props.saveSettings }, (message) => toast.show(message))
const viewState = useViewState(props.viewState, props.storage)
const settingsOpen = ref(false)
const sidecarFlow = useSidecarFlow(props.sidecars, toast.show)
const cull = useCull({ warmPreviews: props.warmPreviews, lookupDecisions: props.lookupDecisions, saveDecisions: props.saveDecisions }, props.storage, () => settings.value, sidecarFlow.sync)
const { folderSet, pictures, folderPaths, folders, grouped, view, progress, filters, activeFilters, empty, sortOrder, filtersOpen, pickerOpen, groupByFolder, tileSize, saveFailed } = cull
const grid = useTemplateRef<InstanceType<typeof PhotoGrid>>('grid')
const { loupe, close: closeLoupe } = useLoupeOpening((index) => grid.value?.reveal(index))
const loupeView = useTemplateRef<InstanceType<typeof PhotoLoupe>>('loupeView')
const filterBar = useTemplateRef<InstanceType<typeof FilterBar>>('filterBar')
const headerShown = ref(true)
const shortcutsOpen = ref(false)
const selection = useSelectionMode(() => view.value, pictures)
const { selecting, selected } = selection
const common = computed(() => cull.common(selected.value))
watch(cull.pairing, selection.selectNone)

const { decide, pickRest, undo, redo } = useToastedDecisions(cull, toast.show)
const seriesCompare = useSeriesCompare({ series: () => cull.series.value, decisionOf: cull.decisionOf, decide: (intent, picture) => decide(intent, [picture]), pickRest, settings: () => settings.value, updateSettings, toast: (shown) => toast.show(shown.message, shown.action) })
const seriesFlow = useTemplateRef<InstanceType<typeof SeriesCompareFlow>>('seriesFlow')
const overlayScreen = computed(() => (loupe.value !== null ? '.photo-loupe' : seriesCompare.viewer.open.value ? '.series-viewer' : undefined))
const deleting = useDeleteFlow({ pictures: () => pictures.value, view: () => view.value, decisionOf: cull.decisionOf, decide, trash: props.trashPictures, removeFiles: cull.removeFiles, loupe, toast: toast.show })
const { dialog: deleteDialog, rejected, rawRemovable } = deleting
const moving = useMoveFlow({ view: () => view.value, settings: () => settings.value, updateSettings, probe: props.move.probeTargets, move: props.move.movePictures, removeFiles: cull.removeFiles, restoreFiles: cull.restoreFiles, listing: () => folderSet.value, loupe, toast: toast.show })
const resume = useResume(props.positions, {
	folderSet: () => folderSet.value,
	pictures: () => pictures.value,
	view: () => view.value,
	progress: () => progress.value,
	decisionOf: cull.decisionOf,
	shown: () => (loupe.value === null ? null : loupe.value.pictures[loupe.value.index] ?? null),
	openLoupe: (index) => {
		loupe.value = { pictures: view.value, index }
	},
}, toast.show)
const movable = computed(() => (activeFilters.value > 0 ? view.value : pictures.value.filter((picture) => cull.decisionOf(picture).flag === 'picked')))

const gridKeys = gridHotkeys({
	grid: () => grid.value,
	view: () => view.value,
	selection,
	common: cull.common,
	decide,
	toggleFiltersOff: cull.toggleFiltersOff,
	openLoupe: (index) => {
		loupe.value = { pictures: view.value, index }
	},
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
function toggleShortcuts() {
	shortcutsOpen.value = !shortcutsOpen.value
}

useHotkeys(() => {
	if (pickerOpen.value || settingsOpen.value || deleteDialog.value !== null || sidecarFlow.open.value || moving.pictures.value !== null || moving.report.value !== null) {
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
		<NcAppContent class="honeycomb">
			<template v-if="folderSet !== null">
				<GridToolbar
					v-if="headerShown"
					:folderSet="folderSet"
					:folders="folders"
					:tileSize="tileSize"
					:groupByFolder="groupByFolder"
					:scope="filters.scope"
					:scopeLocked="filters.flags.size > 0"
					:decided="progress.decided"
					:total="progress.total"
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
					@update:scope="cull.setScope"
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
					@update:filters="filters = $event" />
				<NcNoteCard v-if="saveFailed" type="error" :text="t('honeycomb', 'Could not save the change; the photos show what is stored.')" />
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
					:seriesSizes="cull.seriesSizes.value"
					@update:tileSize="cull.setTileSize"
					@update:selecting="selection.setSelecting"
					@update:selection="selection.select"
					@open="loupe = { pictures: view, index: $event }" />
				<CullEmptyState
					v-else
					:reason="empty"
					:rejected="rejected.length"
					@clearFilters="filters = clearFilters(filters)"
					@showAll="cull.setScope('all')"
					@reviewRejects="deleting.review" />
				<ActionBar
					v-if="selecting"
					:common="common"
					:disabled="selected.length === 0"
					@decide="decide($event, selected)">
					<template #end>
						<NcButton :disabled="selected.length === 0" @click="moving.open(selected)">
							{{ t('honeycomb', 'Move…') }}
						</NcButton>
						<NcButton variant="error" :disabled="selected.length === 0" @click="deleting.summarise(selected)">
							{{ t('honeycomb', 'Delete…') }}
						</NcButton>
					</template>
				</ActionBar>
			</template>
			<NoFolderState v-else @chooseFolder="pickerOpen = true" />
			<FolderPicker
				v-if="pickerOpen"
				:current="folderSet"
				:listFolders="props.listFolders"
				:listEntries="props.listEntries"
				:pairing="cull.pairing.value"
				@confirm="openFolderSet"
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
			<SeriesCompareFlow ref="seriesFlow" :flow="seriesCompare" :decisionOf="cull.decisionOf" />
			<SettingsDialog v-model:open="settingsOpen" :settings="settings" @update="updateSettings" />
			<Teleport to="body">
				<PhotoLoupe
					v-if="loupe !== null && folderSet !== null"
					ref="loupeView"
					v-model:index="loupe.index"
					:pictures="loupe.pictures"
					:folderSet="folderSet"
					:decisionOf="cull.decisionOf"
					:storage="props.storage"
					:viewState="viewState"
					:settings="settings"
					@updateSettings="updateSettings"
					@decide="(intent, picture) => decide(intent, [picture])"
					@toast="toast.show($event.message, $event.action)"
					@allDecided="deleting.allDecided"
					@move="moving.openShown([], () => 0)"
					@close="closeLoupe" />
				<ShortcutSheet
					v-if="shortcutsOpen"
					:container="overlayScreen"
					@close="shortcutsOpen = false" />
				<UndoToast
					v-if="toast.current.value !== null"
					:toast="toast.current.value"
					:top="overlayScreen !== undefined"
					@act="toast.act" />
			</Teleport>
		</NcAppContent>
	</NcContent>
</template>

<style scoped>
.honeycomb {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.honeycomb__grid {
	flex: 1;
}
</style>
