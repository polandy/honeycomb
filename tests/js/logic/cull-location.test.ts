// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { locationHash, parseLocation } from '../../../src/logic/cull-location.ts'

const SET = { paths: ['/Trip', '/Trip/Café'], subfolders: true, excluded: ['/Trip/Skip'] }

describe('locationHash', () => {
	// spec: DECISIONS-002.17
	it('round-trips the folder set and the picture of the loupe', () => {
		expect(parseLocation(locationHash(SET, 7))).toEqual({ folderSet: SET, fileId: 7 })
	})

	// spec: DECISIONS-002.17
	it('round-trips a folder set without a picture and without exclusions', () => {
		const set = { paths: [''], subfolders: false }
		expect(parseLocation(locationHash(set, null))).toEqual({ folderSet: set, fileId: null })
	})

	// spec: DECISIONS-002.17
	it('is empty without a folder set', () => {
		expect(locationHash(null, 7)).toBe('')
	})
})

describe('parseLocation', () => {
	// spec: DECISIONS-002.17
	it.each([
		['an empty hash', ''],
		['another hash', '#something'],
		['broken JSON', '#cull=%7B'],
		['no paths', `#cull=${encodeURIComponent('{"paths":[],"subfolders":true}')}`],
		['a path that is no string', `#cull=${encodeURIComponent('{"paths":[1],"subfolders":true}')}`],
		['no subfolders flag', `#cull=${encodeURIComponent('{"paths":["/A"]}')}`],
		['malformed exclusions', `#cull=${encodeURIComponent('{"paths":["/A"],"subfolders":true,"excluded":"/B"}')}`],
		['a picture that is no number', `#cull=${encodeURIComponent('{"paths":["/A"],"subfolders":true,"fileId":"x"}')}`],
	])('reads nothing from %s', (_, hash) => {
		expect(parseLocation(hash)).toBeNull()
	})
})
