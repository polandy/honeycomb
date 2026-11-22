// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { firstAfter, keptIndex, landingTarget, narrowSnapshot, snapshotIndex } from '../../../src/logic/loupe-pictures.ts'

const SNAPSHOT = ['a', 'b', 'c', 'd']

describe('narrowSnapshot', () => {
	// spec: LOUPE-001.22
	it('drops the pictures that no longer pass and keeps the shown one at its place', () => {
		expect(narrowSnapshot(SNAPSHOT, 2, (picture) => picture !== 'b')).toEqual({ pictures: ['a', 'c', 'd'], index: 1 })
	})

	// spec: LOUPE-001.22
	it('keeps the shown picture while it no longer passes', () => {
		expect(narrowSnapshot(SNAPSHOT, 1, (picture) => picture === 'd')).toEqual({ pictures: ['b', 'd'], index: 0 })
	})

	// spec: LOUPE-001.22
	it('keeps the whole snapshot while every picture passes', () => {
		expect(narrowSnapshot(SNAPSHOT, 3, () => true)).toEqual({ pictures: SNAPSHOT, index: 3 })
	})
})

describe('snapshotIndex', () => {
	// spec: LOUPE-001.22
	it('finds the narrowed list\'s picture in the snapshot', () => {
		expect(snapshotIndex(SNAPSHOT, ['a', 'c', 'd'], 1)).toBe(2)
	})
})

describe('firstAfter', () => {
	const FIVE = ['a', 'b', 'c', 'd', 'e']

	// spec: SERIES-001.24
	it('finds the first shown picture after the series\' last one in the snapshot', () => {
		expect(firstAfter(FIVE, FIVE, ['c', 'b'])).toBe('d')
	})

	// spec: SERIES-001.24
	it('counts a series split by the sort from its last member', () => {
		expect(firstAfter(FIVE, FIVE, ['b', 'd'])).toBe('e')
	})

	// spec: SERIES-001.24
	it('skips a picture the filters no longer show', () => {
		expect(firstAfter(FIVE, ['a', 'b', 'c', 'e'], ['b', 'c'])).toBe('e')
	})

	// spec: SERIES-001.24
	it('finds none when the series ends the snapshot', () => {
		expect(firstAfter(FIVE, FIVE, ['d', 'e'])).toBeNull()
	})
})

describe('landingTarget', () => {
	// spec: SERIES-001.24, SERIES-002.13
	it('lands on the active picture, or after the series on the first shown picture, else on the pick', () => {
		expect(landingTarget(SNAPSHOT, SNAPSHOT, { kind: 'on', picture: 'b' })).toBe('b')
		expect(landingTarget(SNAPSHOT, ['a', 'b', 'd'], { kind: 'after', series: { members: ['b', 'c'] }, picked: 'b' })).toBe('d')
		expect(landingTarget(SNAPSHOT, SNAPSHOT, { kind: 'after', series: { members: ['c', 'd'] }, picked: 'c' })).toBe('c')
	})
})

describe('keptIndex', () => {
	// spec: IMMICH-002.28
	it('finds the picture where it is now, or the next one still there, or the last one', () => {
		expect(keptIndex(['a', 'b', 'c'], ['a', 'c'], 2)).toBe(1)
		expect(keptIndex(['a', 'b', 'c'], ['a', 'c'], 1)).toBe(1)
		expect(keptIndex(['a', 'b', 'c'], ['a'], 1)).toBe(0)
		expect(keptIndex(['a'], [], 0)).toBe(-1)
	})
})
