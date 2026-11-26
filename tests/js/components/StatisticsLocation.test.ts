// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chip, fakeLocation, mountPage, periodLabel, ROOTS, ROWS, step } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

/** Mounts the page on an address with `hash` and waits for the counters. */
async function open(hash: string, answer: Parameters<typeof mountPage>[0] = { firstDay: '2025-03-14' }) {
	const location = fakeLocation(hash)
	const wrapper = mountPage(answer, ROOTS, vi.fn(async (_root: string) => ROWS), location)
	await flushPromises()
	return { wrapper, location }
}

describe('StatisticsPage address', () => {
	// spec: STATS-001.58
	it.each([
		['#month=2025-07', 'July 2025'],
		['#year=2025', '2025'],
		['#week=2026-11-18', 'Nov 16 – 22, 2026'],
		['#all', 'Since Mar 14, 2025'],
	])('opens the period %s', async (hash, label) => {
		const { wrapper } = await open(hash)

		expect(periodLabel(wrapper)).toBe(label)
	})

	// spec: STATS-001.58
	it.each(['', '#nonsense', '#month=2026-13', '#week=2026-02-30', '#cull=%7B%7D'])('shows the month of today for %j and writes no hash', async (hash) => {
		const { wrapper, location } = await open(hash)

		expect(periodLabel(wrapper)).toBe('November 2026')
		expect(location.hash).toBe('')
	})

	// spec: STATS-001.58
	it('clamps a month after today to today and one before the first counted day to that day, and rewrites the address', async () => {
		const future = await open('#month=2027-03')

		expect(periodLabel(future.wrapper)).toBe('November 2026')
		expect(future.location.hash).toBe('')

		const past = await open('#month=2019-01')

		expect(periodLabel(past.wrapper)).toBe('March 2025')
		expect(past.location.hash).toBe('#month=2025-03')
	})

	// spec: STATS-001.57
	it('writes the period when the segment changes, the user steps and presses Today', async () => {
		const { wrapper, location } = await open('')

		await chip(wrapper, 'Week').trigger('click')
		expect(location.hash).toBe('#week')

		await step(wrapper, 'Previous period').trigger('click')
		expect(location.hash).toBe('#week=2026-11-16')

		await chip(wrapper, 'Month').trigger('click')
		expect(location.hash).toBe('')

		await chip(wrapper, 'Year').trigger('click')
		expect(location.hash).toBe('#year')

		await chip(wrapper, 'All time').trigger('click')
		expect(location.hash).toBe('#all')

		await chip(wrapper, 'Month').trigger('click')
		await step(wrapper, 'Previous period').trigger('click')
		expect(location.hash).toBe('#month=2026-10')

		await chip(wrapper, 'Today').trigger('click')
		expect(location.hash).toBe('')
	})

	// spec: STATS-001.57
	it('writes nothing before the counters have loaded, so a failed load keeps the address', async () => {
		const location = fakeLocation('#month=2025-07')
		mountPage({}, ROOTS, vi.fn(async (_root: string) => ROWS), location)

		expect(location.writes).toEqual([])
	})
})
