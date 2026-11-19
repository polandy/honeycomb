// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { EmbeddedXmpAnswer } from '../../../src/logic/embedded-xmp.ts'
import type { SidecarLookupAnswer } from '../../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { freshFolders, freshLookups, freshVerdict, matchFresh } from '../../../src/logic/fresh-check.ts'
import { serializeXmp } from '../../../src/logic/xmp/serialize.ts'
import { listingEntry, pictureOf, picturesOf } from './listing-entries.ts'
import { read, xmp } from './sidecar-answers.ts'
import { CANONICAL_TIME, fixtureBytes, packetOf, seq } from './xmp/xmp-builders.ts'

const RAW = listingEntry(1, '/Trip/IMG_1.NEF', { mime: 'image/x-dcraw' })
const JPEG = listingEntry(2, '/Trip/IMG_1.JPG')
const RAW_SIDECAR = listingEntry(11, '/Trip/IMG_1.NEF.xmp', { mime: 'application/octet-stream' })
const JPEG_SIDECAR = listingEntry(12, '/Trip/IMG_1.JPG.xmp', { mime: 'application/octet-stream' })
const SHARED_SIDECAR = listingEntry(13, '/Trip/IMG_1.xmp', { mime: 'application/octet-stream' })

const REJECTED = xmp({ 'digiKam:PickLabel': '1' })
const PICKED = xmp({ 'digiKam:PickLabel': '3' })
const KEPT = xmp({ 'honeycomb:KeepRaw': 'True' })

type Answers = Map<number, SidecarLookupAnswer>
const noEmbedded = new Map<number, EmbeddedXmpAnswer>()

describe('freshFolders', () => {
	// spec: DELETE-002.15
	it('names the folder of every file once, the root as /', () => {
		const pictures = picturesOf([RAW, JPEG, RAW_SIDECAR, listingEntry(3, '/Trip/Day 2/IMG_2.JPG'), listingEntry(4, '/IMG_3.JPG'), listingEntry(14, '/IMG_3.JPG.xmp')])

		expect(freshFolders(pictures)).toEqual(['/Trip', '/Trip/Day 2', '/'])
	})
})

describe('matchFresh', () => {
	// spec: DELETE-002.15
	it('matches each picture to its fresh listing by its members, and skips one whose members changed', () => {
		const pair = pictureOf(RAW, JPEG)
		const single = pictureOf(listingEntry(3, '/Trip/IMG_2.JPG'))
		const gone = pictureOf(listingEntry(4, '/Trip/IMG_3.JPG'))
		const fresh = picturesOf([RAW, JPEG, JPEG_SIDECAR, listingEntry(3, '/Trip/IMG_2.JPG'), listingEntry(5, '/Trip/IMG_2.NEF', { mime: 'image/x-dcraw' })])

		const { matched, skipped } = matchFresh([pair, single, gone], fresh)

		expect(matched).toEqual([{ picture: pair, fresh: fresh[0] }])
		expect(matched[0]!.fresh.sidecars).toEqual([JPEG_SIDECAR])
		expect(skipped).toEqual([{ picture: single, reason: 'changed' }, { picture: gone, reason: 'changed' }])
	})
})

describe('freshLookups', () => {
	// spec: DELETE-002.15
	it('reads every sidecar but darktable duplicates, and the JPEG whose embedded XMP counts', () => {
		const withSidecars = pictureOf(RAW, JPEG, RAW_SIDECAR, JPEG_SIDECAR, listingEntry(15, '/Trip/IMG_1_01.NEF.xmp'))
		const embeddedOnly = pictureOf(listingEntry(3, '/Trip/IMG_2.JPG'))

		expect(freshLookups([withSidecars, embeddedOnly])).toEqual({ sidecars: [11, 12], embedded: [3] })
	})
})

describe('freshVerdict', () => {
	const pair = pictureOf(RAW, JPEG, RAW_SIDECAR, JPEG_SIDECAR)

	// spec: DELETE-002.15
	it('lets a picture without a row go only when its sidecars read and say rejected', () => {
		const both: Answers = new Map([[11, read(REJECTED)], [12, read(REJECTED)]])
		const rescued: Answers = new Map([[11, read(PICKED)], [12, read(PICKED)]])

		expect(freshVerdict('rejects', pair, both, noEmbedded)).toMatchObject({ decision: { flag: 'rejected' } })
		expect(freshVerdict('rejects', pair, rescued, noEmbedded)).toEqual({ reason: 'notRejected' })
		expect(freshVerdict('rejects', pictureOf(RAW, JPEG), new Map(), new Map([[2, { result: 'none' }]]))).toEqual({ reason: 'notRejected' })
	})

	// spec: DELETE-002.28
	it('takes the flag from the fresh rows over the sidecars, which may disagree', () => {
		const flagged = (flag: 'picked' | 'rejected') => pictureOf(...[RAW, JPEG, RAW_SIDECAR, JPEG_SIDECAR].map((entry) => ({ ...entry, flag, keepRaw: false, flagUpdated: 1 })))
		const split: Answers = new Map([[11, read(REJECTED)], [12, read(PICKED)]])
		const rejected: Answers = new Map([[11, read(REJECTED)], [12, read(REJECTED)]])

		expect(freshVerdict('rejects', flagged('rejected'), new Map([[11, read(PICKED)], [12, read(PICKED)]]), noEmbedded)).toMatchObject({ decision: { flag: 'rejected' } })
		expect(freshVerdict('rejects', flagged('rejected'), split, noEmbedded)).toMatchObject({ decision: { flag: 'rejected' } })
		expect(freshVerdict('rejects', flagged('picked'), rejected, noEmbedded)).toEqual({ reason: 'notRejected' })
	})

	// spec: DELETE-002.15
	it('skips a picture with a sidecar that cannot be read, is not valid XMP, or was not answered', () => {
		const locked: Answers = new Map([[11, read(REJECTED)], [12, { result: 'locked' }]])
		const refused: Answers = new Map([[11, read(REJECTED)], [12, read(fixtureBytes('refused/unclosed.xmp'))]])
		const missing: Answers = new Map([[11, read(REJECTED)]])

		expect(freshVerdict('rejects', pair, locked, noEmbedded)).toEqual({ reason: 'unread' })
		expect(freshVerdict('rejects', pair, refused, noEmbedded)).toEqual({ reason: 'refused' })
		expect(freshVerdict('rejects', pair, missing, noEmbedded)).toEqual({ reason: 'unread' })
	})

	// spec: DELETE-002.15
	it('counts the JPEG embedded XMP while the JPEG has no sidecar', () => {
		const single = pictureOf(JPEG)
		const embedded = (bytes: Uint8Array): Map<number, EmbeddedXmpAnswer> => new Map([[2, { result: 'read', bytes }]])

		expect(freshVerdict('rejects', single, new Map(), embedded(REJECTED))).toMatchObject({ decision: { flag: 'rejected' } })
		expect(freshVerdict('rejects', single, new Map(), new Map([[2, { result: 'locked' }]]))).toEqual({ reason: 'unread' })
		expect(freshVerdict('rejects', single, new Map(), noEmbedded)).toEqual({ reason: 'unread' })
		expect(freshVerdict('rejects', single, new Map(), embedded(fixtureBytes('refused/unclosed.xmp')))).toEqual({ reason: 'refused' })
	})

	// spec: DELETE-003.8
	it('lets a RAW go only when no sidecar says Keep RAW or rejected; a pair without sidecars goes', () => {
		const bare = pictureOf(RAW, JPEG)
		const undecided = new Map([[2, { result: 'none' } as EmbeddedXmpAnswer]])

		expect(freshVerdict('raws', bare, new Map(), undecided)).toEqual({ decision: UNDECIDED, tags: [], jpegSidecar: null })
		expect(freshVerdict('raws', pair, new Map([[11, read(KEPT)], [12, read(KEPT)]]), noEmbedded)).toEqual({ reason: 'notRemovable' })
		expect(freshVerdict('raws', pair, new Map([[11, read(REJECTED)], [12, read(REJECTED)]]), noEmbedded)).toEqual({ reason: 'notRemovable' })
		expect(freshVerdict('raws', pair, new Map([[11, read(xmp({}))], [12, { result: 'failed' }]]), noEmbedded)).toEqual({ reason: 'unread' })
	})

	// spec: DELETE-003.13
	it('takes Keep RAW from the fresh rows over the sidecars', () => {
		const kept = pictureOf(...[RAW, JPEG, RAW_SIDECAR, JPEG_SIDECAR].map((entry) => ({ ...entry, flag: 'unflagged' as const, keepRaw: true, flagUpdated: 1 })))
		const released = pictureOf(...[RAW, JPEG, RAW_SIDECAR, JPEG_SIDECAR].map((entry) => ({ ...entry, flag: 'unflagged' as const, keepRaw: false, flagUpdated: 1 })))
		const empty: Answers = new Map([[11, read(xmp({}))], [12, read(xmp({}))]])

		expect(freshVerdict('raws', kept, empty, noEmbedded)).toEqual({ reason: 'notRemovable' })
		expect(freshVerdict('raws', released, new Map([[11, read(KEPT)], [12, read(xmp({}))]]), noEmbedded)).toMatchObject({ decision: { keepRaw: false } })
	})

	// spec: DELETE-003.9
	it('names the JPEG sidecar to write first when only the RAW sidecar holds a decision or tags', () => {
		const rawOnly = pictureOf(RAW, JPEG, RAW_SIDECAR)
		const rated = serializeXmp(packetOf({ 'xmp:Rating': '3', 'digiKam:TagsList': seq(['Places/Lisbon']) }), CANONICAL_TIME)
		const none = new Map([[2, { result: 'none' } as EmbeddedXmpAnswer]])

		expect(freshVerdict('raws', rawOnly, new Map([[11, read(rated)]]), none)).toEqual({ decision: { ...UNDECIDED, rating: 3 }, tags: ['Places/Lisbon'], jpegSidecar: '/Trip/IMG_1.JPG.xmp' })
		expect(freshVerdict('raws', rawOnly, new Map([[11, read(xmp({}))]]), none)).toEqual({ decision: UNDECIDED, tags: [], jpegSidecar: null })
		expect(freshVerdict('raws', pictureOf(RAW, JPEG, RAW_SIDECAR, SHARED_SIDECAR), new Map([[11, read(rated)], [13, read(xmp({}))]]), noEmbedded)).toMatchObject({ jpegSidecar: null })
		expect(freshVerdict('rejects', rawOnly, new Map([[11, read(REJECTED)]]), none)).toMatchObject({ jpegSidecar: null })
	})
})
