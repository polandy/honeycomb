// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { CARD_CHROME_HEIGHT, CARD_FRAME, CARD_GAP, compareGrid, PHOTO_ASPECT, rowStep } from '../../../src/logic/compare-grid.ts'

/** The height `rows` rows of cards with photos `photoWidth` wide take. */
const heightOf = (rows: number, photoWidth: number) => rows * (photoWidth / PHOTO_ASPECT + CARD_CHROME_HEIGHT) + (rows - 1) * CARD_GAP

describe('compareGrid', () => {
	// spec: SERIES-001.21
	it('puts a series of 5 in 2 columns on a phone and in 3 on an iPad and a desktop', () => {
		expect(compareGrid({ count: 5, width: 366, height: 700 }).columns).toBe(2)
		expect(compareGrid({ count: 5, width: 1000, height: 634 }).columns).toBe(3)
		expect(compareGrid({ count: 5, width: 1416, height: 760 }).columns).toBe(3)
	})

	// spec: SERIES-001.21
	it('picks the column count with the largest photo that still fits the area', () => {
		const grid = compareGrid({ count: 2, width: 1416, height: 760 })

		expect(grid).toEqual({ columns: 2, photoWidth: (1416 - CARD_GAP) / 2 - CARD_FRAME, scrolls: false })
		const tall = compareGrid({ count: 2, width: 400, height: 1000 })
		expect(tall.columns).toBe(1)
		expect(heightOf(2, tall.photoWidth)).toBeLessThanOrEqual(1000)
	})

	// spec: SERIES-001.21
	it('is limited by the height when the rows would not fit at the full width', () => {
		const grid = compareGrid({ count: 3, width: 1416, height: 380 })

		expect(grid.scrolls).toBe(false)
		expect(grid.columns).toBe(3)
		expect(heightOf(1, grid.photoWidth)).toBeCloseTo(380)
		expect(grid.columns * (grid.photoWidth + CARD_FRAME) + (grid.columns - 1) * CARD_GAP).toBeLessThanOrEqual(1416)
	})

	// spec: SERIES-001.21
	it('scrolls downwards once a photo would drop below 220 px, in as many columns as keep it at least that wide', () => {
		const grid = compareGrid({ count: 26, width: 1000, height: 634 })

		expect(grid.scrolls).toBe(true)
		expect(grid.columns).toBe(4)
		expect(grid.photoWidth).toBe((1000 - 3 * CARD_GAP) / 4 - CARD_FRAME)
		expect(grid.photoWidth).toBeGreaterThanOrEqual(220)
	})

	// spec: SERIES-001.21
	it('allows photos down to 150 px on a phone, in portrait and in landscape', () => {
		const portrait = compareGrid({ count: 12, width: 366, height: 700 })
		const landscape = compareGrid({ count: 5, width: 820, height: 280 })

		expect(portrait).toEqual({ columns: 2, photoWidth: (366 - CARD_GAP) / 2 - CARD_FRAME, scrolls: true })
		expect(landscape.scrolls).toBe(true)
		expect(landscape.columns).toBe(4)
		expect(landscape.photoWidth).toBeGreaterThanOrEqual(150)
	})

	// spec: SERIES-001.21
	it('keeps one column with no width to share, so nothing divides by zero', () => {
		expect(compareGrid({ count: 3, width: 0, height: 0 })).toEqual({ columns: 1, photoWidth: 0, scrolls: true })
		expect(compareGrid({ count: 0, width: 800, height: 600 }).columns).toBe(1)
	})
})

describe('rowStep', () => {
	// spec: SERIES-001.10
	it('moves to the card above or below in the same column', () => {
		expect(rowStep(1, 1, 3, 5)).toBe(4)
		expect(rowStep(4, -1, 3, 5)).toBe(1)
	})

	// spec: SERIES-001.10
	it('stays where no card lies above or below', () => {
		expect(rowStep(1, -1, 3, 5)).toBe(1)
		expect(rowStep(2, 1, 3, 5)).toBe(2)
		expect(rowStep(0, 1, 1, 1)).toBe(0)
	})
})
