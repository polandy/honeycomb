// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanUpWithToast, clearCacheWithToast } from '../../src/settings/cache-clear.ts'
import { logger } from '../../src/shared/logger.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

describe('clearCacheWithToast', () => {
	// spec: SETTINGS-001.25
	it('clears the cache and says so', async () => {
		const toasts: string[] = []
		let cleared = 0

		await clearCacheWithToast(async () => void cleared++, (message) => void toasts.push(message), () => undefined)

		expect(cleared).toBe(1)
		expect(toasts).toEqual(['Cache cleared'])
	})

	// spec: SETTINGS-001.25, APP-001.13
	it('logs a failure and says the cache could not be cleared', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const toasts: string[] = []
		const failure = new Error('offline')

		await clearCacheWithToast(async () => {
			throw failure
		}, () => undefined, (message) => void toasts.push(message))

		expect(toasts).toEqual(['Could not clear the cache.'])
		expect(error).toHaveBeenCalledWith('Could not clear the cache.', { error: failure })
	})
})

describe('cleanUpWithToast', () => {
	// spec: SETTINGS-001.27
	it.each([[12, 'Removed 12 orphaned entries'], [1, 'Removed 1 orphaned entry'], [0, 'Nothing was orphaned']])('cleans up %i entries and says so', async (removed, message) => {
		const toasts: string[] = []

		await cleanUpWithToast(async () => removed, (text) => void toasts.push(text), () => undefined)

		expect(toasts).toEqual([message])
	})

	// spec: SETTINGS-001.27, APP-001.13
	it('logs a failure and says the clean-up failed', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const toasts: string[] = []
		const failure = new Error('forbidden')

		await cleanUpWithToast(async () => {
			throw failure
		}, () => undefined, (text) => void toasts.push(text))

		expect(toasts).toEqual(['Could not clean up the orphaned data.'])
		expect(error).toHaveBeenCalledWith('Could not clean up the orphaned data.', { error: failure })
	})
})
