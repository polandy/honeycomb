// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ImmichEntry } from '../../../src/logic/immich-asset.ts'
import type { Calendar } from '../../../src/logic/immich-filters.ts'
import type { CheckedAsset, WriteCandidate, WrittenState } from '../../../src/logic/immich-write-plan.ts'

import { UNDECIDED } from '../../../src/logic/decision.ts'

const MS_PER_SECOND = 1000

/** A calendar in UTC, so tests do not depend on the machine's time zone. */
export const UTC_CALENDAR: Calendar = {
	monthOf: (seconds) => {
		const date = new Date(seconds * MS_PER_SECOND)
		return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
	},
	monthStart: (year, month) => Date.UTC(year, month - 1, 1) / MS_PER_SECOND,
}

/** 20 November 2026, 12:00 UTC. */
export const NOW = Date.UTC(2026, 10, 20, 12) / MS_PER_SECOND

/** An undecided photo listed by the Immich source. */
export function immichEntry(assetId: string, overrides: Partial<ImmichEntry> = {}): ImmichEntry {
	return {
		assetId,
		name: `${assetId}.jpg`,
		takenAt: NOW,
		cameraModel: 'Pixel 9 Pro',
		kind: 'photo',
		width: 4000,
		height: 3000,
		duration: null,
		stackSize: null,
		updatedAt: '2026-11-20T12:00:00.000Z',
		...UNDECIDED,
		...overrides,
	}
}

/** Immich's `updatedAt` of an asset when its decision was saved. */
export const DECIDED_AT = '2026-11-20T10:00:00.000Z'

/** A write candidate with the decision's fields over an undecided one, decided at `DECIDED_AT`. */
export function candidate(assetId: string, decision: Partial<Decision>, written: WrittenState | null = null): WriteCandidate {
	return { assetId, decision: { ...UNDECIDED, ...decision }, written, decidedUpdatedAt: DECIDED_AT }
}

/** An asset as the write check reloads it, unchanged since `DECIDED_AT`, unless the fields say otherwise. */
export function checked(assetId: string, fields: Partial<CheckedAsset> = {}): CheckedAsset {
	return { assetId, updatedAt: DECIDED_AT, rating: null, favorite: false, trashed: false, archived: false, sharedAlbum: null, stackSize: null, ...fields }
}
