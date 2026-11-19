// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { freshFolders, jpegSidecarOf, matchFresh } from '../../../src/logic/fresh-check.ts'
import { listingEntry, pictureOf, picturesOf } from './listing-entries.ts'

const RAW = listingEntry(1, '/Trip/IMG_1.NEF', { mime: 'image/x-dcraw' })
const JPEG = listingEntry(2, '/Trip/IMG_1.JPG')
const RAW_SIDECAR = listingEntry(11, '/Trip/IMG_1.NEF.xmp', { mime: 'application/octet-stream' })
const JPEG_SIDECAR = listingEntry(12, '/Trip/IMG_1.JPG.xmp', { mime: 'application/octet-stream' })
const SHARED_SIDECAR = listingEntry(13, '/Trip/IMG_1.xmp', { mime: 'application/octet-stream' })

describe('freshFolders', () => {
	// spec: DELETE-002.26
	it('names the folder of every file once, the root as /', () => {
		const pictures = picturesOf([RAW, JPEG, RAW_SIDECAR, listingEntry(3, '/Trip/Day 2/IMG_2.JPG'), listingEntry(4, '/IMG_3.JPG'), listingEntry(14, '/IMG_3.JPG.xmp')])

		expect(freshFolders(pictures)).toEqual(['/Trip', '/Trip/Day 2', '/'])
	})
})

describe('matchFresh', () => {
	// spec: DELETE-002.16
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

describe('jpegSidecarOf', () => {
	const rawOnly = pictureOf(RAW, JPEG, RAW_SIDECAR)

	// spec: DELETE-003.12
	it('names the JPEG sidecar to write first while the cull shows a rating, colour label or tag and only the RAW has a sidecar', () => {
		expect(jpegSidecarOf(rawOnly, { ...UNDECIDED, rating: 3 }, [])).toBe('/Trip/IMG_1.JPG.xmp')
		expect(jpegSidecarOf(rawOnly, { ...UNDECIDED, colourLabel: 'red' }, [])).toBe('/Trip/IMG_1.JPG.xmp')
		expect(jpegSidecarOf(rawOnly, UNDECIDED, ['Places/Lisbon'])).toBe('/Trip/IMG_1.JPG.xmp')
	})

	// spec: DELETE-003.9
	it('names none for a picture without values, without a RAW sidecar, with a JPEG or shared sidecar, or without a JPEG', () => {
		expect(jpegSidecarOf(rawOnly, { ...UNDECIDED, flag: 'picked', keepRaw: true }, [])).toBeNull()
		expect(jpegSidecarOf(pictureOf(RAW, JPEG), { ...UNDECIDED, rating: 3 }, [])).toBeNull()
		expect(jpegSidecarOf(pictureOf(RAW, JPEG, RAW_SIDECAR, JPEG_SIDECAR), { ...UNDECIDED, rating: 3 }, [])).toBeNull()
		expect(jpegSidecarOf(pictureOf(RAW, JPEG, RAW_SIDECAR, SHARED_SIDECAR), { ...UNDECIDED, rating: 3 }, [])).toBeNull()
		expect(jpegSidecarOf(pictureOf(RAW, RAW_SIDECAR), { ...UNDECIDED, rating: 3 }, [])).toBeNull()
	})
})
