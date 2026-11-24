import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Decision, StoredDecision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry, SourceEntry } from '../logic/listing.ts'
import type { OpenedSource } from '../logic/opened-source.ts'
import type { PairingSettings, Picture } from '../logic/pairing.ts'
import type { PictureId } from '../logic/picture-id.ts'
import type { ReductionPlan } from '../logic/series-reduction.ts'
import type { Settings } from '../logic/settings.ts'
import type { SavedSidecar } from '../logic/sidecar-sync.ts'
import type { CountSign } from '../logic/stats-counts.ts'
import type { TagChange } from '../logic/tag.ts'
import type { DecisionStep, PickRestStep, ReductionStep, StepEffects, TagStep, UndoStep } from '../logic/undo.ts'
import type { ListedAccess } from '../logic/writability.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from '../shared/browser-storage.ts'
import type { CullApi, SidecarWrites } from './cull-seams.ts'

import { computed, shallowRef, watch } from 'vue'
import { sharpnessBy } from '../hashes/quality-of.ts'
import { prepareCull, warmMembers } from '../logic/cull.ts'
import { commonDecision, resolveChange, withRows } from '../logic/decision-change.ts'
import { countsAsDecided, pictureDecision, UNDECIDED } from '../logic/decision.ts'
import { listedPictures } from '../logic/listing.ts'
import { folderSetOf, folderSource } from '../logic/opened-source.ts'
import { memberIds } from '../logic/pairing.ts'
import { emptyReason, filterPictures, matchesFilters, pictureFolders, progress } from '../logic/picture-filter.ts'
import { listedRows, pictureFlag, readDecision } from '../logic/picture-flag.ts'
import { sortPictures } from '../logic/picture-order.ts'
import { reductionPlan as planReduction } from '../logic/series-reduction.ts'
import { pairingSettings } from '../logic/settings.ts'
import { readEtags, savedEtags } from '../logic/sidecar-etags.ts'
import { inDoneSeries } from '../logic/stored-series.ts'
import { inverseChange } from '../logic/tag.ts'
import { withoutFiles } from '../logic/trash-report.ts'
import { applyStep, clearEntry, pickRestEntry, reductionEntry, tagStep, undoEntry } from '../logic/undo.ts'
import { NO_ACCESS } from '../logic/writability.ts'
import { useSeriesEdits } from '../series/series-edits.ts'
import { useSeries } from '../series/series.ts'
import { useStoredSeries } from '../series/stored-series.ts'
import { useViewOptions } from '../settings/view-options.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'
import { nameComparer } from '../shared/l10n.ts'
import { logger } from '../shared/logger.ts'
import { usePreviewWarmer } from '../shared/preview-warmer.ts'
import { useCullAccess } from './cull-access.ts'
import { syncFlags } from './cull-flag-sync.ts'
import { useCullFlags } from './cull-flags.ts'
import { useCullHistory } from './cull-history.ts'
import { useCullTags } from './cull-tags.ts'
import { useCullWrites } from './cull-writes.ts'

/** A step of the cull's undo history. */
export type CullStep = UndoStep<Picture<ListingEntry>>

/** The open cull, its view settings and the folder picker's state; it pairs and shows singles as the settings say; `onFlagsNotSaved` hears how many photos got their flag back. */
export function useCull(api: CullApi, storage: BrowserStorage, settings: () => Settings, sidecars: SidecarWrites, onFlagsNotSaved: (photos: number) => void = () => undefined) {
	const compareNames = nameComparer()
	const source = shallowRef<OpenedSource | null>(null)
	const folderSet = computed(() => folderSetOf(source.value))
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
		reduction: (step, back) => store(back ? step.before : step.after, back ? -1 : 1),
		tags: (step, back) => changeTags(step.pictures, back ? inverseChange(step.change) : step.change, back ? -1 : 1),
		series: (step, back) => fireAndLog(storedSeries.store(back ? step.before : step.after), 'Could not store the series'),
	}
	const history = useCullHistory<CullStep>((step, back) => applyStep(effects, step, back))
	/** Whether a step on the picture is saved and written through (XMP-008.12). */
	const writesThrough = (picture: Picture<ListingEntry>) => access.writabilityOf(picture) === 'writable'
	const tags = useCullTags(api.tags, sidecars.writeTags, writesThrough)
	const writes = useCullWrites(flags, sidecars, { decisions, pictures: () => paired.value, writesThrough, writeFlags: () => settings().writeFlagsToXmp, onFlagsNotSaved })
	const folderPaths = computed(() => pictureFolders(pictures.value, compareNames))
	const folders = computed(() => folderPaths.value.length)
	const options = useViewOptions(storage, () => folders.value)
	const { filters, sortOrder, grouped } = options
	const decisionOf = (picture: Picture<SourceEntry>) => pictureDecision(picture, decisions.value)
	const passes = (picture: Picture<SourceEntry>) => matchesFilters(picture, decisionOf(picture), tags.tagsOf(picture), filters.value)
	const view = computed(() => sortPictures(filterPictures(pictures.value, decisionOf, tags.tagsOf, filters.value), sortOrder.value, compareNames, grouped.value))
	/** Whether the picture counts as decided, an unflagged one in a done series too (SERIES-005.14). */
	const decidedOf = (picture: Picture<SourceEntry>) => countsAsDecided(decisionOf(picture), inDoneSeries(picture, storedSeries.rows.value))
	const cullProgress = computed(() => progress(pictures.value, decidedOf))
	const shownProgress = computed(() => progress(view.value, decidedOf))
	const empty = computed(() => emptyReason(filters.value, pictures.value.length))
	const seriesState = useSeries(api, storage, () => pictures.value, decisionOf, () => storedSeries.rows.value)
	const warmer = usePreviewWarmer(api.warmPreviews, storage)
	const seriesEdits = useSeriesEdits({ record: history.record, rows: () => storedSeries.rows.value, newId: storedSeries.newId, seriesOf: () => seriesState.seriesOf.value })

	/** Shows the pictures of the confirmed folders with fresh filters and the listing's flags, then reads their sidecars. */
	function open(set: FolderSet, listed: readonly ListingEntry[], listedAccess: ListedAccess = NO_ACCESS) {
		source.value = folderSource(set)
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

	/** Shows the sidecars' values of the pictures no read or step has set yet, with the listing's flag, takes over those without a row and syncs the others' flags (XMP-003.3, .34–.36, .46–.49, TAGS-002.2). */
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
			const unlisted = fresh.filter((picture) => pictureFlag(picture) === null)
			const unlistedIds = new Set(unlisted.flatMap(memberIds))
			flags.takeOver(rows.filter(({ fileId }) => unlistedIds.has(fileId)), new Map(unlisted.flatMap((picture) => [...readEtags(picture, fromSidecars.rows)])))
			if (settings().writeFlagsToXmp) {
				syncFlags(fresh, fromSidecars, flags, sidecars, { decisions, writesThrough })
			}
		}).catch((error: unknown) => logger.error('Could not read the sidecars; the photos show the listing\'s flags', { error }))
	}

	/** Marks the rows' files as set, so no read overrides them. */
	function settle(rows: readonly StoredDecision[]) {
		for (const { fileId } of rows) {
			settled.add(fileId)
		}
	}

	/** The pictures with their decisions, as the decision rules take them. */
	const decided = <P extends Picture<SourceEntry>>(chosen: readonly P[]) => chosen.map((picture) => ({ picture, decision: decisionOf(picture) }))

	/** What the pictures share, for the action bar. */
	const common = (chosen: readonly Picture<SourceEntry>[]) => commonDecision(decided(chosen))

	/** Decides the writable pictures, keeps the step for undo and returns it, or null when nothing changes or all are locked (XMP-008.9). */
	function decide(intent: DecisionIntent, chosen: readonly Picture<SourceEntry>[]): DecisionStep | null {
		return access.gate(listedPictures(chosen), (writable) => history.record(undoEntry(decided(writable), resolveChange(intent, decided(writable)))))
	}

	/** Picks one picture and rejects the rest as one undo step (SERIES-001.9), or null when nothing changes. */
	function pickRest(picked: Picture<SourceEntry>, rest: readonly Picture<SourceEntry>[]): PickRestStep | null {
		const [listedPick, ...listedRest] = listedPictures([picked, ...rest])
		return access.gate([listedPick!, ...listedRest], (writable) => history.record(pickRestEntry(decided([listedPick!])[0]!, decided(writable.filter((picture) => picture !== picked)))), listedPick)
	}

	/** Applies the tag change to the pictures as one undo step and returns it, or null when nothing changes (TAGS-003.10, .11). */
	function tag(change: TagChange, chosen: readonly Picture<SourceEntry>[]): TagStep<Picture<ListingEntry>> | null {
		return access.gate(listedPictures(chosen), (writable) => history.record(tagStep(writable, tags.tagsOf, change)))
	}

	/** How many rateable pictures *Clear picks/rejects* would reset (GRID-001.22). */
	const clearable = computed(() => clearEntry(decided(pictures.value.filter(writesThrough)))?.names.length ?? 0)

	/** Resets the rateable pictures of the folder set to unflagged without Keep RAW as one undo step, or null when nothing changes (GRID-001.22). */
	function clearFlags(): DecisionStep | null {
		return history.record(clearEntry(decided(pictures.value.filter(writesThrough))))
	}

	/** The series *Reduce series to the sharpest* would decide (SERIES-008.1). */
	const reductionPlan = computed(() => planReduction(seriesState.everySeries.value, { sharpnessOf: sharpnessBy(seriesState.qualityOf), decisionOf, writable: writesThrough }))

	/** Picks the sharpest of each planned series and rejects the rest as one undo step, or null when nothing changes (SERIES-008.5). */
	function reduceSeries(plan: ReductionPlan<Picture<ListingEntry>>): ReductionStep | null {
		return history.record(reductionEntry(plan.reduced.map(({ kept, rejected }) => ({ picked: decided([kept])[0]!, rest: decided(rejected) }))))
	}

	/** Shows the rows at once and writes them through, counting by the sign. */
	function store(rows: readonly StoredDecision[], sign: CountSign) {
		const before = decisions.value
		decisions.value = withRows(before, rows)
		settle(rows)
		writes.write(rows, before, sign)
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

	/** Records the ETags of the sidecars honeycomb saved for their members (XMP-003.45). */
	const sidecarsSaved = (saved: readonly SavedSidecar[]) => flags.record(savedEtags(saved))

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
		source,
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
		reductionPlan,
		reduceSeries,
		tag,
		...seriesEdits,
		undo: history.undo,
		redo: history.redo,
		open,
		removeFiles,
		restoreFiles,
		sidecarsSaved,
		setFlags: options.setFlags,
		toggleFiltersOff: options.toggleFiltersOff,
		setTileSize: options.setTileSize,
	}
}
