// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { XmpCacheRow } from '../../../src/logic/xmp-cache.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { flagSync } from '../../../src/logic/flag-sync.ts'
import { XMP_READER } from '../../../src/logic/xmp-cache.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const PICKED: Decision = { ...UNDECIDED, flag: 'picked' }

/** A read sidecar row of the file stating the flag, with the listed ETag. */
function row(fileId: number, etag: string, values: Partial<XmpCacheRow> = {}): XmpCacheRow {
	return { fileId, kind: 'sidecar', etag, reader: XMP_READER, state: 'read', reason: null, rating: null, flag: null, colourLabel: null, keepRaw: null, tags: null, ...values }
}

const byId = (...rows: XmpCacheRow[]) => new Map(rows.map((each) => [each.fileId, each]))

/** A JPEG whose row holds the flag and ETag, with a sidecar listed under `etag` unless null. */
function jpeg(fileId: number, flag: 'picked' | 'rejected' | 'unflagged', stored: string | null, etag: string | null = `etag-${fileId + 100}`) {
	const member = listingEntry(fileId, `/P/IMG_${fileId}.JPG`, { flag, keepRaw: false, flagUpdated: 5, sidecarEtag: stored })
	return etag === null ? pictureOf(member) : pictureOf(member, listingEntry(fileId + 100, `/P/IMG_${fileId}.JPG.xmp`, { etag }))
}

function sync(pictures: Picture<ListingEntry>[], rows: Map<number, XmpCacheRow>, stated = new Map<Picture<ListingEntry>, Decision>(), knownEtags = new Map<number, string | null>()) {
	return flagSync(pictures, { rows, stated: (picture) => stated.get(picture) ?? UNDECIDED, knownEtags, known: new Map() })
}

describe('flagSync', () => {
	// spec: XMP-003.46
	it('records the ETag of a sidecar that states the row, and writes nothing', () => {
		const unknown = jpeg(1, 'picked', null)
		const known = jpeg(2, 'picked', 'etag-102')

		const result = sync([unknown, known], byId(row(101, 'etag-101', { flag: 'picked' }), row(102, 'etag-102', { flag: 'picked' })))

		expect(result.etags).toEqual([{ fileId: 1, sidecarEtag: 'etag-101' }])
		expect(result.takenOver).toEqual([])
		expect(result.plan.pictures).toEqual([])
	})

	// spec: XMP-003.47
	it('takes over a flag changed in digiKam, writes the sidecar still differing and records the agreeing one', () => {
		const pair = pictureOf(
			listingEntry(1, '/P/IMG_0001.NEF', { mime: 'image/x-nikon-nef', flag: 'rejected', keepRaw: false, flagUpdated: 5, sidecarEtag: 'e1' }),
			listingEntry(2, '/P/IMG_0001.JPG', { flag: 'rejected', keepRaw: false, flagUpdated: 5, sidecarEtag: 'j1' }),
			listingEntry(11, '/P/IMG_0001.NEF.xmp', { etag: 'e2' }),
			listingEntry(12, '/P/IMG_0001.JPG.xmp', { etag: 'j1' }),
		)

		const result = sync([pair], byId(row(11, 'e2', { flag: 'picked' }), row(12, 'j1', { flag: 'rejected' })), new Map([[pair, PICKED]]))

		expect(result.takenOver).toEqual([{ picture: pair, flag: { flag: 'picked', keepRaw: false } }])
		expect(result.etags).toEqual([{ fileId: 1, sidecarEtag: 'e2' }])
		expect(result.plan.pictures).toEqual([pair])
		expect(result.plan.paths.get(pair)).toEqual(new Set(['/P/IMG_0001.JPG.xmp']))
	})

	// spec: XMP-003.47
	it('takes the ETag recorded in this session over the listed one', () => {
		const picture = jpeg(1, 'rejected', null)

		const result = sync([picture], byId(row(101, 'etag-101', { flag: 'picked' })), new Map([[picture, PICKED]]), new Map([[1, 'old']]))

		expect(result.takenOver).toEqual([{ picture, flag: { flag: 'picked', keepRaw: false } }])
	})

	// spec: XMP-003.48
	it('writes the row where the sidecar did not change or its ETag was never known', () => {
		const unchanged = jpeg(1, 'picked', 'etag-101')
		const neverKnown = jpeg(2, 'rejected', null)
		const stated = new Map([[unchanged, { ...UNDECIDED, flag: 'rejected' as const }], [neverKnown, PICKED]])

		const result = sync([unchanged, neverKnown], byId(row(101, 'etag-101', { flag: 'rejected' }), row(102, 'etag-102', { flag: 'picked' })), stated)

		expect(result.takenOver).toEqual([])
		expect(result.etags).toEqual([])
		expect(result.plan.pictures).toEqual([unchanged, neverKnown])
	})

	// spec: XMP-003.48
	it('creates the sidecar of a flagged picture without one, not of an unflagged one', () => {
		const flagged = jpeg(1, 'picked', null, null)
		const unflagged = jpeg(2, 'unflagged', null, null)

		const result = sync([flagged, unflagged], new Map())

		expect(result.plan.pictures).toEqual([flagged])
		expect(result.plan.files).toBe(1)
	})

	// spec: XMP-003.49
	it('leaves out a picture with a refused, unread or stale sidecar and one without a row', () => {
		const refused = jpeg(1, 'rejected', 'old')
		const unread = jpeg(2, 'rejected', 'old')
		const stale = jpeg(4, 'rejected', 'old')
		const rowless = pictureOf(listingEntry(3, '/P/IMG_3.JPG'), listingEntry(103, '/P/IMG_3.JPG.xmp'))

		const result = sync([refused, unread, stale, rowless], byId(row(101, 'etag-101', { state: 'refused', reason: 'too-large' }), row(104, 'old', { flag: 'picked' }), row(103, 'etag-103', { flag: 'picked' })), new Map([[refused, PICKED], [unread, PICKED], [stale, PICKED], [rowless, PICKED]]))

		expect(result).toMatchObject({ takenOver: [], etags: [], plan: { pictures: [], files: 0 } })
	})
})
