// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { addRecent, folderName, parentName, targetChips, toggleFavourite } from '../../../src/logic/move-targets.ts'

describe('targetChips', () => {
	// spec: MOVE-004.3
	it('lists the favourites first, then the recent targets that are not favourites, at most 9', () => {
		const favourites = ['/F1', '/F2', '/F3', '/F4', '/F5', '/F6']
		const recent = ['/R1', '/F2', '/R2', '/R3', '/R4']

		const chips = targetChips(favourites, recent)

		expect(chips.map((chip) => chip.path)).toEqual(['/F1', '/F2', '/F3', '/F4', '/F5', '/F6', '/R1', '/R2', '/R3'])
		expect(chips.map((chip) => chip.favourite)).toEqual([true, true, true, true, true, true, false, false, false])
		expect(chips.map((chip) => chip.key)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
	})
})

describe('addRecent', () => {
	// spec: MOVE-004.10
	it('puts a new target first and keeps 5', () => {
		expect(addRecent(['/1', '/2', '/3', '/4', '/5'], '/6')).toEqual(['/6', '/1', '/2', '/3', '/4'])
	})

	// spec: MOVE-004.10
	it('moves a known target to the front without repeating it', () => {
		expect(addRecent(['/6', '/1', '/2', '/3', '/4'], '/2')).toEqual(['/2', '/6', '/1', '/3', '/4'])
	})
})

describe('toggleFavourite', () => {
	// spec: MOVE-004.5
	it('adds a target at the end and removes it again', () => {
		const added = toggleFavourite(['/A'], '/B')

		expect(added).toEqual(['/A', '/B'])
		expect(toggleFavourite(added, '/B')).toEqual(['/A'])
	})
})

describe('folder names', () => {
	// spec: MOVE-004.3
	it('names the folder and its parent, the root as /', () => {
		expect(folderName('/Photos/Best')).toBe('Best')
		expect(parentName('/Photos/Best')).toBe('/Photos')
		expect(parentName('/Best')).toBe('/')
		expect(folderName('/')).toBe('/')
	})
})
