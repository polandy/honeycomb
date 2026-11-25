// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chip, fakeList, MARK, mountScreen, showAll } from './folders-screen-fixture.ts'
import { installMarkedCatalogue, uninstallMarkedCatalogue } from './l10n/marked-catalogue.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

const decided = { picked: 0, rejected: 0 }
const ROWS = [
	row({ fileId: 10, path: '/Photos/2024', photos: 37, undecided: 37, ...decided }),
	row({ fileId: 11, path: '/Photos/2024/Jura', photos: 3, picked: 1, rejected: 1, undecided: 1 }),
	row({ fileId: 12, path: '/Photos/2024/Iceland/Day 1', photos: 2, picked: 1, rejected: 0, undecided: 1 }),
	doneRow({ fileId: 13, path: '/Photos/2024/Iceland/Day 2', photos: 4, picked: 4 }, 4),
	row({ fileId: 14, path: '/Photos/2024/Iceland/Day 3', photos: 1, undecided: 1, ...decided }),
	row({ fileId: 16, path: '/Photos/Archive/Analog/Scans 1998' }),
	doneRow({ fileId: 17, path: '/Photos/2024/Iceland/Day 4', photos: 5, picked: 5 }, 3),
]

/** The number on a filter chip. */
function count(wrapper: ReturnType<typeof mountScreen>, label: string): number {
	return Number(chip(wrapper, 'Filter', label).find('.folder-filters__count').text())
}

describe('FoldersScreen chip counts', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: FOLDERS-009.23
	it('counts every chip over the folders of the level, so All is never fewer than Suggested or New photos', async () => {
		const wrapper = mountScreen(fakeList(ROWS))

		expect([count(wrapper, 'Suggested'), count(wrapper, 'New photos'), count(wrapper, 'All')]).toEqual([5, 1, 7])
		await chip(wrapper, 'Filter', 'Suggested').trigger('click')
		expect(wrapper.findAll('.folder-row')).toHaveLength(5)
		await chip(wrapper, 'Filter', 'New photos').trigger('click')
		expect(wrapper.findAll('.folder-row')).toHaveLength(1)
		await showAll(wrapper)
		await wrapper.find(`[aria-label="${MARK}Open 2024"]`).trigger('click')
		expect([count(wrapper, 'Suggested'), count(wrapper, 'New photos'), count(wrapper, 'All')]).toEqual([4, 1, 6])
	})
})
