// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { readEtags, savedEtags } from '../../../src/logic/sidecar-etags.ts'
import { XMP_READER } from '../../../src/logic/xmp-cache.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const NEF = { mime: 'image/x-nikon-nef' }

/** A NEF+JPEG pair with the sidecars at the paths, file ids from 11. */
const pairWith = (...sidecars: string[]) => pictureOf(listingEntry(1, '/P/IMG_0001.NEF', NEF), listingEntry(2, '/P/IMG_0001.JPG'), ...sidecars.map((path, index) => listingEntry(11 + index, path)))

describe('savedEtags', () => {
	// spec: XMP-003.45
	it('gives the RAW the ETag of its own sidecar and the JPEG that of the shared one', () => {
		const pair = pairWith('/P/IMG_0001.NEF.xmp', '/P/IMG_0001.xmp')

		expect(savedEtags([
			{ picture: pair, path: '/P/IMG_0001.NEF.xmp', created: false, fileId: 11, etag: 'n2' },
			{ picture: pair, path: '/P/IMG_0001.xmp', created: false, fileId: 12, etag: 's2' },
		])).toEqual([{ fileId: 1, sidecarEtag: 'n2' }, { fileId: 2, sidecarEtag: 's2' }])
	})

	// spec: XMP-003.45
	it('records a created sidecar for its member and leaves out a member whose own sidecar was not saved', () => {
		const pair = pairWith('/P/IMG_0001.NEF.xmp', '/P/IMG_0001.xmp')
		const single = pictureOf(listingEntry(3, '/P/IMG_0003.JPG'))

		expect(savedEtags([
			{ picture: pair, path: '/P/IMG_0001.xmp', created: false, fileId: 12, etag: 's2' },
			{ picture: single, path: '/P/IMG_0003.JPG.xmp', created: true, fileId: 30, etag: 'c1' },
		])).toEqual([{ fileId: 2, sidecarEtag: 's2' }, { fileId: 3, sidecarEtag: 'c1' }])
	})

	// spec: XMP-003.45
	it('matches a member\'s sidecar ignoring case and records nothing for none saved', () => {
		const pair = pairWith('/P/img_0001.nef.xmp', '/P/IMG_0001.JPG.xmp')

		expect(savedEtags([{ picture: pair, path: '/P/img_0001.nef.xmp', created: false, fileId: 11, etag: 'n3' }])).toEqual([{ fileId: 1, sidecarEtag: 'n3' }])
		expect(savedEtags([])).toEqual([])
	})
})

describe('readEtags', () => {
	// spec: DECISIONS-001.41, XMP-003.46
	it('gives each member the listed ETag of its sidecar, where the cache read that version', () => {
		const pair = pairWith('/P/IMG_0001.NEF.xmp', '/P/IMG_0001.xmp')
		const read = (fileId: number, state: 'read' | 'refused', etag = `etag-${fileId}`) => ({ fileId, kind: 'sidecar' as const, etag, reader: XMP_READER, state, reason: null, rating: null, flag: null, colourLabel: null, keepRaw: null, tags: null })

		expect(readEtags(pair, new Map([[11, read(11, 'read')], [12, read(12, 'read')]]))).toEqual(new Map([[1, 'etag-11'], [2, 'etag-12']]))
		expect(readEtags(pair, new Map([[11, read(11, 'refused')], [12, read(12, 'read', 'stale')]]))).toEqual(new Map())
	})
})
