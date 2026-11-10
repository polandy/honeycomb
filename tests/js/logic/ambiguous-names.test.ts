// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { ambiguousNames } from '../../../src/logic/ambiguous-names.ts'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../../src/logic/pairing.ts'

const pictures = (paths: readonly string[]) => pairPictures(paths.map((path, index) => ({ path, fileId: index + 1 })), DEFAULT_PAIRING_SETTINGS)

describe('ambiguousNames', () => {
	// spec: LISTING-002.11
	it('names each ambiguous base name of a folder once, with the number of its singles', () => {
		const shown = pictures(['/P/A.JPG', '/P/B.JPG', '/P/a.jpg', '/P/B.NEF', '/P/A.NEF', '/Q/A.JPG', '/Q/A.JPEG'])

		expect(ambiguousNames(shown)).toEqual([
			{ folder: '/P', baseName: 'A', count: 3 },
			{ folder: '/Q', baseName: 'A', count: 2 },
		])
	})

	it('counts only the singles it is given, as after a filter', () => {
		const shown = pictures(['/P/A.JPG', '/P/A.jpg', '/P/A.NEF']).slice(1)

		expect(ambiguousNames(shown)).toEqual([{ folder: '/P', baseName: 'A', count: 2 }])
	})

	it('names nothing when every base name is unique', () => {
		expect(ambiguousNames(pictures(['/P/A.JPG', '/P/A.NEF', '/P/B.JPG']))).toEqual([])
	})
})
