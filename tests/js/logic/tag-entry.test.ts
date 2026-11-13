// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { cycleMatch, knownTag, tagChips, tagMatches, typedTag, withLevels } from '../../../src/logic/tag-entry.ts'

describe('tagChips', () => {
	// spec: TAGS-003.3
	it('counts how many targets have each tag, sorted', () => {
		expect(tagChips([['Sunrise'], ['Sunrise', 'People/Anna'], ['Sunrise', 'Sunrise']])).toEqual([
			{ tag: 'People/Anna', count: 1 },
			{ tag: 'Sunrise', count: 3 },
		])
	})

	it('has no chips without tags', () => {
		expect(tagChips([[], []])).toEqual([])
	})
})

describe('withLevels', () => {
	// spec: TAGS-003.5
	it('adds every level of each tag, each once, sorted', () => {
		expect(withLevels(['Places/Italy/Dolomites', 'Places/Spain', 'Anna'])).toEqual(['Anna', 'Places', 'Places/Italy', 'Places/Italy/Dolomites', 'Places/Spain'])
	})
})

describe('typedTag', () => {
	// spec: TAGS-003.7
	it.each([
		[' places / italy ', 'Places/Italy'],
		['Places/Italy/Bolzano', 'Places/Italy/Bolzano'],
	])('makes %j the tag %j, taking a known spelling', (typed, tag) => {
		expect(typedTag(typed, ['Places', 'Places/Italy'])).toBe(tag)
	})

	// spec: TAGS-003.8
	it.each(['Places//Rome', 'A|B', '', '  '])('refuses %j', (typed) => {
		expect(typedTag(typed, ['Places'])).toBeNull()
	})
})

describe('knownTag', () => {
	// spec: TAGS-004.3
	it('takes the known spelling of the text, ignoring case', () => {
		expect(knownTag(' places / italy ', ['Places', 'Places/Italy'])).toBe('Places/Italy')
	})

	// spec: TAGS-004.4
	it.each(['Places/Rome', 'A|B', ''])('refuses %j, which is not known', (typed) => {
		expect(knownTag(typed, ['Places', 'Places/Italy'])).toBeNull()
	})
})

describe('tagMatches', () => {
	const known = withLevels(['Natur/Berg', 'Bergsee', 'People/Anna'])

	// spec: TAGS-003.4
	it('offers the known tags containing the text, ignoring case, but those every target has', () => {
		const chips = [{ tag: 'Bergsee', count: 1 }]

		expect(tagMatches('BERG', known, chips, 1)).toEqual({ matches: ['Natur/Berg'], create: 'BERG' })
	})

	// spec: TAGS-003.4
	it('offers a tag only some targets have', () => {
		expect(tagMatches('berg', known, [{ tag: 'Bergsee', count: 1 }], 2).matches).toEqual(['Bergsee', 'Natur/Berg'])
	})

	// spec: TAGS-003.5
	it('offers the levels of a tag and creates a new one', () => {
		const levels = withLevels(['Places/Italy/Dolomites'])

		expect(tagMatches('places/ital', levels, [], 1)).toEqual({ matches: ['Places/Italy', 'Places/Italy/Dolomites'], create: 'places/ital' })
		expect(tagMatches('Places/Spain', levels, [], 1)).toEqual({ matches: [], create: 'Places/Spain' })
	})

	it('offers every known tag for an empty field and creates nothing for a refused one', () => {
		expect(tagMatches('', known, [], 1)).toEqual({ matches: known, create: null })
		expect(tagMatches('a|b', known, [], 1).create).toBeNull()
	})
})

describe('cycleMatch', () => {
	// spec: TAGS-003.6
	it('goes forward from none to the first and back to the last, wrapping', () => {
		const forward = [1, 1, 1, 1].reduce<number[]>((seen) => [...seen, cycleMatch(seen.at(-1) ?? -1, 1, 3)], [])

		expect(forward).toEqual([0, 1, 2, 0])
		expect(cycleMatch(0, -1, 3)).toBe(2)
		expect(cycleMatch(-1, -1, 3)).toBe(2)
	})

	it('has nothing to cycle without matches', () => {
		expect(cycleMatch(-1, 1, 0)).toBe(-1)
	})
})
