// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { leafOf, tagOf } from '../../../src/logic/tag.ts'

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
