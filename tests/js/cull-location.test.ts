// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useCullLocation } from '../../src/cull-location.ts'
import { logger } from '../../src/logger.ts'
import { locationHash } from '../../src/logic/cull-location.ts'

vi.mock('../../src/logger.ts', () => ({ logger: { error: vi.fn() } }))

afterEach(() => vi.clearAllMocks())

const SET = { paths: ['/Trip'], subfolders: false }

describe('useCullLocation', () => {
	// spec: DECISIONS-002.17
	it('logs a restore that fails and still keeps the address on the cull', async () => {
		const logged = vi.mocked(logger.error)
		const written: string[] = []
		const failure = new Error('gone')
		const fileId = ref<number | null>(7)

		effectScope().run(() => useCullLocation(
			{ read: () => locationHash(SET, 7), write: (hash) => written.push(hash) },
			{ folderSet: () => SET, shownFileId: () => fileId.value },
			() => Promise.reject(failure),
		))
		await flushPromises()

		expect(logged).toHaveBeenCalledWith('Could not open the cull the address names', { error: failure })
		expect(written).toEqual([locationHash(SET, 7)])
	})
})
