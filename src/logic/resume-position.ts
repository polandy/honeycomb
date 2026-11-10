// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { FolderSet } from './folder-set.ts'
import type { Picture } from './pairing.ts'

import { isDecided } from './decision.ts'
import { folderSetKey } from './folder-set.ts'

/** Where a user stands in a folder set, as the positions endpoint stores it (ADR 0012). */
export interface ResumePosition {
	readonly folderSet: FolderSet
	readonly fileId: number
	readonly decided: number
	readonly total: number
}

/** The well-formed positions of an answer, in its order; anything else is dropped. */
export function parsePositions(answer: unknown): ResumePosition[] {
	if (!Array.isArray(answer)) {
		return []
	}
	return answer.filter(isPosition).map(({ folderSet, fileId, decided, total }) => ({ folderSet: { paths: folderSet.paths, subfolders: folderSet.subfolders }, fileId, decided, total }))
}

/** The position of the folder set, whatever the order of its paths, or null. */
export function positionOf(positions: readonly ResumePosition[], set: FolderSet): ResumePosition | null {
	const key = folderSetKey(set)
	return positions.find((position) => folderSetKey(position.folderSet) === key) ?? null
}

/** The file a position names a picture by: its rendered member, a RAW alone by itself. */
export function positionFileId(picture: Picture<{ readonly fileId: number }>): number {
	return (picture.rendered ?? picture.raw)!.fileId
}

/** The picture with the file as any member, or null. */
export function pictureHolding<P extends Picture<{ readonly fileId: number }>>(pictures: readonly P[], fileId: number): P | null {
	return pictures.find((picture) => picture.raw?.fileId === fileId || picture.rendered?.fileId === fileId) ?? null
}

/** Where the loupe resumes: at the picture, else at the first undecided one of the view, else at the first; -1 for an empty view. */
export function resumeIndex<P>(view: readonly P[], picture: P, decisionOf: (picture: P) => Decision): number {
	const at = view.indexOf(picture)
	if (at >= 0) {
		return at
	}
	const undecided = view.findIndex((shown) => !isDecided(decisionOf(shown)))
	return undecided >= 0 ? undecided : view.length > 0 ? 0 : -1
}

/** Whether a value is a position with a whole file id and `decided` within `total`. */
function isPosition(value: unknown): value is ResumePosition {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	const { folderSet, fileId, decided, total } = value as Record<string, unknown>
	return typeof folderSet === 'object' && folderSet !== null
		&& Array.isArray((folderSet as FolderSet).paths) && (folderSet as FolderSet).paths.every((path) => typeof path === 'string')
		&& typeof (folderSet as FolderSet).subfolders === 'boolean'
		&& Number.isInteger(fileId) && (fileId as number) >= 1
		&& Number.isInteger(total) && Number.isInteger(decided) && (decided as number) >= 0 && (decided as number) <= (total as number)
}
