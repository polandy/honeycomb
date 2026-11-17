// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { nameParts } from '../../../src/logic/name-bar.ts'

describe('nameParts', () => {
	it.each([
		['IMG_1234', 'IMG', '_1234'],
		['2026-11-17 wedding party-0042', '2026-11-17 wedding party', '-0042'],
		['DSC.98765', 'DSC', '.98765'],
		['shot7', 'shot', '7'],
		['scan 12345678901234', 'scan 1234', '5678901234'],
		['20261117', '', '20261117'],
	// spec: GRID-004.5
	])('keeps the trailing number of %s whole', (name, head, tail) => {
		expect(nameParts(name)).toEqual({ head, tail })
	})

	// spec: GRID-004.5
	it('keeps the last characters of a name without a trailing number', () => {
		expect(nameParts('sunset over the lake')).toEqual({ head: 'sunset over the ', tail: 'lake' })
	})

	// spec: GRID-004.5
	it('keeps a short name in the head', () => {
		expect(nameParts('sky')).toEqual({ head: 'sky', tail: '' })
	})
})
