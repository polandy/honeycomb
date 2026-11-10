// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { recentFolderSets } from '../../../src/logic/recent.ts'

const trip = { folderSet: { paths: ['/Trip', '/Day'], subfolders: false }, fileId: 2, decided: 1, total: 3 }
const home = { folderSet: { paths: [''], subfolders: true }, fileId: 9, decided: 0, total: 40 }

describe('recentFolderSets', () => {
	// spec: DECISIONS-002.8
	it('lists the positions in their order with their stored progress', () => {
		expect(recentFolderSets([trip, home], null, { decided: 0, total: 0 })).toEqual([
			{ position: trip, current: false, decided: 1, total: 3 },
			{ position: home, current: false, decided: 0, total: 40 },
		])
	})

	// spec: DECISIONS-002.8
	it('marks the open folder set, whatever the order of its paths, with the progress of the open cull', () => {
		expect(recentFolderSets([trip, home], { paths: ['/Day', '/Trip'], subfolders: false }, { decided: 2, total: 3 })).toEqual([
			{ position: trip, current: true, decided: 2, total: 3 },
			{ position: home, current: false, decided: 0, total: 40 },
		])
	})

	it('marks nothing for the same paths with another subfolders switch', () => {
		expect(recentFolderSets([trip], { paths: ['/Trip', '/Day'], subfolders: true }, { decided: 3, total: 3 })[0]!.current).toBe(false)
	})
})
