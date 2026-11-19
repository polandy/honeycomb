import type { Picture } from '../../src/logic/pairing.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FlagFields } from '../../src/logic/picture-flag.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { listedRows, pictureFlag, readDecision } from '../../src/logic/picture-flag.ts'

const NO_ROW: FlagFields = { flag: null, keepRaw: null, flagUpdated: null }

/** A pair of a RAW and a JPEG member with the given rows. */
function pair(raw: FlagFields, rendered: FlagFields): Picture<FlagFields> {
	return { raw, rendered, folder: '/Photos', baseName: 'IMG_1', sidecars: [], ambiguous: false }
}

describe('pictureFlag', () => {
	// spec: DECISIONS-001.28
	it('reads the member row changed last', () => {
		const picture = pair({ flag: 'rejected', keepRaw: false, flagUpdated: 1_800_000_060 }, { flag: 'picked', keepRaw: true, flagUpdated: 1_800_000_000 })

		expect(pictureFlag(picture)).toEqual({ flag: 'rejected', keepRaw: false })
	})

	// spec: DECISIONS-001.28
	it('reads the later JPEG row over an earlier RAW row', () => {
		const picture = pair({ flag: 'rejected', keepRaw: false, flagUpdated: 1_800_000_000 }, { flag: 'picked', keepRaw: true, flagUpdated: 1_800_000_060 })

		expect(pictureFlag(picture)).toEqual({ flag: 'picked', keepRaw: true })
	})

	// spec: DECISIONS-001.28
	it('reads the first member of rows saved in the same second', () => {
		const picture = pair({ flag: 'rejected', keepRaw: false, flagUpdated: 1_800_000_000 }, { flag: 'picked', keepRaw: true, flagUpdated: 1_800_000_000 })

		expect(pictureFlag(picture)).toEqual({ flag: 'rejected', keepRaw: false })
	})

	// spec: DECISIONS-001.28
	it('reads the one member with a row', () => {
		expect(pictureFlag(pair(NO_ROW, { flag: 'unflagged', keepRaw: true, flagUpdated: 1_800_000_000 }))).toEqual({ flag: 'unflagged', keepRaw: true })
	})

	// spec: DECISIONS-001.28
	it('reads nothing for a picture without any row, so it is not taken over yet', () => {
		expect(pictureFlag(pair(NO_ROW, NO_ROW))).toBeNull()
		expect(pictureFlag({ raw: null, rendered: NO_ROW, folder: '/Photos', baseName: 'IMG_2', sidecars: [], ambiguous: false })).toBeNull()
	})
})

describe('readDecision', () => {
	const stated = { ...UNDECIDED, rating: 3, colourLabel: 'red' as const, flag: 'picked' as const }

	// spec: XMP-003.35
	it('shows the listed flag and Keep RAW over the sidecars\' with their rating and colour label', () => {
		expect(readDecision({ flag: 'rejected', keepRaw: true }, stated)).toEqual({ ...stated, flag: 'rejected', keepRaw: true })
	})

	// spec: XMP-003.34
	it('shows what the sidecars state for a picture not taken over yet', () => {
		expect(readDecision(null, stated)).toEqual(stated)
	})
})

describe('listedRows', () => {
	// spec: XMP-003.35
	it('gives every member of a picture with a row the picture\'s flag, and nothing for one without', () => {
		const picked = { flag: 'picked', keepRaw: true, flagUpdated: 1_800_000_000 } as const
		const rows = listedRows([
			{ raw: { fileId: 1, ...picked }, rendered: { fileId: 2, ...NO_ROW }, folder: '/Photos', baseName: 'IMG_1', sidecars: [], ambiguous: false },
			{ raw: null, rendered: { fileId: 3, ...NO_ROW }, folder: '/Photos', baseName: 'IMG_2', sidecars: [], ambiguous: false },
		])

		expect(rows).toEqual([{ fileId: 1, ...UNDECIDED, flag: 'picked', keepRaw: true }, { fileId: 2, ...UNDECIDED, flag: 'picked', keepRaw: true }])
	})
})
