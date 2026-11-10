// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarBytes } from '../../../../src/logic/xmp/decision.ts'

import { describe, expect, it } from 'vitest'
import { pictureSidecarDecision, sidecarDecision } from '../../../../src/logic/xmp/decision.ts'
import { XmpError } from '../../../../src/logic/xmp/model.ts'
import { readXmp } from '../../../../src/logic/xmp/parse.ts'
import expected from '../../../fixtures/xmp/expected.json' with { type: 'json' }
import { fixtureBytes, packetOf, seq } from './xmp-builders.ts'

const DECIDED = Object.entries(expected).flatMap(([name, value]) => ('error' in value ? [] : [[name, value] as const]))

/** The decision of a single whose sidecar states the given properties. */
function decisionOf(properties: Parameters<typeof packetOf>[0], isPair = false) {
	return sidecarDecision(packetOf(properties), isPair)
}

describe('sidecarDecision', () => {
	// spec: XMP-001.7
	it.each(DECIDED)('reads %s as its expected decision', (name, value) => {
		expect(sidecarDecision(readXmp(fixtureBytes(name)), false)).toEqual({ ...value, keepRaw: false })
	})

	// spec: XMP-001.7
	it('refuses conflict.xmp with its expected error', () => {
		expect(() => readXmp(fixtureBytes('conflict.xmp'))).toThrow(expected['conflict.xmp'].error)
	})

	// spec: XMP-001.8
	it.each([
		['nothing', {}, 'unflagged'],
		['PickLabel 0 before pick 1', { 'digiKam:PickLabel': '0', 'xmpDM:pick': '1' }, 'unflagged'],
		['PickLabel 1', { 'digiKam:PickLabel': '1' }, 'rejected'],
		['PickLabel 2 (pending) before pick -1', { 'digiKam:PickLabel': '2', 'xmpDM:pick': '-1' }, 'unflagged'],
		['PickLabel 3 before rating -1', { 'digiKam:PickLabel': '3', 'xmp:Rating': '-1' }, 'picked'],
		['an invalid PickLabel 4 before pick 1', { 'digiKam:PickLabel': '4', 'xmpDM:pick': '1' }, 'picked'],
		['a PickLabel that is no number before pick -1', { 'digiKam:PickLabel': 'x', 'xmpDM:pick': '-1' }, 'rejected'],
		['pick 1 before rating -1', { 'xmpDM:pick': '1', 'xmp:Rating': '-1' }, 'picked'],
		['pick 0 skipped for good true', { 'xmpDM:pick': '0', 'xmpDM:good': 'true' }, 'picked'],
		['pick 0 skipped for rating -1', { 'xmpDM:pick': '0', 'xmp:Rating': '-1' }, 'rejected'],
		['good FALSE', { 'xmpDM:good': 'FALSE' }, 'rejected'],
		['good True before rating -1', { 'xmpDM:good': 'True', 'xmp:Rating': '-1' }, 'picked'],
		['an unknown good skipped for rating -1', { 'xmpDM:good': 'maybe', 'xmp:Rating': '-1' }, 'rejected'],
		['rating -1', { 'xmp:Rating': '-1' }, 'rejected'],
		['a PickLabel that is an array', { 'digiKam:PickLabel': seq(['3']) }, 'unflagged'],
	])('reads the flag from %s', (_, properties, flag) => {
		expect(decisionOf(properties).flag).toBe(flag)
	})

	// spec: XMP-001.9
	it.each([
		['4', 4],
		['2.5', 2],
		['-1', 0],
		['7', 0],
		['abc', 0],
		['', 0],
	])('reads the rating %j as %d', (rating, stars) => {
		expect(decisionOf({ 'xmp:Rating': rating }).rating).toBe(stars)
	})

	// spec: XMP-001.9
	it('reads no rating as 0', () => {
		expect(decisionOf({}).rating).toBe(0)
	})

	// spec: XMP-001.10
	it.each([
		['NoColor', null],
		['Red', 'red'],
		['Orange', 'orange'],
		['Yellow', 'yellow'],
		['Green', 'green'],
		['Blue', 'blue'],
		['Purple', 'magenta'],
		['Gray', 'gray'],
		['Black', 'black'],
		['White', 'white'],
	])('reads the xmp:Label %s as %s', (label, colourLabel) => {
		expect(decisionOf({ 'xmp:Label': label, 'darktable:colorlabels': seq(['3']) }).colourLabel).toBe(colourLabel)
	})

	// spec: XMP-001.10
	it.each([
		['ColorLabel 5 before Label Red', { 'digiKam:ColorLabel': '5', 'xmp:Label': 'Red' }, 'blue'],
		['ColorLabel 0 before Label Red', { 'digiKam:ColorLabel': '0', 'xmp:Label': 'Red' }, null],
		['an invalid ColorLabel 12 skipped for Label Red', { 'digiKam:ColorLabel': '12', 'xmp:Label': 'Red' }, 'red'],
		['a lower-case Label skipped for darktable 2', { 'xmp:Label': 'red', 'darktable:colorlabels': seq(['2']) }, 'green'],
		['an unknown Label skipped for darktable 1', { 'xmp:Label': 'To print', 'darktable:colorlabels': seq(['1']) }, 'yellow'],
		['darktable 3 and 0, the lowest', { 'darktable:colorlabels': seq(['3', '0']) }, 'red'],
		['darktable 4', { 'darktable:colorlabels': seq(['4']) }, 'magenta'],
		['darktable indexes out of range', { 'darktable:colorlabels': seq(['9', 'x']) }, null],
		['darktable labels that are no array', { 'darktable:colorlabels': '2' }, null],
		['nothing', {}, null],
	])('reads the colour label from %s', (_, properties, colourLabel) => {
		expect(decisionOf(properties).colourLabel).toBe(colourLabel)
	})

	// spec: XMP-001.11
	it.each([
		['True', true, true],
		['true', true, true],
		['False', true, false],
		['True', false, false],
		['true', false, false],
	])('reads KeepRaw %s for a pair (%s) as %s', (keepRaw, isPair, marked) => {
		expect(decisionOf({ 'honeycomb:KeepRaw': keepRaw }, isPair).keepRaw).toBe(marked)
	})
})

/** A sidecar of a picture with its modification time and owner. */
function sidecar(name: string, mtime: number, ofRaw: boolean, bytes: Uint8Array): SidecarBytes {
	return { name, mtime, ofRaw, bytes }
}

describe('pictureSidecarDecision', () => {
	const threeStars = fixtureBytes('digikam.xmp')
	const rejected = fixtureBytes('darktable.xmp')

	// spec: XMP-001.12
	it('takes the more recently modified sidecar as a whole and reports the disagreement', () => {
		const result = pictureSidecarDecision([
			sidecar('IMG_0001.NEF.xmp', 100, true, rejected),
			sidecar('IMG_0001.JPG.xmp', 200, false, threeStars),
		], true)
		expect(result.winner).toEqual({ name: 'IMG_0001.JPG.xmp', decision: { rating: 3, flag: 'picked', colourLabel: 'blue', keepRaw: false } })
		expect(result.disagreeing).toEqual(['IMG_0001.NEF.xmp'])
		expect(result.refused).toEqual([])
	})

	// spec: XMP-001.12
	it('gives a tie to the RAW member\'s sidecar', () => {
		const result = pictureSidecarDecision([
			sidecar('IMG_0001.JPG.xmp', 100, false, threeStars),
			sidecar('IMG_0001.NEF.xmp', 100, true, rejected),
		], true)
		expect(result.winner?.name).toBe('IMG_0001.NEF.xmp')
		expect(result.disagreeing).toEqual(['IMG_0001.JPG.xmp'])
	})

	// spec: XMP-001.12
	it('reports a refused sidecar and skips it even when it is the newest', () => {
		const result = pictureSidecarDecision([
			sidecar('IMG_0001.NEF.xmp', 100, true, threeStars),
			sidecar('IMG_0001.JPG.xmp', 300, false, fixtureBytes('conflict.xmp')),
		], true)
		expect(result.winner?.name).toBe('IMG_0001.NEF.xmp')
		expect(result.refused).toHaveLength(1)
		expect(result.refused[0]?.name).toBe('IMG_0001.JPG.xmp')
		expect(result.refused[0]?.error).toBeInstanceOf(XmpError)
	})

	it('reports no disagreement when the sidecars agree', () => {
		const result = pictureSidecarDecision([
			sidecar('IMG_0001.NEF.xmp', 100, true, threeStars),
			sidecar('IMG_0001.JPG.xmp', 200, false, threeStars),
		], true)
		expect(result.winner?.name).toBe('IMG_0001.JPG.xmp')
		expect(result.disagreeing).toEqual([])
	})

	it('has no winner without a readable sidecar', () => {
		expect(pictureSidecarDecision([], false)).toEqual({ winner: null, disagreeing: [], refused: [] })
	})
})
