// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PictureFile } from './delete-summary.ts'
import type { ListingEntry } from './listing.ts'
import type { MoveRequestFile } from './move-plan.ts'

/** Why the move endpoint left a file where it was, or put it back (ADR 0018). */
export type MoveFailure = 'notFound' | 'changed' | 'notPermitted' | 'locked' | 'exists' | 'failed' | 'skipped' | 'movedBack'

/** One file of the move response; `result` is checked here. */
export interface MoveResponseFile {
	readonly fileId: number
	readonly result: string
	readonly replaced: boolean
	readonly path?: string
	readonly newFileId?: number
	readonly etag?: string
}

/** A file that moved: where from, where to, and its id and ETag there. */
export interface MovedFile {
	readonly file: PictureFile
	readonly from: string
	readonly path: string
	readonly fileId: number
	readonly etag: string
}

/** A file that did not move, and why. */
export interface FailedMove {
	readonly file: PictureFile
	readonly result: MoveFailure
}

/** What a move did: the moved and failed files, the pictures whose files all moved and the files replaced. */
export interface MoveReport {
	readonly moved: readonly MovedFile[]
	readonly failed: readonly FailedMove[]
	readonly pictures: number
	readonly replaced: number
}

const FAILURES: ReadonlySet<string> = new Set<MoveFailure>(['notFound', 'changed', 'notPermitted', 'locked', 'exists', 'failed', 'skipped', 'movedBack'])

/** The report of a response; a file it leaves out, answers with an unknown result or moves without its new place counts as failed. */
export function moveReport(sent: readonly (readonly PictureFile[])[], response: readonly (readonly MoveResponseFile[])[]): MoveReport {
	const answers = new Map(response.flat().map((answer) => [answer.fileId, answer]))
	const moved: MovedFile[] = []
	const failed: FailedMove[] = []
	let pictures = 0
	let replaced = 0
	for (const files of sent) {
		let whole = true
		for (const file of files) {
			const answer = answers.get(file.entry.fileId)
			replaced += answer?.replaced === true ? 1 : 0
			if (answer?.result === 'moved' && answer.path !== undefined && answer.newFileId !== undefined && answer.etag !== undefined) {
				moved.push({ file, from: file.entry.path, path: answer.path, fileId: answer.newFileId, etag: answer.etag })
				continue
			}
			whole = false
			failed.push({ file, result: answer !== undefined && FAILURES.has(answer.result) ? answer.result as MoveFailure : 'failed' })
		}
		pictures += whole ? 1 : 0
	}
	return { moved, failed, pictures, replaced }
}

/** The move request that puts every moved file back, a picture per list; replaced files stay in the trash bin (ADR 0018). */
export function undoRequest(report: MoveReport): MoveRequestFile[][] {
	const byPicture = new Map<unknown, MoveRequestFile[]>()
	for (const { file, from, path, fileId, etag } of report.moved) {
		if (path === from) {
			continue
		}
		const files = byPicture.get(file.picture) ?? []
		files.push({ fileId, etag, path: from })
		byPicture.set(file.picture, files)
	}
	return [...byPicture.values()]
}

/** The listing entries of the files the undo moved back, at their old paths with the answer's id and ETag, and how many stayed. */
export function undoneEntries(report: MoveReport, response: readonly (readonly MoveResponseFile[])[]): { entries: ListingEntry[], failed: number } {
	const byNewId = new Map(report.moved.map((file) => [file.fileId, file]))
	const entries: ListingEntry[] = []
	let failed = 0
	for (const answer of response.flat()) {
		const moved = byNewId.get(answer.fileId)
		if (moved !== undefined && answer.result === 'moved' && answer.path !== undefined && answer.newFileId !== undefined && answer.etag !== undefined) {
			entries.push({ ...moved.file.entry, path: answer.path, fileId: answer.newFileId, etag: answer.etag })
		} else {
			failed++
		}
	}
	return { entries, failed }
}
