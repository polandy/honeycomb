// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PlannedSave } from '../../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { NO_OWN_SAVES, recordSaves, withOwnSaves } from '../../../src/logic/own-saves.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const BYTES = new Uint8Array([1])
const NEF = listingEntry(1, '/P/IMG_0001.NEF')
const JPG = listingEntry(2, '/P/IMG_0001.JPG')
const NEF_XMP = listingEntry(11, '/P/IMG_0001.NEF.xmp', { etag: 'listed', size: 5, mtime: 100 })
const PAIR = pictureOf(NEF, JPG, NEF_XMP)

/** A save of the listed NEF sidecar from `etag`. */
const existing = (etag: string): PlannedSave => ({ picture: PAIR, path: NEF_XMP.path, item: { fileId: NEF_XMP.fileId, etag, size: 5, bytes: BYTES } })
/** A save that creates the JPEG's sidecar. */
const created: PlannedSave = { picture: PAIR, path: '/P/IMG_0001.JPG.xmp', item: { path: '/P/IMG_0001.JPG.xmp', bytes: BYTES } }
const saved = (fileId: number, etag: string) => ({ result: 'saved' as const, fileId, etag, size: 9, mtime: 200 })

describe('withOwnSaves', () => {
	// spec: DELETE-002.17
	it('gives a listed sidecar the state of honeycomb\'s last save, following one save after another', () => {
		const once = recordSaves(NO_OWN_SAVES, [existing('listed')], [saved(11, 'first')])
		const twice = recordSaves(once, [existing('first')], [saved(11, 'second')])

		expect(withOwnSaves(PAIR, twice).sidecars).toEqual([{ ...NEF_XMP, etag: 'second', size: 9, mtime: 200 }])
	})

	// spec: DELETE-002.17
	it('adds a sidecar honeycomb created for a member, with the state of its last save', () => {
		const made = recordSaves(NO_OWN_SAVES, [created], [saved(21, 'made')])
		const again = recordSaves(made, [{ ...created, item: { fileId: 21, etag: 'made', size: 9, bytes: BYTES } }], [saved(21, 'again')])

		const sidecars = withOwnSaves(PAIR, again).sidecars
		expect(sidecars.map(({ fileId, path, etag }) => ({ fileId, path, etag }))).toEqual([
			{ fileId: 11, path: NEF_XMP.path, etag: 'listed' },
			{ fileId: 21, path: '/P/IMG_0001.JPG.xmp', etag: 'again' },
		])
	})

	// spec: DELETE-002.18
	it('keeps the listed state of a sidecar another program changed before honeycomb saved it', () => {
		const own = recordSaves(NO_OWN_SAVES, [existing('foreign')], [saved(11, 'mine')])

		expect(withOwnSaves(PAIR, own).sidecars).toEqual([NEF_XMP])
	})

	it('records nothing for a failed save or a failed request', () => {
		const failed = recordSaves(NO_OWN_SAVES, [existing('listed'), created], [{ result: 'changed' }, { result: 'locked' }])
		const unreachable = recordSaves(NO_OWN_SAVES, [existing('listed')], null)

		expect(withOwnSaves(PAIR, failed)).toEqual(PAIR)
		expect(withOwnSaves(PAIR, unreachable)).toEqual(PAIR)
	})

	it('leaves a created sidecar already in the listing and one of another picture out', () => {
		const other = pictureOf(listingEntry(3, '/P/IMG_0002.JPG'))
		const own = recordSaves(NO_OWN_SAVES, [{ ...created, path: NEF_XMP.path, item: { path: NEF_XMP.path, bytes: BYTES } }], [saved(11, 'mine')])

		expect(withOwnSaves(PAIR, own).sidecars).toEqual([NEF_XMP])
		expect(withOwnSaves(other, own)).toEqual(other)
	})
})
