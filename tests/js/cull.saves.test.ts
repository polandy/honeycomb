// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CullSidecars } from '../../src/cull-seams.ts'
import type { StoredDecision } from '../../src/logic/decision.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { logger } from '../../src/logger.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, fakeStorage, NO_TAGS, SET } from './app-cull.ts'

const NO_SIDECARS: CullSidecars = { takeOver: async () => ({ decided: [], tagged: [] }), write: async () => ({ written: 0, failed: [] }), writeTags: async () => ({ written: 0, failed: [] }) }

afterEach(() => vi.restoreAllMocks())

/** A cull opened on ENTRIES whose saves are recorded and wait until the test settles them one by one. */
async function waitingCull() {
	const saved: StoredDecision[][] = []
	const settle: { resolve: () => void, reject: (error: Error) => void }[] = []
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		warmPreviews: async () => undefined,
		lookupDecisions: async () => [],
		saveDecisions: (rows) => new Promise<void>((resolve, reject) => {
			saved.push([...rows])
			settle.push({ resolve, reject })
		}),
		tags: NO_TAGS,
	}, fakeStorage(), () => DEFAULT_SETTINGS, NO_SIDECARS)
	cull.open(SET, ENTRIES, [])
	await flushPromises()
	return { cull, saved, settle, picture: (name: string) => cull.pictures.value.find((picture) => picture.baseName === name)! }
}

describe('useCull: saves', () => {
	// spec: DECISIONS-001.14, DECISIONS-001.15
	it('sends one save at a time; a failed one puts back only the files no later save stored', async () => {
		const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull, saved, settle, picture } = await waitingCull()

		cull.decide({ kind: 'flag', flag: 'rejected' }, [picture('IMG_9'), picture('IMG_2')])
		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9')])
		cull.decide({ kind: 'rating', rating: 3 }, [picture('IMG_9')])
		expect(saved).toHaveLength(1)

		settle[0]!.reject(new Error('down'))
		await flushPromises()
		expect(saved[1]).toEqual([{ fileId: 4, rating: 3, colourLabel: null, flag: 'picked', keepRaw: false }])
		expect(cull.saveFailed.value).toBe(false)

		settle[1]!.resolve()
		await flushPromises()
		expect(cull.decisionOf(picture('IMG_9'))).toMatchObject({ flag: 'picked', rating: 3 })
		expect(cull.decisionOf(picture('IMG_2')).flag).toBe('unflagged')
		expect(cull.saveFailed.value).toBe(true)
		expect(logged).toHaveBeenCalledOnce()
	})

	// spec: DECISIONS-001.15
	it('puts a file back to what it had before the first failed save when the later one fails too', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull, settle, picture } = await waitingCull()

		cull.decide({ kind: 'flag', flag: 'rejected' }, [picture('IMG_9')])
		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9')])
		settle[0]!.reject(new Error('down'))
		await flushPromises()
		settle[1]!.reject(new Error('still down'))
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('unflagged')
		expect(cull.saveFailed.value).toBe(true)
	})
})
