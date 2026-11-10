// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { MoveResponseFile } from '../../../src/logic/move-report.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { filesOf } from '../../../src/logic/delete-summary.ts'
import { moveReport, undoneEntries, undoRequest } from '../../../src/logic/move-report.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

const [PAIR, SINGLE, OTHER] = picturesOf([
	listingEntry(1, '/In/A.RAF', { mime: 'image/x-fuji-raf' }),
	listingEntry(2, '/In/A.JPG'),
	listingEntry(3, '/In/A.xmp'),
	listingEntry(4, '/In/B.JPG'),
	listingEntry(5, '/In/C.JPG'),
]) as [Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>]

const SENT = [filesOf(PAIR), filesOf(SINGLE), filesOf(OTHER)]
const moved = (fileId: number, path: string, newFileId = fileId, replaced = false): MoveResponseFile => ({ fileId, result: 'moved', replaced, path, newFileId, etag: `etag-${newFileId}` })

describe('moveReport', () => {
	// spec: MOVE-003.6
	it('reports moved files with old and new path, and pictures whose files all moved', () => {
		const report = moveReport(SENT.slice(0, 2), [
			[moved(2, '/Out/X.JPG', 2, true), moved(1, '/Out/X.RAF', 10), moved(3, '/Out/X.xmp')],
			[moved(4, '/Out/B.JPG')],
		])

		expect(report.moved.map(({ file, from, path, fileId, etag }) => [file.entry.fileId, from, path, fileId, etag])).toEqual([
			[2, '/In/A.JPG', '/Out/X.JPG', 2, 'etag-2'],
			[1, '/In/A.RAF', '/Out/X.RAF', 10, 'etag-10'],
			[3, '/In/A.xmp', '/Out/X.xmp', 3, 'etag-3'],
			[4, '/In/B.JPG', '/Out/B.JPG', 4, 'etag-4'],
		])
		expect(report).toMatchObject({ failed: [], pictures: 2, replaced: 1 })
	})

	// spec: MOVE-003.6
	it('reports each failed file with its result, unknown and incomplete answers as failed', () => {
		const report = moveReport(SENT, [
			[{ fileId: 2, result: 'movedBack', replaced: true }, { fileId: 1, result: 'locked', replaced: false }, { fileId: 3, result: 'skipped', replaced: false }],
			[{ fileId: 4, result: 'moved', replaced: false, path: '/Out/B.JPG' }],
			[{ fileId: 5, result: 'teleported', replaced: false }],
		])

		expect(report.failed.map(({ file, result }) => [file.entry.fileId, result])).toEqual([[2, 'movedBack'], [1, 'locked'], [3, 'skipped'], [4, 'failed'], [5, 'failed']])
		expect(report).toMatchObject({ moved: [], pictures: 0, replaced: 1 })
	})

	// spec: MOVE-003.6
	it('counts a file the response leaves out as failed', () => {
		const report = moveReport([filesOf(SINGLE)], [])

		expect(report.failed).toEqual([{ file: filesOf(SINGLE)[0], result: 'failed' }])
	})
})

describe('undoRequest', () => {
	// spec: MOVE-003.7
	it('sends every moved file back to its old path by its new id, a picture per list', () => {
		const report = moveReport(SENT, [
			[moved(2, '/Out/X.JPG'), moved(1, '/Out/X.RAF', 10), moved(3, '/Out/X.xmp')],
			[moved(4, '/In/B.JPG')],
			[moved(5, '/Out/C.JPG', 50)],
		])

		expect(undoRequest(report)).toEqual([
			[{ fileId: 2, etag: 'etag-2', path: '/In/A.JPG' }, { fileId: 10, etag: 'etag-10', path: '/In/A.RAF' }, { fileId: 3, etag: 'etag-3', path: '/In/A.xmp' }],
			[{ fileId: 50, etag: 'etag-50', path: '/In/C.JPG' }],
		])
	})
})

describe('undoneEntries', () => {
	// spec: MOVE-004.11
	it('gives each file moved back its old entry at its old path with its id and ETag of the answer', () => {
		const report = moveReport(SENT.slice(0, 2), [[moved(2, '/Out/X.JPG'), moved(1, '/Out/X.RAF'), moved(3, '/Out/X.xmp')], [moved(4, '/Out/B.JPG')]])

		const undone = undoneEntries(report, [
			[moved(2, '/In/A.JPG', 2), moved(1, '/In/A.RAF', 11), { fileId: 3, result: 'locked', replaced: false }],
			[{ fileId: 4, result: 'moved', replaced: false }],
		])

		expect(undone.entries).toEqual([
			{ ...PAIR.rendered, path: '/In/A.JPG', fileId: 2, etag: 'etag-2' },
			{ ...PAIR.raw, path: '/In/A.RAF', fileId: 11, etag: 'etag-11' },
		])
		expect(undone.failed).toBe(2)
	})
})
