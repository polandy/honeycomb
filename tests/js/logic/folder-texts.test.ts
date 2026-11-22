// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { folderProgress } from '../../../src/logic/folder-progress.ts'
import { COMPLETE_TEXT, doneText, EMPTY_LIST_TEXT, FILTER_LABELS, progressTexts, READ_ONLY_TEXT, rootsSummary, scanningText, SORT_LABELS, yearHeadingText } from '../../../src/logic/folder-texts.ts'
import { doneRow, row } from './folder-fixtures.ts'

describe('folder texts', () => {
	// spec: FOLDERS-003.6
	it('labels the filters and sorts as the mockup does', () => {
		expect(FILTER_LABELS).toEqual({ suggested: 'Suggested', new: 'New photos', all: 'All' })
		expect(SORT_LABELS).toEqual({ suggested: 'Suggested', undecided: 'Most undecided', largest: 'Largest', oldest: 'Oldest', newest: 'Newest', name: 'Name' })
		expect([COMPLETE_TEXT, READ_ONLY_TEXT, EMPTY_LIST_TEXT]).toEqual(['Complete · not marked done', 'Read-only', 'No folders here.'])
	})

	// spec: FOLDERS-003.6
	it('words the progress', () => {
		const rows = [doneRow({ path: '/Photos/a', photos: 410, picked: 100, done: { by: 'Andy', at: Date.UTC(2026, 10, 2) / 1000, photos: 410 } }), ...Array.from({ length: 17 }, (_, index) => row({ path: `/Photos/f${index}`, photos: 590 / 17, undecided: 590 / 17, picked: 0, rejected: 0 }))]
		expect(progressTexts(folderProgress(rows, ['/Photos'], new Date(Date.UTC(2026, 10, 20))).total)).toEqual({
			headline: '41 % of photos in done folders',
			folders: '1 of 18 folders done',
			month: '1 this month',
			decided: '12 % of all photos decided',
		})
	})

	// spec: FOLDERS-003.6
	it('words the done line, the scan and the roots summary with its singular', () => {
		expect(doneText(doneRow())).toBe('Done 2026-11-02 · by Andy')
		expect(doneText(doneRow({ done: { by: null, at: Date.UTC(2026, 10, 2) / 1000, photos: 100 } }))).toBe('Done 2026-11-02')
		expect(scanningText(12)).toBe('Updating 12 folders')
		expect(scanningText(1)).toBe('Updating 1 folder')
		expect(rootsSummary(2, { folders: 18, photos: 14120 })).toBe('2 roots · 18 folders · 14,120 photos')
		expect(rootsSummary(1, { folders: 1, photos: 1 })).toBe('1 root · 1 folder · 1 photo')
	})

	// spec: FOLDERS-002.6
	it('words the year headings', () => {
		expect(([2019, 'unknown', null] as const).map(yearHeadingText)).toEqual(['2019', 'Unknown year', null])
	})
})
