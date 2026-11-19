// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { CullApi, SidecarWrites } from './cull-seams.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision, DecisionField, StoredDecision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings, Picture } from './logic/pairing.ts'
import type { Settings } from './logic/settings.ts'
import type { TagChange } from './logic/tag.ts'
import type { DecisionStep, PickRestStep, StepEffects, TagStep, UndoStep } from './logic/undo.ts'
import type { ListedAccess } from './logic/writability.ts'

import { computed, ref, shallowRef, watch } from 'vue'
import { useCullAccess } from './cull-access.ts'
import { useCullHistory } from './cull-history.ts'
import { useCullTags } from './cull-tags.ts'
import { nameComparer } from './l10n.ts'
import { logger } from './logger.ts'
import { prepareCull, warmMembers } from './logic/cull.ts'
import { changedFields, commonDecision, resolveChange, withRows } from './logic/decision-change.ts'
import { countsAsDecided, decisionsByFileId, pictureDecision } from './logic/decision.ts'
import { legacyWrites } from './logic/legacy.ts'
import { memberIds } from './logic/pairing.ts'
import { emptyReason, filterPictures, matchesFilters, pictureFolders, progress } from './logic/picture-filter.ts'
import { sortPictures } from './logic/picture-order.ts'
import { pairingSettings } from './logic/settings.ts'
import { inDoneSeries } from './logic/stored-series.ts'
import { inverseChange } from './logic/tag.ts'
import { withoutFiles } from './logic/trash-report.ts'
import { applyStep, pickRestEntry, tagStep, undoEntry } from './logic/undo.ts'
import { NO_ACCESS } from './logic/writability.ts'
import { usePreviewWarmer } from './preview-warmer.ts'
import { useSeriesEdits } from './series-edits.ts'
import { useSeries } from './series.ts'
import { useStoredSeries } from './stored-series.ts'
import { useViewOptions } from './view-options.ts'

/** A step of the cull's undo history. */
export type CullStep = UndoStep<Picture<ListingEntry>>

/** The open cull, its view settings and the folder picker's state; it pairs and shows singles as the settings say. */
export function useCull(api: CullApi, storage: BrowserStorage, settings: () => Settings, sidecars: SidecarWrites) {
	const compareNames = nameComparer()
	const folderSet = ref<FolderSet | null>(null)
	const entries = shallowRef<readonly ListingEntry[]>([])
	const paired = shallowRef<Picture<ListingEntry>[]>([])
	const pairingKey = computed(() => JSON.stringify(pairingSettings(settings())))
	const pairing = computed(() => JSON.parse(pairingKey.value) as PairingSettings)
	const pictures = computed(() => (settings().showSingles ? paired.value : paired.value.filter((picture) => picture.raw !== null && picture.rendered !== null)))
	const decisions = shallowRef<ReadonlyMap<number, Decision>>(new Map())
	const legacyDecisions = shallowRef<ReadonlyMap<number, Decision>>(new Map())
	const access = useCullAccess(hasLegacyRows)
	let opening = 0
	const storedSeries = useStoredSeries(api, () => opening)
	/** Puts each kind of step into effect, or takes it back when `back`. */
	const effects: StepEffects<Picture<ListingEntry>> = {
		decision: (step, back) => store(back ? step.before : step.after),
		pickRest: (step, back) => store(back ? step.before : step.after),
		tags: (step, back) => changeTags(step.pictures, back ? inverseChange(step.change) : step.change),
		series: (step, back) => void storedSeries.store(back ? step.before : step.after),
	}
	const history = useCullHistory<CullStep>((step, back) => applyStep(effects, step, back))
	/** Whether a step on the picture is written through to its sidecars (XMP-008.1). */
	const writesThrough = (picture: Picture<ListingEntry>) => access.writabilityOf(picture) === 'writable'
	const tags = useCullTags(api.tags, sidecars.writeTags, () => opening, writesThrough)
	const folderPaths = computed(() => pictureFolders(pictures.value, compareNames))
	const folders = computed(() => folderPaths.value.length)
	const options = useViewOptions(storage, () => folders.value)
	const { filters, sortOrder, grouped } = options
	const decisionOf = (picture: Picture<ListingEntry>) => pictureDecision(picture, decisions.value)
	const passes = (picture: Picture<ListingEntry>) => matchesFilters(picture, decisionOf(picture), tags.tagsOf(picture), filters.value)
	const view = computed(() => sortPictures(filterPictures(pictures.value, decisionOf, tags.tagsOf, filters.value), sortOrder.value, compareNames, grouped.value))
	/** Whether the picture counts as decided, an unflagged one in a done series too (SERIES-005.14). */
	const decidedOf = (picture: Picture<ListingEntry>) => countsAsDecided(decisionOf(picture), inDoneSeries(picture, storedSeries.rows.value))
	const cullProgress = computed(() => progress(pictures.value, decidedOf))
	const shownProgress = computed(() => progress(view.value, decidedOf))
	const empty = computed(() => emptyReason(filters.value, pictures.value.length))
	const seriesState = useSeries(api, storage, () => pictures.value, decisionOf, () => storedSeries.rows.value)
	const warmer = usePreviewWarmer(api.warmPreviews, storage)
	const seriesEdits = useSeriesEdits({ record: history.record, rows: () => storedSeries.rows.value, newId: storedSeries.newId, seriesOf: () => seriesState.seriesOf.value })

	/** Shows the pictures of the confirmed folders with fresh filters, then their stored decisions. */
	function open(set: FolderSet, listed: readonly ListingEntry[], listedAccess: ListedAccess = NO_ACCESS) {
		folderSet.value = set
		access.open(listedAccess)
		opening++
		entries.value = listed
		paired.value = prepareCull(listed, pairing.value).pictures
		decisions.value = new Map()
		legacyDecisions.value = new Map()
		tags.reset()
		storedSeries.reset()
		tags.loadList()
		history.reset()
		options.reset()
		warmer.warm(warmMembers(view.value))
		loadDecisions(paired.value)
	}

	watch(pairing, () => {
		paired.value = prepareCull(entries.value, pairing.value).pictures
		loadDecisions(paired.value)
	})

	/** Reads the stored series and the decisions and tags of every member. */
	function loadDecisions(opened: readonly Picture<ListingEntry>[]) {
		storedSeries.load(opened)
		const fileIds = opened.flatMap(memberIds)
		readPictures(opened, fileIds, fileIds)
	}

	/** Shows the legacy rows of the files and the sidecars' values of the pictures, read through the XMP cache; a legacy row wins, then a change made meanwhile, then the sidecars (XMP-003.1–.3, TAGS-002.2). */
	function readPictures(read: readonly Picture<ListingEntry>[], decisionIds: readonly number[], tagIds: readonly number[]) {
		const shown = paired.value
		const cull = opening
		Promise.all([lookupLegacy(decisionIds), tags.load(tagIds), sidecars.read(read)]).then(([rows, , fromSidecars]) => {
			if (opening !== cull || paired.value !== shown) {
				return
			}
			legacyDecisions.value = new Map([...legacyDecisions.value, ...decisionsByFileId(rows)])
			decisions.value = new Map([...decisionsByFileId(rows), ...decisions.value])
			tags.fromSidecars(fromSidecars.tagged)
			const undecided = fromSidecars.decided.filter(({ picture }) => !memberIds(picture).some((fileId) => decisions.value.has(fileId)))
			if (undecided.length > 0) {
				decisions.value = withRows(decisions.value, undecided.flatMap(({ picture, decision }) => memberIds(picture).map((fileId) => ({ fileId, ...decision }))))
			}
		}).catch((error: unknown) => logger.error('Could not read the sidecars; the photos show their stored decisions', { error }))
	}

	/** The legacy decisions of the files; none, logged, when they cannot be read (XMP-003.2). */
	async function lookupLegacy(fileIds: readonly number[]): Promise<StoredDecision[]> {
		try {
			return fileIds.length === 0 ? [] : await api.lookupDecisions(fileIds)
		} catch (error) {
			logger.error('Could not read the stored decisions; the photos show their sidecars\' decisions', { error })
			return []
		}
	}

	/** The pictures with their decisions, as the decision rules take them. */
	const decided = (chosen: readonly Picture<ListingEntry>[]) => chosen.map((picture) => ({ picture, decision: decisionOf(picture) }))

	/** What the pictures share, for the action bar. */
	const common = (chosen: readonly Picture<ListingEntry>[]) => commonDecision(decided(chosen))

	/** Decides the writable pictures, keeps the step for undo and returns it, or null when nothing changes or all are locked (XMP-008.9). */
	function decide(intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]): DecisionStep | null {
		return access.gate(chosen, (writable) => history.record(undoEntry(decided(writable), resolveChange(intent, decided(writable)))))
	}

	/** Picks one picture and rejects the rest as one undo step (SERIES-001.9), or null when nothing changes. */
	function pickRest(picked: Picture<ListingEntry>, rest: readonly Picture<ListingEntry>[]): PickRestStep | null {
		return access.gate([picked, ...rest], (writable) => history.record(pickRestEntry(decided([picked])[0]!, decided(writable.filter((picture) => picture !== picked)))), picked)
	}

	/** Applies the tag change to the pictures as one undo step and returns it, or null when nothing changes (TAGS-003.10, .11). */
	function tag(change: TagChange, chosen: readonly Picture<ListingEntry>[]): TagStep<Picture<ListingEntry>> | null {
		return access.gate(chosen, (writable) => history.record(tagStep(writable, tags.tagsOf, change)))
	}

	/** Shows the rows at once and writes their changed fields through. */
	function store(rows: readonly StoredDecision[]) {
		const before = decisions.value
		decisions.value = withRows(before, rows)
		writeThrough(rows, changedFields(rows, before))
	}

	/** Writes the changed fields of the rows' pictures to their sidecars where they write through (XMP-003.6, .20, XMP-008.1). */
	function writeThrough(rows: readonly StoredDecision[], fields: readonly DecisionField[]) {
		const fileIds = new Set(rows.map((row) => row.fileId))
		const written = paired.value.filter((picture) => memberIds(picture).some((fileId) => fileIds.has(fileId)) && writesThrough(picture))
		if (written.length > 0 && fields.length > 0) {
			void sidecars.write(written, decisionOf, fields)
		}
	}

	/** The pictures with legacy rows, for *Write decisions to sidecars…* (XMP-007.5); they are locked until it wrote them (XMP-008.11). */
	const legacy = computed(() => legacyWrites(paired.value, legacyDecisions.value, tags.legacyTagsOf))
	const legacyPictures = computed(() => new Set(legacy.value.map(({ picture }) => picture)))

	/** Whether the picture still has legacy rows, which lock it (XMP-008.11). */
	function hasLegacyRows(picture: Picture<ListingEntry>) {
		return legacyPictures.value.has(picture)
	}

	/** Changes the tags of the pictures as a step says. */
	function changeTags(chosen: readonly Picture<ListingEntry>[], change: TagChange) {
		tags.change(chosen, change)
	}

	/** Forgets the legacy rows of the files the ⋯ entry wrote to their sidecars, which unlocks their pictures (XMP-008.11). */
	function forgetLegacy(fileIds: readonly number[]) {
		const forgotten = new Set(fileIds)
		legacyDecisions.value = new Map([...legacyDecisions.value].filter(([fileId]) => !forgotten.has(fileId)))
		tags.forget(forgotten)
	}

	/** Takes trashed files out of the pictures; returns what each affected picture became (ADR 0013). */
	function removeFiles(fileIds: ReadonlySet<number>) {
		const { pictures: left, replaced } = withoutFiles(paired.value, fileIds, pairing.value)
		entries.value = entries.value.filter((entry) => !fileIds.has(entry.fileId))
		paired.value = left
		return replaced
	}

	/** Puts files back into the listing and pairs it again; the decisions and tags of unknown ids are read, the restored pictures' sidecars too. */
	function restoreFiles(restored: readonly ListingEntry[]) {
		entries.value = [...entries.value, ...restored]
		paired.value = prepareCull(entries.value, pairing.value).pictures
		const fileIds = new Set(restored.map((entry) => entry.fileId))
		storedSeries.restore([...fileIds])
		const pictures = paired.value.filter((picture) => memberIds(picture).some((fileId) => fileIds.has(fileId)))
		readPictures(pictures, [...fileIds].filter((fileId) => !decisions.value.has(fileId)), [...fileIds].filter((fileId) => !tags.tags.value.has(fileId)))
	}

	return {
		writabilityOf: access.writabilityOf,
		takeSkipped: access.takeSkipped,
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
		legacy,
		forgetLegacy,
		tags,
		decisionOf,
		decidedOf,
		passes,
		common,
		series: seriesState.series,
		everySeries: seriesState.everySeries,
		seriesOf: seriesState.seriesOf,
		openSeries: seriesState.openSeries,
		holdHashes: seriesState.holdHashes,
		hashProgress: seriesState.hashProgress,
		decide,
		pickRest,
		tag,
		...seriesEdits,
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
