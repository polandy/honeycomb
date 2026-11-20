// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AssetsRequest, CountsRequest, ImmichCullApi } from '../../src/immich-cull.ts'
import type { DecisionRow, ImmichEntry } from '../../src/logic/immich-asset.ts'
import type { ImmichCounts } from '../../src/logic/immich-counts.ts'
import type { Page } from '../../src/logic/immich-paging.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PAGE_SIZE, useImmichCull } from '../../src/immich-cull.ts'
import { imageMember } from '../../src/logic/image-tiers.ts'
import { logger } from '../../src/logger.ts'
import { immichEntry, NOW, UTC_CALENDAR } from './logic/immich-fixtures.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const COUNTS: ImmichCounts = { total: 1000, undecided: 1000, decided: 0, matching: 1000, flags: { picked: 0, rejected: 0, unflagged: 1000 }, ratings: {}, colourLabels: {}, devices: [], kinds: { photo: 1000, live: 0, video: 0 }, periods: [] }

/** A page of entries named by their ids. */
const page = (ids: readonly string[], nextCursor: string | null = null): Page => ({ entries: ids.map((id) => immichEntry(id)), nextCursor, previousCursor: null })

/** The Immich cull over a fake server; each request waits until the test answers it. */
function cullOn() {
	const assets: { request: AssetsRequest, answer: (page: Page) => void, fail: (error: Error) => void }[] = []
	const counts: { request: CountsRequest, answer: (counts: ImmichCounts) => void }[] = []
	const saves: { rows: readonly DecisionRow[], answer: () => void, fail: (error: Error) => void }[] = []
	const api: ImmichCullApi = {
		assets: (_id, request) => new Promise((answer, fail) => assets.push({ request, answer, fail })),
		counts: (_id, request) => new Promise((answer) => counts.push({ request, answer })),
		saveDecisions: (_id, rows) => new Promise((answer, fail) => saves.push({ rows, answer: () => answer(rows.map((row) => row.assetId)), fail })),
		imageUrl: (id, assetId, size, version) => `${id}/${assetId}/${size}?v=${version}`,
	}
	const toast = { show: vi.fn(), showError: vi.fn() }
	const cull = useImmichCull({ api, now: () => NOW, calendar: UTC_CALENDAR, dayLabel: (seconds) => `day ${seconds}`, toast })
	return { cull, assets, counts, saves, toast }
}

/** The asset ids of the cull's pictures. */
const assetIds = (cull: ReturnType<typeof useImmichCull>) => cull.pictures.value.map((picture) => (imageMember(picture) as unknown as { asset: ImmichEntry }).asset.assetId)

describe('useImmichCull', () => {
	// spec: IMMICH-002.6, IMMICH-002.13
	it('asks the counts and the first page on open', async () => {
		const { cull, assets, counts } = cullOn()
		cull.open('andy-phone')

		expect(assets).toHaveLength(1)
		expect(assets[0]!.request).toMatchObject({ cursor: null, size: PAGE_SIZE })
		expect(counts).toHaveLength(1)
		assets[0]!.answer(page(['a1', 'a2'], 'c2'))
		counts[0]!.answer(COUNTS)
		await flushPromises()

		expect(assetIds(cull)).toEqual(['a1', 'a2'])
		expect(cull.pictures.value[0]!.folder).toBe(`day ${NOW}`)
		expect(cull.counts.value).toEqual(COUNTS)
	})

	// spec: IMMICH-002.6
	it('asks the next page only when the last shown entry comes near the end, and once', async () => {
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1', 'a2', 'a3'], 'c2'))
		await flushPromises()

		cull.loadNext(0, 1)
		expect(assets).toHaveLength(1)
		cull.loadNext(2, 1)
		cull.loadNext(2, 1)
		expect(assets).toHaveLength(2)
		expect(assets[1]!.request.cursor).toBe('c2')
		assets[1]!.answer(page(['a4']))
		await flushPromises()

		expect(assetIds(cull)).toEqual(['a1', 'a2', 'a3', 'a4'])
		cull.loadNext(3, 1)
		expect(assets).toHaveLength(2)
	})

	// spec: IMMICH-002.8
	it('asks again at once when a page adds nothing while the cursor goes on', async () => {
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page([], 'c2'))
		await flushPromises()

		expect(assets).toHaveLength(2)
		expect(assets[1]!.request.cursor).toBe('c2')
	})

	// spec: IMMICH-002.19
	it('keeps the loaded pages when one fails and asks the same cursor on Try again', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1'], 'c2'))
		await flushPromises()
		cull.loadNext(0, 1)
		assets[1]!.fail(new Error('Immich is down'))
		await flushPromises()

		expect(cull.list.value.next).toBe('failed')
		expect(assetIds(cull)).toEqual(['a1'])
		expect(logger.error).toHaveBeenCalled()
		cull.loadNext(0, 1)
		expect(assets).toHaveLength(2)
		cull.retry()
		expect(assets[2]!.request.cursor).toBe('c2')
	})

	// spec: IMMICH-002.11
	it('starts over on new filters and drops the answers to the old ones', async () => {
		const { cull, assets, counts } = cullOn()
		cull.open('andy-phone')
		cull.setFilters({ ...cull.filters.value, kinds: new Set(['video']) })

		expect(assets).toHaveLength(2)
		expect(assets[1]!.request.filters.kinds).toEqual(['video'])
		assets[0]!.answer(page(['old']))
		counts[0]!.answer(COUNTS)
		assets[1]!.answer(page(['v1']))
		await flushPromises()

		expect(assetIds(cull)).toEqual(['v1'])
		expect(cull.counts.value).toBeNull()
	})

	// spec: IMMICH-002.16
	it('names each picture\'s image by its asset, the thumbnail for the grid and the preview above', async () => {
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1']))
		await flushPromises()
		const id = imageMember(cull.pictures.value[0]!).fileId

		expect(cull.imageUrl(id, 256, 0)).toBe('andy-phone/a1/thumbnail?v=2026-11-20T12:00:00.000Z')
		expect(cull.imageUrl(id, 1024, 0)).toBe('andy-phone/a1/thumbnail?v=2026-11-20T12:00:00.000Z')
		expect(cull.imageUrl(id, 4096, 0)).toBe('andy-phone/a1/preview?v=2026-11-20T12:00:00.000Z')
		expect(cull.imageUrl(id, 0, 0)).toBe('andy-phone/a1/preview?v=2026-11-20T12:00:00.000Z')
	})

	// spec: IMMICH-002.15, IMMICH-003.1, IMMICH-003.7
	it('saves a decision, updates the counts at once and toasts it with Undo', async () => {
		const { cull, assets, counts, saves, toast } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1', 'a2']))
		counts[0]!.answer(COUNTS)
		await flushPromises()
		const [first] = cull.pictures.value

		void cull.decide({ kind: 'flag', flag: 'rejected' }, [first!])

		expect(cull.decisionOf(first!).flag).toBe('rejected')
		expect(cull.counts.value!.flags.rejected).toBe(1)
		expect(saves[0]!.rows).toEqual([expect.objectContaining({ assetId: 'a1', flag: 'rejected', rating: 0 })])
		saves[0]!.answer()
		await flushPromises()
		expect(toast.show).toHaveBeenCalledWith('Rejected a1', expect.objectContaining({ label: 'Undo' }))
	})

	// spec: IMMICH-003.4
	it('takes a decision back with Undo as a new save of the earlier one', async () => {
		const { cull, assets, counts, saves, toast } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1']))
		counts[0]!.answer(COUNTS)
		await flushPromises()
		const [first] = cull.pictures.value
		void cull.decide({ kind: 'flag', flag: 'rejected' }, [first!])
		saves[0]!.answer()
		await flushPromises()

		toast.show.mock.calls[0]![1].run()

		expect(saves[1]!.rows).toEqual([expect.objectContaining({ assetId: 'a1', flag: 'unflagged' })])
		expect(cull.decisionOf(first!).flag).toBe('unflagged')
		expect(cull.counts.value!.flags.rejected).toBe(0)
	})

	it('puts a decision back and says so when its save fails', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		const { cull, assets, counts, saves, toast } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1']))
		counts[0]!.answer(COUNTS)
		await flushPromises()
		const [first] = cull.pictures.value

		void cull.decide({ kind: 'rating', rating: 4 }, [first!])
		saves[0]!.fail(new Error('database down'))
		await flushPromises()

		expect(cull.decisionOf(first!).rating).toBe(0)
		expect(cull.counts.value).toEqual(COUNTS)
		expect(toast.showError).toHaveBeenCalled()
		expect(logger.error).toHaveBeenCalled()
	})
})
