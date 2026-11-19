// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, fakeStorage, NO_SERIES, NO_SIDECARS, NO_TAGS, SAVED_SERIES, SET } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

describe('useCull: warm-up', () => {
	// spec: IMAGES-001.14
	it('stops the warm-up of the previous folder set when another opens', () => {
		const signals: AbortSignal[] = []
		const cull = useCull({
			hashImage: () => new Promise(() => undefined),
			saveVisualHashes: async () => undefined,
			wait: async () => {},
			warmPreviews: async (_fileIds, options) => { signals.push(options.signal!) },
			lookupDecisions: async () => [],
			lookupSeries: NO_SERIES,
			saveSeries: SAVED_SERIES,
			tags: NO_TAGS,
		}, fakeStorage(), () => DEFAULT_SETTINGS, NO_SIDECARS)

		cull.open(SET, ENTRIES)
		cull.open(SET, [listingEntry(50, '/A/IMG_50.JPG')])

		expect(signals.map((signal) => signal.aborted)).toEqual([true, false])
	})
})
