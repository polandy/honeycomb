// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ShallowRef } from 'vue'
import type { useCullFlags } from './cull-flags.ts'
import type { SidecarWrites } from './cull-seams.ts'
import type { Decision, DecisionField, StoredDecision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { CountSign } from './logic/stats-counts.ts'

import { logger } from './logger.ts'
import { changedFields, takenBack, withRows } from './logic/decision-change.ts'
import { FLAG_FIELDS, pictureDecision } from './logic/decision.ts'
import { memberIds } from './logic/pairing.ts'
import { countsByRow, fieldCounts, flagCounts } from './logic/stats-counts.ts'

/** What the writes read of the open cull of Nextcloud folders. */
export interface CullWriteState {
	readonly decisions: ShallowRef<ReadonlyMap<PictureId, Decision>>
	readonly pictures: () => readonly Picture<ListingEntry>[]
	/** Whether a step on the picture is saved and written through (XMP-008.12). */
	readonly writesThrough: (picture: Picture<ListingEntry>) => boolean
	/** Whether the flag fields are written through to the sidecars too (XMP-003.43). */
	readonly writeFlags: () => boolean
	/** Hears how many photos got their flag back. */
	readonly onFlagsNotSaved: (photos: number) => void
}

/** The Nextcloud-only writes of a step's rows: flags to the flag table, the other fields to the sidecars. */
export function useCullWrites(flags: ReturnType<typeof useCullFlags>, sidecars: SidecarWrites, state: CullWriteState) {
	const decisionOf = (picture: Picture<ListingEntry>) => pictureDecision(picture, state.decisions.value)

	/** Saves the flags of the rows changed from `before` and writes their fields through with what they count, by the sign; a failed save, or a failed write of a field other than a flag, is taken back (XMP-003.37, .38, .44, XMP-008.15, .17, STATS-001). */
	function write(rows: readonly StoredDecision[], before: ReadonlyMap<PictureId, Decision>, sign: CountSign) {
		const after = state.decisions.value
		const fields = changedFields(rows, before)
		const fileIds = new Set(rows.map(({ fileId }) => fileId))
		const written = state.pictures().filter((picture) => memberIds(picture).some((fileId) => fileIds.has(fileId)) && state.writesThrough(picture))
		const writtenRows = rowsOf(rows, written)
		const flagFields = fields.filter((field) => FLAG_FIELDS.includes(field))
		const sidecarFields = fields.filter((field) => !FLAG_FIELDS.includes(field))
		const writtenFields = state.writeFlags() ? [...flagFields, ...sidecarFields] : sidecarFields
		if (writtenRows.length > 0 && flagFields.length > 0) {
			void flags.save(writtenRows, countsByRow(written, writtenRows, (picture) => flagCounts(pictureDecision(picture, before).flag, pictureDecision(picture, after).flag))).then((notSaved) => {
				const back = written.filter((picture) => memberIds(picture).some((fileId) => notSaved.has(fileId)))
				if (back.length > 0) {
					takeBack(rowsOf(writtenRows, back), before, flagFields)
					state.onFlagsNotSaved(back.length)
				}
			})
		}
		if (written.length > 0 && writtenFields.length > 0) {
			sidecars.write(written, decisionOf, writtenFields, undefined, (picture) => fieldCounts(pictureDecision(picture, before), pictureDecision(picture, after), sign)).then(({ failed }) => {
				const failedPictures = new Set(failed.map(({ picture }) => picture))
				takeBack(rowsOf(writtenRows, written.filter((picture) => failedPictures.has(picture))), before, sidecarFields)
			}, (error: unknown) => logger.error('Could not write the sidecars; the photos show them as changed', { error }))
		}
	}

	/** The rows of the pictures' members. */
	function rowsOf(rows: readonly StoredDecision[], of: readonly Picture<ListingEntry>[]): StoredDecision[] {
		const fileIds = new Set(of.flatMap(memberIds))
		return rows.filter(({ fileId }) => fileIds.has(fileId))
	}

	/** Takes the fields of the written rows back where they still hold what was written. */
	function takeBack(written: readonly StoredDecision[], before: ReadonlyMap<PictureId, Decision>, fields: readonly DecisionField[]) {
		if (written.length > 0) {
			state.decisions.value = withRows(state.decisions.value, takenBack(state.decisions.value, written, before, fields))
		}
	}

	return { write }
}
