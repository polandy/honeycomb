// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from '../../src/logic/folder-set.ts'

import { describe, expect, it } from 'vitest'
import { folderSetName } from '../../src/recent-text.ts'

describe('folderSetName', () => {
	it.each<[FolderSet, string]>([
		[{ paths: ['/Photos/2026'], subfolders: false }, '2026'],
		[{ paths: ['/Photos/A & B'], subfolders: true }, 'A & B + subfolders'],
		[{ paths: [''], subfolders: false }, 'Home'],
		[{ paths: ['/A', '/B'], subfolders: false }, '2 folders'],
		[{ paths: ['/A', '/B', '/C'], subfolders: true }, '3 folders + subfolders'],
	])('names %o "%s"', (set, name) => {
		expect(folderSetName(set)).toBe(name)
	})
})
