// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { FILMSTRIP_OVERSCAN, FILMSTRIP_THUMB, filmstripLayout } from '../../../src/logic/filmstrip.ts'

describe('filmstripLayout', () => {
	const VIEWPORT = 1000
	const MIDDLE = VIEWPORT / 2 - FILMSTRIP_THUMB / 2

	// spec: LOUPE-001.19
	it('lays the pictures edge to edge from the left edge of the strip and scrolls the shown one to the middle', () => {
		const layout = filmstripLayout({ index: 15, count: 30, viewport: VIEWPORT, offset: 0 })
		expect(layout.width).toBe(30 * FILMSTRIP_THUMB)
		expect(15 * FILMSTRIP_THUMB - layout.centred).toBe(MIDDLE)
	})

	// spec: LOUPE-001.19
	it('keeps the strip at its left edge until the shown picture reaches the middle', () => {
		expect(filmstripLayout({ index: 0, count: 30, viewport: VIEWPORT, offset: 0 }).centred).toBe(0)
		expect(filmstripLayout({ index: 8, count: 30, viewport: VIEWPORT, offset: 0 }).centred).toBe(0)
		expect(filmstripLayout({ index: 9, count: 30, viewport: VIEWPORT, offset: 0 }).centred).toBe(9 * FILMSTRIP_THUMB - MIDDLE)
	})

	// spec: LOUPE-001.19
	it('keeps the strip at its right edge once the shown picture is past the middle of the last ones', () => {
		expect(filmstripLayout({ index: 29, count: 30, viewport: VIEWPORT, offset: 0 }).centred).toBe(30 * FILMSTRIP_THUMB - VIEWPORT)
	})

	// spec: LOUPE-001.19
	it('never scrolls a strip whose pictures all fit', () => {
		expect(filmstripLayout({ index: 4, count: 5, viewport: VIEWPORT, offset: 0 })).toMatchObject({ width: 5 * FILMSTRIP_THUMB, centred: 0 })
	})

	// spec: LOUPE-001.19
	it('renders the pictures in view and a few more on each side', () => {
		// 1000 px show 17 pictures and a part of the 18th at 56 px each
		expect(FILMSTRIP_THUMB).toBe(56)
		expect(filmstripLayout({ index: 15, count: 40, viewport: VIEWPORT, offset: 10 * FILMSTRIP_THUMB })).toMatchObject({ first: 10 - FILMSTRIP_OVERSCAN, end: 28 + FILMSTRIP_OVERSCAN })
	})

	// spec: LOUPE-001.19
	it('follows a scroll the user made, within the pictures', () => {
		expect(filmstripLayout({ index: 0, count: 30, viewport: VIEWPORT, offset: 0 })).toMatchObject({ first: 0, end: 18 + FILMSTRIP_OVERSCAN })
		expect(filmstripLayout({ index: 0, count: 30, viewport: VIEWPORT, offset: 30 * FILMSTRIP_THUMB - VIEWPORT })).toMatchObject({ first: 12 - FILMSTRIP_OVERSCAN, end: 30 })
	})

	// spec: LOUPE-001.19
	it('renders nothing before the strip has a width and nothing past the last picture', () => {
		expect(filmstripLayout({ index: 3, count: 5, viewport: 0, offset: 0 })).toMatchObject({ centred: 0, first: 0, end: 0 })
		expect(filmstripLayout({ index: 0, count: 0, viewport: VIEWPORT, offset: 0 })).toMatchObject({ first: 0, end: 0, width: 0, centred: 0 })
	})
})
