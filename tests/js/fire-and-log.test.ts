// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireAndLog } from '../../src/shared/fire-and-log.ts'
import { logger } from '../../src/shared/logger.ts'

vi.mock('../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

afterEach(() => vi.clearAllMocks())

describe('fireAndLog', () => {
	it('logs a rejection with what the work was', async () => {
		const logged = vi.mocked(logger.error)
		const failure = new Error('down')

		fireAndLog(Promise.reject(failure), 'Could not do it')
		await flushPromises()

		expect(logged).toHaveBeenCalledWith('Could not do it', { error: failure })
	})

	it('logs nothing when the work succeeds', async () => {
		const logged = vi.mocked(logger.error)

		fireAndLog(Promise.resolve(1), 'Could not do it')
		await flushPromises()

		expect(logged).not.toHaveBeenCalled()
	})
})
