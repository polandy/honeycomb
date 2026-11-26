// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { isAppended, isRemoval } from '../../../src/logic/appended.ts'

const A = { id: 'a' }
const B = { id: 'b' }
const C = { id: 'c' }

describe('isAppended', () => {
	// spec: IMMICH-002.6
	it('says whether the new list only adds items after the old ones', () => {
		expect(isAppended([A, B], [A, B, C])).toBe(true)
		expect(isAppended([], [A])).toBe(true)
		expect(isAppended([A, B], [A, B])).toBe(true)
		expect(isAppended([A, B], [B, A, C])).toBe(false)
		expect(isAppended([A, B], [A])).toBe(false)
		expect(isAppended([A], [{ id: 'a' }])).toBe(false)
	})
})

describe('isRemoval', () => {
	// spec: IMMICH-003.25
	it('says whether the new list is the old one without some items, the rest in order', () => {
		expect(isRemoval([A, B, C], [A, C])).toBe(true)
		expect(isRemoval([A, B, C], [C])).toBe(true)
		expect(isRemoval([A, B, C], [])).toBe(false)
		expect(isRemoval([A, B], [A, B])).toBe(false)
		expect(isRemoval([A, B, C], [C, A])).toBe(false)
		expect(isRemoval([A, B, C], [A, { id: 'c' }])).toBe(false)
		expect(isRemoval([A, B], [A, A])).toBe(false)
	})
})
