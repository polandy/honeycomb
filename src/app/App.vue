<!--
  - SPDX-FileCopyrightText: 2026 honeycomb contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script setup lang="ts">
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { ResumePosition } from '../logic/resume-position.ts'
import type { AppSeams } from './app-seams.ts'

import { computed, ref, useTemplateRef, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import AppTooltip from '../components/AppTooltip.vue'
import CullDialogs from '../components/CullDialogs.vue'
import CullFinished from '../components/CullFinished.vue'
import FolderPicker from '../components/FolderPicker.vue'
import FoldersHome from '../components/FoldersHome.vue'
import GridScreen from '../components/GridScreen.vue'
import GridSkeleton from '../components/GridSkeleton.vue'
import ImmichConnectionDialog from '../components/ImmichConnectionDialog.vue'
import ImmichScreen from '../components/ImmichScreen.vue'
import ImmichState from '../components/ImmichState.vue'
import LoupeScreen from '../components/LoupeScreen.vue'
import NoFolderState from '../components/NoFolderState.vue'
import SeriesCompareScreen from '../components/SeriesCompareScreen.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
import ShortcutSheet from '../components/ShortcutSheet.vue'
import TagEntry from '../components/TagEntry.vue'
import ToastDetails from '../components/ToastDetails.vue'
import UndoToast from '../components/UndoToast.vue'
import { provideCullContext } from '../cull/cull-context.ts'
import { useCullFinished } from '../cull/cull-finished.ts'
import { useCull } from '../cull/cull.ts'
import { flagsNotSavedText } from '../cull/decision-text.ts'
import { folderPictureSource } from '../cull/folder-picture-source.ts'
import { useTagEntryTargets } from '../cull/tag-entry-targets.ts'
import { useToastedDecisions } from '../cull/toasted-decisions.ts'
import { useFoldersHome } from '../folders/folders-home.ts'
import { useRecent } from '../folders/recent.ts'
import { useResume } from '../folders/resume.ts'
import { gridHotkeys } from '../grid/grid-hotkeys.ts'
import { useSelectionMode } from '../grid/selection-mode.ts'
import { useImmichApp } from '../immich/immich-app.ts'
import { useImmichOnly } from '../immich/immich-only.ts'
import { connectionLines } from '../immich/immich-text.ts'
import { DECISIONS_ONLY } from '../logic/opened-source.ts'
import { positionFileId } from '../logic/resume-position.ts'
import { waitSeconds } from '../logic/retry-after.ts'
import { unofferedKeys } from '../logic/source-keys.ts'
import { useLoupeOpening } from '../loupe/loupe-opening.ts'
import { useMoveFlow } from '../move/move-flow.ts'
import { notInSeriesHint } from '../series/not-in-series.ts'
import { useRestOffer } from '../series/rest-offer.ts'
import { useSeriesCompare } from '../series/series-compare.ts'
import { useSettings } from '../settings/settings.ts'
import { readOnce, useViewState } from '../settings/view-state.ts'
import { freshCheck } from '../shared/fresh-check.ts'
import { useHotkeys } from '../shared/hotkeys.ts'
import { useToast } from '../shared/toast.ts'
import { useBundledSidecars } from '../sidecars/sidecar-bundle.ts'
import { useSidecarFlow } from '../sidecars/sidecar-flow.ts'
import { useXmpExport } from '../sidecars/xmp-export.ts'
import { useActiveTime } from '../statistics/active-time.ts'
import { useYearReviewHint } from '../statistics/year-review-hint.ts'
import { useDeleteFlow } from '../trash/delete-flow.ts'
import { useAppDialogs } from './app-dialogs.ts'
import { APP_SEAMS } from './app-seams.ts'
import { useFolderSetOpening } from './app-source.ts'

const props = withDefaults(defineProps<AppSeams>(), APP_SEAMS)

const toast = useToast(props.schedule)
const isAdmin = props.admin()
const { settings, settled: settingsSettled, update: updateSettings } = useSettings({ loadSettings: props.loadSettings, saveSettings: props.saveSettings, saveSettingsList: props.saveSettingsList }, toast.showError)
const viewStateApi = readOnce(props.viewState)
const viewState = useViewState(viewStateApi, props.storage)
const yearReviewHint = useYearReviewHint(viewStateApi, props.today)
const dialogs = useAppDialogs({ clearCache: props.clearCache, cleanUp: props.cleanUp, resetStatistics: props.resetStatistics }, toast)
const { settingsOpen, shortcutsOpen, connectionOpen, toggleShortcuts } = dialogs
const sidecarFlow = useSidecarFlow(props.sidecars, toast.show, toast.showError)
const sidecars = useBundledSidecars(sidecarFlow.sync, props.schedule, props.onPageHide)
const folderPictures = folderPictureSource({ listEntries: props.listEntries, imageUrl: props.imageUrl, saveFlags: (items) => props.flags.save(items) })
const cull = useCull({ hashImage: props.hashImage, saveVisualHashes: props.saveVisualHashes, measureImage: props.measureImage, saveQualityValues: props.saveQualityValues, wait: waitSeconds(props.schedule), warmPreviews: props.warmPreviews, flags: { ...props.flags, save: folderPictures.decide }, lookupSeries: props.lookupSeries, saveSeries: props.saveSeries, tags: props.tags }, props.storage, () => settings.value, sidecars, (photos) => toast.showError(flagsNotSavedText(photos)))
const { folderSet, pictures, folders, view, progress, filtersOpen, pickerOpen, tileSize } = cull
const gridScreen = useTemplateRef<InstanceType<typeof GridScreen>>('gridScreen')
const grid = computed(() => gridScreen.value?.grid ?? null)
// The picker and the move dialog count pictures with the user's extension lists (LISTING-003.24).
const listFolders = (path: string) => props.listFolders(path, { rawExtensions: cull.pairing.value.rawExtensions, renderedExtensions: cull.pairing.value.renderedExtensions })
const loupeOpening = useLoupeOpening((index) => grid.value?.reveal(index), cull.passes)
const { loupe, picture: shownInLoupe, land: landInLoupe } = loupeOpening
watch(shownInLoupe, sidecars.leave)
const loupeScreen = useTemplateRef<InstanceType<typeof LoupeScreen>>('loupeScreen')
const headerShown = ref(true)
/** Opens the loupe on the shown picture at the index. */
const openLoupe = (index: number) => (loupe.value = { pictures: view.value, index })
const selection = useSelectionMode(() => view.value, pictures)
const { selected } = selection
watch(cull.pairing, selection.selectNone)

const cullFinished = useCullFinished({ folderSet: () => folderSet.value, pictures: () => pictures.value, decisionOf: cull.decisionOf, decidedOf: cull.decidedOf, now: props.clock })
sidecarFlow.onSaved((saved) => [cullFinished.saved, cull.sidecarsSaved].forEach((listen) => listen(saved)))
const { decide, pickRest, clearFlags, reduceSeries, tag, removeFromSeries, dissolveSeries, mergeSeries, markSeries, editSelection, undo, redo } = cullFinished.watching(useToastedDecisions(cull, toast.show, toast.showError, { seen: () => viewState.rejectHintSeen.value, dismiss: viewState.dismissRejectHint }))
const tagEntry = useTagEntryTargets()
const seriesCompare = useSeriesCompare({ series: () => cull.series.value, decisionOf: cull.decisionOf, decide: decideInCompare, pickRest, removeFromSeries, dissolve: dissolveSeries, everySeries: () => cull.everySeries.value, merge: mergeSeries, markSeries, settings: () => settings.value, updateSettings, toast: (shown) => toast.show(shown.message, shown.action), holdHashes: cull.holdHashes })
const restOffer = useRestOffer({ seriesOf: () => cull.seriesOf.value, decisionOf: cull.decisionOf, compare: seriesCompare, shown: shownInLoupe, land: landInLoupe })
/** Decides in the series compare, offering *Reject the other N* after a Pick in its viewer. */
function decideInCompare(intent: DecisionIntent, picture: Picture<ListingEntry>, inViewer: boolean) {
	decide(intent, [picture], () => (inViewer ? restOffer(intent, picture) : null))
}
const seriesScreen = useTemplateRef<InstanceType<typeof SeriesCompareScreen>>('seriesScreen')
const immichScreen = useTemplateRef<InstanceType<typeof ImmichScreen>>('immichScreen')
const overlayScreen = computed(() => (loupe.value !== null || immichScreen.value?.loupe ? '.photo-loupe' : seriesCompare.viewer.open.value ? '.series-viewer' : undefined))
const check = freshCheck({ listEntries: props.listEntries }, { pairing: () => cull.pairing.value, writable: (picture) => cull.writabilityOf(picture) === 'writable', seedSidecar: sidecarFlow.sync.seed })
/** Writes the waiting sidecars and waits for the flag saves in flight, before a delete or move reads the folders again (DELETE-002.28). */
async function flushWrites() {
	await sidecars.flush()
	await cull.flushFlags()
}
const xmpExport = useXmpExport(sidecarFlow, { pictures: () => pictures.value.filter((picture) => cull.writabilityOf(picture) === 'writable'), decisionOf: cull.decisionOf, flush: flushWrites })
const deleting = useDeleteFlow({ pictures: () => pictures.value, view: () => view.value, decisionOf: cull.decisionOf, decide, flush: flushWrites, current: sidecarFlow.sync.current, check, trash: props.trashPictures, removeFiles: cull.removeFiles, loupe, toast: toast.show, error: toast.showError, reload: reloadFolder, onDeleted: cullFinished.deleted })
const { dialog: deleteDialog } = deleting
cullFinished.waitWhile(() => loupe.value !== null || seriesCompare.open.value || deleteDialog.value !== null || deleting.busy.value)
const moving = useMoveFlow({ view: () => view.value, settings: () => settings.value, updateSettings, probe: props.move.probeTargets, move: props.move.movePictures, flush: flushWrites, current: sidecarFlow.sync.current, removeFiles: cull.removeFiles, restoreFiles: cull.restoreFiles, listing: () => folderSet.value, loupe, toast: toast.show, error: toast.showError, reload: reloadFolder })
const recent = useRecent(props.positions, props.listEntries, { folderSet: () => folderSet.value, progress: () => progress.value, pairing: () => cull.pairing.value }, toast.showError)
const activeTime = useActiveTime(props.clock)
const resume = useResume(recent.positions, { folderSet: () => folderSet.value, pictures: () => pictures.value, view: () => view.value, progress: () => progress.value, decidedOf: cull.decidedOf, shown: shownInLoupe, openLoupe, takeActiveSeconds: activeTime.take }, toast.show)
const home = useFoldersHome(props.library, { roots: () => (settingsSettled.value ? settings.value.libraryRoots : null), flush: flushWrites, toastError: toast.showError, folderSet: () => folderSet.value, listing: () => recent.listing.value, positionOf: recent.positionOf, openPosition: openRecent, openSet: openFolderSetAnew, saveRoots: (libraryRoots) => updateSettings({ libraryRoots }), includeSubfolders: () => settings.value.foldersIncludeSubfolders, setIncludeSubfolders: (on) => updateSettings({ foldersIncludeSubfolders: on }), now: props.now, toast: toast.show, setFlags: cull.setFlags })
const finishedCard = computed(() => ({ markable: home.finishing.value !== null, onClose: cullFinished.close, onMarkDone: home.markFinished }))
recent.refresh()
watch(pickerOpen, (open) => open && recent.refresh())

const { immich, shown: immichShown, opened, openedStatus, onlyOffer, cull: immichCull, openConnection, checkOpened } = useImmichApp({ source: props.immich, cull: props.immichCull, storage: props.storage, viewState: viewStateApi, now: props.now, toast })
const immichOnly = useImmichOnly({ stored: () => (settingsSettled.value ? settings.value.immichOnly : null), offer: () => onlyOffer.value, store: (chosen) => updateSettings({ immichOnly: chosen }), chooseSource: immich.choose, folderSet: () => folderSet.value, idle: () => folderSet.value === null && !recent.listing.value, pickerOpen })
const IMMICH_HIDDEN_KEYS = unofferedKeys(DECISIONS_ONLY)

const gridKeys = gridHotkeys({ grid: () => grid.value, view: () => view.value, selection, common: cull.common, decide, seriesOf: () => cull.seriesOf.value, pickRest, notInSeries: () => toast.show(notInSeriesHint()), toggleFiltersOff: cull.toggleFiltersOff, openLoupe, openTags: tagEntry.open, headerShown, filtersOpen, filterBar: () => gridScreen.value?.filterBar?.$el, toggleFullscreen: () => props.toggleFullscreen(document.documentElement) })

provideCullContext({ cull, selection, decide, clearFlags, reduceSeries, xmpExport, editSeries: editSelection, deleting, moving, resume, seriesCompare, unsaved: sidecars.waiting, tagEntry, headerShown, home: { fromList: home.fromList, back: home.back }, openLoupe, openSettings: () => (settingsOpen.value = true), loupe: loupeOpening, restOffer, toast: toast.show, settings, updateSettings, viewState, storage: props.storage, imageUrl: props.imageUrl })

/** The file the loupe shows, null while it is closed. */
const shownFile = () => (shownInLoupe() === null ? null : positionFileId(shownInLoupe()!))
const source = useFolderSetOpening(props.location, { folderSet: () => folderSet.value, shownFileId: shownFile, open: cull.open, list: recent.list, openPosition: recent.open, offer: resume.offer, resumeAt: resume.resumeAt, resume: resume.resume, leave: () => {
	pickerOpen.value = false
	home.hide()
}, choose: (target) => ((target === 'folder-picker' ? pickerOpen : settingsOpen).value = true) })
const { openFolderSet } = source
/** Lists the open folder set again (DECISIONS-002.18). */
function reloadFolder() {
	source.reload()
}
/** Opens a folder set under *Recent* at its resume position. */
function openRecent(position: ResumePosition) {
	source.openRecent(position)
}
/** Lists the folder set and opens it with its resume offer. */
function openFolderSetAnew(set: FolderSet) {
	return source.openAt(set, null)
}
/** Shows or hides the file names above the grid's tiles (GRID-004.3). */
const toggleFileNames = () => updateSettings({ showFileNames: !settings.value.showFileNames })
useHotkeys(() => {
	if (pickerOpen.value || dialogs.holdsKeys() || tagEntry.targets.value !== null || deleteDialog.value !== null || cullFinished.numbers.value !== null || sidecarFlow.open.value || moving.pictures.value !== null || moving.report.value !== null) {
		return null
	}
	if (immichShown.value && !shortcutsOpen.value) {
		return { undo: immichCull.undo, redo: immichCull.redo, shortcuts: toggleShortcuts, ...immichScreen.value?.loupe?.hotkeys }
	}
	if (shortcutsOpen.value || folderSet.value === null || immichShown.value || home.shown.value) {
		return { shortcuts: toggleShortcuts }
	}
	if (seriesCompare.open.value) {
		return { undo, redo, shortcuts: toggleShortcuts, ...(seriesScreen.value?.hotkeys() ?? seriesCompare.hotkeys) }
	}
	return { undo, redo, shortcuts: toggleShortcuts, 'review-rejects': deleting.review, delete: () => deleting.summariseShown(selected.value, () => grid.value?.focusedIndex() ?? 0), move: () => moving.openShown(selected.value, () => grid.value?.focusedIndex() ?? 0), ...(loupe.value === null ? { ...gridKeys, compare: seriesCompare.start, 'file-names': toggleFileNames } : loupeScreen.value?.loupe?.hotkeys) }
}, () => settings.value.viKeys)
</script>

<template>
	<AppLayout
		:items="recent.items.value"
		:storage="props.storage"
		:hintYear="yearReviewHint.year.value"
		:source="immich.source.value"
		:offersImmich="immich.offered.value"
		:connections="connectionLines(immich.connections.value, immich.statusOf)"
		:connectionId="opened?.id ?? null"
		@chooseSource="immich.choose"
		@openConnection="openConnection"
		@connectionDetails="connectionOpen = true"
		@closeHint="yearReviewHint.close()"
		@openFolders="home.back"
		@chooseFolders="pickerOpen = true"
		@openRecent="openRecent"
		@openSettings="settingsOpen = true">
		<FoldersHome v-show="immichOnly.started.value && home.shown.value && !immichShown" :home="home" :listFolders="listFolders" />
		<ImmichScreen
			v-if="immichShown && openedStatus?.state === 'ok'"
			ref="immichScreen"
			:cull="immichCull"
			:settings="settings"
			:storage="props.storage"
			:viewState="viewState"
			:tileSize="tileSize"
			@update:tileSize="cull.setTileSize"
			@updateSettings="updateSettings"
			@toast="toast.show($event.message, $event.action)" />
		<ImmichState
			v-else-if="immichShown"
			:connection="opened"
			:status="openedStatus"
			@retry="checkOpened"
			@details="connectionOpen = true" />
		<template v-else-if="home.shown.value" />
		<GridSkeleton v-else-if="recent.listing.value" class="honeycomb__grid" :tileSize="tileSize" />
		<GridScreen v-else-if="folderSet !== null" ref="gridScreen" />
		<NoFolderState v-else @chooseFolder="pickerOpen = true" />
		<FolderPicker
			v-if="pickerOpen && immichOnly.started.value"
			:current="folderSet"
			:closable="immich.offered.value"
			:immichOnly="onlyOffer ?? 'asked'"
			:listFolders="listFolders"
			:listEntries="props.listEntries"
			:roots="settings.libraryRoots"
			:pairing="cull.pairing.value"
			:recent="recent.items.value"
			@confirm="openFolderSet"
			@openRecent="openRecent"
			@immichOnly="immichOnly.choose"
			@cancel="pickerOpen = false" />
		<CullDialogs
			v-if="folderSet !== null"
			:deleting="deleting"
			:moving="moving"
			:sidecars="sidecarFlow"
			:folderSet="folderSet"
			:folders="folders"
			:listFolders="listFolders"
			:container="loupe !== null ? '.photo-loupe' : undefined" />
		<CullFinished v-if="cullFinished.numbers.value !== null" :numbers="cullFinished.numbers.value" v-bind="finishedCard" />
		<SeriesCompareScreen ref="seriesScreen" />
		<SettingsDialog
			v-model:open="settingsOpen"
			:settings="settings"
			:gestureGuideSeen="viewState.gestureGuideSeen.value"
			:admin="isAdmin"
			:listFolders="listFolders"
			:check="home.check"
			@update="updateSettings"
			@showGestureGuide="viewState.showGestureGuide"
			@clearCache="dialogs.settingsActions.clearCache"
			@cleanUp="dialogs.settingsActions.cleanUp"
			@resetStatistics="dialogs.settingsActions.resetStatistics" />
		<ImmichConnectionDialog
			v-if="connectionOpen && opened !== null"
			:connection="opened"
			:status="openedStatus"
			@test="checkOpened"
			@close="connectionOpen = false" />
		<ToastDetails v-if="toast.detailed.value !== null" :detailed="toast.detailed.value" @close="toast.closeDetails" />
		<Teleport to="body">
			<LoupeScreen ref="loupeScreen" />
			<TagEntry
				v-if="tagEntry.targets.value !== null"
				:targets="tagEntry.targets.value.map(cull.tags.tagsOf)"
				:known="cull.tags.known.value"
				@change="tag($event, tagEntry.targets.value!)"
				@close="tagEntry.close" />
			<ShortcutSheet
				v-if="shortcutsOpen"
				:container="overlayScreen"
				:hidden="immichShown ? IMMICH_HIDDEN_KEYS : undefined"
				@close="shortcutsOpen = false" />
			<UndoToast
				v-if="toast.current.value !== null"
				:toast="toast.current.value"
				:top="overlayScreen !== undefined"
				v-bind="toast.listeners" />
		</Teleport>
		<template #outside>
			<AppTooltip :container="overlayScreen" :schedule="props.schedule" />
		</template>
	</AppLayout>
</template>

<style scoped src="./app.css" />
