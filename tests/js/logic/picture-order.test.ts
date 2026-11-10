// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { capPictures, captureTime, defaultSortOrder, groupByFolder, PICTURE_CAP, sortPictures } from '../../../src/logic/picture-order.ts'
import { listingEntry, pictureOf, picturesOf } from './listing-entries.ts'

const compareNames = new Intl.Collator('en', { numeric: true }).compare

describe('captureTime', () => {
	it.each([
		['the RAW member\'s capture time', { captureTime: 10, mtime: 1 }, { captureTime: 20, mtime: 2 }, 10],
		['the rendered member\'s capture time without the RAW member\'s', { captureTime: null, mtime: 1 }, { captureTime: 20, mtime: 2 }, 20],
		['the RAW member\'s modification time without any capture time', { captureTime: null, mtime: 1 }, { captureTime: null, mtime: 2 }, 1],
	])('of a pair is %s', (_case, raw, rendered, expected) => {
		const picture = pictureOf(listingEntry(1, '/P/A.NEF', raw), listingEntry(2, '/P/A.JPG', rendered))

		expect(captureTime(picture)).toBe(expected)
	})

	it.each([
		['/P/A.JPG', { captureTime: 30, mtime: 3 }, 30],
		['/P/A.JPG', { captureTime: null, mtime: 3 }, 3],
		['/P/A.NEF', { captureTime: null, mtime: 4 }, 4],
	])('of the single %s with %o is %d', (path, fields, expected) => {
		expect(captureTime(pictureOf(listingEntry(1, path, fields)))).toBe(expected)
	})
})

describe('capPictures', () => {
	it('caps at 20,000 pictures', () => {
		expect(PICTURE_CAP).toBe(20_000)
	})

	it('keeps every picture at the cap', () => {
		const pictures = picturesOf(Array.from({ length: PICTURE_CAP }, (_, index) => listingEntry(index, `/P/${index}.JPG`)))

		const capped = capPictures(pictures)

		expect(capped.cut).toBe(false)
		expect(capped.pictures).toHaveLength(PICTURE_CAP)
	})

	// spec: GRID-001.11
	it('keeps the first 20,000 by capture time above the cap, in their given order', () => {
		const count = PICTURE_CAP + 2
		const entries = Array.from({ length: count }, (_, index) => listingEntry(index, `/P/${index}.JPG`, { captureTime: count - index }))

		const capped = capPictures(picturesOf(entries))

		expect(capped.cut).toBe(true)
		expect(capped.pictures).toHaveLength(PICTURE_CAP)
		expect(capped.pictures[0]?.baseName).toBe('2')
		expect(capped.pictures.at(-1)?.baseName).toBe(String(count - 1))
	})
})

describe('defaultSortOrder', () => {
	// spec: GRID-002.8
	it('sorts one folder by file name and several by capture time', () => {
		expect(defaultSortOrder(0)).toBe('file-name')
		expect(defaultSortOrder(1)).toBe('file-name')
		expect(defaultSortOrder(2)).toBe('capture-time')
	})
})

describe('sortPictures', () => {
	const timed = (fileId: number, path: string, captureTime: number | null, mtime = 1000) => listingEntry(fileId, path, { captureTime, mtime })

	// spec: GRID-002.9
	it('sorts by base name with the given comparison, then by folder', () => {
		const pictures = picturesOf(['/B/IMG_1.JPG', '/A/IMG_10.JPG', '/A/IMG_2.JPG', '/A/IMG_2.NEF', '/A/IMG_1.JPG'].map((path, index) => listingEntry(index, path)))

		const sorted = sortPictures(pictures, 'file-name', compareNames, false)

		expect(sorted.map((picture) => `${picture.folder}/${picture.baseName}`)).toEqual(['/A/IMG_1', '/B/IMG_1', '/A/IMG_2', '/A/IMG_10'])
	})

	// spec: GRID-002.9
	it('sorts by capture time, a picture without one by its modification time, ties by file name', () => {
		const pictures = picturesOf([timed(1, '/P/C.JPG', 30), timed(2, '/P/B.JPG', null, 20), timed(3, '/P/A.JPG', 30), timed(4, '/P/D.JPG', 10)])

		const sorted = sortPictures(pictures, 'capture-time', compareNames, false)

		expect(sorted.map((picture) => picture.baseName)).toEqual(['D', 'B', 'A', 'C'])
	})

	it('sorts by folder first when grouped by folder', () => {
		const pictures = picturesOf([timed(1, '/B/X.JPG', 10), timed(2, '/A/Y.JPG', 30), timed(3, '/A/Z.JPG', 20)])

		const sorted = sortPictures(pictures, 'capture-time', compareNames, true)

		expect(sorted.map((picture) => `${picture.folder}/${picture.baseName}`)).toEqual(['/A/Z', '/A/Y', '/B/X'])
	})

	it('leaves the given pictures in their order', () => {
		const pictures = picturesOf([listingEntry(1, '/P/B.JPG'), listingEntry(2, '/P/A.JPG')])

		sortPictures(pictures, 'file-name', compareNames, false)

		expect(pictures.map((picture) => picture.baseName)).toEqual(['B', 'A'])
	})
})

describe('groupByFolder', () => {
	it('gives each run of one folder its start and count', () => {
		const pictures = picturesOf(['/A/1.JPG', '/A/2.JPG', '/B/1.JPG', '/C/1.JPG', '/C/2.JPG'].map((path, index) => listingEntry(index, path)))

		expect(groupByFolder(pictures)).toEqual([
			{ folder: '/A', start: 0, count: 2 },
			{ folder: '/B', start: 2, count: 1 },
			{ folder: '/C', start: 3, count: 2 },
		])
	})

	it('gives no groups for no pictures', () => {
		expect(groupByFolder([])).toEqual([])
	})
})
