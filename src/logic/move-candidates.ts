// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { MoveCandidate, PlannedPicture } from './move-plan.ts'
import type { NameTemplate } from './name-template/parse.ts'
import type { MemberFile, PictureFacts } from './name-template/render.ts'
import type { Picture } from './pairing.ts'

import { filesOf } from './delete-summary.ts'
import { renderPicture } from './name-template/render.ts'

/** The minutes east of UTC at a file time, the offset that turns it into local time. */
export type MtimeOffset = (mtime: number) => number

/** Why a picture cannot be named. */
export type NamingProblem = Extract<ReturnType<typeof renderPicture>, { ok: false }>['problem']

/** A picture of the move dialog and its candidate, or why it has none. */
export interface NamedPicture {
	readonly picture: Picture<ListingEntry>
	readonly candidate: MoveCandidate | null
	readonly problem: NamingProblem | null
}

const MS_PER_SECOND = 1000

/** The browser's offset at the file time. */
export const browserOffset: MtimeOffset = (mtime) => -new Date(mtime * MS_PER_SECOND).getTimezoneOffset()

/** The pictures in view order, those outside the view last in their order. */
export function inViewOrder<P>(pictures: readonly P[], view: readonly P[]): P[] {
	const position = new Map(view.map((picture, index) => [picture, index]))
	const at = (picture: P) => position.get(picture) ?? view.length
	return pictures.toSorted((a, b) => at(a) - at(b))
}

/** The picture's values: times and camera of the rendered member, else of the RAW member. */
export function pictureFacts(picture: Picture<ListingEntry>, offset: MtimeOffset): PictureFacts {
	const member = (picture.rendered ?? picture.raw)!
	return { baseName: picture.baseName, captureTime: member.captureTime, mtime: member.mtime, mtimeOffsetMinutes: offset(member.mtime), make: null, model: member.camera }
}

/** Each file of the picture as the template reads it, in `filesOf` order. */
export function memberFiles(picture: Picture<ListingEntry>): MemberFile[] {
	return filesOf(picture).map(({ entry }) => {
		const slash = entry.path.lastIndexOf('/')
		const folder = entry.path.slice(0, slash)
		return {
			extension: entry.path.slice(slash + 1 + picture.baseName.length + 1),
			subfolder: folder === picture.folder ? null : folder.slice(folder.lastIndexOf('/') + 1),
		}
	})
}

/** Every picture with its files and where the template puts them, or why it cannot be named. */
export function nameCandidates(pictures: readonly Picture<ListingEntry>[], template: NameTemplate, offset: MtimeOffset = browserOffset): NamedPicture[] {
	return pictures.map((picture) => {
		const rendered = renderPicture(template, pictureFacts(picture, offset), memberFiles(picture))
		return rendered.ok
			? { picture, candidate: { files: filesOf(picture), rendered: rendered.files }, problem: null }
			: { picture, candidate: null, problem: rendered.problem }
	})
}

/** The files the plan sends and its pictures in conflict. */
export function moveCounts(plan: readonly PlannedPicture[]): { files: number, conflicts: number } {
	return {
		files: plan.filter((picture) => picture.sent).reduce((sum, picture) => sum + picture.files.length, 0),
		conflicts: plan.filter((picture) => picture.inConflict).length,
	}
}
