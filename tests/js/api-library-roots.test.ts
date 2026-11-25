// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadLibraryRoots } from '../../src/api/library-roots.ts'
import { logger } from '../../src/shared/logger.ts'

afterEach(() => vi.restoreAllMocks())

describe('loadLibraryRoots', () => {
	// spec: SETTINGS-001.36
	it('returns the roots of the settings', async () => {
		expect(await loadLibraryRoots(async () => ({ libraryRoots: ['/Photos'] }))).toEqual(['/Photos'])
	})

	// spec: SETTINGS-001.36
	it('offers every folder and logs when the settings cannot be read', async () => {
		const failure = new Error('offline')
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})

		expect(await loadLibraryRoots(async () => {
			throw failure
		})).toEqual([])
		expect(error).toHaveBeenCalledWith('Could not read the library roots; the picker offers every folder', { error: failure })
	})
})
