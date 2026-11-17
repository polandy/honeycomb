// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { listingEntry } from './logic/listing-entries.ts'
import { allMoved, moveFlow } from './move-fixtures.ts'

const SAVED = listingEntry(11, '/Trip/IMG_1.CR3.xmp', { etag: 'saved-11' })
const CREATED = listingEntry(30, '/Trip/IMG_1.JPG.xmp', { etag: 'created-30' })

/** The picture with the sidecars added when it holds `/Trip/IMG_1.CR3`, as `current` gives honeycomb's saves. */
function withSidecars(...sidecars: ListingEntry[]) {
	return (picture: Picture<ListingEntry>) => (picture.raw?.path === '/Trip/IMG_1.CR3' ? { ...picture, sidecars: [...picture.sidecars, ...sidecars] } : picture)
}

describe('useMoveFlow: honeycomb\'s own sidecar saves', () => {
	// spec: MOVE-004.19
	it('counts and sends the sidecars as honeycomb last saved them when the dialog opens', async () => {
		const { moving, pair, sent } = moveFlow(allMoved(), { current: withSidecars(SAVED) })
		moving.open([pair])
		moving.choose('/Out')
		await flushPromises()
		expect(moving.counts.value.files).toBe(3)

		await moving.confirm()

		expect(sent[0]![0]).toContainEqual({ fileId: 11, etag: 'saved-11', path: '/Out/IMG_1.CR3.xmp' })
	})

	// spec: MOVE-004.19
	it('sends a sidecar honeycomb created while the move waited for the writes, with its path checked against the target', async () => {
		let current = withSidecars()
		const { moving, pair, sent } = moveFlow(allMoved(), {
			held: ['IMG_1.JPG.xmp'],
			flush: async () => {
				current = withSidecars(SAVED, CREATED)
			},
			current: (picture) => current(picture),
		})
		moving.open([pair])
		moving.choose('/Out')
		await flushPromises()

		await moving.confirm()

		expect(sent[0]![0]!.map(({ fileId, etag, path }) => [fileId, etag, path])).toEqual(expect.arrayContaining([
			[11, 'saved-11', '/Out/IMG_1-2.CR3.xmp'],
			[30, 'created-30', '/Out/IMG_1-2.JPG.xmp'],
		]))
		expect(sent[0]![0]).toHaveLength(4)
	})
})
