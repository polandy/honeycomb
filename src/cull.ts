// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { CullApi, SidecarWrites } from './cull-seams.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision, DecisionField, StoredDecision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings, Picture } from './logic/pairing.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { Settings } from './logic/settings.ts'
import type { CountSign } from './logic/stats-counts.ts'
import type { TagChange } from './logic/tag.ts'
import type { DecisionStep, PickRestStep, StepEffects, TagStep, UndoStep } from './logic/undo.ts'
import type { ListedAccess } from './logic/writability.ts'

import { computed, ref, shallowRef, watch } from 'vue'
import { useCullAccess } from './cull-access.ts'
import { useCullFlags } from './cull-flags.ts'
import { useCullHistory } from './cull-history.ts'
import { useCullTags } from './cull-tags.ts'
import { nameComparer } from './l10n.ts'
import { logger } from './logger.ts'
import { prepareCull, warmMembers } from './logic/cull.ts'
import { changedFields, commonDecision, resolveChange, takenBack, withRows } from './logic/decision-change.ts'
import { countsAsDecided, FLAG_FIELDS, pictureDecision, UNDECIDED } from './logic/decision.ts'
import { memberIds } from './logic/pairing.ts'
import { emptyReason, filterPictures, matchesFilters, pictureFolders, progress } from './logic/picture-filter.ts'
import { listedRows, pictureFlag, readDecision } from './logic/picture-flag.ts'
import { sortPictures } from './logic/picture-order.ts'
import { pairingSettings } from './logic/settings.ts'
import { countsByRow, fieldCounts, flagCounts } from './logic/stats-counts.ts'
import { inDoneSeries } from './logic/stored-series.ts'
import { inverseChange } from './logic/tag.ts'
import { withoutFiles } from './logic/trash-report.ts'
import { applyStep, clearEntry, pickRestEntry, tagStep, undoEntry } from './logic/undo.ts'
import { NO_ACCESS } from './logic/writability.ts'
import { usePreviewWarmer } from './preview-warmer.ts'
import { useSeriesEdits } from './series-edits.ts'
import { useSeries } from './series.ts'
import { useStoredSeries } from './stored-series.ts'
import { useViewOptions } from './view-options.ts'

/** A step of the cull's undo history. */
export type CullStep = UndoStep<Picture<ListingEntry>>

/** The open cull, its view settings and the folder picker's state; it pairs and shows singles as the settings say; `onFlagsNotSaved` hears how many photos got their flag back. */
export function useCull(api: CullApi, storage: BrowserStorage, settings: () => Settings, sidecars: SidecarWrites, onFlagsNotSaved: (photos: number) => void = () => undefined) {
	const compareNames = nameComparer()
	const folderSet = ref<FolderSet | null>(null)
	const entries = shallowRef<readonly ListingEntry[]>([])
	const paired = shallowRef<Picture<ListingEntry>[]>([])
	const pairingKey = computed(() => JSON.stringify(pairingSettings(settings())))
	const pairing = computed(() => JSON.parse(pairingKey.value) as PairingSettings)
	const pictures = computed(() => (settings().showSingles ? paired.value : paired.value.filter((picture) => picture.raw !== null && picture.rendered !== null)))
	const decisions = shallowRef<ReadonlyMap<PictureId, Decision>>(new Map())
	/** The file ids a read or a step has set, so a later read leaves them as they are (XMP-003.3). */
	let settled = new Set<PictureId>()
	const access = useCullAccess()
	const flags = useCullFlags(api.flags)
	let opening = 0
	const storedSeries = useStoredSeries(api, () => opening)
	/** Puts each kind of step into effect, or takes it back when `back`. */
	const effects: StepEffects<Picture<ListingEntry>> = {
		decision: (step, back) => store(back ? step.before : step.after, back ? -1 : 1),
		pickRest: (step, back) => store(back ? step.before : step.after, back ? -1 : 1),
		tags: (step, back) => changeTags(step.pictures, back ? inverseChange(step.change) : step.change, back ? -1 : 1),
		series: (step, back) => void storedSeries.store(back ? step.before : step.after),
	}
	const history = useCullHistory<CullStep>((step, back) => applyStep(effects, step, back))
	/** Whether a step on the picture is saved and written through (XMP-008.12). */
	const writesThrough = (picture: Picture<ListingEntry>) => access.writabilityOf(picture) === 'writable'
	const tags = useCullTags(api.tags, sidecars.writeTags, writesThrough)
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

	/** Shows the pictures of the confirmed folders with fresh filters and the listing's flags, then reads their sidecars. */
	function open(set: FolderSet, listed: readonly ListingEntry[], listedAccess: ListedAccess = NO_ACCESS) {
		folderSet.value = set
		access.open(listedAccess)
		opening++
		entries.value = listed
		paired.value = prepareCull(listed, pairing.value).pictures
		decisions.value = withRows(new Map(), listedRows(paired.value))
		settled = new Set()
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

	/** Reads the stored series and the sidecars of every picture. */
	function loadDecisions(opened: readonly Picture<ListingEntry>[]) {
		storedSeries.load(opened)
		readPictures(opened)
	}

	/** Shows the sidecars' values of the pictures no read or step has set yet, with the listing's flag, and takes over those without a row (XMP-003.3, .34–.36, TAGS-002.2). */
	function readPictures(read: readonly Picture<ListingEntry>[]) {
		const shown = paired.value
		const cull = opening
		sidecars.read(read).then((fromSidecars) => {
			if (opening !== cull || paired.value !== shown) {
				return
			}
			tags.fromSidecars(fromSidecars.tagged)
			const stated = new Map(fromSidecars.decided.map(({ picture, decision }) => [picture, decision]))
			const fresh = read.filter((picture) => !memberIds(picture).some((fileId) => settled.has(fileId)))
			const rows = fresh.flatMap((picture) => memberIds(picture).map((fileId) => ({ fileId, ...readDecision(pictureFlag(picture), stated.get(picture) ?? UNDECIDED) })))
			decisions.value = withRows(decisions.value, rows)
			settle(rows)
			const unlisted = new Set(fresh.filter((picture) => pictureFlag(picture) === null).flatMap(memberIds))
			flags.takeOver(rows.filter(({ fileId }) => unlisted.has(fileId)))
		}).catch((error: unknown) => logger.error('Could not read the sidecars; the photos show the listing\'s flags', { error }))
	}

	/** Marks the rows' files as set, so no read overrides them. */
	function settle(rows: readonly StoredDecision[]) {
		for (const { fileId } of rows) {
			settled.add(fileId)
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

	/** How many rateable pictures *Clear picks/rejects* would reset (GRID-001.22). */
	const clearable = computed(() => clearEntry(decided(pictures.value.filter(writesThrough)))?.names.length ?? 0)

	/** Resets the rateable pictures of the folder set to unflagged without Keep RAW as one undo step, or null when nothing changes (GRID-001.22). */
	function clearFlags(): DecisionStep | null {
		return history.record(clearEntry(decided(pictures.value.filter(writesThrough))))
	}

	/** Shows the rows at once, saves their flags and writes their other changed fields through with what they count, by the sign; a failed save or write is taken back (XMP-003.37, .38, XMP-008.15, .17, STATS-001). */
	function store(rows: readonly StoredDecision[], sign: CountSign) {
		const before = decisions.value
		const after = withRows(before, rows)
		decisions.value = after
		settle(rows)
		const fields = changedFields(rows, before)
		const fileIds = new Set(rows.map(({ fileId }) => fileId))
		const written = paired.value.filter((picture) => memberIds(picture).some((fileId) => fileIds.has(fileId)) && writesThrough(picture))
		const writtenRows = rowsOf(rows, written)
		const flagFields = fields.filter((field) => FLAG_FIELDS.includes(field))
		const sidecarFields = fields.filter((field) => !FLAG_FIELDS.includes(field))
		if (writtenRows.length > 0 && flagFields.length > 0) {
			void flags.save(writtenRows, countsByRow(written, writtenRows, (picture) => flagCounts(pictureDecision(picture, before).flag, pictureDecision(picture, after).flag))).then((notSaved) => {
				const back = written.filter((picture) => memberIds(picture).some((fileId) => notSaved.has(fileId)))
				if (back.length > 0) {
					takeBack(rowsOf(writtenRows, back), before, flagFields)
					onFlagsNotSaved(back.length)
				}
			})
		}
		if (written.length > 0 && sidecarFields.length > 0) {
			sidecars.write(written, decisionOf, sidecarFields, undefined, (picture) => fieldCounts(pictureDecision(picture, before), pictureDecision(picture, after), sign)).then(({ failed }) => {
				const failedPictures = new Set(failed.map(({ picture }) => picture))
				takeBack(rowsOf(writtenRows, written.filter((picture) => failedPictures.has(picture))), before, sidecarFields)
			}, (error: unknown) => logger.error('Could not write the sidecars; the photos show them as changed', { error }))
		}
	}

	/** The rows of the pictures' members. */
	function rowsOf(rows: readonly StoredDecision[], of: readonly Picture<ListingEntry>[]): StoredDecision[] {
		const fileIds = new Set(of.flatMap(memberIds))
		return rows.filter(({ fileId }) => fileIds.has(fileId))
	}

	/** Takes the fields of the written rows back where they still hold what was written. */
	function takeBack(written: readonly StoredDecision[], before: ReadonlyMap<PictureId, Decision>, fields: readonly DecisionField[]) {
		if (written.length > 0) {
			decisions.value = withRows(decisions.value, takenBack(decisions.value, written, before, fields))
		}
	}

	/** Changes the tags of the pictures as a step says, counting each by the sign. */
	function changeTags(chosen: readonly Picture<ListingEntry>[], change: TagChange, sign: CountSign) {
		tags.change(chosen, change, sign)
	}

	/** Takes trashed files out of the pictures; returns what each affected picture became (ADR 0013). */
	function removeFiles(fileIds: ReadonlySet<PictureId>) {
		const { pictures: left, replaced } = withoutFiles(paired.value, fileIds, pairing.value)
		entries.value = entries.value.filter((entry) => !fileIds.has(entry.fileId))
		paired.value = left
		return replaced
	}

	/** Puts files back into the listing and pairs it again; the restored pictures not set yet show their listed flags, then their sidecars are read. */
	function restoreFiles(restored: readonly ListingEntry[]) {
		entries.value = [...entries.value, ...restored]
		paired.value = prepareCull(entries.value, pairing.value).pictures
		const fileIds = new Set(restored.map((entry) => entry.fileId))
		storedSeries.restore([...fileIds])
		const pictures = paired.value.filter((picture) => memberIds(picture).some((fileId) => fileIds.has(fileId)))
		decisions.value = withRows(decisions.value, listedRows(pictures.filter((picture) => !memberIds(picture).some((fileId) => settled.has(fileId)))))
		readPictures(pictures)
	}

	return {
		writabilityOf: access.writabilityOf,
		flushFlags: flags.flush,
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
		tags,
		decisionOf,
		decidedOf,
		passes,
		common,
		series: seriesState.series,
		everySeries: seriesState.everySeries,
		seriesOf: seriesState.seriesOf,
		qualityOf: seriesState.qualityOf,
		openSeries: seriesState.openSeries,
		seriesLoading: storedSeries.loading,
		holdHashes: seriesState.holdHashes,
		hashProgress: seriesState.hashProgress,
		decide,
		pickRest,
		clearable,
		clearFlags,
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
