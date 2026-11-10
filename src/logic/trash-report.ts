// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PictureFile } from './delete-summary.ts'
import type { ListingEntry } from './listing.ts'
import type { PairingSettings, Picture } from './pairing.ts'

import { filesOf } from './delete-summary.ts'
import { pairPictures } from './pairing.ts'

/** Why the trash endpoint left a file where it was (ADR 0013). */
export type TrashFailure = 'notFound' | 'changed' | 'notPermitted' | 'locked' | 'failed' | 'skipped'

/** The files of each picture to send, a picture per list. */
export type TrashBatch = readonly (readonly PictureFile[])[]

/** One file of the trash request, with the ETag from the listing. */
export interface TrashRequestFile {
	readonly fileId: number
	readonly etag: string
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

/** What a delete did: the files in the trash bin, the failed ones, the pictures whose sent members all went and the bytes freed. */
export interface TrashReport {
	readonly trashed: readonly PictureFile[]
	readonly failed: readonly FailedFile[]
	readonly removed: number
	readonly bytes: number
}

const FAILURES: ReadonlySet<string> = new Set<TrashFailure>(['notFound', 'changed', 'notPermitted', 'locked', 'failed', 'skipped'])

/** Every file of each picture. */
export function wholePictures(pictures: readonly Picture<ListingEntry>[]): PictureFile[][] {
	return pictures.map(filesOf)
}

/** The request body's pictures (ADR 0013). */
export function trashRequest(batch: TrashBatch): TrashRequestFile[][] {
	return batch.map((files) => files.map(({ entry }) => ({ fileId: entry.fileId, etag: entry.etag })))
}

/** The report of a response; a file it leaves out or answers with an unknown result counts as failed. */
export function trashReport(batch: TrashBatch, response: readonly (readonly TrashResponseFile[])[]): TrashReport {
	const results = new Map(response.flat().map((file) => [file.fileId, file.result]))
	const trashed: PictureFile[] = []
	const failed: FailedFile[] = []
	for (const file of batch.flat()) {
		const result = results.get(file.entry.fileId) ?? 'failed'
		if (result === 'trashed') {
			trashed.push(file)
		} else {
			failed.push({ file, result: FAILURES.has(result) ? result as TrashFailure : 'failed' })
		}
	}
	const gone = new Set(trashed.map((file) => file.entry))
	const removed = batch.filter((files) => files.some((file) => file.role !== 'sidecar') && files.every((file) => file.role === 'sidecar' || gone.has(file.entry))).length
	return { trashed, failed, removed, bytes: trashed.reduce((sum, file) => sum + file.entry.size, 0) }
}

/** The failed and skipped files of a report again, grouped by their picture. */
export function retryBatch(report: TrashReport): PictureFile[][] {
	const byPicture = new Map<Picture<ListingEntry>, PictureFile[]>()
	for (const { file } of report.failed) {
		byPicture.set(file.picture, [...(byPicture.get(file.picture) ?? []), file])
	}
	return [...byPicture.values()]
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
