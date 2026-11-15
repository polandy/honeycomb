<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { AppSeams } from './app-seams.ts'
import type { CullStep } from './cull.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { ResumePosition } from './logic/resume-position.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'

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
import WriteOnDialog from './components/WriteOnDialog.vue'
import { APP_SEAMS } from './app-seams.ts'
import { clearCacheWithToast } from './cache-clear.ts'
import { provideCullContext } from './cull-context.ts'
import { useCull } from './cull.ts'
import { useDeleteFlow } from './delete-flow.ts'
import { gridHotkeys } from './grid-hotkeys.ts'
import { useHotkeys } from './hotkeys.ts'
import { useLegacy } from './legacy.ts'
import { waitSeconds } from './logic/retry-after.ts'
import { useLoupeOpening } from './loupe-opening.ts'
import { useMoveFlow } from './move-flow.ts'
import { useRecent } from './recent.ts'
import { useRestOffer } from './rest-offer.ts'
import { useResume } from './resume.ts'
import { useSelectionMode } from './selection-mode.ts'
import { useSeriesCompare } from './series-compare.ts'
import { useSettings } from './settings.ts'
import { useSidecarFlow } from './sidecar-flow.ts'
import { useTagEntryTargets } from './tag-entry-targets.ts'
import { useToast } from './toast.ts'
import { useToastedDecisions } from './toasted-decisions.ts'
import { useViewState } from './view-state.ts'
import { useWriteLock } from './write-lock.ts'

const props = withDefaults(defineProps<AppSeams>(), APP_SEAMS)

const toast = useToast(props.schedule)
const { settings, update: updateSettings } = useSettings({ loadSettings: props.loadSettings, saveSettings: props.saveSettings }, (message) => toast.show(message))
const viewState = useViewState(props.viewState, props.storage)
const settingsOpen = ref(false)
const sidecarsReady = computed(() => settings.value.sidecarWrite === 'on')
const legacy = useLegacy(props.legacy, props.saveFile, (message) => toast.show(message), () => sidecarsReady.value)
const sidecarFlow = useSidecarFlow(props.sidecars, toast.show, refuseFailed, legacy.acknowledge)
const writeLock = useWriteLock(() => settings.value, updateSettings, toast.show, retryLocked)
const cull = useCull({ hashImage: props.hashImage, saveVisualHashes: props.saveVisualHashes, wait: waitSeconds(props.schedule), warmPreviews: props.warmPreviews, lookupDecisions: props.lookupDecisions, saveDecisions: props.saveDecisions, lookupSeries: props.lookupSeries, saveSeries: props.saveSeries, tags: props.tags }, props.storage, () => settings.value, sidecarFlow.sync, writeLock.locked)
/** Locks the pictures whose sidecar a write refused (XMP-008.6). */
function refuseFailed(failed: readonly SidecarFailure[]) {
	cull.refuse(failed)
}
const { folderSet, pictures, folders, view, progress, filtersOpen, pickerOpen, tileSize } = cull
const gridScreen = useTemplateRef<InstanceType<typeof GridScreen>>('gridScreen')
const grid = computed(() => gridScreen.value?.grid ?? null)
const loupeOpening = useLoupeOpening((index) => grid.value?.reveal(index), cull.passes)
const { loupe, picture: shownInLoupe, land: landInLoupe } = loupeOpening
const loupeScreen = useTemplateRef<InstanceType<typeof LoupeScreen>>('loupeScreen')
const headerShown = ref(true)
/** Opens the loupe on the shown picture at the index. */
const openLoupe = (index: number) => (loupe.value = { pictures: view.value, index })
const shortcutsOpen = ref(false)
const selection = useSelectionMode(() => view.value, pictures)
const { selected } = selection
watch(cull.pairing, selection.selectNone)

const { decide, pickRest, tag, removeFromSeries, dissolveSeries, mergeSeries, editSelection, undo, redo, toastChange } = useToastedDecisions(cull, toast.show)
/** Toasts a step taken once its lock was lifted (XMP-008.7). */
function retryLocked(step: CullStep | null) {
	toastChange(step)
}
const tagEntry = useTagEntryTargets()
const seriesCompare = useSeriesCompare({ series: () => cull.series.value, decisionOf: cull.decisionOf, decide: decideInCompare, pickRest, removeFromSeries, dissolve: dissolveSeries, everySeries: () => cull.everySeries.value, merge: mergeSeries, settings: () => settings.value, updateSettings, toast: (shown) => toast.show(shown.message, shown.action), holdHashes: cull.holdHashes })
const restOffer = useRestOffer({ seriesOf: () => cull.seriesOf.value, decisionOf: cull.decisionOf, compare: seriesCompare, shown: shownInLoupe, land: landInLoupe })
/** Decides in the series compare, offering *Reject the other N* after a Pick in its viewer. */
function decideInCompare(intent: DecisionIntent, picture: Picture<ListingEntry>, inViewer: boolean) {
	decide(intent, [picture], () => (inViewer ? restOffer(intent, picture) : null))
}
const seriesScreen = useTemplateRef<InstanceType<typeof SeriesCompareScreen>>('seriesScreen')
const overlayScreen = computed(() => (loupe.value !== null ? '.photo-loupe' : seriesCompare.viewer.open.value ? '.series-viewer' : undefined))
const deleting = useDeleteFlow({ pictures: () => pictures.value, view: () => view.value, decisionOf: cull.decisionOf, decide, trash: props.trashPictures, removeFiles: cull.removeFiles, loupe, toast: toast.show })
const { dialog: deleteDialog } = deleting
const moving = useMoveFlow({ view: () => view.value, settings: () => settings.value, updateSettings, probe: props.move.probeTargets, move: props.move.movePictures, removeFiles: cull.removeFiles, restoreFiles: cull.restoreFiles, listing: () => folderSet.value, loupe, toast: toast.show })
const recent = useRecent(props.positions, props.listEntries, { folderSet: () => folderSet.value, progress: () => progress.value, pairing: () => cull.pairing.value }, (message) => toast.show(message))
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

const gridKeys = gridHotkeys({ grid: () => grid.value, view: () => view.value, selection, common: cull.common, decide, toggleFiltersOff: cull.toggleFiltersOff, openLoupe, openTags: tagEntry.open, headerShown, filtersOpen, filterBar: () => gridScreen.value?.filterBar?.$el, toggleFullscreen: () => props.toggleFullscreen(document.documentElement) })

provideCullContext({ cull, selection, decide, editSeries: editSelection, deleting, moving, resume, seriesCompare, sidecars: sidecarFlow, legacy, tagEntry, headerShown, openLoupe, openSettings: () => (settingsOpen.value = true), loupe: loupeOpening, restOffer, toast: toast.show, settings, updateSettings, viewState, storage: props.storage })

/** Opens the confirmed folder set and offers its resume position. */
function openFolderSet(...opened: Parameters<typeof cull.open>) {
	cull.open(...opened)
	resume.offer()
}
/** Opens or closes the shortcut sheet. */
const toggleShortcuts = () => (shortcutsOpen.value = !shortcutsOpen.value)
useHotkeys(() => {
	if (pickerOpen.value || settingsOpen.value || tagEntry.targets.value !== null || deleteDialog.value !== null || sidecarFlow.open.value || writeLock.asking.value !== null || moving.pictures.value !== null || moving.report.value !== null) {
		return null
	}
	if (shortcutsOpen.value || folderSet.value === null) {
		return { shortcuts: toggleShortcuts }
	}
	if (seriesCompare.open.value) {
		return { undo, redo, shortcuts: toggleShortcuts, ...(seriesScreen.value?.hotkeys() ?? seriesCompare.hotkeys) }
	}
	return { undo, redo, shortcuts: toggleShortcuts, 'review-rejects': deleting.review, delete: () => deleting.summariseShown(selected.value, () => grid.value?.focusedIndex() ?? 0), move: () => moving.openShown(selected.value, () => grid.value?.focusedIndex() ?? 0), ...(loupe.value === null ? { ...gridKeys, compare: seriesCompare.start } : loupeScreen.value?.loupe?.hotkeys) }
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
				:sidecarsReady="sidecarsReady"
				:folderSet="folderSet"
				:folders="folders"
				:decisionOf="cull.decisionOf"
				:listFolders="props.listFolders"
				:container="loupe !== null ? '.photo-loupe' : undefined" />
			<SeriesCompareScreen ref="seriesScreen" />
			<SettingsDialog
				v-model:open="settingsOpen"
				:settings="settings"
				:gestureGuideSeen="viewState.gestureGuideSeen.value"
				:versionsApp="props.versionsApp"
				@update="updateSettings"
				@showGestureGuide="viewState.showGestureGuide"
				@clearCache="clearCacheWithToast(props.clearCache, toast.show)" />
			<WriteOnDialog
				v-if="writeLock.asking.value !== null"
				:turnsOn="writeLock.turnsOn.value"
				:sharedNames="writeLock.sharedNames.value"
				:versionsApp="props.versionsApp"
				:container="loupe !== null ? '.photo-loupe' : undefined"
				@cancel="writeLock.cancel"
				@confirm="writeLock.confirm" />
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

<style scoped src="./app.css" />
