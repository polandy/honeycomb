// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PictureFile } from './delete-summary.ts'
import type { ListingEntry } from './listing.ts'
import type { PairingSettings, Picture } from './pairing.ts'

import { filesOf } from './delete-summary.ts'
import { pairPictures } from './pairing.ts'

/** Why the trash endpoint left a file where it was (ADR 0013). */
export type TrashFailure = 'notFound' | 'changed' | 'notPermitted' | 'noTrashBin' | 'tooLarge' | 'locked' | 'failed' | 'skipped' | 'decisionChanged'

/** The state the server checks a picture's rows against before deleting it (ADR 0040). */
export type TrashExpectation = 'rejected' | 'rawRemovable'

/** The failures of a file the trash bin would not keep, which the user may delete permanently (ADR 0036). */
export type UnkeptFailure = 'noTrashBin' | 'tooLarge'

/** The files of each picture to send, a picture per list. */
export type TrashBatch = readonly (readonly PictureFile[])[]

/** One file of the trash request, with the ETag from the listing; `permanent` once the user confirmed deleting it for good. */
export interface TrashRequestFile {
	readonly fileId: number
	readonly etag: string
	readonly permanent?: true
}

/** One file of the trash response; `result` is checked here. */
export interface TrashResponseFile {
	readonly fileId: number
	readonly result: string
}

/** A file that stayed, and why. */
export interface FailedFile {
	readonly file: PictureFile
	readonly result: TrashFailure
}

/** A file the trash bin would not keep, and why. */
export interface UnkeptFile {
	readonly file: PictureFile
	readonly result: UnkeptFailure
}

/** What a delete did: the files in the trash bin, those deleted permanently, the failed ones, the pictures whose sent members all went and the bytes freed. */
export interface TrashReport {
	readonly trashed: readonly PictureFile[]
	readonly deleted: readonly PictureFile[]
	readonly failed: readonly FailedFile[]
	readonly removed: number
	readonly bytes: number
}

const FAILURES: ReadonlySet<string> = new Set<TrashFailure>(['notFound', 'changed', 'notPermitted', 'noTrashBin', 'tooLarge', 'locked', 'failed', 'skipped', 'decisionChanged'])

const UNKEPT: ReadonlySet<TrashFailure> = new Set<UnkeptFailure>(['noTrashBin', 'tooLarge'])

/** Every file of each picture. */
export function wholePictures(pictures: readonly Picture<ListingEntry>[]): PictureFile[][] {
	return pictures.map(filesOf)
}

/** The request body's pictures (ADR 0013), with `permanent` on the files given (ADR 0036). */
export function trashRequest(batch: TrashBatch, permanent: ReadonlySet<number> = new Set()): TrashRequestFile[][] {
	return batch.map((files) => files.map(({ entry }) => (permanent.has(entry.fileId)
		? { fileId: entry.fileId, etag: entry.etag, permanent: true }
		: { fileId: entry.fileId, etag: entry.etag })))
}

/** The report of a response; a file it leaves out or answers with an unknown result counts as failed. */
export function trashReport(batch: TrashBatch, response: readonly (readonly TrashResponseFile[])[]): TrashReport {
	const results = new Map(response.flat().map((file) => [file.fileId, file.result]))
	const trashed: PictureFile[] = []
	const deleted: PictureFile[] = []
	const failed: FailedFile[] = []
	for (const file of batch.flat()) {
		const result = results.get(file.entry.fileId) ?? 'failed'
		if (result === 'trashed') {
			trashed.push(file)
		} else if (result === 'deleted') {
			deleted.push(file)
		} else {
			failed.push({ file, result: FAILURES.has(result) ? result as TrashFailure : 'failed' })
		}
	}
	const gone = [...trashed, ...deleted]
	const goneEntries = new Set(gone.map((file) => file.entry))
	const removed = batch.filter((files) => files.some((file) => file.role !== 'sidecar') && files.every((file) => file.role === 'sidecar' || goneEntries.has(file.entry))).length
	return { trashed, deleted, failed, removed, bytes: gone.reduce((sum, file) => sum + file.entry.size, 0) }
}

/** The failed files grouped by their picture. */
function byPicture(failed: readonly FailedFile[]): PictureFile[][] {
	const grouped = new Map<Picture<ListingEntry>, PictureFile[]>()
	for (const { file } of failed) {
		grouped.set(file.picture, [...(grouped.get(file.picture) ?? []), file])
	}
	return [...grouped.values()]
}

/** The report without the files the server kept because their rows no longer said the expected state, and those pictures, each once. */
export function decisionChanges(report: TrashReport): { report: TrashReport, changed: Picture<ListingEntry>[] } {
	const changed = report.failed.filter(({ result }) => result === 'decisionChanged')
	const failed = report.failed.filter(({ result }) => result !== 'decisionChanged')
	return { report: { ...report, failed }, changed: [...new Set(changed.map(({ file }) => file.picture))] }
}

/** The failed and skipped files of a report again, grouped by their picture. */
export function retryBatch(report: TrashReport): PictureFile[][] {
	return byPicture(report.failed)
}

/** The files of a report the trash bin would not keep (ADR 0036). */
export function unkeptFiles(report: TrashReport): UnkeptFile[] {
	return report.failed.filter((failed): failed is UnkeptFile => UNKEPT.has(failed.result))
}

/** The failed files of the pictures with a file the trash bin would not keep, grouped by their picture, to send again. */
export function permanentBatch(report: TrashReport): PictureFile[][] {
	const pictures = new Set(unkeptFiles(report).map(({ file }) => file.picture))
	return byPicture(report.failed.filter(({ file }) => pictures.has(file.picture)))
}

/** Both requests of a delete as one report; a file sent again counts only by its second result. */
export function mergeReports(first: TrashReport, second: TrashReport): TrashReport {
	const resent = new Set([...second.trashed, ...second.deleted, ...second.failed.map(({ file }) => file)].map((file) => file.entry))
	return {
		trashed: [...first.trashed, ...second.trashed],
		deleted: [...first.deleted, ...second.deleted],
		failed: [...first.failed.filter(({ file }) => !resent.has(file.entry)), ...second.failed],
		removed: first.removed + second.removed,
		bytes: first.bytes + second.bytes,
	}
}

/** The pictures without the files; an affected picture is paired again from what is left, or dropped. */
export function withoutFiles(pictures: readonly Picture<ListingEntry>[], fileIds: ReadonlySet<number>, settings: PairingSettings) {
	const replaced = new Map<Picture<ListingEntry>, Picture<ListingEntry> | null>()
	const kept = pictures.flatMap((picture) => {
		const files = filesOf(picture)
		if (!files.some((file) => fileIds.has(file.entry.fileId))) {
			return [picture]
		}
		const again = pairPictures(files.map((file) => file.entry).filter((entry) => !fileIds.has(entry.fileId)), settings)
		replaced.set(picture, again[0] ?? null)
		return again
	})
	return { pictures: kept, replaced }
}

/** A snapshot of pictures after a delete, at what replaced the shown one or the next left; null when none is left. */
export function followReplaced<P>(pictures: readonly P[], index: number, replaced: ReadonlyMap<P, P | null>): { pictures: P[], index: number } | null {
	const follow = (picture: P): P | null => (replaced.has(picture) ? replaced.get(picture) ?? null : picture)
	const kept = (list: readonly P[]) => list.map(follow).filter((picture): picture is P => picture !== null)
	const left = kept(pictures)
	const before = kept(pictures.slice(0, index)).length
	return left.length === 0 ? null : { pictures: left, index: Math.min(before, left.length - 1) }
}
