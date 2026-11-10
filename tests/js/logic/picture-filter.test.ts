// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { Filters } from '../../../src/logic/picture-filter.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import {
	activeFilterCount,
	clearFilters,
	DEFAULT_FILTERS,
	emptyReason,
	filterPictures,
	matchesFilters,
	nextComparison,
	pairingKind,
	pictureFolders,
	progress,
	toggleChip,
} from '../../../src/logic/picture-filter.ts'
import { listingEntry, pictureOf, picturesOf } from './listing-entries.ts'

const compareNames = new Intl.Collator('en', { numeric: true }).compare
const pair = pictureOf(listingEntry(1, '/P/A.NEF'), listingEntry(2, '/P/A.JPG'))
const jpegOnly = pictureOf(listingEntry(3, '/P/B.JPG'))
const rawOnly = pictureOf(listingEntry(4, '/Q/C.NEF'))

/** The default filters with the given fields changed. */
function filters(fields: Partial<Filters>): Filters {
	return { ...DEFAULT_FILTERS, ...fields }
}

/** An undecided decision with the given fields changed. */
function decision(fields: Partial<Decision>): Decision {
	return { ...UNDECIDED, ...fields }
}

describe('pairingKind', () => {
	it.each([
		[pair, 'pair'],
		[jpegOnly, 'rendered-only'],
		[rawOnly, 'raw-only'],
	] as const)('of %o is %s', (picture, expected) => {
		expect(pairingKind(picture)).toBe(expected)
	})
})

describe('nextComparison', () => {
	// spec: GRID-002.3
	it('cycles at least → at most → exactly → at least', () => {
		expect(nextComparison('at-least')).toBe('at-most')
		expect(nextComparison('at-most')).toBe('exactly')
		expect(nextComparison('exactly')).toBe('at-least')
	})
})

describe('matchesFilters', () => {
	// spec: GRID-002.1
	it('shows everything but rejects by default', () => {
		expect(DEFAULT_FILTERS.scope).toBe('not-rejected')
		expect(matchesFilters(pair, decision({ flag: 'picked' }), DEFAULT_FILTERS)).toBe(true)
		expect(matchesFilters(pair, decision({}), DEFAULT_FILTERS)).toBe(true)
		expect(matchesFilters(pair, decision({ flag: 'rejected' }), DEFAULT_FILTERS)).toBe(false)
	})

	it.each([
		['undecided', 'unflagged', true],
		['undecided', 'picked', false],
		['undecided', 'rejected', false],
		['all', 'rejected', true],
		['all', 'picked', true],
	// spec: GRID-002.1
	] as const)('in the scope %s shows %s: %s', (scope, flag, expected) => {
		expect(matchesFilters(pair, decision({ flag }), filters({ scope }))).toBe(expected)
	})

	// spec: GRID-002.2
	it('lets a flag filter override the scope', () => {
		const rejectsOnly = filters({ scope: 'not-rejected', flags: new Set(['rejected']) })

		expect(matchesFilters(pair, decision({ flag: 'rejected' }), rejectsOnly)).toBe(true)
		expect(matchesFilters(pair, decision({ flag: 'picked' }), rejectsOnly)).toBe(false)
	})

	it.each([
		['at-least', 3, [false, false, false, true, true, true]],
		['at-most', 3, [true, true, true, true, false, false]],
		['exactly', 3, [false, false, false, true, false, false]],
		['at-least', 0, [true, true, true, true, true, true]],
	// spec: GRID-002.3
	] as const)('with rating %s %d matches ratings 0–5 as %o', (comparison, rating, expected) => {
		const ratingFilter = filters({ rating, comparison })

		expect([0, 1, 2, 3, 4, 5].map((stars) => matchesFilters(pair, decision({ rating: stars }), ratingFilter))).toEqual(expected)
	})

	// spec: GRID-002.3
	it('ignores the comparison while no rating is chosen', () => {
		expect(matchesFilters(pair, decision({ rating: 0 }), filters({ comparison: 'exactly' }))).toBe(true)
	})

	// spec: GRID-002.4
	it('matches any of the chosen colour labels', () => {
		const redOrGreen = filters({ colourLabels: new Set(['red', 'green']) })

		expect(matchesFilters(pair, decision({ colourLabel: 'green' }), redOrGreen)).toBe(true)
		expect(matchesFilters(pair, decision({ colourLabel: 'blue' }), redOrGreen)).toBe(false)
		expect(matchesFilters(pair, decision({ colourLabel: null }), redOrGreen)).toBe(false)
	})

	// spec: GRID-002.4
	it('matches any of the chosen pairing kinds', () => {
		const singles = filters({ pairings: new Set(['rendered-only', 'raw-only']) })

		expect([pair, jpegOnly, rawOnly].map((picture) => matchesFilters(picture, UNDECIDED, singles))).toEqual([false, true, true])
	})

	it.each([
		[['marked'], true, true],
		[['marked'], false, false],
		[['not-marked'], false, true],
		[['not-marked'], true, false],
		[['marked', 'not-marked'], false, true],
	// spec: GRID-002.4
	] as const)('with Keep RAW %o matches a marker %s: %s', (chips, keepRaw, expected) => {
		expect(matchesFilters(pair, decision({ keepRaw }), filters({ keepRaw: new Set(chips) }))).toBe(expected)
	})

	// spec: GRID-002.4
	it('matches any of the chosen folders', () => {
		const folderP = filters({ folders: new Set(['/P']) })

		expect(matchesFilters(jpegOnly, UNDECIDED, folderP)).toBe(true)
		expect(matchesFilters(rawOnly, UNDECIDED, folderP)).toBe(false)
	})

	// spec: GRID-002.5
	it('needs every active group to match', () => {
		const redAndThreeStars = filters({ colourLabels: new Set(['red']), rating: 3 })

		expect(matchesFilters(pair, decision({ colourLabel: 'red', rating: 4 }), redAndThreeStars)).toBe(true)
		expect(matchesFilters(pair, decision({ colourLabel: 'red', rating: 2 }), redAndThreeStars)).toBe(false)
		expect(matchesFilters(pair, decision({ colourLabel: 'blue', rating: 4 }), redAndThreeStars)).toBe(false)
	})
})

describe('filterPictures', () => {
	it('keeps the matching pictures in their order', () => {
		const decisions = new Map([[pair, decision({ flag: 'rejected' })]])

		const shown = filterPictures([rawOnly, pair, jpegOnly], (picture) => decisions.get(picture) ?? UNDECIDED, DEFAULT_FILTERS)

		expect(shown).toEqual([rawOnly, jpegOnly])
	})
})

describe('progress', () => {
	// spec: GRID-002.7
	it('counts the picked and rejected pictures of all', () => {
		const decisions = new Map([[pair, decision({ flag: 'rejected' })], [jpegOnly, decision({ flag: 'picked' })], [rawOnly, decision({ rating: 5 })]])

		expect(progress([pair, jpegOnly, rawOnly], (picture) => decisions.get(picture)!)).toEqual({ decided: 2, total: 3 })
	})
})

describe('activeFilterCount', () => {
	it('is 0 for the defaults, whatever the scope and comparison', () => {
		expect(activeFilterCount(filters({ scope: 'all', comparison: 'exactly' }))).toBe(0)
	})

	// spec: GRID-002.6
	it('counts each group with a choice once', () => {
		const active = filters({
			rating: 0,
			colourLabels: new Set(['red', 'blue']),
			flags: new Set(['picked']),
			pairings: new Set(['pair']),
			keepRaw: new Set(['marked']),
			folders: new Set(['/P']),
		})

		expect(activeFilterCount(active)).toBe(6)
	})
})

describe('clearFilters', () => {
	// spec: GRID-002.6
	it('resets every group and keeps the scope', () => {
		const active = filters({ scope: 'undecided', rating: 2, comparison: 'exactly', colourLabels: new Set(['red']), folders: new Set(['/P']) })

		expect(clearFilters(active)).toEqual({ ...DEFAULT_FILTERS, scope: 'undecided' })
	})
})

describe('toggleChip', () => {
	it('adds a chip that is off and removes one that is on, leaving the given set alone', () => {
		const chips = new Set(['red'])

		expect(toggleChip(chips, 'green')).toEqual(new Set(['red', 'green']))
		expect(toggleChip(chips, 'red')).toEqual(new Set())
		expect(chips).toEqual(new Set(['red']))
	})
})

describe('pictureFolders', () => {
	it('lists each folder of the pictures once, in name order', () => {
		const pictures = picturesOf(['/B/1.JPG', '/A/IMG_10/1.JPG', '/A/IMG_9/1.JPG', '/B/2.JPG'].map((path, index) => listingEntry(index, path)))

		expect(pictureFolders(pictures, compareNames)).toEqual(['/A/IMG_9', '/A/IMG_10', '/B'])
	})
})

describe('emptyReason', () => {
	it.each([
		['no pictures at all', DEFAULT_FILTERS, 0, 'no-pictures'],
		['every picture decided in the scope undecided', filters({ scope: 'undecided' }), 3, 'all-decided'],
		['every picture rejected in the scope not rejected', DEFAULT_FILTERS, 3, 'none-left'],
		['an active filter', filters({ rating: 5 }), 3, 'no-match'],
		['an active filter in the scope undecided', filters({ scope: 'undecided', folders: new Set(['/P']) }), 3, 'no-match'],
		['the scope all', filters({ scope: 'all' }), 3, 'no-match'],
	// spec: GRID-002.11
	] as const)('of an empty view is %s', (_case, active, total, expected) => {
		expect(emptyReason(active, total)).toBe(expected)
	})
})
