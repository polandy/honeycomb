// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { CullApi, CullSidecars } from './cull-seams.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision, StoredDecision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings, Picture } from './logic/pairing.ts'
import type { Settings, SidecarWriting } from './logic/settings.ts'
import type { TagChange } from './logic/tag.ts'
import type { DecisionStep, PickRestStep, StepEffects, TagStep, UndoStep } from './logic/undo.ts'

import { computed, ref, shallowRef, watch } from 'vue'
import { useCullHistory } from './cull-history.ts'
import { useCullTags } from './cull-tags.ts'
import { nameComparer } from './l10n.ts'
import { logger } from './logger.ts'
import { prepareCull, warmMembers } from './logic/cull.ts'
import { commonDecision, resolveChange, revertRows, withRows } from './logic/decision-change.ts'
import { decisionsByFileId, pictureDecision } from './logic/decision.ts'
import { memberIds } from './logic/pairing.ts'
import { emptyReason, filterPictures, matchesFilters, pictureFolders, progress } from './logic/picture-filter.ts'
import { sortPictures } from './logic/picture-order.ts'
import { byFileId, saveQueue } from './logic/save-queue.ts'
import { pairingSettings } from './logic/settings.ts'
import { inSharedFolder } from './logic/sidecar-sync.ts'
import { inverseChange } from './logic/tag.ts'
import { withoutFiles } from './logic/trash-report.ts'
import { applyStep, pickRestEntry, tagStep, undoEntry } from './logic/undo.ts'
import { usePreviewWarmer } from './preview-warmer.ts'
import { useSeries } from './series.ts'
import { useStoredSeries } from './stored-series.ts'
import { useViewOptions } from './view-options.ts'

/** A step of the cull's undo history. */
export type CullStep = UndoStep<Picture<ListingEntry>>

/** The open cull, its view settings and the folder picker's state; it pairs and shows singles as the settings say. */
export function useCull(api: CullApi, storage: BrowserStorage, settings: () => Settings, sidecars: CullSidecars) {
	const compareNames = nameComparer()
	const folderSet = ref<FolderSet | null>(null)
	const entries = shallowRef<readonly ListingEntry[]>([])
	const paired = shallowRef<Picture<ListingEntry>[]>([])
	const pairingKey = computed(() => JSON.stringify(pairingSettings(settings())))
	const pairing = computed(() => JSON.parse(pairingKey.value) as PairingSettings)
	const pictures = computed(() => (settings().showSingles ? paired.value : paired.value.filter((picture) => picture.raw !== null && picture.rendered !== null)))
	const decisions = shallowRef<ReadonlyMap<number, Decision>>(new Map())
	const saveFailed = ref(false)
	const saveDecisions = saveQueue(api.saveDecisions, { key: byFileId })
	const sharedFolders = shallowRef<ReadonlySet<string>>(new Set())
	let opening = 0
	/** Puts each kind of step into effect, or takes it back when `back`. */
	const effects: StepEffects<Picture<ListingEntry>> = {
		decision: (step, back) => store(back ? step.before : step.after),
		pickRest: (step, back) => store(back ? step.before : step.after),
		tags: (step, back) => storeTags(step.pictures, back ? inverseChange(step.change) : step.change),
	}
	const history = useCullHistory<CullStep>((step, back) => applyStep(effects, step, back))
	/** How the picture's sidecars are written: the setting, unless a shared folder keeps them (XMP-003.11, .18). */
	const sidecarWriting = (picture: Picture<ListingEntry>): SidecarWriting => settings().sidecarWrite !== 'off' && inSharedFolder(picture, sharedFolders.value) ? 'shared-folder' : settings().sidecarWrite
	/** Whether a step on the picture is written through to its sidecars on its own. */
	const writesThrough = (picture: Picture<ListingEntry>) => sidecarWriting(picture) !== 'off' && sidecarWriting(picture) !== 'shared-folder'
	const tags = useCullTags(api.tags, sidecars.writeTags, () => opening, writesThrough)
	const folderPaths = computed(() => pictureFolders(pictures.value, compareNames))
	const folders = computed(() => folderPaths.value.length)
	const options = useViewOptions(storage, () => folders.value)
	const { filters, sortOrder, grouped } = options
	const decisionOf = (picture: Picture<ListingEntry>) => pictureDecision(picture, decisions.value)
	const passes = (picture: Picture<ListingEntry>) => matchesFilters(picture, decisionOf(picture), tags.tagsOf(picture), filters.value)
	const view = computed(() => sortPictures(filterPictures(pictures.value, decisionOf, tags.tagsOf, filters.value), sortOrder.value, compareNames, grouped.value))
	const cullProgress = computed(() => progress(pictures.value, decisionOf))
	const shownProgress = computed(() => progress(view.value, decisionOf))
	const empty = computed(() => emptyReason(filters.value, pictures.value.length))
	const storedSeries = useStoredSeries(api.lookupSeries, () => opening)
	const seriesState = useSeries(api, storage, () => pictures.value, decisionOf, () => storedSeries.rows.value)
	const warmer = usePreviewWarmer(api.warmPreviews, storage)
	const sharedPictures = computed(() => pictures.value.filter((picture) => inSharedFolder(picture, sharedFolders.value)))

	/** Shows the pictures of the confirmed folders with fresh filters, then their stored decisions. */
	function open(set: FolderSet, listed: readonly ListingEntry[], shared: readonly string[]) {
		folderSet.value = set
		sharedFolders.value = new Set(shared)
		opening++
		entries.value = listed
		paired.value = prepareCull(listed, pairing.value).pictures
		decisions.value = new Map()
		tags.reset()
		storedSeries.reset()
		tags.loadList()
		history.reset()
		saveFailed.value = false
		options.reset()
		warmer.warm(warmMembers(view.value))
		loadDecisions(paired.value)
	}

	watch(pairing, () => {
		paired.value = prepareCull(entries.value, pairing.value).pictures
		loadDecisions(paired.value)
	})

	/** Reads the decisions, tags and stored series of every member, then takes the sidecars' over; they apply only while the same pictures are open, under changes made meanwhile. */
	function loadDecisions(opened: readonly Picture<ListingEntry>[]) {
		const storedTags = tags.load(opened)
		storedSeries.load(opened)
		api.lookupDecisions(opened.flatMap(memberIds)).then(async (rows) => {
			if (paired.value !== opened) {
				return
			}
			decisions.value = new Map([...decisionsByFileId(rows), ...decisions.value])
			await takeOver(opened, new Set(rows.map((row) => row.fileId)), await storedTags)
		}).catch((error: unknown) => logger.error('Could not read the decisions; every photo shows as undecided', { error }))
	}

	/** Shows and stores the sidecars' decision of the pictures still undecided, and their tags; no undo step and no write back (XMP-003.1–.5, TAGS-002.2). */
	async function takeOver(opened: readonly Picture<ListingEntry>[], storedIds: ReadonlySet<number>, storedTagIds: ReadonlySet<number> | null) {
		const cull = opening
		const { decided: taken, tagged } = await sidecars.takeOver(opened, storedIds, storedTagIds)
		tags.takeOver(paired.value === opened ? cull : null, tagged)
		const rows = paired.value === opened
			? taken.filter(({ picture }) => !memberIds(picture).some((fileId) => decisions.value.has(fileId)))
					.flatMap(({ picture, decision }) => memberIds(picture).map((fileId) => ({ fileId, ...decision })))
			: []
		if (rows.length > 0) {
			decisions.value = withRows(decisions.value, rows)
			void saveDecisions(rows).then((saved) => saved.ok || logger.error('Could not save the decisions taken over from the sidecars', { error: saved.error }))
		}
	}

	/** The pictures with their decisions, as the decision rules take them. */
	const decided = (chosen: readonly Picture<ListingEntry>[]) => chosen.map((picture) => ({ picture, decision: decisionOf(picture) }))

	/** What the pictures share, for the action bar. */
	const common = (chosen: readonly Picture<ListingEntry>[]) => commonDecision(decided(chosen))

	/** Decides the pictures, keeps the step for undo and returns it, or null when nothing changes. */
	function decide(intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]): DecisionStep | null {
		return history.record(undoEntry(decided(chosen), resolveChange(intent, decided(chosen))))
	}

	/** Picks one picture and rejects the rest as one undo step (SERIES-001.9), or null when nothing changes. */
	function pickRest(picked: Picture<ListingEntry>, rest: readonly Picture<ListingEntry>[]): PickRestStep | null {
		return history.record(pickRestEntry(decided([picked])[0]!, decided(rest)))
	}

	/** Applies the tag change to the pictures as one undo step and returns it, or null when nothing changes (TAGS-003.10, .11). */
	function tag(change: TagChange, chosen: readonly Picture<ListingEntry>[]): TagStep<Picture<ListingEntry>> | null {
		return history.record(tagStep(chosen, tags.tagsOf, change))
	}

	/** Changes the pictures' tags and says in the grid when the save failed. */
	function storeTags(chosen: readonly Picture<ListingEntry>[], change: TagChange) {
		const opened = opening
		saveFailed.value = false
		void tags.change(chosen, change).then((saved) => {
			if (!saved && opening === opened) {
				saveFailed.value = true
			}
		})
	}

	/** Shows the rows at once and stores them; a failed save puts back what they replaced. */
	function store(rows: readonly StoredDecision[]) {
		const before = decisions.value
		const opened = opening
		decisions.value = withRows(before, rows)
		saveFailed.value = false
		void saveDecisions(rows).then((saved) => {
			if (saved.ok) {
				writeThrough(rows, opened)
				return
			}
			logger.error('Could not save the decisions', { error: saved.error })
			if (opening === opened) {
				decisions.value = revertRows(decisions.value, saved.unsaved, before)
				saveFailed.value = true
			}
		})
	}

	/** Writes the decisions of the rows' pictures to their sidecars where they write through (XMP-003.6, .11, .18). */
	function writeThrough(rows: readonly StoredDecision[], opened: number) {
		const fileIds = new Set(rows.map((row) => row.fileId))
		const written = paired.value.filter((picture) => memberIds(picture).some((fileId) => fileIds.has(fileId)) && writesThrough(picture))
		if (opening === opened && written.length > 0) {
			void sidecars.write(written, decisionOf)
		}
	}

	/** The pictures in shared folders with a stored decision, for an explicit write (XMP-003.12). */
	const sharedDecided = () => sharedPictures.value.filter((picture) => memberIds(picture).some((fileId) => decisions.value.has(fileId)))

	/** Takes trashed files out of the pictures; returns what each affected picture became (ADR 0013). */
	function removeFiles(fileIds: ReadonlySet<number>) {
		const { pictures: left, replaced } = withoutFiles(paired.value, fileIds, pairing.value)
		entries.value = entries.value.filter((entry) => !fileIds.has(entry.fileId))
		paired.value = left
		return replaced
	}

	/** Puts files back into the listing and pairs it again; decisions are keyed by file id, so those of unknown ids are read. */
	function restoreFiles(restored: readonly ListingEntry[]) {
		entries.value = [...entries.value, ...restored]
		paired.value = prepareCull(entries.value, pairing.value).pictures
		tags.restore(restored.map((entry) => entry.fileId))
		storedSeries.restore(restored.map((entry) => entry.fileId))
		const unknown = restored.map((entry) => entry.fileId).filter((fileId) => !decisions.value.has(fileId))
		const opened = opening
		if (unknown.length > 0) {
			api.lookupDecisions(unknown).then((rows) => {
				if (opening === opened) {
					decisions.value = new Map([...decisionsByFileId(rows), ...decisions.value])
				}
			}).catch((error: unknown) => logger.error('Could not read the decisions of the photos moved back', { error }))
		}
	}

	return {
		sidecarWriting,
		folderSet,
		pictures,
		pairing,
		folderPaths,
		folders,
		grouped,
		view,
		progress: cullProgress,
		shownProgress,
		filters,
		activeFilters: options.activeFilters,
		empty,
		sortOrder,
		filtersOpen: options.filtersOpen,
		pickerOpen: options.pickerOpen,
		groupByFolder: options.groupByFolder,
		tileSize: options.tileSize,
		saveFailed,
		sharedPictures,
		sharedDecided,
		tags,
		decisionOf,
		passes,
		common,
		series: seriesState.series,
		seriesSizes: seriesState.seriesSizes,
		seriesOf: seriesState.seriesOf,
		openSeries: seriesState.openSeries,
		holdHashes: seriesState.holdHashes,
		hashProgress: seriesState.hashProgress,
		decide,
		pickRest,
		tag,
		undo: history.undo,
		redo: history.redo,
		open,
		removeFiles,
		restoreFiles,
		setFlags: options.setFlags,
		toggleFiltersOff: options.toggleFiltersOff,
		setTileSize: options.setTileSize,
	}
}
