// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { FILMSTRIP_OVERSCAN, FILMSTRIP_TAB, FILMSTRIP_THUMB, filmstripFrames, filmstripLayout, filmstripLeft } from '../../../src/logic/filmstrip.ts'

describe('filmstripLayout', () => {
	const VIEWPORT = 1000
	const MIDDLE = VIEWPORT / 2 - FILMSTRIP_THUMB / 2

	// spec: LOUPE-001.19
	it('lays the pictures edge to edge from the left edge of the strip and scrolls the shown one to the middle', () => {
		const layout = filmstripLayout({ index: 15, count: 30, viewport: VIEWPORT, offset: 0, tabs: [] })
		expect(layout.width).toBe(30 * FILMSTRIP_THUMB)
		expect(15 * FILMSTRIP_THUMB - layout.centred).toBe(MIDDLE)
	})

	// spec: LOUPE-001.19
	it('keeps the strip at its left edge until the shown picture reaches the middle', () => {
		expect(filmstripLayout({ index: 0, count: 30, viewport: VIEWPORT, offset: 0, tabs: [] }).centred).toBe(0)
		expect(filmstripLayout({ index: 8, count: 30, viewport: VIEWPORT, offset: 0, tabs: [] }).centred).toBe(0)
		expect(filmstripLayout({ index: 9, count: 30, viewport: VIEWPORT, offset: 0, tabs: [] }).centred).toBe(9 * FILMSTRIP_THUMB - MIDDLE)
	})

	// spec: LOUPE-001.19
	it('keeps the strip at its right edge once the shown picture is past the middle of the last ones', () => {
		expect(filmstripLayout({ index: 29, count: 30, viewport: VIEWPORT, offset: 0, tabs: [] }).centred).toBe(30 * FILMSTRIP_THUMB - VIEWPORT)
	})

	// spec: LOUPE-001.19
	it('never scrolls a strip whose pictures all fit', () => {
		expect(filmstripLayout({ index: 4, count: 5, viewport: VIEWPORT, offset: 0, tabs: [] })).toMatchObject({ width: 5 * FILMSTRIP_THUMB, centred: 0 })
	})

	// spec: LOUPE-001.19
	it('renders the pictures in view and a few more on each side', () => {
		// 1000 px show 17 pictures and a part of the 18th at 56 px each
		expect(FILMSTRIP_THUMB).toBe(56)
		expect(filmstripLayout({ index: 15, count: 40, viewport: VIEWPORT, offset: 10 * FILMSTRIP_THUMB, tabs: [] })).toMatchObject({ first: 10 - FILMSTRIP_OVERSCAN, end: 28 + FILMSTRIP_OVERSCAN })
	})

	// spec: LOUPE-001.19
	it('follows a scroll the user made, within the pictures', () => {
		expect(filmstripLayout({ index: 0, count: 30, viewport: VIEWPORT, offset: 0, tabs: [] })).toMatchObject({ first: 0, end: 18 + FILMSTRIP_OVERSCAN })
		expect(filmstripLayout({ index: 0, count: 30, viewport: VIEWPORT, offset: 30 * FILMSTRIP_THUMB - VIEWPORT, tabs: [] })).toMatchObject({ first: 12 - FILMSTRIP_OVERSCAN, end: 30 })
	})

	// spec: LOUPE-001.19
	it('renders nothing before the strip has a width and nothing past the last picture', () => {
		expect(filmstripLayout({ index: 3, count: 5, viewport: 0, offset: 0, tabs: [] })).toMatchObject({ centred: 0, first: 0, end: 0 })
		expect(filmstripLayout({ index: 0, count: 0, viewport: VIEWPORT, offset: 0, tabs: [] })).toMatchObject({ first: 0, end: 0, width: 0, centred: 0 })
	})

	// spec: LOUPE-001.19
	it('puts a tab column before each photo that opens a series run and widens the strip by it', () => {
		expect(FILMSTRIP_TAB).toBe(44)
		const tabs = [2, 5]
		expect(filmstripLeft(0, tabs)).toBe(0)
		expect(filmstripLeft(1, tabs)).toBe(FILMSTRIP_THUMB)
		expect(filmstripLeft(2, tabs)).toBe(2 * FILMSTRIP_THUMB + FILMSTRIP_TAB)
		expect(filmstripLeft(4, tabs)).toBe(4 * FILMSTRIP_THUMB + FILMSTRIP_TAB)
		expect(filmstripLeft(5, tabs)).toBe(5 * FILMSTRIP_THUMB + 2 * FILMSTRIP_TAB)
		expect(filmstripLayout({ index: 0, count: 7, viewport: VIEWPORT, offset: 0, tabs }).width).toBe(7 * FILMSTRIP_THUMB + 2 * FILMSTRIP_TAB)
	})

	// spec: LOUPE-001.19
	it('scrolls the shown photo to the middle past the tabs before it', () => {
		const layout = filmstripLayout({ index: 15, count: 30, viewport: VIEWPORT, offset: 0, tabs: [3, 10, 20] })
		expect(15 * FILMSTRIP_THUMB + 2 * FILMSTRIP_TAB - layout.centred).toBe(MIDDLE)
	})

	// spec: LOUPE-001.19
	it('renders the photos in view past the tabs before them', () => {
		// 10 tabs of 44 px before photo 10 put 440 px more before it; 1000 px from photo 10 show photos 10 up to 27
		const tabs = Array.from({ length: 10 }, (_, at) => at)
		const offset = filmstripLeft(10, tabs)
		expect(filmstripLayout({ index: 15, count: 40, viewport: VIEWPORT, offset, tabs })).toMatchObject({ first: 10 - FILMSTRIP_OVERSCAN, end: 28 + FILMSTRIP_OVERSCAN })
		expect(filmstripLayout({ index: 15, count: 40, viewport: VIEWPORT, offset: offset - 1, tabs })).toMatchObject({ first: 9 - FILMSTRIP_OVERSCAN })
	})
})

describe('filmstripFrames', () => {
	const first = { key: 2, members: ['B', 'C', 'D'] }
	const second = { key: 6, members: ['F', 'G'] }
	const members = new Map([first, second].flatMap((series) => series.members.map((name) => [name, series] as const)))

	// spec: LOUPE-001.19
	it('frames each run of neighbours in one series with the size of the series', () => {
		expect(filmstripFrames(['A', 'B', 'C', 'D', 'E', 'F', 'G'], members)).toEqual([
			{ first: 1, end: 4, count: 3 },
			{ first: 5, end: 7, count: 2 },
		])
	})

	// spec: LOUPE-001.19
	it('gives each run of a split series its own frame, each with the whole count', () => {
		expect(filmstripFrames(['B', 'X', 'C', 'D'], members)).toEqual([
			{ first: 0, end: 1, count: 3 },
			{ first: 2, end: 4, count: 3 },
		])
	})

	// spec: LOUPE-001.19
	it('ends a frame where the next series starts and frames nothing outside a series', () => {
		expect(filmstripFrames(['D', 'F'], members)).toEqual([
			{ first: 0, end: 1, count: 3 },
			{ first: 1, end: 2, count: 2 },
		])
		expect(filmstripFrames(['A', 'X'], members)).toEqual([])
	})
})
