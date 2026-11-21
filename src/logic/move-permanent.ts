// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PictureFile } from './delete-summary.ts'
import type { ExistingFile, PlannedPicture } from './move-plan.ts'
import type { MoveReport } from './move-report.ts'
import type { UnkeptFailure } from './trash-report.ts'

/** A file whose replace the trash bin would not keep: the existing file it replaces and why (ADR 0048). */
export interface UnkeptReplace {
	readonly file: PictureFile
	readonly replace: ExistingFile
	readonly result: UnkeptFailure
}

const UNKEPT: ReadonlySet<string> = new Set<UnkeptFailure>(['noTrashBin', 'tooLarge'])

/** The failed files of a report whose replace the trash bin would not keep, with the file they replace. */
export function unkeptReplaces(plan: readonly PlannedPicture[], report: MoveReport): UnkeptReplace[] {
	const replaces = new Map(plan.flatMap((picture) => picture.files).map(({ file, replace }) => [file.entry, replace]))
	return report.failed.flatMap(({ file, result }) => {
		const replace = replaces.get(file.entry)
		return UNKEPT.has(result) && replace !== undefined && replace !== null ? [{ file, replace, result: result as UnkeptFailure }] : []
	})
}

/** The planned pictures that hold an unkept replace, to send again whole. */
export function permanentPlan(plan: readonly PlannedPicture[], unkept: readonly UnkeptReplace[]): PlannedPicture[] {
	const entries = new Set(unkept.map(({ file }) => file.entry))
	return plan.filter((picture) => picture.sent && picture.files.some(({ file }) => entries.has(file.entry)))
}

/** Both requests of a move as one report; a file sent again counts only by its second result. */
export function mergeMoveReports(first: MoveReport, second: MoveReport): MoveReport {
	const resent = new Set([...second.moved, ...second.failed].map(({ file }) => file.entry))
	return {
		moved: [...first.moved, ...second.moved],
		failed: [...first.failed.filter(({ file }) => !resent.has(file.entry)), ...second.failed],
		pictures: first.pictures + second.pictures,
		replaced: first.replaced + second.replaced,
	}
}
