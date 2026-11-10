// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { ConflictChoice, MoveCandidate, PlannedPicture } from '../../../src/logic/move-plan.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { filesOf } from '../../../src/logic/delete-summary.ts'
import { existingFiles, moveRequest, planMove, probeFolders } from '../../../src/logic/move-plan.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

const [PAIR, SINGLE, OTHER] = picturesOf([
	listingEntry(1, '/In/A.RAF', { mime: 'image/x-fuji-raf' }),
	listingEntry(2, '/In/A.JPG'),
	listingEntry(3, '/In/A.xmp'),
	listingEntry(4, '/In/B.JPG'),
	listingEntry(5, '/In/C.JPG'),
]) as [Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>]

/** The picture with every file rendered to `folder/name`, keeping its extension. */
function candidate(picture: Picture<ListingEntry>, name: string, folder = ''): MoveCandidate {
	const files = filesOf(picture)
	return { files, rendered: files.map(({ entry }) => ({ folder, name, extension: entry.path.slice(entry.path.indexOf('.') + 1) })) }
}

const existing = (...files: [string, number][]) => files.map(([path, fileId]) => ({ path, fileId, etag: `etag-${fileId}` }))
const pathsOf = (plan: readonly PlannedPicture[]) => plan.map((picture) => picture.files.map((file) => file.path))

describe('probeFolders', () => {
	// spec: MOVE-003.1
	it('lists each folder below the target once, in order of first use', () => {
		const candidates = [candidate(PAIR, 'X', '2026/11'), candidate(SINGLE, 'Y', '2026/11'), candidate(OTHER, 'Z')]

		expect(probeFolders('/Sorted', candidates)).toEqual(['/Sorted/2026/11', '/Sorted'])
	})

	// spec: MOVE-003.1
	it('joins below the root without a double slash', () => {
		expect(probeFolders('/', [candidate(SINGLE, 'Y', '2026'), candidate(OTHER, 'Z')])).toEqual(['/2026', '/'])
	})
})

describe('existingFiles', () => {
	// spec: MOVE-003.3
	it('turns the probe answer into the paths of the existing files', () => {
		const folders = [
			{ path: '/Out', children: [{ name: 'a.RAF', fileId: 9, etag: 'etag-9' }] },
			{ path: '/', children: [{ name: 'b.JPG', fileId: 8, etag: 'etag-8' }] },
		]

		expect(existingFiles(folders)).toEqual(existing(['/Out/a.RAF', 9], ['/b.JPG', 8]))
	})
})

describe('planMove', () => {
	// spec: MOVE-003.2
	it('joins every path below the target folder and keeps the suffix within the move', () => {
		const plan = planMove('/Out', [candidate(PAIR, 'X', '2026'), candidate(SINGLE, 'X', '2026')], [])

		expect(pathsOf(plan)).toEqual([['/Out/2026/X.JPG', '/Out/2026/X.RAF', '/Out/2026/X.xmp'], ['/Out/2026/X-2.JPG']])
		expect(plan.map((picture) => [picture.inConflict, picture.sent])).toEqual([[false, true], [false, true]])
	})

	// spec: MOVE-003.3
	it('counts a path taken in another letter case as a conflict, but not the file itself', () => {
		const taken = existing(['/out/x.jpg', 9], ['/In/B.JPG', 4])

		const plan = planMove('/Out', [candidate(PAIR, 'X')], taken)
		const own = planMove('/In', [candidate(SINGLE, 'B')], taken)

		expect(plan[0]).toMatchObject({ inConflict: true, files: [{ conflict: taken[0] }, { conflict: null }, { conflict: null }] })
		expect(own[0]).toMatchObject({ inConflict: false, files: [{ path: '/In/B.JPG', conflict: null }] })
	})

	// spec: MOVE-003.4
	it('adds the next free suffix to every file of a picture in conflict', () => {
		const taken = existing(['/Out/X.JPG', 9], ['/Out/X-2.RAF', 10])

		const plan = planMove('/Out', [candidate(PAIR, 'X'), candidate(SINGLE, 'X')], taken)

		expect(pathsOf(plan)).toEqual([['/Out/X-3.JPG', '/Out/X-3.RAF', '/Out/X-3.xmp'], ['/Out/X-2.JPG']])
		expect(plan.map((picture) => picture.inConflict)).toEqual([true, false])
		expect(plan.flatMap((picture) => picture.files).every((file) => file.replace === null)).toBe(true)
	})

	// spec: MOVE-003.5
	it('keeps a skipped picture out, replaces for Replace, and suffixes a conflict with a file the move takes away', () => {
		const taken = existing(['/In/E.JPG', 8], ['/In/D.JPG', 9], ['/In/B.JPG', 4])
		const choices: ConflictChoice[] = ['skip', 'replace', 'replace']

		const plan = planMove('/In', [candidate(PAIR, 'E'), candidate(SINGLE, 'D'), candidate(OTHER, 'B')], taken, (index) => choices[index]!)

		expect(pathsOf(plan)).toEqual([['/In/E.JPG', '/In/E.RAF', '/In/E.xmp'], ['/In/D.JPG'], ['/In/B-2.JPG']])
		expect(plan.map((picture) => [picture.inConflict, picture.sent])).toEqual([[true, false], [true, true], [true, true]])
		expect(moveRequest(plan)).toEqual([
			[{ fileId: 4, etag: 'etag-4', path: '/In/D.JPG', replace: { fileId: 9, etag: 'etag-9' } }],
			[{ fileId: 5, etag: 'etag-5', path: '/In/B-2.JPG' }],
		])
	})

	// spec: MOVE-003.5
	it('ignores the choice of a picture without a conflict', () => {
		const plan = planMove('/Out', [candidate(SINGLE, 'B')], [], () => 'skip')

		expect(moveRequest(plan)).toEqual([[{ fileId: 4, etag: 'etag-4', path: '/Out/B.JPG' }]])
	})
})
