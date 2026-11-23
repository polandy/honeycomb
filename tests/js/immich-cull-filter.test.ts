// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { assetIds, COUNTS, cullOn, page } from './immich-cull-fixtures.ts'

describe('useImmichCull under the flag filter', () => {
	// spec: IMMICH-002.28
	it('keeps a refused decision in the pictures while held, hides it on release without a request, and undo and redo bring it back and take it out', async () => {
		const { cull, assets, counts, saves } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1', 'a2', 'a3']))
		counts[0]!.answer(COUNTS)
		await flushPromises()
		const [, second] = cull.pictures.value

		cull.hold(true)
		cull.decide({ kind: 'flag', flag: 'rejected' }, [second!])
		saves[0]!.answer()
		await flushPromises()
		expect(assetIds(cull)).toEqual(['a1', 'a2', 'a3'])

		cull.hold(false)
		expect(assetIds(cull)).toEqual(['a1', 'a3'])
		expect(cull.counts.value!.flags.rejected).toBe(1)
		expect(assets).toHaveLength(1)
		expect(counts).toHaveLength(1)

		cull.undo()
		expect(assetIds(cull)).toEqual(['a1', 'a2', 'a3'])
		cull.redo()
		expect(assetIds(cull)).toEqual(['a1', 'a3'])
	})

	// spec: IMMICH-002.28
	it('hides a refused decision at once when no loupe holds it, and keeps an admitted one', async () => {
		const { cull, assets, counts } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1', 'a2']))
		counts[0]!.answer(COUNTS)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'picked' }, [cull.pictures.value[0]!])
		expect(assetIds(cull)).toEqual(['a1', 'a2'])
		cull.decide({ kind: 'flag', flag: 'rejected' }, [cull.pictures.value[0]!])
		expect(assetIds(cull)).toEqual(['a2'])
	})

	// spec: IMMICH-002.28, IMMICH-002.8
	it('asks the next page at once when the hidden pictures leave none', async () => {
		const { cull, assets, counts } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1'], 'c2'))
		counts[0]!.answer(COUNTS)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'rejected' }, [cull.pictures.value[0]!])

		expect(assetIds(cull)).toEqual([])
		expect(assets).toHaveLength(2)
		expect(assets[1]!.request.cursor).toBe('c2')
	})

	// spec: IMMICH-002.18
	it('shows the default filters again on reset and asks from the start', () => {
		const { cull, assets } = cullOn()
		cull.open('andy-phone')
		cull.setFilters({ ...cull.filters.value, kinds: new Set(['video']), flags: new Set(['rejected']) })

		cull.resetFilters()

		expect(cull.filters.value.kinds.size).toBe(0)
		expect(cull.filters.value.flags).toEqual(new Set(['picked', 'unflagged']))
		expect(assets).toHaveLength(3)
		expect(assets[2]!.request.filters.kinds).toEqual([])
		expect(assets[2]!.request.cursor).toBeNull()
	})
})
