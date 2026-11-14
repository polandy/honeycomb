// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The gap between the series compare's cards, in CSS pixels. */
export const CARD_GAP = 10
/** A card's border and padding beside its photo, both sides together. */
export const CARD_FRAME = 12
/** A card's height beside its photo: frame, name row and flag buttons. */
export const CARD_CHROME_HEIGHT = 96
/** The photo frame's width over its height, a landscape 3:2. */
export const PHOTO_ASPECT = 1.5
/** A screen whose shorter side is at most this is a phone. */
const PHONE_SIDE = 520
const MIN_PHOTO_WIDTH_PHONE = 150
const MIN_PHOTO_WIDTH = 220

/** The cards to lay out and the area they fill, in CSS pixels. */
export interface CompareGridInput {
	readonly count: number
	readonly width: number
	readonly height: number
}

/** The grid's columns, each card's photo width and whether the grid scrolls down. */
export interface CompareGrid {
	readonly columns: number
	readonly photoWidth: number
	readonly scrolls: boolean
}

/** The photo width when `columns` columns share `width`. */
const widthIn = (width: number, columns: number) => (width - CARD_GAP * (columns - 1)) / columns - CARD_FRAME

/** The column count that gives the largest photo with every card on screen; below the minimum width it scrolls down (SERIES-001.21). */
export function compareGrid({ count, width, height }: CompareGridInput): CompareGrid {
	const cards = Math.max(1, count)
	let best = { columns: 1, photoWidth: -Infinity }
	for (let columns = 1; columns <= cards; columns++) {
		const rows = Math.ceil(cards / columns)
		const byHeight = ((height - CARD_GAP * (rows - 1)) / rows - CARD_CHROME_HEIGHT) * PHOTO_ASPECT
		const photoWidth = Math.min(widthIn(width, columns), byHeight)
		if (photoWidth > best.photoWidth) {
			best = { columns, photoWidth }
		}
	}
	const minimum = Math.min(width, height) <= PHONE_SIDE ? MIN_PHOTO_WIDTH_PHONE : MIN_PHOTO_WIDTH
	if (best.photoWidth >= minimum) {
		return { ...best, scrolls: false }
	}
	const columns = Math.max(1, Math.floor((width + CARD_GAP) / (minimum + CARD_FRAME + CARD_GAP)))
	return { columns, photoWidth: Math.max(0, widthIn(width, columns)), scrolls: true }
}

/** The card a row above (`step` -1) or below (1) `at` in `columns` columns, or `at` where there is none. */
export function rowStep(at: number, step: -1 | 1, columns: number, count: number): number {
	const target = at + step * columns
	return target >= 0 && target < count ? target : at
}
