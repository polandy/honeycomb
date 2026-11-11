// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { FILMSTRIP_OVERSCAN, FILMSTRIP_THUMB, filmstripLayout } from '../../../src/logic/filmstrip.ts'

describe('filmstripLayout', () => {
	const VIEWPORT = 1000
	const EDGE = VIEWPORT / 2 - FILMSTRIP_THUMB / 2

	// spec: LOUPE-001.19
	it('pads both ends by half the strip so any picture can sit in the middle, scrolled to it', () => {
		const layout = filmstripLayout({ index: 10, count: 30, viewport: VIEWPORT, offset: 10 * FILMSTRIP_THUMB })
		expect(layout.edge).toBe(EDGE)
		expect(layout.width).toBe(30 * FILMSTRIP_THUMB + 2 * EDGE)
		expect(layout.centred).toBe(10 * FILMSTRIP_THUMB)
		expect(layout.centred + EDGE + FILMSTRIP_THUMB / 2).toBe(10 * FILMSTRIP_THUMB + VIEWPORT / 2)
	})

	// spec: LOUPE-001.19
	it('renders the pictures in view and a few more on each side', () => {
		// 1000 px show 9 pictures and a part on each side of the middle one at 56 px each
		expect(FILMSTRIP_THUMB).toBe(56)
		expect(filmstripLayout({ index: 15, count: 30, viewport: VIEWPORT, offset: 15 * FILMSTRIP_THUMB })).toMatchObject({ first: 6 - FILMSTRIP_OVERSCAN, end: 25 + FILMSTRIP_OVERSCAN })
	})

	// spec: LOUPE-001.19
	it('follows a scroll the user made, within the pictures', () => {
		expect(filmstripLayout({ index: 0, count: 30, viewport: VIEWPORT, offset: 0 })).toMatchObject({ first: 0, end: 10 + FILMSTRIP_OVERSCAN })
		expect(filmstripLayout({ index: 0, count: 30, viewport: VIEWPORT, offset: 29 * FILMSTRIP_THUMB })).toMatchObject({ first: 29 - 9 - FILMSTRIP_OVERSCAN, end: 30 })
	})

	// spec: LOUPE-001.19
	it('renders nothing before the strip has a width and nothing past the last picture', () => {
		expect(filmstripLayout({ index: 3, count: 5, viewport: 0, offset: 0 })).toMatchObject({ edge: 0, first: 0, end: 0 })
		expect(filmstripLayout({ index: 0, count: 0, viewport: VIEWPORT, offset: 0 })).toMatchObject({ first: 0, end: 0, width: 2 * EDGE })
	})
})
