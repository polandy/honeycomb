// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichEntry } from '../../../src/logic/immich-asset.ts'
import type { Page, PagedList } from '../../../src/logic/immich-paging.ts'

import { describe, expect, it } from 'vitest'
import { EMPTY_LIST, LOUPE_AHEAD, loupeCounter, pageArrived, pageAsked, pageFailed, replaceEntry, wantsNext, wantsPrevious } from '../../../src/logic/immich-paging.ts'
import { immichEntry } from './immich-fixtures.ts'

const entries = (from: number, count: number) => Array.from({ length: count }, (_, index) => immichEntry(`a${from + index}`))
const page = (list: readonly ImmichEntry[], nextCursor: string | null, previousCursor: string | null = null): Page => ({ entries: list, nextCursor, previousCursor })

function loaded(...pages: Page[]): PagedList {
	return pages.reduce<PagedList>((list, next) => pageArrived(pageAsked(list, 'next'), 'next', next), EMPTY_LIST)
}

describe('wantsNext', () => {
	// spec: IMMICH-002.6
	it('wants the first page of a list not yet loaded', () => {
		expect(wantsNext(EMPTY_LIST, -1, 40)).toBe(true)
		expect(wantsNext(pageAsked(EMPTY_LIST, 'next'), -1, 40)).toBe(false)
	})

	// spec: IMMICH-002.6
	it('wants the next page only when the last loaded entry comes within the distance', () => {
		const list = loaded(page(entries(0, 100), 'c1'))

		expect(wantsNext(list, 59, 40)).toBe(false)
		expect(wantsNext(list, 60, 40)).toBe(true)
	})

	// spec: IMMICH-002.6
	it('wants nothing once the cursor ends, and shows every entry once', () => {
		const list = loaded(page(entries(0, 100), 'c1'), page(entries(100, 100), 'c2'), page(entries(200, 50), null))

		expect(list.entries.map((entry) => entry.assetId)).toEqual(entries(0, 250).map((entry) => entry.assetId))
		expect(wantsNext(list, 249, 40)).toBe(false)
	})

	// spec: IMMICH-002.8
	it('asks again after a short or empty page that has a cursor', () => {
		const list = loaded(page(entries(0, 10), 'c1'), page([], 'c2'))

		expect(list.nextCursor).toBe('c2')
		expect(wantsNext(list, 9, 40)).toBe(true)
	})

	// spec: IMMICH-002.9
	it('lets the loupe ask within twelve entries of the last loaded one', () => {
		const list = loaded(page(entries(0, 100), 'c1'))

		expect(LOUPE_AHEAD).toBe(12)
		expect(wantsNext(list, 87, LOUPE_AHEAD)).toBe(false)
		expect(wantsNext(list, 89, LOUPE_AHEAD)).toBe(true)
	})
})

describe('pageArrived', () => {
	// spec: IMMICH-002.10
	it('appends the next page so the loupe steps past the old end', () => {
		const list = loaded(page(entries(0, 100), 'c1'), page(entries(100, 100), 'c2'))

		expect(list.entries[100]?.assetId).toBe('a100')
		expect(list.nextCursor).toBe('c2')
		expect(list.next).toBe('idle')
	})

	// spec: IMMICH-002.2
	it('drops an entry it already holds', () => {
		const list = loaded(page(entries(0, 3), 'c1'), page(entries(2, 3), null))

		expect(list.entries.map((entry) => entry.assetId)).toEqual(['a0', 'a1', 'a2', 'a3', 'a4'])
	})

	it('takes the previous cursor of a first page started at an asset', () => {
		const list = loaded(page(entries(50, 100), 'c1', 'p1'))

		expect(list.previousCursor).toBe('p1')
		expect(wantsPrevious(list, 11)).toBe(true)
		expect(wantsPrevious(list, 12)).toBe(false)
	})

	it('puts a previous page before the loaded ones and keeps the next cursor', () => {
		const list = pageArrived(pageAsked(loaded(page(entries(50, 50), 'c1', 'p1')), 'previous'), 'previous', page(entries(0, 50), 'ignored', null))

		expect(list.entries[0]?.assetId).toBe('a0')
		expect(list.entries[50]?.assetId).toBe('a50')
		expect(list.previousCursor).toBeNull()
		expect(list.nextCursor).toBe('c1')
		expect(list.previous).toBe('idle')
		expect(wantsPrevious(list, 0)).toBe(false)
	})

	it('asks for no previous page while one is loading', () => {
		const list = pageAsked(loaded(page(entries(50, 50), 'c1', 'p1')), 'previous')

		expect(wantsPrevious(list, 0)).toBe(false)
	})
})

describe('pageFailed', () => {
	// spec: IMMICH-002.19
	it('keeps the loaded pages and the cursor to ask again, and asks nothing on its own', () => {
		const list = pageFailed(pageAsked(loaded(page(entries(0, 100), 'c1'), page(entries(100, 100), 'c2')), 'next'), 'next')

		expect(list.entries).toHaveLength(200)
		expect(list.nextCursor).toBe('c2')
		expect(list.next).toBe('failed')
		expect(wantsNext(list, 199, 40)).toBe(false)
		expect(pageAsked(list, 'next').next).toBe('loading')
	})
})

describe('replaceEntry', () => {
	it('swaps the entry of the same asset and leaves the others', () => {
		const list = loaded(page(entries(0, 3), null))
		const picked = immichEntry('a1', { flag: 'picked' })

		expect(replaceEntry(list, picked).entries).toEqual([list.entries[0], picked, list.entries[2]])
	})
})

describe('loupeCounter', () => {
	// spec: IMMICH-002.9
	it('counts the position against the server total', () => {
		const list = loaded(page(entries(0, 100), 'c1'), page(entries(100, 100), 'c2'))

		expect(loupeCounter(list, 90, 1000)).toEqual({ position: 91, total: 1000 })
	})

	// spec: IMMICH-002.27
	it('gives only the total while newer pages are not loaded', () => {
		expect(loupeCounter(loaded(page(entries(50, 100), 'c1', 'p1')), 3, 1000)).toEqual({ position: null, total: 1000 })
	})
})
