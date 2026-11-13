// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { changedTags, leafOf, revertTagRows, sortedTags, storableTags, tagOf, withTagRows } from '../../../src/logic/tag.ts'

describe('tagOf', () => {
	// spec: XMP-004.1
	it.each([
		[' Places / Italy /Bolzano ', 'Places/Italy/Bolzano'],
		['Anna', 'Anna'],
	])('makes %j the tag %j', (typed, tag) => {
		expect(tagOf(typed)).toBe(tag)
	})

	// spec: XMP-004.1
	it.each(['Places//Italy', 'a|b', '   ', '', 'Places/'])('refuses %j', (typed) => {
		expect(tagOf(typed)).toBeNull()
	})
})

describe('leafOf', () => {
	// spec: XMP-004.2
	it.each([
		['Places/Italy/Dolomites', 'Dolomites'],
		['Anna', 'Anna'],
	])('takes the last name of %j', (tag, leaf) => {
		expect(leafOf(tag)).toBe(leaf)
	})
})

describe('sortedTags', () => {
	it('keeps each tag once, in code-unit order', () => {
		expect(sortedTags(['b', 'B', 'a', 'b'])).toEqual(['B', 'a', 'b'])
	})
})

describe('changedTags', () => {
	// spec: TAGS-002.7
	it('removes the removed tags and adds the added ones, sorted', () => {
		expect(changedTags(['Places/Lisbon', 'People/Anna'], { added: ['Events/Wedding', 'People/Anna'], removed: ['Places/Lisbon'] })).toEqual(['Events/Wedding', 'People/Anna'])
	})
})

describe('storableTags', () => {
	// spec: TAGS-002.5
	it('leaves out a tag over 255 characters and the tags beyond the first 100 in sort order', () => {
		const long = 'x'.repeat(256)
		const many = Array.from({ length: 101 }, (_, index) => `t${String(index).padStart(3, '0')}`)

		expect(storableTags(['b', long, 'a', 'y'.repeat(255)])).toEqual({ kept: ['a', 'b', 'y'.repeat(255)], leftOut: [long] })
		expect(storableTags(many)).toEqual({ kept: many.slice(0, 100), leftOut: ['t100'] })
	})
})

describe('withTagRows and revertTagRows', () => {
	const before = new Map([[1, ['a']], [2, ['b']]])

	it('sets each row and drops the file of an empty one', () => {
		expect(withTagRows(before, [{ fileId: 1, tags: [] }, { fileId: 3, tags: ['c'] }])).toEqual(new Map([[2, ['b']], [3, ['c']]]))
	})

	// spec: TAGS-002.8
	it('puts back what each row replaced unless a later change set the file since', () => {
		const rows = [{ fileId: 1, tags: ['x'] }, { fileId: 2, tags: ['y'] }, { fileId: 3, tags: ['z'] }]
		const later = withTagRows(withTagRows(before, rows), [{ fileId: 2, tags: ['later'] }])

		expect(revertTagRows(later, rows, before)).toEqual(new Map([[1, ['a']], [2, ['later']]]))
	})
})
