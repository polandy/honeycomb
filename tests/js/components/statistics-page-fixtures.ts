// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { StatsAnswer } from '../../../src/logic/statistics.ts'

import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import StatisticsPage from '../../../src/components/StatisticsPage.vue'
import { METRIC } from '../../../src/logic/statistics.ts'
import { doneRow, row } from '../logic/folder-fixtures.ts'
import { fakePageNavigation } from '../page-navigation.ts'

/** The user's today of the stubbed answer. */
export const TODAY = '2026-11-20'
export const COUNTERS = [
	{ day: '2026-11-01', metric: METRIC.decided, value: 100 },
	{ day: '2026-11-19', metric: METRIC.decided, value: 18 },
	{ day: TODAY, metric: METRIC.trashPictures, value: 4 },
	{ day: TODAY, metric: METRIC.sidecarsCreated, value: 7 },
	{ day: TODAY, metric: METRIC.sidecarsUpdated, value: 3 },
]
export const MONDAY = 1
export const NOTHING_READ = { pictures: 0, picked: 0, rejected: 0, rated: 0 }
export const ROOTS = { libraryRoots: ['/Photos'] }
export const ROWS = [doneRow({ path: '/Photos/Wedding' }), row({ path: '/Photos/Italy 2025' })]

/** An address that remembers the hash written to it. */
export function fakeLocation(hash = '') {
	const location = { hash, writes: [] as string[], read: () => location.hash, write: (next: string) => { location.hash = next; location.writes.push(next) } }
	return location
}

/** Mounts the statistics page on stubbed seams, the counters overridable per test. */
export function mountPage(answer: Partial<StatsAnswer> = {}, settings: unknown = ROOTS, folders = vi.fn(async (_root: string) => ROWS), location = fakeLocation()) {
	const seams = {
		loadStatistics: vi.fn(async () => ({ counters: COUNTERS, firstDay: '2026-11-01', today: TODAY, seriesDoneBefore: 0, read: NOTHING_READ, ...answer })),
		loadLibraryFolders: folders,
		loadSettings: vi.fn(async () => settings),
		saveViewState: vi.fn(async (_patch: { year_review_hint_closed: number }) => undefined),
		firstWeekDay: () => MONDAY,
		location,
	}
	return mount(StatisticsPage, { props: { seams, navigation: fakePageNavigation().seams } })
}

/** The text of the tile with `label`. */
export const tile = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('.delete-stats__item').find((each) => each.text().includes(label))!.text()
/** The button whose text is `label`. */
export const chip = (wrapper: ReturnType<typeof mountPage>, label: string) => wrapper.findAll('button').find((each) => each.text() === label)!
/** The stepper's arrow with `label`. */
export const step = (wrapper: ReturnType<typeof mountPage>, label: 'Previous period' | 'Next period') => wrapper.find(`button[aria-label="${label}"]`)
/** The stepper's name of the period shown. */
export const periodLabel = (wrapper: ReturnType<typeof mountPage>) => wrapper.find('.statistics-period__label').text()
