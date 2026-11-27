// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { cleanUp, workDone } from '../../../src/logic/stats-work.ts'

const NOVEMBER = { from: '2026-11-01', to: '2026-11-30' }

describe('cleanUp', () => {
	const counters = [
		{ day: '2026-10-31', metric: METRIC.trashBytes, value: 999 },
		{ day: '2026-11-03', metric: METRIC.trashPictures, value: 3 },
		{ day: '2026-11-03', metric: METRIC.trashBytes, value: 6000 },
		{ day: '2026-11-24', metric: METRIC.trashPictures, value: 1 },
		{ day: '2026-11-24', metric: METRIC.trashBytes, value: 2000 },
		{ day: '2026-11-24', metric: METRIC.deletedPictures, value: 2 },
		{ day: '2026-11-24', metric: METRIC.deletedBytes, value: 1000 },
		{ day: '2026-11-24', metric: METRIC.rawsRemoved, value: 5 },
		{ day: '2026-11-24', metric: METRIC.rawsRemovedBytes, value: 1000 },
	]

	// spec: STATS-001.78
	it('splits the space freed into the trash bin, deleted for good and the RAW files, in the bar order', () => {
		expect(cleanUp(counters, NOVEMBER)).toEqual({
			freedBytes: 10_000,
			rows: [
				{ part: 'trash', count: 4, bytes: 8000 },
				{ part: 'deleted', count: 2, bytes: 1000 },
				{ part: 'raws', count: 5, bytes: 1000 },
			],
		})
	})

	// spec: STATS-001.78
	it('leaves a part without a count and bytes out, and keeps one with only a count', () => {
		const only = [{ day: '2026-11-03', metric: METRIC.rawsRemoved, value: 2 }, { day: '2026-11-03', metric: METRIC.trashPictures, value: 0 }]

		expect(cleanUp(only, NOVEMBER)).toEqual({ freedBytes: 0, rows: [{ part: 'raws', count: 2, bytes: 0 }] })
		expect(cleanUp([], NOVEMBER)).toEqual({ freedBytes: 0, rows: [] })
	})
})

describe('workDone', () => {
	const counters = [
		{ day: '2026-10-31', metric: METRIC.tagsSet, value: 77 },
		{ day: '2026-11-03', metric: METRIC.sidecarsCreated, value: 7 },
		{ day: '2026-11-03', metric: METRIC.sidecarsUpdated, value: 3 },
		{ day: '2026-11-03', metric: METRIC.sidecarsForeign, value: 2 },
		{ day: '2026-11-04', metric: METRIC.ratingsSet, value: 12 },
		{ day: '2026-11-24', metric: METRIC.ratingsSet, value: 8 },
		{ day: '2026-11-24', metric: METRIC.colourLabelsSet, value: 4 },
		{ day: '2026-11-24', metric: METRIC.tagsSet, value: 10 },
		{ day: '2026-11-24', metric: METRIC.seriesDone, value: 2 },
		{ day: '2026-11-24', metric: METRIC.foldersDone, value: 1 },
		{ day: '2026-11-24', metric: METRIC.picturesMoved, value: 30 },
	]

	// spec: STATS-001.79
	it('sums every counter of the period in the order of the card, those from digiKam or darktable with the updates', () => {
		expect(workDone(counters, NOVEMBER)).toEqual([
			{ key: 'sidecarsCreated', value: 7, foreign: 0 },
			{ key: 'sidecarsUpdated', value: 3, foreign: 2 },
			{ key: 'ratingsSet', value: 20, foreign: 0 },
			{ key: 'colourLabelsSet', value: 4, foreign: 0 },
			{ key: 'tagsSet', value: 10, foreign: 0 },
			{ key: 'seriesDone', value: 2, foreign: 0 },
			{ key: 'foldersDone', value: 1, foreign: 0 },
			{ key: 'picturesMoved', value: 30, foreign: 0 },
		])
	})

	// spec: STATS-001.79
	it('leaves a row at zero out, and every row without a count', () => {
		const some = [{ day: '2026-11-04', metric: METRIC.tagsSet, value: 5 }, { day: '2026-11-04', metric: METRIC.ratingsSet, value: 0 }]

		expect(workDone(some, NOVEMBER)).toEqual([{ key: 'tagsSet', value: 5, foreign: 0 }])
		expect(workDone([], NOVEMBER)).toEqual([])
	})
})
