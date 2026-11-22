// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { folderProgress } from '../../../src/logic/folder-progress.ts'
import { doneRow, row } from './folder-fixtures.ts'

const at = (month: number, day: number, hour = 12) => Date.UTC(2026, month, day, hour) / 1000
const NOV_END = new Date(Date.UTC(2026, 10, 30, 23, 59))

describe('folderProgress', () => {
	// spec: FOLDERS-003.1
	it('shares the photos in done folders of all photos', () => {
		const rows = [doneRow({ path: '/Photos/a', photos: 400 }, 400), doneRow({ path: '/Photos/b', photos: 200 }, 200), row({ path: '/Photos/c', photos: 400, undecided: 400, picked: 0, rejected: 0 })]
		const { total } = folderProgress(rows, ['/Photos'], NOV_END)
		expect(total).toMatchObject({ photos: 1000, donePhotos: 600, donePercent: 60, doneFolders: 2, folders: 3 })
	})

	// spec: FOLDERS-003.2
	it('counts rows below the roots and gives each root its own progress', () => {
		const rows = [
			doneRow({ path: '/Photos/a', photos: 100 }),
			row({ path: '/Archive/b', root: '/Archive', photos: 300, undecided: 300, picked: 0, rejected: 0 }),
			row({ path: '/Elsewhere/c', root: '/Elsewhere', photos: 999 }),
		]
		const progress = folderProgress(rows, ['/Photos', '/Archive'], NOV_END)
		expect(progress.total).toMatchObject({ photos: 400, donePhotos: 100, donePercent: 25 })
		expect(progress.perRoot.map((entry) => [entry.root, entry.progress.donePercent, entry.progress.folders])).toEqual([['/Photos', 100, 1], ['/Archive', 0, 1]])
	})

	// spec: FOLDERS-003.3
	it('counts the folders marked done in the current month of the injected clock', () => {
		const mark = (path: string, when: number) => doneRow({ path, done: { by: 'Andy', at: when, photos: 100 } })
		const rows = [mark('/Photos/oct', at(9, 31, 23)), mark('/Photos/start', at(10, 1, 0)), mark('/Photos/end', at(10, 30, 23))]
		expect(folderProgress(rows, ['/Photos'], NOV_END).total.doneThisMonth).toBe(2)
		expect(folderProgress(rows, ['/Photos'], new Date(Date.UTC(2026, 9, 31, 23, 59))).total.doneThisMonth).toBe(1)
	})

	// spec: FOLDERS-003.4
	it('shares the picked and rejected photos of all photos', () => {
		const rows = [row({ path: '/Photos/a', photos: 100, picked: 30, rejected: 20, undecided: 50 }), row({ path: '/Photos/b', photos: 100, picked: 10, rejected: 0, undecided: 90 })]
		expect(folderProgress(rows, ['/Photos'], NOV_END).total.decidedPercent).toBe(30)
	})

	// spec: FOLDERS-003.5
	it('is 0 % for no rows and for rows without photos', () => {
		const empty = row({ photos: 0, undecided: 0, picked: 0, rejected: 0, bytes: 0 })
		for (const rows of [[], [empty]]) {
			expect(folderProgress(rows, ['/Photos'], NOV_END).total).toMatchObject({ photos: 0, donePercent: 0, decidedPercent: 0, doneThisMonth: 0 })
		}
		expect(folderProgress([], [], NOV_END)).toEqual({ total: expect.objectContaining({ folders: 0 }), perRoot: [] })
	})
})
