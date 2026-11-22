// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { newCount, PERMISSION_UPDATE } from '../../../src/logic/folder-row.ts'
import { badgeText, buildFolderList, filterCounts, filterRows, sortRows } from '../../../src/logic/folder-list.ts'
import { doneRow, row } from './folder-fixtures.ts'

const paths = (rows: readonly { path: string }[]) => rows.map((folder) => folder.path)
const year = (y: number) => Date.UTC(y, 5, 1) / 1000

describe('newCount', () => {
	// spec: FOLDERS-002.3
	it('counts the photos that arrived since Mark done, never below 0', () => {
		expect(newCount(doneRow({ photos: 140 }, 138))).toBe(2)
		expect(newCount(doneRow({ photos: 100 }, 100))).toBe(0)
		expect(newCount(doneRow({ photos: 90 }, 100))).toBe(0)
		expect(newCount(row())).toBe(0)
	})
})

describe('filterRows', () => {
	// spec: FOLDERS-002.1
	it('suggests rateable folders that are not done and have undecided photos or are complete', () => {
		const open = row({ path: '/Photos/open' })
		const complete = row({ path: '/Photos/complete', undecided: 0, picked: 100 })
		const rows = [
			open,
			doneRow({ path: '/Photos/done' }),
			row({ path: '/Photos/read-only', permissions: 1 }),
			row({ path: '/Photos/empty', photos: 0, undecided: 0, picked: 0, rejected: 0, bytes: 0 }),
			complete,
		]
		expect(paths(filterRows(rows, 'suggested'))).toEqual(['/Photos/open', '/Photos/complete'])
	})

	// spec: FOLDERS-002.3
	it('lists done folders with new photos as New photos', () => {
		const rows = [doneRow({ path: '/Photos/more', photos: 140 }, 138), doneRow({ path: '/Photos/same' }), doneRow({ path: '/Photos/fewer', photos: 90 }), row({ path: '/Photos/open' })]
		expect(paths(filterRows(rows, 'new'))).toEqual(['/Photos/more'])
	})

	// spec: FOLDERS-002.4
	it('keeps every row for All', () => {
		const rows = [row(), doneRow({ path: '/Photos/b' }), row({ path: '/Photos/c', permissions: 0 })]
		expect(filterRows(rows, 'all')).toEqual(rows)
	})
})

describe('sortRows', () => {
	// spec: FOLDERS-002.2
	it('sorts Suggested complete first, then by score, undecided and path', () => {
		const complete = row({ path: '/Photos/complete', undecided: 0, picked: 100 })
		const heavy = row({ path: '/Photos/heavy', undecided: 90, bursts: 80 })
		const light = row({ path: '/Photos/light', undecided: 10 })
		const tieB = row({ path: '/Photos/tie-b', undecided: 30 })
		const tieA = row({ path: '/Photos/tie-a', undecided: 30 })
		const done = doneRow({ path: '/Photos/done' })
		expect(paths(sortRows([done, light, tieB, complete, heavy, tieA], 'suggested'))).toEqual(['/Photos/complete', '/Photos/heavy', '/Photos/tie-a', '/Photos/tie-b', '/Photos/light', '/Photos/done'])
	})

	// spec: FOLDERS-002.2
	it('breaks equal scores by undecided photos before the path', () => {
		const more = row({ path: '/Photos/z', photos: 10, undecided: 4, bursts: 0, bytes: 0 })
		const fewer = row({ path: '/Photos/a', photos: 10, undecided: 2, bursts: 5, bytes: 0 })
		expect(paths(sortRows([fewer, more], 'suggested'))).toEqual(['/Photos/z', '/Photos/a'])
	})

	// spec: FOLDERS-002.5
	it('sorts by undecided, size, capture times and name, ties by path, missing times last', () => {
		const a = row({ path: '/Photos/a', undecided: 5, bytes: 300, oldest: year(2022), newest: year(2022) })
		const b = row({ path: '/Photos/b', undecided: 50, bytes: 100, oldest: year(2019), newest: year(2023) })
		const c = row({ path: '/Photos/c', undecided: 50, bytes: 200, oldest: null, newest: null })
		const rows = [a, c, b]
		expect(paths(sortRows(rows, 'undecided'))).toEqual(['/Photos/b', '/Photos/c', '/Photos/a'])
		expect(paths(sortRows(rows, 'largest'))).toEqual(['/Photos/a', '/Photos/c', '/Photos/b'])
		expect(paths(sortRows(rows, 'oldest'))).toEqual(['/Photos/b', '/Photos/a', '/Photos/c'])
		expect(paths(sortRows(rows, 'newest'))).toEqual(['/Photos/b', '/Photos/a', '/Photos/c'])
		expect(paths(sortRows([c, b, a], 'name'))).toEqual(['/Photos/a', '/Photos/b', '/Photos/c'])
	})

	// spec: FOLDERS-002.5
	it('sorts names in natural, case-insensitive order and does not change its input', () => {
		const rows = [row({ path: '/Photos/10 b' }), row({ path: '/Photos/2 a' }), row({ path: '/Photos/Z' }), row({ path: '/Photos/m' })]
		const before = [...rows]
		expect(paths(sortRows(rows, 'name'))).toEqual(['/Photos/2 a', '/Photos/10 b', '/Photos/m', '/Photos/Z'])
		expect(rows).toEqual(before)
	})

	// spec: FOLDERS-002.5
	it('orders paths that differ only in case by code point, so the order is stable', () => {
		const rows = [row({ path: '/Photos/b' }), row({ path: '/Photos/B' }), row({ path: '/Photos/b' })]
		expect(paths(sortRows(rows, 'name'))).toEqual(['/Photos/B', '/Photos/b', '/Photos/b'])
		expect(paths(sortRows([...rows].reverse(), 'name'))).toEqual(['/Photos/B', '/Photos/b', '/Photos/b'])
	})

	// spec: FOLDERS-002.5
	it('breaks ties of every sort by path and puts two missing capture times in path order', () => {
		const rows = [row({ path: '/Photos/y', oldest: null, newest: null }), row({ path: '/Photos/x', oldest: null, newest: null }), row({ path: '/Photos/w', oldest: year(2020), newest: year(2020) }), row({ path: '/Photos/v', oldest: year(2020), newest: year(2020) })]
		for (const sort of ['undecided', 'largest', 'oldest', 'newest'] as const) {
			expect(paths(sortRows(rows, sort)).filter((path) => ['/Photos/x', '/Photos/y'].includes(path))).toEqual(['/Photos/x', '/Photos/y'])
		}
		expect(paths(sortRows(rows, 'oldest'))).toEqual(['/Photos/v', '/Photos/w', '/Photos/x', '/Photos/y'])
	})
})

describe('buildFolderList', () => {
	const roots = ['/Photos', '/Archive']
	const view = { roots, root: null, filter: 'all', sort: 'name' } as const

	// spec: FOLDERS-002.6
	it('groups Oldest and Newest under year headings, folders without a time last', () => {
		const rows = [row({ path: '/Photos/a', oldest: year(2021), newest: year(2021) }), row({ path: '/Photos/b', oldest: year(2019), newest: year(2023) }), row({ path: '/Photos/c', oldest: null, newest: null }), row({ path: '/Photos/d', oldest: year(2019), newest: year(2019) })]
		const oldest = buildFolderList(rows, { ...view, roots: ['/Photos'], sort: 'oldest' })
		expect(oldest.sections[0].groups.map((group) => [group.heading, paths(group.rows)])).toEqual([[2019, ['/Photos/b', '/Photos/d']], [2021, ['/Photos/a']], ['unknown', ['/Photos/c']]])
		const newest = buildFolderList(rows, { ...view, roots: ['/Photos'], sort: 'newest' })
		expect(newest.sections[0].groups.map((group) => group.heading)).toEqual([2023, 2021, 2019, 'unknown'])
		const byName = buildFolderList(rows, { ...view, roots: ['/Photos'] })
		expect(byName.sections[0].groups.map((group) => group.heading)).toEqual([null])
	})

	// spec: FOLDERS-002.7
	it('groups by root in the roots order, only roots with rows, when all roots show', () => {
		const rows = [row({ path: '/Archive/x', root: '/Archive' }), row({ path: '/Photos/y' }), row({ path: '/Elsewhere/z', root: '/Elsewhere' })]
		const all = buildFolderList(rows, view)
		expect(all.rootHeadings).toBe(true)
		expect(all.sections.map((section) => [section.root, section.count])).toEqual([['/Photos', 1], ['/Archive', 1]])
		const none = buildFolderList([row({ path: '/Archive/x', root: '/Archive' })], view)
		expect(none.sections.map((section) => section.root)).toEqual(['/Archive'])
	})

	// spec: FOLDERS-002.7
	it('shows one root alone, and a single root without root groups', () => {
		const rows = [row({ path: '/Archive/x', root: '/Archive' }), row({ path: '/Photos/y' })]
		const one = buildFolderList(rows, { ...view, root: '/Archive' })
		expect(one.rootHeadings).toBe(false)
		expect(one.sections.map((section) => paths(section.groups[0].rows))).toEqual([['/Archive/x']])
		expect(buildFolderList(rows, { ...view, roots: ['/Photos'] }).rootHeadings).toBe(false)
	})

	// spec: FOLDERS-002.7
	it('has no sections for no rows', () => {
		expect(buildFolderList([], view)).toEqual({ sections: [], rootHeadings: true })
	})

	// spec: FOLDERS-002.6
	it('filters before it sorts', () => {
		const rows = [row({ path: '/Photos/a', undecided: 5 }), doneRow({ path: '/Photos/b' })]
		const list = buildFolderList(rows, { ...view, filter: 'suggested', sort: 'suggested' })
		expect(paths(list.sections[0].groups[0].rows)).toEqual(['/Photos/a'])
	})
})

describe('filterCounts', () => {
	// spec: FOLDERS-002.8
	it('counts what each filter keeps', () => {
		const rows = [row(), doneRow({ path: '/Photos/b', photos: 140 }, 138), doneRow({ path: '/Photos/c' }), row({ path: '/Photos/d', permissions: PERMISSION_UPDATE - 1 })]
		expect(filterCounts(rows)).toEqual({ suggested: 1, new: 1, all: 4 })
	})
})

describe('badgeText', () => {
	// spec: FOLDERS-002.9
	it('reads n new for a done folder with new photos and is null otherwise', () => {
		expect(badgeText(doneRow({ photos: 112 }, 100))).toBe('12 new')
		expect(badgeText(doneRow())).toBeNull()
		expect(badgeText(row())).toBeNull()
	})
})
