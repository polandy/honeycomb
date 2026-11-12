// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision, StoredDecision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings, Picture } from './logic/pairing.ts'
import type { Filters } from './logic/picture-filter.ts'
import type { SortOrder } from './logic/picture-order.ts'
import type { Settings } from './logic/settings.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { UndoEntry, UndoHistory } from './logic/undo.ts'

import { computed, ref, shallowRef, watch } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { nameComparer } from './l10n.ts'
import { logger } from './logger.ts'
import { prepareCull, warmFileIds } from './logic/cull.ts'
import { commonDecision, resolveChange, revertRows, withRows } from './logic/decision-change.ts'
import { decisionsByFileId, pictureDecision } from './logic/decision.ts'
import { activeFilterCount, DEFAULT_FILTERS, emptyReason, filterPictures, matchesFilters, pictureFolders, progress } from './logic/picture-filter.ts'
import { defaultSortOrder, sortPictures } from './logic/picture-order.ts'
import { findSeries, seriesCandidates, seriesSizes as sizesOf } from './logic/series.ts'
import { pairingSettings } from './logic/settings.ts'
import { inSharedFolder } from './logic/sidecar-sync.ts'
import { parseTileSize } from './logic/tile-size.ts'
import { withoutFiles } from './logic/trash-report.ts'
import { NO_HISTORY, pickRestEntry, recordStep, redoStep, undoEntry, undoStep } from './logic/undo.ts'

/** How the cull takes decisions over from the sidecars and writes them through (XMP-003). */
export interface CullSidecars {
	readonly takeOver: (pictures: readonly Picture<ListingEntry>[], storedIds: ReadonlySet<number>) => Promise<{ picture: Picture<ListingEntry>, decision: Decision }[]>
	readonly write: (pictures: readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision) => Promise<{ written: number, failed: SidecarFailure[] }>
}

/** The browser storage key of the thumbnail size. */
const TILE_SIZE_KEY = 'honeycomb.tileSize'

/** The server calls the cull makes. */
export interface CullApi {
	readonly warmPreviews: (fileIds: readonly number[]) => Promise<void>
	readonly lookupDecisions: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	readonly saveDecisions: (decisions: readonly StoredDecision[]) => Promise<void>
}

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
	const filters = shallowRef<Filters>(DEFAULT_FILTERS)
	const sortOrder = ref<SortOrder>('file-name')
	const filtersOpen = ref(false)
	const pickerOpen = ref(true)
	const groupByFolder = ref(false)
	const tileSize = ref(parseTileSize(readStored(storage, TILE_SIZE_KEY)))
	const saveFailed = ref(false)
	const sharedFolders = shallowRef<ReadonlySet<string>>(new Set())
	let history: UndoHistory = NO_HISTORY
	let opening = 0
	let filtersOff: Filters | null = null
	const folderPaths = computed(() => pictureFolders(pictures.value, compareNames))
	const folders = computed(() => folderPaths.value.length)
	const grouped = computed(() => groupByFolder.value && folders.value > 1)
	const decisionOf = (picture: Picture<ListingEntry>) => pictureDecision(picture, decisions.value)
	const passes = (picture: Picture<ListingEntry>) => matchesFilters(picture, decisionOf(picture), filters.value)
	const view = computed(() => sortPictures(filterPictures(pictures.value, decisionOf, filters.value), sortOrder.value, compareNames, grouped.value))
	const cullProgress = computed(() => progress(pictures.value, decisionOf))
	const shownProgress = computed(() => progress(view.value, decisionOf))
	const activeFilters = computed(() => activeFilterCount(filters.value))
	const empty = computed(() => emptyReason(filters.value, pictures.value.length))
	const candidates = computed(() => seriesCandidates(pictures.value))
	const series = computed(() => findSeries(candidates.value, decisionOf))
	const seriesSizes = computed(() => sizesOf(series.value))
	const sharedPictures = computed(() => pictures.value.filter((picture) => inSharedFolder(picture, sharedFolders.value)))

	/** Shows the pictures of the confirmed folders with fresh filters, then their stored decisions. */
	function open(set: FolderSet, listed: readonly ListingEntry[], shared: readonly string[]) {
		folderSet.value = set
		sharedFolders.value = new Set(shared)
		opening++
		entries.value = listed
		paired.value = prepareCull(listed, pairing.value).pictures
		decisions.value = new Map()
		history = NO_HISTORY
		filtersOff = null
		saveFailed.value = false
		filters.value = DEFAULT_FILTERS
		sortOrder.value = defaultSortOrder(folders.value)
		pickerOpen.value = false
		api.warmPreviews(warmFileIds(view.value)).catch((error: unknown) => logger.error('Could not warm the previews', { error }))
		loadDecisions(paired.value)
	}

	watch(pairing, () => {
		paired.value = prepareCull(entries.value, pairing.value).pictures
		loadDecisions(paired.value)
	})

	/** Reads the decisions of every member, then takes the sidecars' over; they apply only while the same pictures are open, under changes made meanwhile. */
	function loadDecisions(opened: readonly Picture<ListingEntry>[]) {
		api.lookupDecisions(opened.flatMap(memberIds)).then(async (rows) => {
			if (paired.value !== opened) {
				return
			}
			decisions.value = new Map([...decisionsByFileId(rows), ...decisions.value])
			await takeOver(opened, new Set(rows.map((row) => row.fileId)))
		}).catch((error: unknown) => logger.error('Could not read the decisions; every photo shows as undecided', { error }))
	}

	/** Shows and stores the sidecars' decision of the pictures still undecided; no undo step and no write back (XMP-003.1–.5). */
	async function takeOver(opened: readonly Picture<ListingEntry>[], storedIds: ReadonlySet<number>) {
		const taken = await sidecars.takeOver(opened, storedIds)
		const rows = paired.value === opened
			? taken.filter(({ picture }) => !memberIds(picture).some((fileId) => decisions.value.has(fileId)))
					.flatMap(({ picture, decision }) => memberIds(picture).map((fileId) => ({ fileId, ...decision })))
			: []
		if (rows.length > 0) {
			decisions.value = withRows(decisions.value, rows)
			api.saveDecisions(rows).catch((error: unknown) => logger.error('Could not save the decisions taken over from the sidecars', { error }))
		}
	}

	/** The pictures with their decisions, as the decision rules take them. */
	const decided = (chosen: readonly Picture<ListingEntry>[]) => chosen.map((picture) => ({ picture, decision: decisionOf(picture) }))

	/** What the pictures share, for the action bar. */
	const common = (chosen: readonly Picture<ListingEntry>[]) => commonDecision(decided(chosen))

	/** Decides the pictures, keeps the step for undo and returns it, or null when nothing changes. */
	function decide(intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]): UndoEntry | null {
		return record(undoEntry(decided(chosen), resolveChange(intent, decided(chosen))))
	}

	/** Picks one picture and rejects the rest as one undo step (SERIES-001.9), or null when nothing changes. */
	function pickRest(picked: Picture<ListingEntry>, rest: readonly Picture<ListingEntry>[]): UndoEntry | null {
		return record(pickRestEntry(decided([picked])[0]!, decided(rest)))
	}

	/** Records a step in the history and stores its result. */
	function record(entry: UndoEntry | null): UndoEntry | null {
		if (entry !== null) {
			history = recordStep(history, entry)
			store(entry.after)
		}
		return entry
	}

	/** Puts back what the latest step replaced and returns it, or null when there is none. */
	function undo(): UndoEntry | null {
		const step = undoStep(history)
		if (step === null) {
			return null
		}
		history = step.history
		store(step.entry.before)
		return step.entry
	}

	/** Writes again what the latest undo took back and returns it, or null when there is none. */
	function redo(): UndoEntry | null {
		const step = redoStep(history)
		if (step === null) {
			return null
		}
		history = step.history
		store(step.entry.after)
		return step.entry
	}

	/** Shows the rows at once and stores them; a failed save puts back what they replaced. */
	function store(rows: readonly StoredDecision[]) {
		const before = decisions.value
		const opened = opening
		decisions.value = withRows(before, rows)
		saveFailed.value = false
		api.saveDecisions(rows).then(() => writeThrough(rows, opened), (error: unknown) => {
			logger.error('Could not save the decisions', { error })
			if (opening === opened) {
				decisions.value = revertRows(decisions.value, rows, before)
				saveFailed.value = true
			}
		})
	}

	/** Writes the decisions of the rows' pictures outside shared folders to their sidecars (XMP-003.6, .11). */
	function writeThrough(rows: readonly StoredDecision[], opened: number) {
		const fileIds = new Set(rows.map((row) => row.fileId))
		const written = paired.value.filter((picture) => memberIds(picture).some((fileId) => fileIds.has(fileId)) && !inSharedFolder(picture, sharedFolders.value))
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

	/** Replaces the flag filter and keeps the other groups. */
	function setFlags(flags: Filters['flags']) {
		filters.value = { ...filters.value, flags }
	}

	/** Turns the filters off; the next press turns them back on unless others were set meanwhile. */
	function toggleFiltersOff() {
		if (filtersOff !== null && activeFilters.value === 0) {
			filters.value = filtersOff
			filtersOff = null
		} else {
			filtersOff = filters.value
			filters.value = DEFAULT_FILTERS
		}
	}

	/** Sets the thumbnail size and keeps it for the next visit. */
	function setTileSize(size: number) {
		tileSize.value = size
		writeStored(storage, TILE_SIZE_KEY, String(size))
	}

	return {
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
		activeFilters,
		empty,
		sortOrder,
		filtersOpen,
		pickerOpen,
		groupByFolder,
		tileSize,
		saveFailed,
		sharedPictures,
		sharedDecided,
		decisionOf,
		passes,
		common,
		series,
		seriesSizes,
		decide,
		pickRest,
		undo,
		redo,
		open,
		removeFiles,
		restoreFiles,
		setFlags,
		toggleFiltersOff,
		setTileSize,
	}
}

/** The file ids of the picture's members, RAW first. */
function memberIds(picture: Picture<ListingEntry>): number[] {
	return [picture.raw, picture.rendered].filter((member) => member !== null).map((member) => member.fileId)
}
