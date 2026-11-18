// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { EmbeddedXmpAnswer } from '../../../src/logic/embedded-xmp.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { planSaves } from '../../../src/logic/sidecar-sync.ts'
import { sidecarDecision } from '../../../src/logic/xmp/decision.ts'
import { readXmp } from '../../../src/logic/xmp/parse.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'
import { read, xmp } from './sidecar-answers.ts'
import { CANONICAL_TIME, itemsOf } from './xmp/xmp-builders.ts'

const NEF = listingEntry(1, '/P/IMG_0001.NEF', { mime: 'image/x-nikon-nef' })
const JPG = listingEntry(2, '/P/IMG_0001.JPG', { mtime: 200 })
const NEF_XMP = listingEntry(11, '/P/IMG_0001.NEF.xmp')
const PAIR = pictureOf(NEF, JPG, NEF_XMP)
const ALONE = pictureOf(listingEntry(3, '/P/B.JPG'))

/** An embedded XMP answer `read` with the properties. */
function embedded(properties: Record<string, string>): EmbeddedXmpAnswer {
	return { result: 'read', bytes: xmp(properties) }
}

/** The decision each planned save writes, by path. */
function written(saves: ReturnType<typeof planSaves>['saves'], isPair = true) {
	return saves.map(({ path, item }) => [path, sidecarDecision(readXmp(item.bytes), isPair)])
}

describe('planSaves with the embedded XMP for a decision', () => {
	// spec: XMP-003.23
	it('starts the JPEG\'s new sidecar from the embedded decision, the others from their own', () => {
		const answers = new Map([[11, read(xmp({ 'xmp:Rating': '1' }), 300)]])

		const { saves, failed } = planSaves(PAIR, { decision: { flag: 'picked' } }, new Map(), answers, CANONICAL_TIME, undefined, new Map([[2, embedded({ 'xmp:Rating': '4', 'digiKam:ColorLabel': '4' })]]))

		expect(failed).toEqual([])
		expect(written(saves)).toEqual([
			['/P/IMG_0001.NEF.xmp', { ...UNDECIDED, rating: 1, flag: 'picked' }],
			['/P/IMG_0001.JPG.xmp', { ...UNDECIDED, rating: 4, colourLabel: 'green', flag: 'picked' }],
		])
	})

	// spec: XMP-003.21, XMP-003.23
	it('starts a new RAW sidecar from the embedded decision when it is all the picture states', () => {
		const pair = pictureOf(NEF, JPG)

		const { saves } = planSaves(pair, { decision: { rating: 5 } }, new Map(), new Map(), CANONICAL_TIME, undefined, new Map([[2, embedded({ 'xmp:Rating': '2', 'digiKam:ColorLabel': '1' })]]))
		const none = planSaves(pair, { decision: { rating: 5 } }, new Map(), new Map(), CANONICAL_TIME, undefined, new Map([[2, { result: 'none' }]]))

		expect(written(saves).map(([, decision]) => decision)).toEqual([{ ...UNDECIDED, rating: 5, colourLabel: 'red' }, { ...UNDECIDED, rating: 5, colourLabel: 'red' }])
		expect(written(none.saves).map(([, decision]) => decision)).toEqual([{ ...UNDECIDED, rating: 5 }, { ...UNDECIDED, rating: 5 }])
	})

	// spec: XMP-003.23
	it('writes the embedded decision into the JPEG\'s sidecar that a tag change creates', () => {
		const { saves } = planSaves(ALONE, { tags: { added: ['Kids'], removed: [] } }, new Map(), new Map(), CANONICAL_TIME, undefined, new Map([[3, embedded({ 'xmp:Rating': '3', 'digiKam:PickLabel': '1' })]]))

		expect(written(saves, false)).toEqual([['/P/B.JPG.xmp', { ...UNDECIDED, rating: 3, flag: 'rejected' }]])
		expect(itemsOf(readXmp(saves[0]!.item.bytes), 'digiKam:TagsList')).toEqual(['Kids'])
	})

	// spec: XMP-003.24
	it('fails every sidecar of the picture when its embedded XMP was not read', () => {
		const { saves, failed } = planSaves(PAIR, { decision: { rating: 2 } }, new Map(), new Map([[11, read(xmp({}))]]), CANONICAL_TIME, undefined, new Map([[2, { result: 'notPermitted' }]]))

		expect(saves).toEqual([])
		expect(failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: PAIR, reason: 'notPermitted' }, { path: '/P/IMG_0001.JPG.xmp', picture: PAIR, reason: 'notPermitted' }])
	})
})
