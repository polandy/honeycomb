// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { locationHash, parseLocation, parseTarget, targetHash } from '../../../src/logic/cull-location.ts'

const hashOf = (json: string) => `#cull=${encodeURIComponent(json)}`
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
	it('writes the current format version', () => {
		const json = decodeURIComponent(locationHash(SET, 7).slice('#cull='.length))
		expect(JSON.parse(json)).toMatchObject({ v: 1 })
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
		['no version', hashOf('{"paths":["/A"],"subfolders":true}')],
		['a foreign version', hashOf('{"v":2,"paths":["/A"],"subfolders":true}')],
		['a version that is no number', hashOf('{"v":"1","paths":["/A"],"subfolders":true}')],
		['no paths', `#cull=${encodeURIComponent('{"v":1,"paths":[],"subfolders":true}')}`],
		['a path that is no string', `#cull=${encodeURIComponent('{"v":1,"paths":[1],"subfolders":true}')}`],
		['no subfolders flag', `#cull=${encodeURIComponent('{"v":1,"paths":["/A"]}')}`],
		['malformed exclusions', `#cull=${encodeURIComponent('{"v":1,"paths":["/A"],"subfolders":true,"excluded":"/B"}')}`],
		['a picture that is no number', `#cull=${encodeURIComponent('{"v":1,"paths":["/A"],"subfolders":true,"fileId":"x"}')}`],
	])('reads nothing from %s', (_, hash) => {
		expect(parseLocation(hash)).toBeNull()
	})
})

describe('targetHash', () => {
	// spec: APP-001.26
	it.each(['folder-picker', 'settings'] as const)('round-trips what the cull page opens: %s', (target) => {
		expect(parseTarget(targetHash(target))).toBe(target)
		expect(parseLocation(targetHash(target))).toBe(null)
	})

	// spec: APP-001.26
	it.each(['', '#open=', '#open=trash', '#open=settings2', locationHash(SET, null)])('names no target for %j', (hash) => {
		expect(parseTarget(hash)).toBe(null)
	})
})
