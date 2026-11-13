// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { EmbeddedXmpAnswer } from '../../../src/logic/embedded-xmp.ts'
import type { KnownSidecar, SidecarLookupAnswer } from '../../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { embeddedSourceOf, embeddedXmpSource } from '../../../src/logic/embedded-xmp.ts'
import { planSaves, takeOverLookups } from '../../../src/logic/sidecar-sync.ts'
import { embeddedLookups, takeOverTags } from '../../../src/logic/sidecar-tags.ts'
import { readXmp } from '../../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../../src/logic/xmp/serialize.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'
import { CANONICAL_TIME, fixtureBytes, itemsOf, packetOf, seq, textOf } from './xmp/xmp-builders.ts'

const NEF = listingEntry(1, '/P/IMG_0001.NEF', { mime: 'image/x-nikon-nef' })
const JPG = listingEntry(2, '/P/IMG_0001.JPG')
const NEF_XMP = listingEntry(11, '/P/IMG_0001.NEF.xmp')
const PAIR = pictureOf(NEF, JPG, NEF_XMP)
const ALONE = pictureOf(listingEntry(3, '/P/B.JPG'))

/** The bytes of a packet with the tags in `digiKam:TagsList` and, when given, a rating. */
function tagged(tags: readonly string[], rating?: string): Uint8Array {
	return serializeXmp(packetOf({ 'digiKam:TagsList': seq(tags), ...(rating === undefined ? {} : { 'xmp:Rating': rating }) }), CANONICAL_TIME)
}

/** A sidecar lookup answer `read` with the bytes. */
function read(bytes: Uint8Array): SidecarLookupAnswer {
	return { result: 'read', bytes, etag: 'e', size: bytes.length, mtime: 1 }
}

/** An embedded XMP answer `read` with the tags. */
function embedded(...tags: string[]): EmbeddedXmpAnswer {
	return { result: 'read', bytes: tagged(tags) }
}

const tagsOf = (bytes: Uint8Array) => itemsOf(readXmp(bytes), 'digiKam:TagsList')

describe('embeddedXmpSource', () => {
	// spec: TAGS-002.15, TAGS-002.16
	it('is the JPEG while it has no sidecar of its own nor a shared one', () => {
		const ownSidecar = pictureOf(NEF, JPG, listingEntry(12, '/P/IMG_0001.JPG.xmp'))
		const shared = pictureOf(NEF, JPG, listingEntry(13, '/P/IMG_0001.xmp'))
		const rawAlone = pictureOf(NEF)
		const heic = pictureOf(listingEntry(4, '/P/C.HEIC', { mime: 'image/heic' }))

		expect([PAIR, ALONE].map((picture) => embeddedXmpSource(picture))).toEqual([JPG, ALONE.rendered])
		expect([ownSidecar, shared, rawAlone, heic].map((picture) => embeddedXmpSource(picture))).toEqual([null, null, null, null])
	})

	// spec: TAGS-002.19
	it('is none once honeycomb created the JPEG\'s sidecar', () => {
		expect(embeddedXmpSource(PAIR, new Map([['/P/IMG_0001.JPG.xmp', { fileId: 22, saved: null }]]))).toBeNull()
	})
})

describe('embeddedSourceOf', () => {
	it('reads the packet, none, a refused packet as none, and a failure or no answer as not read', () => {
		expect(tagsOf(serializeXmp((embeddedSourceOf(embedded('Anna')) as { packet: ReturnType<typeof readXmp> }).packet, CANONICAL_TIME))).toEqual(['Anna'])
		expect(embeddedSourceOf({ result: 'none' })).toEqual({ packet: null })
		expect(embeddedSourceOf({ result: 'read', bytes: fixtureBytes('refused/unclosed.xmp') })).toEqual({ packet: null })
		expect(embeddedSourceOf({ result: 'locked' })).toEqual({ failure: 'locked' })
		expect(embeddedSourceOf(undefined)).toEqual({ failure: 'unreachable' })
	})
})

describe('takeOverTags with the embedded XMP', () => {
	const lookups = takeOverLookups([PAIR, ALONE], new Set())

	// spec: TAGS-002.15, TAGS-002.16
	it('looks up the JPEGs of the pictures without stored tags only', () => {
		expect(lookups.map(({ picture }) => picture)).toEqual([PAIR, ALONE])
		expect(embeddedLookups(lookups, new Set())).toEqual([2, 3])
		expect(embeddedLookups(lookups, new Set([1]))).toEqual([3])
	})

	// spec: TAGS-002.15
	it('joins the embedded tags into the union of the sidecars', () => {
		const { tagged: taken, unread } = takeOverTags(lookups, new Map([[11, read(tagged(['People/Anna']))]]), new Set(), new Map([[2, embedded('Places/Lisbon')], [3, { result: 'none' }]]))

		expect(taken).toEqual([{ picture: PAIR, tags: ['People/Anna', 'Places/Lisbon'] }])
		expect(unread).toEqual([])
	})

	// spec: TAGS-002.17
	it('takes no tags over for a picture whose embedded XMP was not read', () => {
		const { tagged: taken, unread } = takeOverTags(lookups, new Map([[11, read(tagged(['People/Anna']))]]), new Set(), new Map([[3, embedded('Kids')], [2, { result: 'notPermitted' }]]))
		const none = takeOverTags(lookups, new Map([[11, read(tagged(['People/Anna']))]]), new Set(), new Map())

		expect(taken).toEqual([{ picture: ALONE, tags: ['Kids'] }])
		expect(unread).toEqual([{ path: '/P/IMG_0001.JPG', reason: 'notPermitted' }])
		expect(none.tagged).toEqual([])
		expect(none.unread).toEqual([{ path: '/P/IMG_0001.JPG', reason: 'unreachable' }, { path: '/P/B.JPG', reason: 'unreachable' }])
	})
})

describe('planSaves with the embedded XMP', () => {
	const WEDDING = { tags: { added: ['Events/Wedding'], removed: [] } }

	// spec: TAGS-002.18
	it('applies the change to the union with the embedded tags and creates the JPEG\'s sidecar', () => {
		const { saves, failed } = planSaves(PAIR, WEDDING, new Map(), new Map([[11, read(tagged(['Places/Lisbon'], '4'))]]), CANONICAL_TIME, undefined, new Map([[2, embedded('People/Anna')]]))

		expect(failed).toEqual([])
		expect(saves.map(({ path, item }) => [path, 'path' in item, tagsOf(item.bytes)])).toEqual([
			['/P/IMG_0001.NEF.xmp', false, ['Events/Wedding', 'People/Anna', 'Places/Lisbon']],
			['/P/IMG_0001.JPG.xmp', true, ['Events/Wedding', 'People/Anna', 'Places/Lisbon']],
		])
		expect(textOf(readXmp(saves[0]!.item.bytes), 'xmp:Rating')).toBe('4')
	})

	// spec: TAGS-002.19
	it('creates the JPEG\'s sidecar without tags when the last embedded tag goes', () => {
		const untag = { tags: { added: [], removed: ['People/Anna'] } }

		const { saves } = planSaves(ALONE, untag, new Map(), new Map(), CANONICAL_TIME, undefined, new Map([[3, embedded('People/Anna')]]))
		const without = planSaves(ALONE, untag, new Map(), new Map(), CANONICAL_TIME, undefined, new Map([[3, { result: 'none' }]]))

		expect(saves.map(({ path, item }) => [path, tagsOf(item.bytes)])).toEqual([['/P/B.JPG.xmp', undefined]])
		expect(without.saves).toEqual([])
	})

	// spec: TAGS-002.19
	it('leaves the embedded XMP out once the JPEG\'s sidecar exists', () => {
		const known = new Map<string, KnownSidecar>([['/P/B.JPG.xmp', { fileId: 23, saved: { etag: 'c', size: 1, bytes: tagged([]) } }]])

		const { saves, failed } = planSaves(ALONE, WEDDING, known, new Map(), CANONICAL_TIME)

		expect(failed).toEqual([])
		expect(saves.map(({ item }) => tagsOf(item.bytes))).toEqual([['Events/Wedding']])
	})

	// spec: TAGS-002.20
	it('fails every sidecar of the picture when its embedded XMP was not read', () => {
		const { saves, failed } = planSaves(PAIR, WEDDING, new Map(), new Map([[11, read(tagged([]))]]), CANONICAL_TIME, undefined, new Map([[2, { result: 'failed' }]]))
		const limited = planSaves(PAIR, WEDDING, new Map(), new Map(), CANONICAL_TIME, new Set(['/P/IMG_0001.NEF.xmp']))

		expect(saves).toEqual([])
		expect(failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'failed' }, { path: '/P/IMG_0001.JPG.xmp', picture: PAIR, reason: 'failed' }])
		expect(limited.failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'unreachable' }])
	})

	it('needs no embedded XMP for a decision', () => {
		expect(planSaves(PAIR, { decision: UNDECIDED }, new Map(), new Map([[11, read(tagged([]))]]), CANONICAL_TIME).failed).toEqual([])
	})
})
