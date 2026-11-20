import type { DecisionIntent } from './logic/decision-change.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './logic/decision.ts'
import type { DecisionRow, ImmichEntry, ImmichImageSize, ImmichSourceEntry } from './logic/immich-asset.ts'
import type { CountsRequest, ImmichCounts } from './logic/immich-counts.ts'
import type { Calendar, ImmichFilters, RequestFilters } from './logic/immich-filters.ts'
import type { AssetsRequest, Page } from './logic/immich-paging.ts'
import type { SourceEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { useToast } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, readonly, ref, shallowRef } from 'vue'
import { changeText } from './decision-text.ts'
import { logger } from './logger.ts'
import { resolveChange } from './logic/decision-change.ts'
import { GRID_TIERS, imageMember } from './logic/image-tiers.ts'
import { assetDecision, assetPicture, decisionRow } from './logic/immich-asset.ts'
import { countsAfterDecision } from './logic/immich-counts.ts'
import { countsRequest, defaultImmichFilters, requestFilters, timeOptions } from './logic/immich-filters.ts'
import { EMPTY_LIST, pageArrived, pageAsked, pageFailed, wantsNext } from './logic/immich-paging.ts'

export type { AssetsRequest, CountsRequest, ImmichImageSize }

/** How many entries one page asks; the server allows 1 to 250 (ADR 0044). */
export const PAGE_SIZE = 100

/** What the Immich cull asks of the server (ADR 0044). */
export interface ImmichCullApi {
	assets: (connectionId: string, request: AssetsRequest) => Promise<Page>
	counts: (connectionId: string, request: CountsRequest) => Promise<ImmichCounts>
	saveDecisions: (connectionId: string, rows: readonly DecisionRow[]) => Promise<string[]>
	imageUrl: (connectionId: string, assetId: string, size: ImmichImageSize, version: string) => string
}

/** What the Immich cull is given: the server, the clock, the calendar and the toast. */
export interface ImmichCullContext {
	readonly api: ImmichCullApi
	readonly now: () => number
	readonly calendar: Calendar
	/** The day group's header of a time in Unix seconds. */
	readonly dayLabel: (seconds: number) => string
	readonly toast: Pick<ReturnType<typeof useToast>, 'show' | 'showError'>
}

/** One asset's decision before and after a change. */
interface Change {
	readonly id: PictureId
	readonly before: Decision
	readonly after: Decision
}

/** The cull of an Immich connection: the paged listing, its counts and the decisions (IMMICH-002, IMMICH-003). */
export function useImmichCull(context: ImmichCullContext) {
	const { api, now, calendar } = context
	const connectionId = ref<string | null>(null)
	const filters = shallowRef<ImmichFilters>(defaultImmichFilters(now(), calendar))
	const list = shallowRef(EMPTY_LIST)
	const counts = shallowRef<ImmichCounts | null>(null)
	const decided = shallowRef<ReadonlyMap<PictureId, Decision>>(new Map())
	// Grid ids and pictures stay the same for an asset while the connection is open, so tiles keep their place.
	const ids = new Map<string, PictureId>()
	const entries = new Map<PictureId, ImmichEntry>()
	const shown = new Map<PictureId, Picture<ImmichSourceEntry>>()
	let request: RequestFilters = requestFilters(filters.value, now(), calendar)
	let generation = 0

	const pictures = computed(() => list.value.entries.map(pictureOf))

	/** The picture of an entry, made once per asset. */
	function pictureOf(entry: ImmichEntry): Picture<ImmichSourceEntry> {
		const id = ids.get(entry.assetId) ?? ids.size + 1
		ids.set(entry.assetId, id)
		const picture = shown.get(id) ?? assetPicture(entry, id, context.dayLabel(entry.takenAt))
		shown.set(id, picture)
		entries.set(id, entry)
		return picture
	}

	/** Opens the connection on its default filters. */
	function open(id: string) {
		connectionId.value = id
		ids.clear()
		entries.clear()
		shown.clear()
		filters.value = defaultImmichFilters(now(), calendar)
		restart()
	}

	/** Shows the listing under new filters from its start (IMMICH-002.11). */
	function setFilters(next: ImmichFilters) {
		filters.value = next
		restart()
	}

	/** Drops what was loaded and asks the counts and the first page again; older answers are ignored. */
	function restart() {
		generation += 1
		request = requestFilters(filters.value, now(), calendar)
		list.value = EMPTY_LIST
		counts.value = null
		decided.value = new Map()
		void askCounts()
		void askNext()
	}

	/** Asks the counts of the filters and the time options (IMMICH-002.13). */
	async function askCounts() {
		const asked = generation
		try {
			const answer = await api.counts(connectionId.value!, countsRequest(filters.value, timeOptions(now(), calendar), now(), calendar))
			if (asked === generation) {
				counts.value = answer
			}
		} catch (error) {
			logger.error('Could not count the Immich uploads', { error })
		}
	}

	/** Asks the page after the loaded ones, and again at once while one adds nothing (IMMICH-002.8). */
	async function askNext() {
		const asked = generation
		const before = list.value.entries.length
		const cursor = list.value.started ? list.value.nextCursor : null
		list.value = pageAsked(list.value, 'next')
		try {
			const page = await api.assets(connectionId.value!, { filters: request, cursor, size: PAGE_SIZE })
			if (asked !== generation) {
				return
			}
			list.value = pageArrived(list.value, 'next', page)
			if (list.value.entries.length === before && list.value.nextCursor !== null) {
				void askNext()
			}
		} catch (error) {
			if (asked === generation) {
				list.value = pageFailed(list.value, 'next')
				logger.error('Could not load an Immich page', { error })
			}
		}
	}

	/** Asks the next page when the last shown entry is within `ahead` of the last loaded one (IMMICH-002.6, IMMICH-002.9). */
	function loadNext(lastShown: number, ahead: number) {
		if (wantsNext(list.value, lastShown, ahead)) {
			void askNext()
		}
	}

	/** Asks the failed page again at its cursor (IMMICH-002.19). */
	function retry() {
		if (list.value.next === 'failed') {
			void askNext()
		}
	}

	/** The decision the picture carries now. */
	function decisionOf(picture: Picture<SourceEntry>): Decision {
		const id = imageMember(picture).fileId
		return decided.value.get(id) ?? assetDecision(entries.get(id)!)
	}

	/** The URL of a picture's image: the thumbnail for the grid's tiers, the preview above (IMMICH-002.16). */
	function imageUrl(fileId: PictureId, size: number): string {
		const entry = entries.get(fileId)!
		const thumbnail = size > 0 && size <= GRID_TIERS.at(-1)!
		return api.imageUrl(connectionId.value!, entry.assetId, thumbnail ? 'thumbnail' : 'preview', entry.updatedAt)
	}

	/** Shows the decisions at once, counts them and saves them; puts them back if the save fails. */
	async function apply(changes: readonly Change[]): Promise<boolean> {
		const asked = generation
		show(changes.map(({ id, after }) => [id, after]), changes.map(({ before, after }) => [before, after]))
		try {
			await api.saveDecisions(connectionId.value!, changes.map(({ id, after }) => decisionRow(entries.get(id)!, after)))
			return true
		} catch (error) {
			logger.error('Could not save the Immich decisions', { error })
			if (asked === generation) {
				show(changes.map(({ id, before }) => [id, before]), changes.map(({ before, after }) => [after, before]))
				context.toast.showError(t('honeycomb', 'Could not save the decision; it is back as it was'))
			}
			return false
		}
	}

	/** Puts the decisions in place and moves the counts along (IMMICH-002.15). */
	function show(next: readonly [PictureId, Decision][], moves: readonly [Decision, Decision][]) {
		decided.value = new Map([...decided.value, ...next])
		const start = counts.value
		counts.value = start && moves.reduce((current, [before, after]) => countsAfterDecision(current, before, after, filters.value), start)
	}

	/** Decides on the pictures and toasts the change with *Undo*, which saves the earlier decisions (IMMICH-003.4). */
	async function decide(intent: DecisionIntent, targets: readonly Picture<SourceEntry>[]) {
		const current = targets.map((picture) => ({ picture, decision: decisionOf(picture) }))
		const change = resolveChange(intent, current)
		const changes = current.map(({ picture, decision }) => ({ id: imageMember(picture).fileId, before: decision, after: { ...decision, ...change } }))
		if (await apply(changes)) {
			const undo = () => void apply(changes.map(({ id, before, after }) => ({ id, before: after, after: before })))
			context.toast.show(changeText({ kind: 'decision', names: targets.map(({ baseName }) => baseName), change }), { label: t('honeycomb', 'Undo'), run: undo })
		}
	}

	return { connectionId: readonly(connectionId), filters, list, counts, pictures, open, setFilters, loadNext, retry, decisionOf, imageUrl, decide }
}
