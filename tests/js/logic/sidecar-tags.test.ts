// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarLookupAnswer } from '../../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { takeOverTags } from '../../../src/logic/sidecar-tags.ts'
import { takeOverLookups } from '../../../src/logic/sidecar-sync.ts'
import { serializeXmp } from '../../../src/logic/xmp/serialize.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'
import { CANONICAL_TIME, fixtureBytes, packetOf, seq } from './xmp/xmp-builders.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_0001.NEF'), listingEntry(2, '/P/IMG_0001.JPG'), listingEntry(11, '/P/IMG_0001.NEF.xmp'), listingEntry(12, '/P/IMG_0001.JPG.xmp'))
const SINGLE = pictureOf(listingEntry(3, '/P/B.JPG'), listingEntry(13, '/P/B.JPG.xmp'))

/** A `read` answer of a sidecar with the tags in `digiKam:TagsList`. */
function tagged(...tags: string[]): SidecarLookupAnswer {
	const bytes = serializeXmp(packetOf({ 'digiKam:TagsList': seq(tags) }), CANONICAL_TIME)
	return { result: 'read', bytes, etag: 'e', size: bytes.length, mtime: 1 }
}

describe('takeOverTags', () => {
	const lookups = takeOverLookups([PAIR, SINGLE], new Set())

	// spec: TAGS-002.2
	it('takes the union of the tags of every sidecar answered', () => {
		const { tagged: taken, leftOut } = takeOverTags(lookups, new Map([[11, tagged('Places/Lisbon')], [12, tagged('People/Anna', 'Places/Lisbon')], [13, tagged()]]), new Set())

		expect(taken).toEqual([{ picture: PAIR, tags: ['People/Anna', 'Places/Lisbon'] }])
		expect(leftOut).toEqual([])
	})

	// spec: TAGS-002.3
	it('takes nothing for a picture with stored tags for a member', () => {
		const { tagged: taken } = takeOverTags(lookups, new Map([[11, tagged('Places/Lisbon')], [13, tagged('Anna')]]), new Set([2]))

		expect(taken).toEqual([{ picture: SINGLE, tags: ['Anna'] }])
	})

	it('passes over a refused, an unread and an unanswered sidecar', () => {
		const refused = fixtureBytes('refused/unclosed.xmp')
		const { tagged: taken } = takeOverTags(lookups, new Map<number, SidecarLookupAnswer>([[11, { result: 'read', bytes: refused, etag: 'e', size: 1, mtime: 1 }], [12, { result: 'notPermitted' }]]), new Set())

		expect(taken).toEqual([])
	})

	// spec: TAGS-002.5
	it('leaves out the tags the storage cannot hold', () => {
		const long = 'x'.repeat(256)

		const { tagged: taken, leftOut } = takeOverTags(lookups, new Map([[13, tagged('Anna', long)]]), new Set())

		expect(taken).toEqual([{ picture: SINGLE, tags: ['Anna'] }])
		expect(leftOut).toEqual([long])
	})
})
