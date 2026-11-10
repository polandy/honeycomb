// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

/** What a file is to its picture. */
export type FileRole = 'rendered' | 'raw' | 'sidecar'

/** One file a delete moves to the trash bin, with the picture it belongs to. */
export interface PictureFile {
	readonly entry: ListingEntry
	readonly role: FileRole
	readonly picture: Picture<ListingEntry>
}

/** How many pictures of a delete are in one folder. */
export interface FolderCount {
	readonly folder: string
	readonly pictures: number
}

/** What a delete moves to the trash bin, as the delete summary shows it. */
export interface DeleteSummary {
	readonly pictures: number
	readonly files: number
	readonly bytes: number
	readonly pairs: number
	readonly singles: number
	readonly folders: readonly FolderCount[]
}

/** Every file of a picture: its members, then every sidecar form (`docs/plan.md` Culling workflow). */
export function filesOf(picture: Picture<ListingEntry>): PictureFile[] {
	const members: [FileRole, ListingEntry | null][] = [['rendered', picture.rendered], ['raw', picture.raw]]
	return [
		...members.flatMap(([role, entry]) => (entry === null ? [] : [{ entry, role, picture }])),
		...picture.sidecars.map((entry) => ({ entry, role: 'sidecar' as const, picture })),
	]
}

/** The rejected pictures, in their order. */
export function rejectedPictures<P>(pictures: readonly P[], decisionOf: (picture: P) => Decision): P[] {
	return pictures.filter((picture) => decisionOf(picture).flag === 'rejected')
}

/** Pictures, files, bytes, pairs and singles of a delete, and its pictures per folder in first-seen order. */
export function deleteSummary(pictures: readonly Picture<ListingEntry>[]): DeleteSummary {
	const files = pictures.flatMap(filesOf)
	const pairs = pictures.filter((picture) => picture.raw !== null && picture.rendered !== null).length
	const folders = new Map<string, number>()
	for (const picture of pictures) {
		folders.set(picture.folder, (folders.get(picture.folder) ?? 0) + 1)
	}
	return {
		pictures: pictures.length,
		files: files.length,
		bytes: files.reduce((sum, file) => sum + file.entry.size, 0),
		pairs,
		singles: pictures.length - pairs,
		folders: [...folders].map(([folder, count]) => ({ folder, pictures: count })),
	}
}
