// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NamingProblem } from './logic/move-candidates.ts'
import type { MoveFailure, MoveReport } from './logic/move-report.ts'

import { n, t } from '@nextcloud/l10n'
import { TrashBinOffError } from './api.ts'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'
import { folderName } from './logic/move-targets.ts'

/** Why a file did not move, in the user's words. */
export function moveFailureReason(result: MoveFailure): string {
	switch (result) {
		case 'notFound':
			return t('honeycomb', 'File is gone or no longer a photo; reload the folder')
		case 'changed':
			return t('honeycomb', 'File changed since the folder was listed; reload the folder, then move again')
		case 'notPermitted':
			return t('honeycomb', 'You may not move this file or write to the target folder')
		case 'locked':
			return t('honeycomb', 'File is locked (another process is writing to it)')
		case 'exists':
			return t('honeycomb', 'A file with this name appeared in the target folder; move again')
		case 'skipped':
			return t('honeycomb', 'Not tried, because another file of this photo failed')
		case 'movedBack':
			return t('honeycomb', 'Moved back, because another file of this photo failed')
		default:
			return t('honeycomb', 'Could not move the file')
	}
}

/** "1 failed" with the count formatted. */
const failedText = (count: number) => n('honeycomb', '{count} failed', '{count} failed', count, { count: formatNumber(count) }, PLAIN_TEXT)

/** The toast after a move: the one picture or the photos moved, or the files moved and failed; and when decisions stayed behind. */
export function movedText(report: MoveReport, target: string, newFileIds: boolean): string {
	const folder = folderName(target)
	const moved = report.moved.length
	let text: string
	if (report.failed.length > 0) {
		text = `${n('honeycomb', 'Moved {count} file to {folder}', 'Moved {count} files to {folder}', moved, { count: formatNumber(moved), folder }, PLAIN_TEXT)} · ${failedText(report.failed.length)}`
	} else if (report.pictures === 1) {
		text = t('honeycomb', 'Moved {name} to {folder}', { name: report.moved[0]!.file.picture.baseName, folder }, undefined, PLAIN_TEXT)
	} else {
		text = n('honeycomb', 'Moved {count} photo to {folder}', 'Moved {count} photos to {folder}', report.pictures, { count: formatNumber(report.pictures), folder }, PLAIN_TEXT)
	}
	return newFileIds ? `${text} · ${t('honeycomb', 'decisions did not move with the files')}` : text
}

/** The toast after *Undo* of a move. */
export function movedBackText(moved: number, failed: number): string {
	const text = n('honeycomb', 'Moved {count} file back', 'Moved {count} files back', moved, { count: formatNumber(moved) }, PLAIN_TEXT)
	return failed > 0 ? `${text} · ${failedText(failed)}` : text
}

/** The toast when the probe or the move request fails. */
export function moveFailedText(error: unknown): string {
	return error instanceof TrashBinOffError
		? t('honeycomb', 'The Nextcloud trash bin is off, so nothing was moved. honeycomb replaces files only into the trash bin.')
		: t('honeycomb', 'Could not move the photos; reload the folder to see what changed.')
}

/** The move summary's note on what a move keeps and what *Undo* does. */
export function moveNote(replace: boolean): string {
	return replace
		? t('honeycomb', 'Moved on the server: shares, tags, comments and decisions stay with the files. Undo moves them back; replaced files stay in the Nextcloud trash bin.')
		: t('honeycomb', 'Moved on the server: shares, tags, comments and decisions stay with the files. Undo moves them back.')
}

/** Why the name template cannot name a picture. */
export function namingProblemText(problem: NamingProblem): string {
	switch (problem) {
		case 'no-number':
			return t('honeycomb', 'cannot be named: its file name does not end in digits for {number}', { number: '{number}' }, undefined, PLAIN_TEXT)
	}
}
