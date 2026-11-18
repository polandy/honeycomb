// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { XmpCacheRow } from '../../../src/logic/xmp-cache.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { embeddedRow, pictureState, sidecarRow, staleSources, XMP_READER, xmpCacheSources } from '../../../src/logic/xmp-cache.ts'
import { serializeXmp } from '../../../src/logic/xmp/serialize.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'
import { CANONICAL_TIME, fixtureBytes, packetOf, seq } from './xmp/xmp-builders.ts'

const NEF = listingEntry(1, '/P/IMG_0001.NEF', { mime: 'image/x-nikon-nef' })
const JPG = listingEntry(2, '/P/IMG_0001.JPG', { mtime: 50 })
const RAW_SIDECAR = listingEntry(11, '/P/IMG_0001.NEF.xmp', { mtime: 100 })
const JPEG_SIDECAR = listingEntry(12, '/P/IMG_0001.JPG.xmp', { mtime: 100 })
const PAIR = pictureOf(NEF, JPG, RAW_SIDECAR)
const ALONE = pictureOf(listingEntry(3, '/P/B.JPG'))

/** The bytes of a packet with the properties. */
function bytesOf(properties: Parameters<typeof packetOf>[0]): Uint8Array {
	return serializeXmp(packetOf(properties), CANONICAL_TIME)
}

/** A read sidecar row of the file with the values, the rest stating nothing. */
function row(fileId: number, values: Partial<XmpCacheRow> = {}): XmpCacheRow {
	return { fileId, kind: 'sidecar', etag: `etag-${fileId}`, reader: XMP_READER, state: 'read', reason: null, rating: null, flag: null, colourLabel: null, keepRaw: null, tags: null, ...values }
}

/** The rows by file id. */
function byId(...rows: XmpCacheRow[]): Map<number, XmpCacheRow> {
	return new Map(rows.map((each) => [each.fileId, each]))
}

describe('xmpCacheSources', () => {
	// spec: XMP-006.7
	it('names each listed sidecar and each counted embedded XMP once', () => {
		const shared = listingEntry(13, '/P/IMG_0001.xmp')
		const both = pictureOf(NEF, JPG, RAW_SIDECAR, shared)

		expect(xmpCacheSources([PAIR, ALONE, both]).map(({ kind, entry }) => [kind, entry.fileId])).toEqual([
			['sidecar', 11],
			['embedded', 2],
			['embedded', 3],
			['sidecar', 13],
		])
	})
})

describe('staleSources', () => {
	// spec: XMP-006.7
	it('keeps the sources without a row, with another ETag or read by an older reader', () => {
		const sources = xmpCacheSources([pictureOf(listingEntry(4, '/P/C.JPG'), listingEntry(14, '/P/C.JPG.xmp')), pictureOf(listingEntry(5, '/P/D.JPG'), listingEntry(15, '/P/D.JPG.xmp')), pictureOf(listingEntry(6, '/P/E.JPG'), listingEntry(16, '/P/E.JPG.xmp')), pictureOf(listingEntry(7, '/P/F.JPG'), listingEntry(17, '/P/F.JPG.xmp'))])
		const rows = byId(row(14, { etag: 'old' }), row(15, { reader: XMP_READER - 1 }), row(16))

		expect(staleSources(sources, rows).map(({ entry }) => entry.fileId)).toEqual([14, 15, 17])
	})
})

describe('sidecarRow', () => {
	// spec: XMP-006.7, XMP-006.10
	it('holds what the sidecar states, null for what it does not, and Keep RAW without the pair rule', () => {
		const bytes = bytesOf({ 'xmp:Rating': '4', 'honeycomb:KeepRaw': 'True', 'digiKam:TagsList': seq(['Places/Rome', 'Trip']) })

		expect(sidecarRow(11, 'new', bytes)).toEqual(row(11, { etag: 'new', rating: 4, keepRaw: true, tags: ['Places/Rome', 'Trip'] }))
		expect(sidecarRow(11, 'e', bytesOf({}))).toEqual(row(11, { etag: 'e' }))
	})

	// spec: XMP-006.7, XMP-003.33
	it('stores a refused sidecar with its reason and no values', () => {
		expect(sidecarRow(11, 'e', fixtureBytes('refused/doctype.xmp'))).toEqual(row(11, { etag: 'e', state: 'refused', reason: 'doctype' }))
	})

	// spec: TAGS-002.5
	it('leaves out a tag the cache cannot hold', () => {
		const long = 'x'.repeat(256)
		const leftOut: string[] = []

		expect(sidecarRow(11, 'e', bytesOf({ 'digiKam:TagsList': seq(['Anna', long]) }), (tag) => leftOut.push(tag))).toMatchObject({ tags: ['Anna'] })
		expect(leftOut).toEqual([long])
	})
})

describe('embeddedRow', () => {
	// spec: XMP-006.7, XMP-003.22
	it('holds the embedded XMP under the JPEG\'s ETag, none when there is none, and no row when it was not read', () => {
		expect(embeddedRow(JPG, { result: 'read', bytes: bytesOf({ 'xmp:Rating': '2' }) })).toEqual(row(2, { kind: 'embedded', rating: 2 }))
		expect(embeddedRow(JPG, { result: 'none' })).toEqual(row(2, { kind: 'embedded', state: 'none' }))
		expect(embeddedRow(JPG, { result: 'notPermitted' })).toBeNull()
	})
})

describe('pictureState', () => {
	// spec: XMP-003.1, XMP-006.7
	it('takes the decision of the newest sidecar by the listing\'s time, a tie going to the RAW member\'s, and the pair rule for Keep RAW', () => {
		const both = pictureOf(NEF, JPG, RAW_SIDECAR, JPEG_SIDECAR)

		expect(pictureState(both, byId(row(11, { rating: 3, keepRaw: true }), row(12, { rating: 5 }))).decision).toEqual({ ...UNDECIDED, rating: 3, keepRaw: true })
		expect(pictureState(pictureOf(JPG, JPEG_SIDECAR), byId(row(12, { flag: 'rejected', keepRaw: true }))).decision).toEqual({ ...UNDECIDED, flag: 'rejected' })
	})

	// spec: XMP-003.4
	it('is undecided without a row read, and warns about the refused and disagreeing sidecars', () => {
		const both = pictureOf(NEF, JPG, listingEntry(11, '/P/IMG_0001.NEF.xmp', { mtime: 200 }), JPEG_SIDECAR)

		expect(pictureState(PAIR, new Map())).toEqual({ decision: UNDECIDED, tags: [], warnings: [] })
		expect(pictureState(both, byId(row(11, { rating: 3 }), row(12, { state: 'refused', reason: 'malformed' }))).warnings).toEqual([{ path: '/P/IMG_0001.JPG.xmp', reason: 'malformed' }])
		expect(pictureState(both, byId(row(11, { rating: 3 }), row(12, { rating: 1 }))).warnings).toEqual([{ path: '/P/IMG_0001.JPG.xmp', reason: 'disagrees' }])
	})

	// spec: TAGS-002.2, TAGS-002.15, XMP-003.22
	it('unites the tags of the sidecars and the embedded XMP, the embedded XMP deciding at the JPEG\'s time', () => {
		const rows = byId(row(11, { rating: 1, tags: ['Places/Lisbon'] }), row(2, { kind: 'embedded', rating: 4, tags: ['People/Anna'] }), row(3, { kind: 'embedded', state: 'none' }))

		expect(pictureState(PAIR, rows)).toEqual({ decision: { ...UNDECIDED, rating: 1 }, tags: ['People/Anna', 'Places/Lisbon'], warnings: [{ path: '/P/IMG_0001.JPG', reason: 'disagrees' }] })
		expect(pictureState(ALONE, rows)).toEqual({ decision: UNDECIDED, tags: [], warnings: [] })
	})

	// spec: TAGS-002.17
	it('shows no tags while the embedded XMP has no row', () => {
		expect(pictureState(PAIR, byId(row(11, { rating: 3, tags: ['Places/Lisbon'] }))).tags).toEqual([])
	})
})
