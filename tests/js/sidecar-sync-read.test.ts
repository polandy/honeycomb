// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { EmbeddedXmpAnswer } from '../../src/logic/embedded-xmp.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { SidecarLookupAnswer } from '../../src/logic/sidecar-sync.ts'
import type { XmpCacheRow } from '../../src/logic/xmp-cache.ts'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { sidecarRow } from '../../src/logic/xmp-cache.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { useSidecarSync } from '../../src/sidecar-sync.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { CANONICAL_TIME, packetOf, seq } from './logic/xmp/xmp-builders.ts'

const RATED_3 = serializeXmp(packetOf({ 'xmp:Rating': '3', 'digiKam:TagsList': seq(['Trip']) }), CANONICAL_TIME)
const RATED_5 = serializeXmp(packetOf({ 'xmp:Rating': '5' }), CANONICAL_TIME)

/** A JPEG with its own sidecar of the given ETag. */
const single = (id: number, etag = `etag-${id + 100}`): Picture<ListingEntry> => pictureOf(listingEntry(id, `/P/S${id}.JPG`), listingEntry(id + 100, `/P/S${id}.JPG.xmp`, { etag }))

/** A sync over a cache holding `cached`, whose sidecars read as RATED_3 and whose JPEGs embed what `embedded` answers. */
function sync(cached: readonly XmpCacheRow[] = [], embedded: (fileId: number) => EmbeddedXmpAnswer = () => ({ result: 'none' })) {
	const cache = new Map(cached.map((row) => [row.fileId, row]))
	const lookups: number[][] = []
	const embeddedLookups: number[][] = []
	const stored: XmpCacheRow[][] = []
	const fail = { cacheLookup: false, cacheSave: false, lookup: false }
	const answer = { current: (fileId: number): SidecarLookupAnswer => ({ result: 'read', bytes: RATED_3, etag: `etag-${fileId}`, size: RATED_3.length, mtime: 1 }) }
	const sidecars = useSidecarSync({
		lookupXmpCache: async (fileIds) => {
			if (fail.cacheLookup) {
				throw new Error('offline')
			}
			return fileIds.flatMap((fileId) => cache.get(fileId) ?? [])
		},
		saveXmpCache: async (rows) => {
			stored.push([...rows])
			if (fail.cacheSave) {
				throw new Error('offline')
			}
			rows.forEach((row) => cache.set(row.fileId, row))
		},
		lookupSidecars: async (fileIds) => {
			lookups.push([...fileIds])
			if (fail.lookup) {
				throw new Error('offline')
			}
			return fileIds.map((fileId) => answer.current(fileId))
		},
		lookupEmbeddedXmp: async (fileIds) => {
			embeddedLookups.push([...fileIds])
			return fileIds.map(embedded)
		},
		saveSidecars: async (items) => items.map((item) => ({ result: 'saved', fileId: 'fileId' in item ? item.fileId : 30, etag: 'saved', size: 1, mtime: 1 })),
	}, () => CANONICAL_TIME, () => undefined)
	return { sidecars, cache, lookups, embeddedLookups, stored, fail, answer }
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe('useSidecarSync: read', () => {
	// spec: XMP-006.7, XMP-003.1
	it('reads only the sidecars without a valid row, stores their rows and shows the valid row\'s values', async () => {
		const valid = sidecarRow(103, 'etag-103', RATED_5)
		const stale = sidecarRow(101, 'old', RATED_5)
		const older = { ...sidecarRow(102, 'etag-102', RATED_5), reader: 0 }
		const { sidecars, lookups, stored } = sync([stale, older, valid])

		const { decided, tagged } = await sidecars.read([single(1), single(2), single(3), single(4)])

		expect(lookups).toEqual([[101, 102, 104]])
		expect(stored).toEqual([[101, 102, 104].map((fileId) => sidecarRow(fileId, `etag-${fileId}`, RATED_3))])
		expect(decided.map(({ picture, decision }) => [picture.baseName, decision.rating])).toEqual([['S1', 3], ['S2', 3], ['S3', 5], ['S4', 3]])
		expect(tagged.map(({ picture, tags }) => [picture.baseName, tags])).toEqual([['S1', ['Trip']], ['S2', ['Trip']], ['S4', ['Trip']]])
	})

	// spec: XMP-006.7
	it('reads nothing and stores nothing on a second visit with the same ETags', async () => {
		const { sidecars, lookups, stored } = sync()

		await sidecars.read([single(1)])
		const { decided } = await sidecars.read([single(1)])

		expect(lookups).toEqual([[101]])
		expect(stored).toHaveLength(1)
		expect(decided).toEqual([{ picture: single(1), decision: { ...UNDECIDED, rating: 3 } }])
	})

	// spec: XMP-006.7
	it('reads a sidecar again once its ETag changed', async () => {
		const { sidecars, lookups } = sync()

		await sidecars.read([single(1)])
		await sidecars.read([single(1, 'edited')])

		expect(lookups).toEqual([[101], [101]])
	})

	// spec: XMP-006.7
	it('reads every sidecar when the cache lookup fails, and keeps the values when the cache save fails', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		const { sidecars, lookups, fail } = sync([sidecarRow(101, 'etag-101', RATED_5)])
		fail.cacheLookup = true
		fail.cacheSave = true

		const { decided } = await sidecars.read([single(1)])

		expect(lookups).toEqual([[101]])
		expect(decided.map(({ decision }) => decision.rating)).toEqual([3])
		expect(warn).toHaveBeenCalledWith('Could not look up the XMP cache; every sidecar is read', expect.anything())
		expect(warn).toHaveBeenCalledWith('Could not save the XMP cache; the sidecars are read again next time', expect.anything())
	})

	// spec: XMP-003.4
	it('warns about a sidecar it could not read and stores no row for it', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		const { sidecars, stored, answer, fail } = sync()
		answer.current = () => ({ result: 'notPermitted' })

		expect(await sidecars.read([single(1)])).toEqual({ decided: [], tagged: [] })
		expect(stored).toEqual([])
		expect(warn).toHaveBeenCalledWith('Could not read a sidecar', { path: '/P/S1.JPG.xmp', reason: 'notPermitted' })

		fail.lookup = true
		expect(await sidecars.read([single(1)])).toEqual({ decided: [], tagged: [] })
		expect(warn).toHaveBeenCalledWith('Could not look up the sidecars; their pictures show what the cache holds', expect.anything())
	})

	// spec: XMP-003.4
	it('looks nothing up without sources', async () => {
		const { sidecars, lookups, stored } = sync()

		expect(await sidecars.read([pictureOf(listingEntry(1, '/P/A.NEF', { mime: 'image/x-nikon-nef' }))])).toEqual({ decided: [], tagged: [] })
		expect(lookups).toEqual([])
		expect(stored).toEqual([])
	})

	// spec: TAGS-002.15, XMP-003.22
	it('reads and stores the embedded XMP of a JPEG without a sidecar', async () => {
		const bytes = serializeXmp(packetOf({ 'xmp:Rating': '2', 'digiKam:TagsList': seq(['Kids']) }), CANONICAL_TIME)
		const alone = pictureOf(listingEntry(3, '/P/B.JPG'))
		const { sidecars, lookups, embeddedLookups, stored } = sync([], () => ({ result: 'read', bytes }))

		const { decided, tagged } = await sidecars.read([alone])
		await sidecars.read([alone])

		expect(lookups).toEqual([])
		expect(embeddedLookups).toEqual([[3]])
		expect(stored[0]).toMatchObject([{ fileId: 3, kind: 'embedded', etag: 'etag-3', rating: 2, tags: ['Kids'] }])
		expect(decided.map(({ decision }) => decision.rating)).toEqual([2])
		expect(tagged).toEqual([{ picture: alone, tags: ['Kids'] }])
	})

	// spec: TAGS-002.17
	it('shows no tags for a picture whose embedded XMP was not read, but its decision', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		const pair = pictureOf(listingEntry(1, '/P/IMG_0001.NEF', { mime: 'image/x-nikon-nef' }), listingEntry(2, '/P/IMG_0001.JPG'), listingEntry(11, '/P/IMG_0001.NEF.xmp'))
		const { sidecars } = sync([], () => ({ result: 'locked' }))

		const { decided, tagged } = await sidecars.read([pair])

		expect(decided).toHaveLength(1)
		expect(tagged).toEqual([])
		expect(warn).toHaveBeenCalledWith('Could not read the embedded XMP; the picture shows no tags', { path: '/P/IMG_0001.JPG', reason: 'locked' })
	})
})

describe('useSidecarSync: the cache on a write', () => {
	// spec: XMP-006.10
	it('stores the row of each sidecar it saved, so the next visit reads none', async () => {
		const { sidecars, lookups, stored } = sync()

		await sidecars.write([single(1)], () => ({ ...UNDECIDED, rating: 4 }))
		const { decided } = await sidecars.read([single(1, 'saved')])

		expect(stored).toEqual([[expect.objectContaining({ fileId: 101, etag: 'saved', rating: 4 })]])
		expect(lookups).toEqual([[101]])
		expect(decided.map(({ decision }) => decision.rating)).toEqual([4])
	})
})
