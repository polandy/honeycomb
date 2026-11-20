// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { folderSource, immichSource } from '../../../src/logic/opened-source.ts'
import { unofferedKeys } from '../../../src/logic/source-keys.ts'

describe('unofferedKeys', () => {
	it('leaves out no key of a folder source', () => {
		expect(unofferedKeys(folderSource({ paths: ['/P'], subfolders: true }).capabilities)).toEqual(new Set())
	})

	// spec: IMMICH-002.17
	it('leaves out the keys of series, tags, delete, move and Keep RAW where the source does not offer them', () => {
		expect(unofferedKeys(immichSource('andy-phone').capabilities)).toEqual(new Set(['series-jump', 'compare', 'pick-rest', 'tag', 'delete', 'review-rejects', 'move', 'keep-raw']))
	})
})
