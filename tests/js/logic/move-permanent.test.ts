// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { PlannedPicture } from '../../../src/logic/move-plan.ts'
import type { MoveResponseFile } from '../../../src/logic/move-report.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { filesOf } from '../../../src/logic/delete-summary.ts'
import { mergeMoveReports, permanentPlan, unkeptReplaces } from '../../../src/logic/move-permanent.ts'
import { moveRequest } from '../../../src/logic/move-plan.ts'
import { moveReport } from '../../../src/logic/move-report.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

const [PAIR, SINGLE, OTHER] = picturesOf([
	listingEntry(1, '/In/A.RAF', { mime: 'image/x-fuji-raf' }),
	listingEntry(2, '/In/A.JPG'),
	listingEntry(4, '/In/B.JPG'),
	listingEntry(5, '/In/C.JPG'),
]) as [Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>]

const held = (fileId: number, path: string) => ({ fileId, etag: `held-${fileId}`, path })

/** Each picture's files to `/Out` under their own names, each replacing the file held there. */
const PLAN: PlannedPicture[] = [PAIR, SINGLE, OTHER].map((picture) => ({
	files: filesOf(picture).map((file) => {
		const path = `/Out/${file.entry.path.slice('/In/'.length)}`
		const existing = held(90 + file.entry.fileId, path)
		return { file, path, conflict: existing, replace: existing }
	}),
	inConflict: true,
	sent: true,
}))
const SENT = PLAN.map((picture) => picture.files.map(({ file }) => file))
const moved = (fileId: number, path: string): MoveResponseFile => ({ fileId, result: 'moved', replaced: true, path, newFileId: fileId, etag: `moved-${fileId}` })
const FIRST = moveReport(SENT, [
	[{ fileId: 2, result: 'noTrashBin', replaced: false }, { fileId: 1, result: 'skipped', replaced: false }],
	[{ fileId: 4, result: 'tooLarge', replaced: false }],
	[moved(5, '/Out/C.JPG')],
])

describe('replace for good', () => {
	// spec: MOVE-003.8
	it('names each replace the trash bin would not keep with the existing file and its reason', () => {
		expect(unkeptReplaces(PLAN, FIRST).map(({ file, replace, result }) => [file.entry.fileId, replace.path, result])).toEqual([
			[2, '/Out/A.JPG', 'noTrashBin'],
			[4, '/Out/B.JPG', 'tooLarge'],
		])
	})

	// spec: MOVE-003.8
	it('sends their pictures again whole, permanent only on the unkept replaces', () => {
		const unkept = unkeptReplaces(PLAN, FIRST)

		expect(moveRequest(permanentPlan(PLAN, unkept), new Set(unkept.map(({ file }) => file.entry.fileId)))).toEqual([
			[
				{ fileId: 2, etag: 'etag-2', path: '/Out/A.JPG', replace: { fileId: 92, etag: 'held-92', permanent: true } },
				{ fileId: 1, etag: 'etag-1', path: '/Out/A.RAF', replace: { fileId: 91, etag: 'held-91' } },
			],
			[{ fileId: 4, etag: 'etag-4', path: '/Out/B.JPG', replace: { fileId: 94, etag: 'held-94', permanent: true } }],
		])
	})

	// spec: MOVE-003.8
	it('merges the second report: a file sent again counts by its second result', () => {
		const resent = permanentPlan(PLAN, unkeptReplaces(PLAN, FIRST)).map((picture) => picture.files.map(({ file }) => file))
		const second = moveReport(resent, [[moved(2, '/Out/A.JPG'), moved(1, '/Out/A.RAF')], [{ fileId: 4, result: 'changed', replaced: false }]])

		const merged = mergeMoveReports(FIRST, second)

		expect(merged.moved.map(({ fileId }) => fileId)).toEqual([5, 2, 1])
		expect(merged.failed.map(({ file, result }) => [file.entry.fileId, result])).toEqual([[4, 'changed']])
		expect(merged).toMatchObject({ pictures: 2, replaced: 3 })
	})

	// spec: MOVE-003.8
	it('finds nothing to send again when every replace moved', () => {
		const report = moveReport(SENT.slice(2), [[moved(5, '/Out/C.JPG')]])

		expect(unkeptReplaces(PLAN, report)).toEqual([])
		expect(permanentPlan(PLAN, [])).toEqual([])
	})
})
