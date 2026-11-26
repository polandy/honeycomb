// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Page } from '../../src/logic/immich-paging.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOUPE_AHEAD } from '../../src/logic/immich-paging.ts'
import { logger } from '../../src/shared/logger.ts'
import { assetIds, COUNTS, cullOn, page } from './immich-cull-fixtures.ts'
import { NOW } from './logic/immich-fixtures.ts'

/** A page with a cursor at each end. */
const between = (ids: readonly string[], nextCursor: string | null, previousCursor: string | null): Page => ({ ...page(ids, nextCursor), previousCursor })

const LAST_MONTH = Date.UTC(2026, 9, 15) / 1000
const FROM = { assetId: 'a6', takenAt: NOW - 60 }

afterEach(() => {
	vi.restoreAllMocks()
})

describe('useImmichCull from an asset', () => {
	// spec: IMMICH-003.14, IMMICH-002.34
	it('asks the first page from the asset under the open filters, and the next one by the cursor alone', async () => {
		const { cull, assets, counts, saveFilters } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1', 'a2'], 'c2'))
		await flushPromises()

		cull.resumeFrom(FROM)

		expect(assets).toHaveLength(2)
		expect(assets[1]!.request).toMatchObject({ cursor: null, from: FROM })
		expect(counts).toHaveLength(2)
		expect(saveFilters).not.toHaveBeenCalled()
		assets[1]!.answer(between(['a6', 'a7'], 'c8', 'p5'))
		await flushPromises()
		expect(assetIds(cull)).toEqual(['a6', 'a7'])

		cull.loadNext(1, 1)
		expect(assets[2]!.request.cursor).toBe('c8')
		expect(assets[2]!.request).not.toHaveProperty('from')
	})

	// spec: IMMICH-003.14
	it('puts the filters back with the whole time and keeps them when they would hide the asset', async () => {
		const { cull, assets, saveFilters } = cullOn()
		cull.open('andy-phone', { flags: ['picked'] })
		await flushPromises()

		cull.resumeFrom({ assetId: 'a6', takenAt: LAST_MONTH })

		expect(cull.filters.value.time).toEqual({ kind: 'all' })
		expect([...cull.filters.value.flags]).toEqual([])
		expect(saveFilters).toHaveBeenCalledWith('andy-phone', expect.objectContaining({ time: 'all', flags: [] }))
		expect(assets.at(-1)!.request).toMatchObject({ cursor: null, from: { assetId: 'a6', takenAt: LAST_MONTH }, filters: { takenAfter: null, takenBefore: null, flags: [] } })
	})

	// spec: IMMICH-002.34
	it('asks the newer page by the previous cursor when the first shown entry comes near the loaded start, and adds it before', async () => {
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		cull.resumeFrom(FROM)
		assets[1]!.answer(between(['a6', 'a7'], 'c8', 'p5'))
		await flushPromises()

		cull.loadPrevious(LOUPE_AHEAD)
		expect(assets).toHaveLength(2)
		cull.loadPrevious(0)
		cull.loadPrevious(0)
		expect(assets).toHaveLength(3)
		expect(assets[2]!.request.cursor).toBe('p5')
		expect(cull.list.value.previous).toBe('loading')
		assets[2]!.answer(between(['a4', 'a5', 'a6'], null, 'p3'))
		await flushPromises()

		expect(assetIds(cull)).toEqual(['a4', 'a5', 'a6', 'a7'])
		expect(cull.list.value.previousCursor).toBe('p3')
		expect(cull.list.value.nextCursor).toBe('c8')
	})

	// spec: IMMICH-002.34
	it('asks nothing before the start of a listing opened at its newest entry', async () => {
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1', 'a2'], 'c2'))
		await flushPromises()

		cull.loadPrevious(0)

		expect(assets).toHaveLength(1)
	})

	// spec: IMMICH-002.19
	it('keeps the entries when a newer page fails and asks the same cursor on Try again', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		cull.resumeFrom(FROM)
		assets[1]!.answer(between(['a6'], null, 'p5'))
		await flushPromises()
		cull.loadPrevious(0)
		assets[2]!.fail(new Error('Immich is down'))
		await flushPromises()

		expect(cull.list.value.previous).toBe('failed')
		expect(assetIds(cull)).toEqual(['a6'])
		expect(logger.error).toHaveBeenCalled()
		cull.loadPrevious(0)
		expect(assets).toHaveLength(3)
		cull.retry()
		expect(assets).toHaveLength(4)
		expect(assets[3]!.request.cursor).toBe('p5')
	})

	// spec: IMMICH-002.34
	it('drops a newer page that answers after the connection opened again', async () => {
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		cull.resumeFrom(FROM)
		assets[1]!.answer(between(['a6'], null, 'p5'))
		await flushPromises()
		cull.loadPrevious(0)
		cull.open('andy-phone')
		assets[2]!.answer(between(['a5'], null, null))
		assets[3]!.answer(page(['a1']))
		await flushPromises()

		expect(assetIds(cull)).toEqual(['a1'])
		expect(cull.list.value.previous).toBe('idle')
	})

	// spec: IMMICH-002.34
	it('asks the next newer page at once while one adds nothing', async () => {
		const { cull, assets, counts } = cullOn()
		cull.open('andy-phone')
		cull.resumeFrom(FROM)
		counts[1]!.answer(COUNTS)
		assets[1]!.answer(between(['a6'], null, 'p5'))
		await flushPromises()
		cull.loadPrevious(0)
		assets[2]!.answer(between(['a6'], null, 'p4'))
		await flushPromises()

		expect(assets).toHaveLength(4)
		expect(assets[3]!.request.cursor).toBe('p4')
	})
})
