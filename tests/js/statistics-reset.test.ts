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

		await resetStatisticsWithToast(async () => void resets++, (message) => void toasts.push(message), () => {
			throw new Error('success must not be an error toast')
		})

		expect(resets).toBe(1)
		expect(toasts).toEqual(['Statistics reset'])
	})

	// spec: APP-001.13
	it('logs a failure and says the statistics could not be reset as an error toast', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const errors: string[] = []
		const failure = new Error('offline')

		await resetStatisticsWithToast(async () => {
			throw failure
		}, () => {
			throw new Error('a failure must be an error toast')
		}, (message) => void errors.push(message))

		expect(errors).toEqual(['Could not reset the statistics.'])
		expect(error).toHaveBeenCalledWith('Could not reset the statistics.', { error: failure })
	})
})
