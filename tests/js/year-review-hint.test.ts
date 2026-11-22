// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { useYearReviewHint } from '../../src/year-review-hint.ts'

vi.mock('../../src/logger.ts', () => ({ logger: { error: vi.fn() } }))

function hintOn(today: string, answer: () => Promise<unknown>, save: () => Promise<void> = async () => undefined) {
	const saved: unknown[] = []
	const hint = useYearReviewHint({
		loadViewState: answer,
		saveViewState: async (patch) => {
			saved.push(patch)
			return save()
		},
	}, () => today)
	return { hint, saved }
}

describe('useYearReviewHint', () => {
	// spec: STATS-001.26
	it('shows nothing until the view state is read, then the year not yet closed', async () => {
		const { hint } = hintOn('2026-12-01', async () => ({ year_review_hint_closed: 2025 }))
		expect(hint.year.value).toBeNull()

		await flushPromises()

		expect(hint.year.value).toBe(2026)
	})

	// spec: STATS-001.26
	it('stays away for a year already closed and outside December and January', async () => {
		const closed = hintOn('2026-12-01', async () => ({ year_review_hint_closed: 2026 }))
		const summer = hintOn('2026-07-01', async () => ({}))
		await flushPromises()

		expect(closed.hint.year.value).toBeNull()
		expect(summer.hint.year.value).toBeNull()
	})

	// spec: STATS-001.48
	it('hides the hint at once on close and stores the year', async () => {
		const { hint, saved } = hintOn('2027-01-03', async () => ({}))
		await flushPromises()

		hint.close()

		expect(hint.year.value).toBeNull()
		expect(saved).toEqual([{ year_review_hint_closed: 2026 }])
	})

	// spec: STATS-001.48
	it('does nothing on close while no hint shows', async () => {
		const { hint, saved } = hintOn('2026-07-01', async () => ({}))
		await flushPromises()

		hint.close()

		expect(saved).toEqual([])
	})

	// spec: STATS-001.48
	it('logs a failed write and keeps the hint away for this visit', async () => {
		const error = new Error('offline')
		const { hint } = hintOn('2026-12-01', async () => ({}), async () => Promise.reject(error))
		await flushPromises()

		hint.close()
		await flushPromises()

		expect(hint.year.value).toBeNull()
		expect(logger.error).toHaveBeenCalledWith('Could not save the closed year-in-review hint.', { error })
	})

	// spec: STATS-001.48
	it('logs a failed read and shows no hint', async () => {
		const error = new Error('down')
		const { hint } = hintOn('2026-12-01', async () => Promise.reject(error))
		await flushPromises()

		expect(hint.year.value).toBeNull()
		expect(logger.error).toHaveBeenCalledWith('Could not read the closed year-in-review hint.', { error })
	})
})
