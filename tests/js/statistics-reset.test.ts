// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { resetStatisticsWithToast } from '../../src/statistics-reset.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

describe('resetStatisticsWithToast', () => {
	// spec: STATS-001.3
	it('resets the statistics and says so', async () => {
		const toasts: string[] = []
		let resets = 0

		await resetStatisticsWithToast(async () => void resets++, (message) => void toasts.push(message))

		expect(resets).toBe(1)
		expect(toasts).toEqual(['Statistics reset'])
	})

	// spec: STATS-001.3
	it('logs a failure and says the statistics could not be reset', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const toasts: string[] = []
		const failure = new Error('offline')

		await resetStatisticsWithToast(async () => {
			throw failure
		}, (message) => void toasts.push(message))

		expect(toasts).toEqual(['Could not reset the statistics.'])
		expect(error).toHaveBeenCalledWith('Could not reset the statistics.', { error: failure })
	})
})
