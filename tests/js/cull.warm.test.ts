// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, fakeStorage, NO_TAGS, SET } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

describe('useCull: warm-up', () => {
	// spec: IMAGES-001.14
	it('stops the warm-up of the previous folder set when another opens', () => {
		const signals: AbortSignal[] = []
		const cull = useCull({
			hashImage: () => new Promise(() => undefined),
			saveVisualHashes: async () => undefined,
			warmPreviews: async (_fileIds, options) => { signals.push(options.signal!) },
			lookupDecisions: async () => [],
			saveDecisions: async () => undefined,
			tags: NO_TAGS,
		}, fakeStorage(), () => DEFAULT_SETTINGS, { takeOver: async () => ({ decided: [], tagged: [] }), write: async () => ({ written: 0, failed: [] }), writeTags: async () => ({ written: 0, failed: [] }) })

		cull.open(SET, ENTRIES, [])
		cull.open(SET, [listingEntry(50, '/A/IMG_50.JPG')], [])

		expect(signals.map((signal) => signal.aborted)).toEqual([true, false])
	})
})
