// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { COUNTS, cullOn, page } from './immich-cull-fixtures.ts'

const OCTOBER = { kind: 'month', year: 2026, month: 10 } as const
const OCTOBER_RANGE = { takenAfter: Date.UTC(2026, 9, 1) / 1000, takenBefore: Date.UTC(2026, 10, 1) / 1000 }

describe('useImmichCull with the filter bar', () => {
	// spec: IMMICH-002.32
	it('opens on the connection\'s stored filters from the first request', () => {
		const { cull, assets, counts } = cullOn()

		cull.open('andy-phone', { time: { year: 2026, month: 10 }, kinds: ['video'] })

		expect(assets[0]!.request.filters).toMatchObject({ ...OCTOBER_RANGE, kinds: ['video'] })
		expect(counts[0]!.request.filters.kinds).toEqual(['video'])
		expect(cull.filters.value.time).toEqual(OCTOBER)
	})

	// spec: IMMICH-002.32
	it('opens on the defaults without stored filters', () => {
		const { cull, assets } = cullOn()

		cull.open('andy-phone')

		expect(assets[0]!.request.filters).toMatchObject({ takenAfter: Date.UTC(2026, 10, 1) / 1000, kinds: [], devices: [] })
		expect(cull.filtersChanged.value).toBe(false)
	})

	// spec: IMMICH-002.30, IMMICH-002.32
	it('starts over under a new filter and keeps it for the connection', () => {
		const { cull, assets, saveFilters } = cullOn()
		cull.open('andy-phone')

		cull.setFilters({ ...cull.filters.value, time: OCTOBER, devices: new Set([null]) })

		expect(assets[1]!.request).toMatchObject({ cursor: null, filters: { ...OCTOBER_RANGE, devices: [null] } })
		expect(saveFilters).toHaveBeenCalledWith('andy-phone', expect.objectContaining({ time: { year: 2026, month: 10 }, devices: [null] }))
		expect(cull.filtersChanged.value).toBe(true)
	})

	// spec: IMMICH-002.31
	it('clears every filter back to its default, starts over and keeps the defaults', () => {
		const { cull, assets, saveFilters } = cullOn()
		cull.open('andy-phone', { time: 'all', kinds: ['video'], flags: ['rejected'] })
		expect(cull.filtersChanged.value).toBe(true)

		cull.clearFilters()

		expect(cull.filtersChanged.value).toBe(false)
		expect(assets[1]!.request.filters).toMatchObject({ takenAfter: Date.UTC(2026, 10, 1) / 1000, kinds: [], flags: ['picked', 'unflagged'] })
		expect(saveFilters).toHaveBeenLastCalledWith('andy-phone', expect.objectContaining({ time: 'current', kinds: [] }))
	})

	// spec: IMMICH-002.30, IMMICH-002.33
	it('offers the counted options, and keeps the last answer\'s devices without numbers while counting again', async () => {
		const { cull, assets, counts } = cullOn()
		cull.open('andy-phone')
		expect(cull.choices.value.devices).toEqual([])
		assets[0]!.answer(page(['a1']))
		counts[0]!.answer({ ...COUNTS, devices: [{ model: 'Pixel 9 Pro', count: 600 }, { model: null, count: 400 }] })
		await flushPromises()
		expect(cull.choices.value.devices).toEqual([{ value: 'Pixel 9 Pro', count: 600 }, { value: null, count: 400 }])
		expect(cull.choices.value.kinds[0]).toEqual({ value: 'photo', count: 1000 })

		cull.setFilters({ ...cull.filters.value, kinds: new Set(['video']) })

		expect(cull.choices.value.devices).toEqual([{ value: 'Pixel 9 Pro', count: null }, { value: null, count: null }])
		expect(cull.choices.value.times.every(({ count }) => count === null)).toBe(true)
	})

	// spec: IMMICH-002.32
	it('forgets the last answer\'s devices when another connection opens', async () => {
		const { cull, assets, counts } = cullOn()
		cull.open('andy-phone')
		assets[0]!.answer(page(['a1']))
		counts[0]!.answer({ ...COUNTS, devices: [{ model: 'Pixel 9 Pro', count: 600 }] })
		await flushPromises()

		cull.open('andy-tablet')

		expect(cull.choices.value.devices).toEqual([])
	})
})
