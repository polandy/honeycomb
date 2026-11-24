// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionMove } from './cull-core.ts'
import type { ImmichCullApi, ImmichShape } from './immich-picture-source.ts'
import type { Decision } from './logic/decision.ts'
import type { DecisionRow, ImmichEntry, ImmichSourceEntry } from './logic/immich-asset.ts'
import type { CountsRequest, ImmichCounts } from './logic/immich-counts.ts'
import type { StoredImmichFilters } from './logic/immich-filter-storage.ts'
import type { Calendar, ImmichFilters, RequestFilters, TimeOption } from './logic/immich-filters.ts'
import type { AssetsRequest } from './logic/immich-paging.ts'
import type { Picture } from './logic/pairing.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { PictureSource } from './logic/picture-source.ts'
import type { useToast } from './toast.ts'

import { computed, readonly, ref, shallowRef } from 'vue'
import { useCullCore } from './cull-core.ts'
import { fireAndLog } from './fire-and-log.ts'
import { immichPictureSource } from './immich-picture-source.ts'
import { logger } from './logger.ts'
import { assetDecision, assetPicture, decisionRow } from './logic/immich-asset.ts'
import { countsAfterDecision } from './logic/immich-counts.ts'
import { filterChoices, isDefaultImmichFilters } from './logic/immich-filter-choices.ts'
import { readImmichFilters, storedImmichFilters } from './logic/immich-filter-storage.ts'
import { countsRequest, defaultImmichFilters, requestFilters, timeOptions } from './logic/immich-filters.ts'
import { EMPTY_LIST, pageArrived, pageAsked, pageFailed, shownList, wantsNext } from './logic/immich-paging.ts'

export type { AssetsRequest, CountsRequest, ImmichCullApi }
export { PAGE_SIZE } from './immich-picture-source.ts'

/** What the Immich cull is given: the server, the clock, the calendar, the toast and where the filters are kept. */
export interface ImmichCullContext {
	readonly api: ImmichCullApi
	readonly now: () => number
	readonly calendar: Calendar
	/** The day group's header of a time in Unix seconds. */
	readonly dayLabel: (seconds: number) => string
	readonly toast: Pick<ReturnType<typeof useToast>, 'show' | 'showError'>
	/** Keeps a connection's filters for its next open (IMMICH-002.32). */
	readonly saveFilters: (connectionId: string, stored: StoredImmichFilters) => void
}

/** The cull of an Immich connection: the paged listing, its counts and the decisions (IMMICH-002, IMMICH-003). */
export function useImmichCull(context: ImmichCullContext) {
	const { api, now, calendar } = context
	const connectionId = ref<string | null>(null)
	const filters = shallowRef<ImmichFilters>(defaultImmichFilters(now(), calendar))
	// The loaded pages; `list` shows them without the pictures the decisions last settled let the filters refuse.
	const loaded = shallowRef(EMPTY_LIST)
	const counts = shallowRef<ImmichCounts | null>(null)
	const settled = shallowRef<ReadonlyMap<string, Decision>>(new Map())
	// The time options the counts' periods line up with, and the device models of the last counts answer.
	const periodOptions = shallowRef<readonly TimeOption[]>(timeOptions(now(), calendar))
	const known = shallowRef<readonly (string | null)[]>([])
	let held = false
	// Grid ids and pictures stay the same for an asset while the connection is open, so tiles keep their place.
	const ids = new Map<string, PictureId>()
	const entries = new Map<PictureId, ImmichEntry>()
	const shown = new Map<PictureId, Picture<ImmichSourceEntry>>()
	let request: RequestFilters = requestFilters(filters.value, now(), calendar)
	let generation = 0
	let source: PictureSource<ImmichShape> | null = null
	const core = useCullCore<DecisionRow>({
		storedOf: (id) => assetDecision(entries.get(id)!),
		rowOf: (id, decision) => decisionRow(entries.get(id)!, decision),
		keyOf: (row) => row.assetId,
		shown: moveCounts,
		toast: context.toast,
	})

	const list = computed(() => shownList(loaded.value, settled.value, filters.value))
	const pictures = computed(() => list.value.entries.map(pictureOf))
	const filtersChanged = computed(() => !isDefaultImmichFilters(filters.value, now(), calendar))
	const choices = computed(() => filterChoices(filters.value, counts.value, periodOptions.value, known.value, now(), calendar))

	/** The picture of an entry, made once per asset. */
	function pictureOf(entry: ImmichEntry): Picture<ImmichSourceEntry> {
		const id = ids.get(entry.assetId) ?? ids.size + 1
		ids.set(entry.assetId, id)
		const picture = shown.get(id) ?? assetPicture(entry, id, context.dayLabel(entry.takenAt))
		shown.set(id, picture)
		entries.set(id, entry)
		return picture
	}

	/** Opens the connection on its stored filters, the defaults for what is not stored (IMMICH-002.32). */
	function open(id: string, stored: unknown = null) {
		connectionId.value = id
		source = immichPictureSource(api, id)
		core.open(source)
		ids.clear()
		entries.clear()
		shown.clear()
		held = false
		known.value = []
		filters.value = readImmichFilters(stored, now(), calendar)
		restart()
	}

	/** Shows the listing under new filters from its start and keeps them for the connection (IMMICH-002.11, IMMICH-002.32). */
	function setFilters(next: ImmichFilters) {
		filters.value = next
		context.saveFilters(connectionId.value!, storedImmichFilters(next, now(), calendar))
		restart()
	}

	/** Puts every filter back to its default (IMMICH-002.31). */
	function clearFilters() {
		setFilters(defaultImmichFilters(now(), calendar))
	}

	/** Drops what was loaded and asks the counts and the first page again; older answers are ignored. */
	function restart() {
		generation += 1
		request = requestFilters(filters.value, now(), calendar)
		periodOptions.value = timeOptions(now(), calendar)
		loaded.value = EMPTY_LIST
		counts.value = null
		core.clear()
		settled.value = new Map()
		fireAndLog(askCounts(), 'Could not ask the Immich counts')
		fireAndLog(askNext(), 'Could not ask the next Immich page')
	}

	/** Asks the counts of the filters and the time options (IMMICH-002.13). */
	async function askCounts() {
		const asked = generation
		try {
			const answer = await source!.counts(countsRequest(filters.value, periodOptions.value, now(), calendar))
			if (asked === generation) {
				counts.value = answer
				known.value = answer.devices.map(({ model }) => model)
			}
		} catch (error) {
			logger.error('Could not count the Immich uploads', { error })
		}
	}

	/** Asks the page after the loaded ones, and again at once while one adds nothing (IMMICH-002.8). */
	async function askNext() {
		const asked = generation
		const before = list.value.entries.length
		const cursor = loaded.value.started ? loaded.value.nextCursor : null
		loaded.value = pageAsked(loaded.value, 'next')
		try {
			const page = await source!.list(request, cursor)
			if (asked !== generation) {
				return
			}
			loaded.value = pageArrived(loaded.value, 'next', page)
			if (list.value.entries.length === before && list.value.nextCursor !== null) {
				fireAndLog(askNext(), 'Could not ask the next Immich page')
			}
		} catch (error) {
			if (asked === generation) {
				loaded.value = pageFailed(loaded.value, 'next')
				logger.error('Could not load an Immich page', { error })
			}
		}
	}

	/** Asks the next page when the last shown entry is within `ahead` of the last loaded one (IMMICH-002.6, IMMICH-002.9). */
	function loadNext(lastShown: number, ahead: number) {
		if (wantsNext(list.value, lastShown, ahead)) {
			fireAndLog(askNext(), 'Could not ask the next Immich page')
		}
	}

	/** Asks the failed page again at its cursor (IMMICH-002.19). */
	function retry() {
		if (list.value.next === 'failed') {
			fireAndLog(askNext(), 'Could not ask the next Immich page')
		}
	}

	/** Keeps the shown pictures while held, as the loupe does; on release hides those the decisions let the filters refuse (IMMICH-002.28). */
	function hold(on: boolean) {
		held = on
		settle()
	}

	/** Lets the filters see the decisions unless held, and asks the next page when none is left to show. */
	function settle() {
		if (held) {
			return
		}
		settled.value = new Map([...core.decided.value].map(([id, decision]) => [entries.get(id)!.assetId, decision]))
		if (list.value.entries.length === 0) {
			loadNext(-1, 1)
		}
	}

	/** The URL of a picture's image: the thumbnail for the grid's tiers, the preview above (IMMICH-002.16). */
	function imageUrl(fileId: PictureId, size: number): string {
		return source!.imageUrl(entries.get(fileId)!, size)
	}

	/** Moves the counts along the shown decisions and lets the filters see them (IMMICH-002.15). */
	function moveCounts(moves: readonly DecisionMove[]) {
		const start = counts.value
		counts.value = start && moves.reduce((current, [before, after]) => countsAfterDecision(current, before, after, filters.value), start)
		settle()
	}

	return { connectionId: readonly(connectionId), filters, filtersChanged, choices, list, counts, pictures, open, setFilters, clearFilters, loadNext, retry, hold, decisionOf: core.decisionOf, imageUrl, decide: core.decide, undo: core.undo, redo: core.redo }
}
