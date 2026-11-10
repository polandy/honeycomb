// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { MoveFailure, MoveReport } from '../../src/logic/move-report.ts'

import { describe, expect, it } from 'vitest'
import { TrashBinOffError } from '../../src/api.ts'
import { filesOf } from '../../src/logic/delete-summary.ts'
import { movedBackText, movedText, moveFailedText, moveFailureReason, moveNote, namingProblemText } from '../../src/move-text.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const FAILURES: MoveFailure[] = ['notFound', 'changed', 'notPermitted', 'locked', 'exists', 'failed', 'skipped', 'movedBack']
const [FILE] = filesOf(pictureOf(listingEntry(1, '/In/DSC_1.JPG')))
const moved = { file: FILE!, from: '/In/DSC_1.JPG', path: '/Out/DSC_1.JPG', fileId: 1, etag: 'e' }

/** A report of `count` moved files and `failed` failed ones, `pictures` of them whole. */
function report(count: number, failed: number, pictures: number): MoveReport {
	return {
		moved: Array.from({ length: count }, () => moved),
		failed: Array.from({ length: failed }, () => ({ file: FILE!, result: 'locked' as const })),
		pictures,
		replaced: 0,
	}
}

describe('move texts', () => {
	// spec: MOVE-004.12
	it('names each reason a file did not move in its own words', () => {
		expect(new Set(FAILURES.map(moveFailureReason)).size).toBe(FAILURES.length)
	})

	// spec: MOVE-004.9
	it('names the one picture or counts the photos, and names the folder', () => {
		expect(movedText(report(1, 0, 1), '/Photos/Best', false)).toBe('Moved DSC_1 to Best')
		expect(movedText(report(3, 0, 2), '/Photos/Best', false)).toBe('Moved 2 photos to Best')
	})

	// spec: MOVE-004.12
	it('counts moved and failed files', () => {
		expect(movedText(report(3, 1, 1), '/Photos/Best', false)).toBe('Moved 3 files to Best · 1 failed')
	})

	// spec: MOVE-004.14
	it('adds that decisions did not move when a file got a new file id', () => {
		expect(movedText(report(1, 0, 1), '/Photos/Best', true)).toBe('Moved DSC_1 to Best · decisions did not move with the files')
	})

	// spec: MOVE-004.11
	it('counts the files moved back and those that stayed', () => {
		expect(movedBackText(2, 0)).toBe('Moved 2 files back')
		expect(movedBackText(1, 1)).toBe('Moved 1 file back · 1 failed')
	})

	// spec: MOVE-004.13
	it('says the trash bin is off, or that the move failed', () => {
		expect(moveFailedText(new TrashBinOffError('off'))).toContain('trash bin is off')
		expect(moveFailedText(new Error('down'))).toBe('Could not move the photos; reload the folder to see what changed.')
	})

	// spec: MOVE-004.7
	it('says replaced files stay in the trash bin only with a Replace', () => {
		expect(moveNote(false)).toBe('Moved on the server: shares, tags, comments and decisions stay with the files. Undo moves them back.')
		expect(moveNote(true)).toBe('Moved on the server: shares, tags, comments and decisions stay with the files. Undo moves them back; replaced files stay in the Nextcloud trash bin.')
	})

	// spec: MOVE-004.15
	it('says why a picture cannot be named', () => {
		expect(namingProblemText('no-number')).toBe('cannot be named: its file name does not end in digits for {number}')
	})
})
