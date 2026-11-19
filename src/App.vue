<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { AppSeams } from './app-seams.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { ResumePosition } from './logic/resume-position.ts'

import { computed, ref, useTemplateRef, watch } from 'vue'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcContent from '@nextcloud/vue/components/NcContent'
import AppNavigation from './components/AppNavigation.vue'
import AppTooltip from './components/AppTooltip.vue'
import CullDialogs from './components/CullDialogs.vue'
import FolderPicker from './components/FolderPicker.vue'
import GridScreen from './components/GridScreen.vue'
import GridSkeleton from './components/GridSkeleton.vue'
import LoupeScreen from './components/LoupeScreen.vue'
import NoFolderState from './components/NoFolderState.vue'
import SeriesCompareScreen from './components/SeriesCompareScreen.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import ShortcutSheet from './components/ShortcutSheet.vue'
import TagEntry from './components/TagEntry.vue'
import UndoToast from './components/UndoToast.vue'
import { APP_SEAMS } from './app-seams.ts'
import { cleanUpWithToast, clearCacheWithToast } from './cache-clear.ts'
import { provideCullContext } from './cull-context.ts'
import { useCull } from './cull.ts'
import { flagsNotSavedText } from './decision-text.ts'
import { useDeleteFlow } from './delete-flow.ts'
import { freshCheck, sidecarSaver } from './fresh-check.ts'
import { gridHotkeys } from './grid-hotkeys.ts'
import { useHotkeys } from './hotkeys.ts'
import { waitSeconds } from './logic/retry-after.ts'
import { useLoupeOpening } from './loupe-opening.ts'
import { useMoveFlow } from './move-flow.ts'
import { useRecent } from './recent.ts'
import { useRestOffer } from './rest-offer.ts'
import { useResume } from './resume.ts'
import { useSelectionMode } from './selection-mode.ts'
import { useSeriesCompare } from './series-compare.ts'
import { useSettings } from './settings.ts'
import { useBundledSidecars } from './sidecar-bundle.ts'
import { useSidecarFlow } from './sidecar-flow.ts'
import { useTagEntryTargets } from './tag-entry-targets.ts'
import { useToast } from './toast.ts'
import { useToastedDecisions } from './toasted-decisions.ts'
import { useViewState } from './view-state.ts'
import { useXmpExport } from './xmp-export.ts'

const props = withDefaults(defineProps<AppSeams>(), APP_SEAMS)

const toast = useToast(props.schedule)
const isAdmin = props.admin()
const { settings, update: updateSettings } = useSettings({ loadSettings: props.loadSettings, saveSettings: props.saveSettings }, (message) => toast.show(message))
const viewState = useViewState(props.viewState, props.storage)
const settingsOpen = ref(false)
const sidecarFlow = useSidecarFlow(props.sidecars, toast.show)
const sidecars = useBundledSidecars(sidecarFlow.sync, props.schedule, props.onPageHide)
const cull = useCull({ hashImage: props.hashImage, saveVisualHashes: props.saveVisualHashes, wait: waitSeconds(props.schedule), warmPreviews: props.warmPreviews, flags: props.flags, lookupSeries: props.lookupSeries, saveSeries: props.saveSeries, tags: props.tags }, props.storage, () => settings.value, sidecars, (photos) => toast.show(flagsNotSavedText(photos)))
const { folderSet, pictures, folders, view, progress, filtersOpen, pickerOpen, tileSize } = cull
const gridScreen = useTemplateRef<InstanceType<typeof GridScreen>>('gridScreen')
const grid = computed(() => gridScreen.value?.grid ?? null)
const loupeOpening = useLoupeOpening((index) => grid.value?.reveal(index), cull.passes)
const { loupe, picture: shownInLoupe, land: landInLoupe } = loupeOpening
watch(shownInLoupe, sidecars.leave)
const loupeScreen = useTemplateRef<InstanceType<typeof LoupeScreen>>('loupeScreen')
const headerShown = ref(true)
/** Opens the loupe on the shown picture at the index. */
const openLoupe = (index: number) => (loupe.value = { pictures: view.value, index })
const shortcutsOpen = ref(false)
const selection = useSelectionMode(() => view.value, pictures)
const { selected } = selection
watch(cull.pairing, selection.selectNone)

const { decide, pickRest, clearFlags, tag, removeFromSeries, dissolveSeries, mergeSeries, markSeries, editSelection, undo, redo } = useToastedDecisions(cull, toast.show)
const tagEntry = useTagEntryTargets()
const seriesCompare = useSeriesCompare({ series: () => cull.series.value, decisionOf: cull.decisionOf, decide: decideInCompare, pickRest, removeFromSeries, dissolve: dissolveSeries, everySeries: () => cull.everySeries.value, merge: mergeSeries, markSeries, settings: () => settings.value, updateSettings, toast: (shown) => toast.show(shown.message, shown.action), holdHashes: cull.holdHashes })
const restOffer = useRestOffer({ seriesOf: () => cull.seriesOf.value, decisionOf: cull.decisionOf, compare: seriesCompare, shown: shownInLoupe, land: landInLoupe })
/** Decides in the series compare, offering *Reject the other N* after a Pick in its viewer. */
function decideInCompare(intent: DecisionIntent, picture: Picture<ListingEntry>, inViewer: boolean) {
	decide(intent, [picture], () => (inViewer ? restOffer(intent, picture) : null))
}
const seriesScreen = useTemplateRef<InstanceType<typeof SeriesCompareScreen>>('seriesScreen')
const overlayScreen = computed(() => (loupe.value !== null ? '.photo-loupe' : seriesCompare.viewer.open.value ? '.series-viewer' : undefined))
const check = freshCheck({ listEntries: props.listEntries, ...props.sidecars }, { pairing: () => cull.pairing.value, writable: (picture) => cull.writabilityOf(picture) === 'writable', writeSidecar: sidecarSaver(sidecarFlow.sync) })
/** Writes the waiting sidecars and waits for the flag saves in flight, before a delete or move reads the folders again (DELETE-002.28). */
async function flushWrites() {
	await sidecars.flush()
	await cull.flushFlags()
}
const xmpExport = useXmpExport(sidecarFlow, { pictures: () => pictures.value.filter((picture) => cull.writabilityOf(picture) === 'writable'), decisionOf: cull.decisionOf, flush: flushWrites })
const deleting = useDeleteFlow({ pictures: () => pictures.value, view: () => view.value, decisionOf: cull.decisionOf, decide, flush: flushWrites, current: sidecarFlow.sync.current, check, trash: props.trashPictures, removeFiles: cull.removeFiles, loupe, toast: toast.show })
const { dialog: deleteDialog } = deleting
const moving = useMoveFlow({ view: () => view.value, settings: () => settings.value, updateSettings, probe: props.move.probeTargets, move: props.move.movePictures, flush: flushWrites, current: sidecarFlow.sync.current, removeFiles: cull.removeFiles, restoreFiles: cull.restoreFiles, listing: () => folderSet.value, loupe, toast: toast.show })
const recent = useRecent(props.positions, props.listEntries, { folderSet: () => folderSet.value, progress: () => progress.value, pairing: () => cull.pairing.value }, (message) => toast.show(message))
const resume = useResume(recent.positions, { folderSet: () => folderSet.value, pictures: () => pictures.value, view: () => view.value, progress: () => progress.value, decidedOf: cull.decidedOf, shown: shownInLoupe, openLoupe }, toast.show)
/** Opens a folder set from *Recent* at its position. */
function openRecent(position: ResumePosition) {
	void recent.open(position, { open: cull.open, resumeAt: resume.resumeAt, resumeOpen: () => {
		pickerOpen.value = false
		resume.resume()
	} })
}
recent.refresh()
watch(pickerOpen, (open) => open && recent.refresh())

const gridKeys = gridHotkeys({ grid: () => grid.value, view: () => view.value, selection, common: cull.common, decide, toggleFiltersOff: cull.toggleFiltersOff, openLoupe, openTags: tagEntry.open, headerShown, filtersOpen, filterBar: () => gridScreen.value?.filterBar?.$el, toggleFullscreen: () => props.toggleFullscreen(document.documentElement) })

provideCullContext({ cull, selection, decide, clearFlags, xmpExport, editSeries: editSelection, deleting, moving, resume, seriesCompare, unsaved: sidecars.waiting, tagEntry, headerShown, openLoupe, openSettings: () => (settingsOpen.value = true), loupe: loupeOpening, restOffer, toast: toast.show, settings, updateSettings, viewState, storage: props.storage })

/** Opens the confirmed folder set and offers its resume position. */
function openFolderSet(...opened: Parameters<typeof cull.open>) {
	cull.open(...opened)
	resume.offer()
}
/** Shows or hides the file names above the grid's tiles (GRID-004.3). */
const toggleFileNames = () => updateSettings({ showFileNames: !settings.value.showFileNames })
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
		return { undo, redo, shortcuts: toggleShortcuts, ...(seriesScreen.value?.hotkeys() ?? seriesCompare.hotkeys) }
	}
	return { undo, redo, shortcuts: toggleShortcuts, 'review-rejects': deleting.review, delete: () => deleting.summariseShown(selected.value, () => grid.value?.focusedIndex() ?? 0), move: () => moving.openShown(selected.value, () => grid.value?.focusedIndex() ?? 0), ...(loupe.value === null ? { ...gridKeys, compare: seriesCompare.start, 'file-names': toggleFileNames } : loupeScreen.value?.loupe?.hotkeys) }
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
			<GridScreen v-else-if="folderSet !== null" ref="gridScreen" />
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
				:listFolders="props.listFolders"
				:container="loupe !== null ? '.photo-loupe' : undefined" />
			<SeriesCompareScreen ref="seriesScreen" />
			<SettingsDialog
				v-model:open="settingsOpen"
				:settings="settings"
				:gestureGuideSeen="viewState.gestureGuideSeen.value"
				:admin="isAdmin"
				@update="updateSettings"
				@showGestureGuide="viewState.showGestureGuide"
				@clearCache="clearCacheWithToast(props.clearCache, toast.show)"
				@cleanUp="cleanUpWithToast(props.cleanUp, toast.show)" />
			<Teleport to="body">
				<LoupeScreen ref="loupeScreen" />
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

<style src="./coarse-controls.css" />

<style src="./navigation-toggle.css" />

<style scoped src="./app.css" />
