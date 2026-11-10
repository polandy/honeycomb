// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { filesOf } from '../../../src/logic/delete-summary.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../../src/logic/pairing.ts'
import { followReplaced, retryBatch, trashReport, trashRequest, wholePictures, withoutFiles } from '../../../src/logic/trash-report.ts'
import { listingEntry, pictureOf, picturesOf } from './listing-entries.ts'

const ENTRIES = [
	listingEntry(1, '/Trip/IMG_1.CR3', { mime: 'image/x-dcraw', size: 20 }),
	listingEntry(2, '/Trip/IMG_1.JPG', { size: 5 }),
	listingEntry(3, '/Trip/IMG_1.xmp', { size: 1 }),
	listingEntry(4, '/Trip/IMG_2.JPG', { size: 7 }),
	listingEntry(5, '/Trip/IMG_3.JPG', { size: 9 }),
]
const [PAIR, SINGLE, OTHER] = picturesOf(ENTRIES) as [ReturnType<typeof pictureOf>, ReturnType<typeof pictureOf>, ReturnType<typeof pictureOf>]
const results = (...pictures: [number, string][][]) => pictures.map((files) => files.map(([fileId, result]) => ({ fileId, result })))

describe('trashRequest', () => {
	it('sends every file of each picture with its listing ETag, a picture per list', () => {
		expect(trashRequest(wholePictures([PAIR, SINGLE]))).toEqual([
			[{ fileId: 2, etag: 'etag-2' }, { fileId: 1, etag: 'etag-1' }, { fileId: 3, etag: 'etag-3' }],
			[{ fileId: 4, etag: 'etag-4' }],
		])
	})
})

describe('trashReport', () => {
	it('counts the trashed files, the pictures fully removed and the bytes freed', () => {
		const report = trashReport(wholePictures([PAIR, SINGLE]), results([[2, 'trashed'], [1, 'trashed'], [3, 'trashed']], [[4, 'trashed']]))

		expect(report.trashed.map((file) => file.entry.fileId)).toEqual([2, 1, 3, 4])
		expect(report).toMatchObject({ failed: [], removed: 2, bytes: 33 })
	})

	it('reports each failed file with its result and leaves a picture that kept a member out of the removed', () => {
		const report = trashReport(wholePictures([PAIR, SINGLE, OTHER]), results(
			[[2, 'trashed'], [1, 'locked'], [3, 'skipped']],
			[[4, 'notPermitted']],
			[[5, 'changed']],
		))

		expect(report.trashed.map((file) => file.entry.fileId)).toEqual([2])
		expect(report.failed.map(({ file, result }) => [file.entry.fileId, result])).toEqual([[1, 'locked'], [3, 'skipped'], [4, 'notPermitted'], [5, 'changed']])
		expect(report).toMatchObject({ removed: 0, bytes: 5 })
	})

	it.each(['notFound', 'failed'])('keeps the %s result', (result) => {
		const report = trashReport(wholePictures([SINGLE]), results([[4, result]]))

		expect(report.failed.map((failed) => failed.result)).toEqual([result])
	})

	it('counts a file the response leaves out, or reports with an unknown result, as failed', () => {
		const report = trashReport(wholePictures([PAIR]), results([[2, 'trashed'], [1, 'vanished']]))

		expect(report.failed.map(({ file, result }) => [file.entry.fileId, result])).toEqual([[1, 'failed'], [3, 'failed']])
	})
})

describe('retryBatch', () => {
	it('resends only the failed and skipped files, grouped by their picture', () => {
		const report = trashReport(wholePictures([PAIR, SINGLE, OTHER]), results(
			[[2, 'trashed'], [1, 'locked'], [3, 'skipped']],
			[[4, 'trashed']],
			[[5, 'changed']],
		))

		expect(trashRequest(retryBatch(report))).toEqual([
			[{ fileId: 1, etag: 'etag-1' }, { fileId: 3, etag: 'etag-3' }],
			[{ fileId: 5, etag: 'etag-5' }],
		])
	})
})

describe('withoutFiles', () => {
	it('keeps an untouched picture as it is and drops a picture whose files all went', () => {
		const { pictures, replaced } = withoutFiles([PAIR, SINGLE, OTHER], new Set([4]), DEFAULT_PAIRING_SETTINGS)

		expect(pictures).toEqual([PAIR, OTHER])
		expect(pictures[0]).toBe(PAIR)
		expect(replaced).toEqual(new Map([[SINGLE, null]]))
	})

	it('pairs again what is left of a picture, so a pair that lost a member shows as a single with its sidecar', () => {
		const { pictures, replaced } = withoutFiles([PAIR, SINGLE], new Set([2]), DEFAULT_PAIRING_SETTINGS)

		expect(pictures[0]).toMatchObject({ raw: ENTRIES[0], rendered: null, sidecars: [ENTRIES[2]] })
		expect(pictures[1]).toBe(SINGLE)
		expect(replaced.get(PAIR)).toBe(pictures[0])
	})

	it('drops a picture that only kept its sidecars', () => {
		const { pictures } = withoutFiles([PAIR], new Set(filesOf(PAIR).filter((file) => file.role !== 'sidecar').map((file) => file.entry.fileId)), DEFAULT_PAIRING_SETTINGS)

		expect(pictures).toEqual([])
	})
})

describe('followReplaced', () => {
	const PAIRED_AGAIN = pictureOf(ENTRIES[0]!)

	it('keeps the shown picture, or shows what replaced it', () => {
		expect(followReplaced([PAIR, SINGLE, OTHER], 2, new Map([[SINGLE, null]]))).toEqual({ pictures: [PAIR, OTHER], index: 1 })
		expect(followReplaced([PAIR, SINGLE], 0, new Map([[PAIR, PAIRED_AGAIN]]))).toEqual({ pictures: [PAIRED_AGAIN, SINGLE], index: 0 })
	})

	it('shows the next picture when the shown one went, the previous at the end, and nothing when none is left', () => {
		expect(followReplaced([PAIR, SINGLE, OTHER], 1, new Map([[SINGLE, null]]))).toEqual({ pictures: [PAIR, OTHER], index: 1 })
		expect(followReplaced([PAIR, SINGLE], 1, new Map([[SINGLE, null]]))).toEqual({ pictures: [PAIR], index: 0 })
		expect(followReplaced([SINGLE], 0, new Map([[SINGLE, null]]))).toBeNull()
	})
})
