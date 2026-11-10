// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

/** The most pictures one grid shows (plan.md, Multiple folders). */
export const PICTURE_CAP = 20_000

/** Where a picture sits for the grid's order. */
interface Placed {
	readonly folder: string
	readonly baseName: string
}

/** A run of pictures of one folder in an ordered list. */
export interface FolderGroup {
	readonly folder: string
	readonly start: number
	readonly count: number
}

/** The picture's capture time in Unix seconds; its file's modification time without one (plan.md, Sort order). */
export function captureTime(picture: Picture<ListingEntry>): number {
	const members = [picture.raw, picture.rendered].filter((member) => member !== null)
	const captured = members.find((member) => member.captureTime !== null)
	return captured?.captureTime ?? members[0]!.mtime
}

/** At most PICTURE_CAP pictures, the earliest by capture time, in their given order; `cut` when some were left out. */
export function capPictures(pictures: readonly Picture<ListingEntry>[]): { pictures: Picture<ListingEntry>[], cut: boolean } {
	if (pictures.length <= PICTURE_CAP) {
		return { pictures: [...pictures], cut: false }
	}
	const times = pictures.map(captureTime)
	const kept = pictures.map((_, index) => index)
		.sort((a, b) => times[a]! - times[b]!)
		.slice(0, PICTURE_CAP)
		.sort((a, b) => a - b)
	return { pictures: kept.map((index) => pictures[index]!), cut: true }
}

/** How the grid sorts pictures (Q18). */
export type SortOrder = 'file-name' | 'capture-time'

/** One folder starts by file name, several by capture time (plan.md, Sort order). */
export function defaultSortOrder(folderCount: number): SortOrder {
	return folderCount > 1 ? 'capture-time' : 'file-name'
}

/** The pictures sorted, by folder first when grouped; names compare with `compareNames`, ties by folder. */
export function sortPictures<P extends Picture<ListingEntry>>(pictures: readonly P[], order: SortOrder, compareNames: (a: string, b: string) => number, byFolder: boolean): P[] {
	const byName = (a: P, b: P) => compareNames(a.baseName, b.baseName) || compareNames(a.folder, b.folder)
	const times = new Map(order === 'capture-time' ? pictures.map((picture) => [picture, captureTime(picture)]) : [])
	const byOrder = order === 'capture-time' ? (a: P, b: P) => times.get(a)! - times.get(b)! || byName(a, b) : byName
	return [...pictures].sort(byFolder ? (a, b) => compareNames(a.folder, b.folder) || byOrder(a, b) : byOrder)
}

/** The runs of one folder in pictures already ordered by folder. */
export function groupByFolder(pictures: readonly Placed[]): FolderGroup[] {
	const groups: FolderGroup[] = []
	pictures.forEach(({ folder }, index) => {
		const last = groups.at(-1)
		if (last?.folder === folder) {
			groups[groups.length - 1] = { ...last, count: last.count + 1 }
		} else {
			groups.push({ folder, start: index, count: 1 })
		}
	})
	return groups
}
