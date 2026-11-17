// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { ratingStars, TILE_INFO_DELAY_MS, tileInfoMembers, tileInfoTimer } from '../../../src/logic/tile-info.ts'
import { fakeScheduler } from '../fake-scheduler.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

/** A timer whose shown tiles the test reads. */
function timer() {
	const scheduler = fakeScheduler()
	const shown: (string | null)[] = []
	return { ...scheduler, shown, info: tileInfoTimer<string>(scheduler.schedule, (tile) => shown.push(tile)) }
}

describe('tileInfoTimer', () => {
	// spec: GRID-004.7
	it('shows a tile after the mouse rests 700 ms on it', () => {
		const { info, timers, fire, shown } = timer()
		info.rest('a')

		expect(TILE_INFO_DELAY_MS).toBe(700)
		expect(timers.map(({ ms }) => ms)).toEqual([700])
		expect(shown).toEqual([])
		fire()
		expect(shown).toEqual(['a'])
	})

	// spec: GRID-004.7
	it('keeps the waiting or shown tile while the mouse stays on it', () => {
		const { info, timers, fire, shown } = timer()
		info.rest('a')
		info.rest('a')
		fire()
		info.rest('a')

		expect(timers).toHaveLength(1)
		expect(shown).toEqual(['a'])
	})

	// spec: GRID-004.7
	it('hides the shown tile on the next one and starts the delay anew', () => {
		const { info, timers, fire, shown } = timer()
		info.rest('a')
		fire()
		info.rest('b')

		expect(shown).toEqual(['a', null])
		expect(timers.at(-1)!.ms).toBe(700)
		fire()
		expect(shown).toEqual(['a', null, 'b'])
	})

	// spec: GRID-004.8
	it('hides a shown tile and says so', () => {
		const { info, fire, shown } = timer()
		info.rest('a')
		fire()

		expect(info.hide()).toBe(true)
		expect(info.hide()).toBe(false)
		expect(shown).toEqual(['a', null])
	})

	// spec: GRID-004.8
	it('never shows a waiting tile once hidden', () => {
		const { info, fire, shown } = timer()
		info.rest('a')

		expect(info.hide()).toBe(false)
		fire()
		expect(shown).toEqual([])
	})
})

describe('tileInfoMembers', () => {
	// spec: GRID-004.9
	it('names a pair\'s members, the JPEG first, and a single\'s one', () => {
		expect(tileInfoMembers(pictureOf(listingEntry(1, '/a/IMG_1.jpeg'), listingEntry(2, '/a/IMG_1.CR3')))).toEqual(['JPG', 'CR3'])
		expect(tileInfoMembers(pictureOf(listingEntry(1, '/a/IMG_1.nef')))).toEqual(['NEF'])
		expect(tileInfoMembers(pictureOf(listingEntry(1, '/a/IMG_1.jpg')))).toEqual(['JPG'])
	})
})

describe('ratingStars', () => {
	// spec: GRID-004.9
	it.each([[0, '☆☆☆☆☆'], [3, '★★★☆☆'], [5, '★★★★★']])('shows %i of five stars', (rating, stars) => {
		expect(ratingStars(rating)).toBe(stars)
	})
})
