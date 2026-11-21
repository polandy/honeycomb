// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { folderSetKey } from '../../../src/logic/folder-set.ts'
import { folderSetOf, folderSource, immichSource, sameSource } from '../../../src/logic/opened-source.ts'

const SET = { paths: ['/Photos/2026', '/Photos/2025'], subfolders: false }

describe('folderSource', () => {
	it('keys the folder set as the folder set key does and allows everything', () => {
		const source = folderSource(SET)

		expect(source).toEqual({ kind: 'folders', key: `folders:${folderSetKey(SET)}`, set: SET, capabilities: { series: true, similarity: true, tags: true, delete: true, move: true, removeRaws: true, keepRaw: true, xmp: true } })
	})
})

describe('immichSource', () => {
	// spec: IMMICH-002.17
	it('keys the connection and switches every capability off', () => {
		const source = immichSource('family-phone')

		expect(source).toEqual({ kind: 'immich', key: 'immich:family-phone', connection: 'family-phone', capabilities: { series: false, similarity: false, tags: false, delete: false, move: false, removeRaws: false, keepRaw: false, xmp: false } })
	})
})

describe('sameSource', () => {
	it('takes folder sets with their paths in another order as the same source', () => {
		expect(sameSource(folderSource(SET), folderSource({ ...SET, paths: [...SET.paths].reverse() }))).toBe(true)
	})

	it('tells sources of another kind, set or connection apart', () => {
		expect(sameSource(folderSource(SET), folderSource({ ...SET, subfolders: true }))).toBe(false)
		expect(sameSource(immichSource('a'), immichSource('b'))).toBe(false)
		expect(sameSource(folderSource(SET), immichSource('a'))).toBe(false)
		expect(sameSource(null, immichSource('a'))).toBe(false)
		expect(sameSource(null, null)).toBe(true)
	})
})

describe('folderSetOf', () => {
	it('gives the folder set of a folder source and null for any other', () => {
		expect(folderSetOf(folderSource(SET))).toBe(SET)
		expect(folderSetOf(immichSource('a'))).toBeNull()
		expect(folderSetOf(null)).toBeNull()
	})
})
