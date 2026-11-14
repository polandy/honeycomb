// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { placeUnderAnchor } from '../../../src/logic/anchored-card.ts'

const ROOM = { overhang: 10, margin: 8 }

describe('placeUnderAnchor', () => {
	// spec: LOUPE-001.26
	it('ends the card past the anchor\'s end with its arrow at the anchor\'s centre', () => {
		expect(placeUnderAnchor({ left: 600, width: 100 }, 300, 1000, ROOM)).toEqual({ left: -190, arrow: 240 })
	})

	// spec: LOUPE-001.26
	it('keeps the card inside the box at its start', () => {
		expect(placeUnderAnchor({ left: 40, width: 60 }, 300, 375, ROOM)).toEqual({ left: -32, arrow: 62 })
	})

	// spec: LOUPE-001.26
	it('keeps the card inside the box at its end', () => {
		expect(placeUnderAnchor({ left: 900, width: 96 }, 300, 1000, ROOM)).toEqual({ left: -208, arrow: 256 })
	})
})
