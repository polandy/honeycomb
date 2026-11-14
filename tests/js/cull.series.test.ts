// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { fakeStorage, NO_TAGS, SET } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

describe('useCull: open series', () => {
	// spec: SERIES-003.25
	it('marks the series with a member still without a hash as open', () => {
		const cull = useCull({
			hashImage: () => new Promise(() => undefined),
			saveVisualHashes: async () => undefined,
			warmPreviews: async () => undefined,
			lookupDecisions: async () => [],
			saveDecisions: async () => undefined,
			tags: NO_TAGS,
		}, fakeStorage(), () => DEFAULT_SETTINGS, { takeOver: async () => ({ decided: [], tagged: [] }), write: async () => ({ written: 0, failed: [] }), writeTags: async () => ({ written: 0, failed: [] }) })

		cull.open(SET, [
			listingEntry(1, '/Trip/A.JPG', { captureTime: 10, visualHash: '0000000000000000' }),
			listingEntry(2, '/Trip/B.JPG', { captureTime: 11, visualHash: '0000000000000000' }),
			listingEntry(3, '/Trip/C.JPG', { captureTime: 500 }),
			listingEntry(4, '/Trip/D.JPG', { captureTime: 501 }),
		], [])

		expect([...cull.openSeries.value].map((each) => each.baseName)).toEqual(['C', 'D'])
	})
})
