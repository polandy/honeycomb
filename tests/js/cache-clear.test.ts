// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearCacheWithToast } from '../../src/cache-clear.ts'
import { logger } from '../../src/logger.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

describe('clearCacheWithToast', () => {
	// spec: SETTINGS-001.25
	it('clears the cache and says so', async () => {
		const toasts: string[] = []
		let cleared = 0

		await clearCacheWithToast(async () => void cleared++, (message) => void toasts.push(message))

		expect(cleared).toBe(1)
		expect(toasts).toEqual(['Cache cleared'])
	})

	// spec: SETTINGS-001.25
	it('logs a failure and says the cache could not be cleared', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const toasts: string[] = []
		const failure = new Error('offline')

		await clearCacheWithToast(async () => {
			throw failure
		}, (message) => void toasts.push(message))

		expect(toasts).toEqual(['Could not clear the cache.'])
		expect(error).toHaveBeenCalledWith('Could not clear the cache.', { error: failure })
	})
})
