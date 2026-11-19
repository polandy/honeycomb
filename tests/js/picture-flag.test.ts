import type { Picture } from '../../src/logic/pairing.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FlagFields } from '../../src/logic/picture-flag.ts'

import { describe, expect, it } from 'vitest'
import { pictureFlag } from '../../src/logic/picture-flag.ts'

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
