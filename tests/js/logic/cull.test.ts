// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { countFolderSet, folderLabel, prepareCull, warmFileIds } from '../../../src/logic/cull.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../../src/logic/pairing.ts'
import { PICTURE_CAP } from '../../../src/logic/picture-order.ts'
import { listingEntry } from './listing-entries.ts'

describe('countFolderSet', () => {
	it('pairs with the given pairing settings', () => {
		const entries = [listingEntry(1, '/A/IMG_1.TIF'), listingEntry(2, '/A/IMG_1.CR3'), listingEntry(3, '/A/IMG_2.TIF')]

		expect(countFolderSet([{ entries, truncated: false }], DEFAULT_PAIRING_SETTINGS).pictures).toBe(1)
		expect(countFolderSet([{ entries, truncated: false }], { ...DEFAULT_PAIRING_SETTINGS, renderedExtensions: ['tif'] }).pictures).toBe(2)
	})

	it('counts the pairs and singles of every listing, each file once, and their folders', () => {
		const pair = [listingEntry(1, '/A/IMG_1.JPG'), listingEntry(2, '/A/IMG_1.CR3')]
		const single = listingEntry(3, '/A/B/IMG_2.JPG')

		const count = countFolderSet([{ entries: [...pair, single], truncated: false }, { entries: [single], truncated: false }], DEFAULT_PAIRING_SETTINGS)

		expect(count).toEqual({ entries: [...pair, single], pictures: 2, folders: 2, firstFolder: '/A', overCap: false })
	})

	it('has no first folder and nothing over the cap without pictures', () => {
		expect(countFolderSet([{ entries: [], truncated: false }], DEFAULT_PAIRING_SETTINGS)).toEqual({ entries: [], pictures: 0, folders: 0, firstFolder: null, overCap: false })
	})

	it('is over the cap when a listing is truncated', () => {
		expect(countFolderSet([{ entries: [listingEntry(1, '/A/X.JPG')], truncated: true }], DEFAULT_PAIRING_SETTINGS).overCap).toBe(true)
	})

	it('is over the cap above the most pictures one grid shows', () => {
		const entries = Array.from({ length: PICTURE_CAP + 1 }, (_, index) => listingEntry(index, `/A/IMG_${index}.JPG`))

		expect(countFolderSet([{ entries, truncated: false }], DEFAULT_PAIRING_SETTINGS).overCap).toBe(true)
		expect(countFolderSet([{ entries: entries.slice(1), truncated: false }], DEFAULT_PAIRING_SETTINGS).overCap).toBe(false)
	})
})

describe('folderLabel', () => {
	it.each([
		['/P/2026/Day 1', { paths: ['/P/2026'], subfolders: true }, 'Day 1'],
		['/P/2026/Day 1/RAW', { paths: ['/P/2026'], subfolders: true }, 'Day 1/RAW'],
		['/P/2026', { paths: ['/P/2026'], subfolders: true }, '2026'],
		['/P/2026-old/X', { paths: ['/P/2026'], subfolders: true }, 'X'],
		['/P/2026/Day 1', { paths: ['/P/2026/Day 1', '/Q'], subfolders: true }, 'Day 1'],
		['/Q/Day 2', { paths: ['/P', '/Q'], subfolders: false }, 'Day 2'],
	])('names %s in %o as %s', (folder, set, expected) => {
		expect(folderLabel(folder, set)).toBe(expected)
	})
})

describe('prepareCull', () => {
	it('pairs with the given pairing settings', () => {
		const entries = [listingEntry(1, '/A/RAW/IMG_1.CR3'), listingEntry(2, '/A/JPG/IMG_1.JPG')]
		const subfolders = { ...DEFAULT_PAIRING_SETTINGS, folderMode: { kind: 'separate-subfolders' as const, rawSubfolder: 'raw', renderedSubfolder: 'jpg' } }

		expect(prepareCull(entries, DEFAULT_PAIRING_SETTINGS).pictures).toHaveLength(2)
		expect(prepareCull(entries, subfolders).pictures).toEqual([expect.objectContaining({ folder: '/A', raw: entries[0], rendered: entries[1] })])
	})

	it('pairs the entries', () => {
		const entries = [listingEntry(1, '/B/IMG_10.JPG'), listingEntry(2, '/B/IMG_9.JPG'), listingEntry(4, '/B/IMG_9.CR3')]

		const { pictures, cut } = prepareCull(entries, DEFAULT_PAIRING_SETTINGS)

		expect(pictures.map((picture) => [picture.baseName, picture.raw?.fileId ?? null])).toEqual([['IMG_10', null], ['IMG_9', 4]])
		expect(cut).toBe(false)
	})

	// spec: GRID-001.11
	it('keeps the earliest pictures by capture time above the cap', () => {
		const entries = Array.from({ length: PICTURE_CAP + 1 }, (_, index) => listingEntry(index, `/A/IMG_${index}.JPG`, { captureTime: PICTURE_CAP - index }))

		const { pictures, cut } = prepareCull(entries, DEFAULT_PAIRING_SETTINGS)

		expect(cut).toBe(true)
		expect(pictures).toHaveLength(PICTURE_CAP)
		expect(pictures.some((picture) => picture.baseName === 'IMG_0')).toBe(false)
	})
})

describe('warmFileIds', () => {
	it('lists the file id of the image each picture shows, in order', () => {
		const { pictures } = prepareCull([listingEntry(1, '/A/X.CR3'), listingEntry(2, '/A/X.JPG'), listingEntry(3, '/A/Y.NEF')], DEFAULT_PAIRING_SETTINGS)

		expect(warmFileIds(pictures)).toEqual([2, 3])
	})
})
