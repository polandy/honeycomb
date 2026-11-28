// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { pendingCount } from '../../../src/logic/immich-write-pending.ts'
import { candidate } from './immich-fixtures.ts'

const WRITTEN_REJECT = { flag: 'rejected', rating: 0, immichRating: null } as const

describe('pendingCount', () => {
	// spec: IMMICH-004.27
	it('counts the pending candidates', () => {
		expect(pendingCount([], new Map())).toBe(0)
		expect(pendingCount([candidate('r1', { flag: 'rejected' }), candidate('w1', { flag: 'rejected' }, WRITTEN_REJECT), candidate('c1', { colourLabel: 'red' })], new Map())).toBe(1)
	})

	// spec: IMMICH-004.27
	it('counts each decision made since by what was last written for its asset', () => {
		const candidates = [candidate('r1', { flag: 'rejected' }), candidate('w1', { flag: 'rejected' }, WRITTEN_REJECT)]
		const decided = new Map([
			['r1', UNDECIDED],
			['w1', { ...UNDECIDED, flag: 'picked' as const }],
			['n1', { ...UNDECIDED, rating: 2 }],
			['n2', { ...UNDECIDED, keepRaw: true }],
		])

		expect(pendingCount(candidates, decided)).toBe(2)
		expect(pendingCount(candidates, new Map([['w1', { ...UNDECIDED, flag: 'rejected' as const }]]))).toBe(1)
	})
})
