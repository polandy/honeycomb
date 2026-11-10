// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NameTemplate } from '../../../src/logic/name-template/parse.ts'

import { describe, expect, it } from 'vitest'
import { addedSuffix, browserOffset, inViewOrder, memberFiles, moveCounts, nameCandidates, pictureFacts } from '../../../src/logic/move-candidates.ts'
import { planMove } from '../../../src/logic/move-plan.ts'
import { parseNameTemplate } from '../../../src/logic/name-template/parse.ts'
import { DEFAULT_NAME_TEMPLATE } from '../../../src/logic/name-template/presets.ts'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../../src/logic/pairing.ts'
import { listingEntry, pictureOf, picturesOf } from './listing-entries.ts'

const PAIR = pictureOf(
	listingEntry(1, '/Trip/DSC_0001.NEF', { size: 30, mtime: 500, captureTime: 400, camera: 'D850' }),
	listingEntry(2, '/Trip/DSC_0001.JPG', { size: 10, mtime: 200, captureTime: 100, camera: 'Z 6' }),
	listingEntry(3, '/Trip/DSC_0001.NEF.xmp', { size: 1 }),
)
const RAW_ONLY = pictureOf(listingEntry(4, '/Trip/IMG_7.CR3', { mtime: 70, captureTime: null, camera: null }))
const NO_DIGITS = pictureOf(listingEntry(5, '/Trip/sunset.jpg'))

/** The parsed template of the text. */
function template(text: string): NameTemplate {
	const parsed = parseNameTemplate(text)
	if (!parsed.ok) {
		throw new Error(`invalid template ${text}`)
	}
	return parsed.template
}

describe('DEFAULT_NAME_TEMPLATE', () => {
	// spec: MOVE-004.6
	it('is a valid template', () => {
		expect(DEFAULT_NAME_TEMPLATE).toBe('{date:%Y}/{date:%Y-%m-%d}/{date:%H%M%S}_{camera}_{name}.{ext}')
		expect(parseNameTemplate(DEFAULT_NAME_TEMPLATE).ok).toBe(true)
	})
})

describe('pictureFacts', () => {
	// spec: MOVE-004.6
	it('takes time, camera and file time from the rendered member', () => {
		expect(pictureFacts(PAIR, () => 60)).toEqual({ baseName: 'DSC_0001', captureTime: 100, mtime: 200, mtimeOffsetMinutes: 60, make: null, model: 'Z 6' })
	})

	// spec: MOVE-004.6
	it('takes them from the RAW member of a RAW single, and the offset of its file time', () => {
		const offsets: number[] = []

		expect(pictureFacts(RAW_ONLY, (mtime) => offsets.push(mtime))).toMatchObject({ captureTime: null, mtime: 70, model: null, mtimeOffsetMinutes: 1 })
		expect(offsets).toEqual([70])
	})

	// spec: MOVE-004.6
	it('offsets the file time by the browser time zone by default', () => {
		expect(browserOffset(0)).toBe(-new Date(0).getTimezoneOffset())
	})
})

describe('memberFiles', () => {
	// spec: MOVE-004.6
	it('writes each extension as it follows the base name, without subfolders in one folder', () => {
		expect(memberFiles(PAIR).map((file) => file.extension)).toEqual(['JPG', 'NEF', 'NEF.xmp'])
		expect(memberFiles(PAIR).every((file) => file.subfolder === null)).toBe(true)
	})

	// spec: MOVE-004.6
	it('keeps each file in its subfolder in separate-subfolders mode', () => {
		const [picture] = pairPictures([listingEntry(1, '/Trip/RAW/A.NEF'), listingEntry(2, '/Trip/JPG/A.JPG')], {
			...DEFAULT_PAIRING_SETTINGS,
			folderMode: { kind: 'separate-subfolders', rawSubfolder: 'RAW', renderedSubfolder: 'JPG' },
		})

		expect(memberFiles(picture!)).toEqual([{ extension: 'JPG', subfolder: 'JPG' }, { extension: 'NEF', subfolder: 'RAW' }])
	})
})

describe('nameCandidates', () => {
	// spec: MOVE-004.6
	it('renders every file of every picture in its order', () => {
		const [named] = nameCandidates([PAIR], template('{camera}/{name}.{ext}'), () => 0)

		expect(named!.candidate!.files.map((file) => file.entry.fileId)).toEqual([2, 1, 3])
		expect(named!.candidate!.rendered.map((file) => `${file.folder}/${file.name}.${file.extension}`)).toEqual(['Z-6/DSC_0001.JPG', 'Z-6/DSC_0001.NEF', 'Z-6/DSC_0001.NEF.xmp'])
		expect(named!.problem).toBeNull()
	})

	// spec: MOVE-004.15
	it('gives the reason for a picture it cannot name', () => {
		const named = nameCandidates([PAIR, NO_DIGITS], template('{number}.{ext}'), () => 0)

		expect(named.map((each) => each.problem)).toEqual([null, 'no-number'])
		expect(named[1]!.candidate).toBeNull()
	})
})

describe('inViewOrder', () => {
	// spec: MOVE-004.1
	it('orders the pictures as the view does, those outside it last', () => {
		const [a, b, c] = picturesOf([listingEntry(1, '/T/A.JPG'), listingEntry(2, '/T/B.JPG'), listingEntry(3, '/T/C.JPG')])

		expect(inViewOrder([c!, a!, b!], [b!, a!])).toEqual([b, a, c])
	})
})

describe('moveCounts', () => {
	// spec: MOVE-004.6, MOVE-004.7
	it('counts the files sent and the pictures in conflict', () => {
		const named = nameCandidates([PAIR, RAW_ONLY], template('{name}.{ext}'), () => 0)
		const candidates = named.map((each) => each.candidate!)
		const existing = [{ path: '/Out/DSC_0001.JPG', fileId: 90, etag: 'e' }, { path: '/Out/IMG_7.CR3', fileId: 91, etag: 'e' }]

		expect(moveCounts(planMove('/Out', candidates, existing))).toEqual({ files: 4, conflicts: 2 })
		expect(moveCounts(planMove('/Out', candidates, existing, (index) => (index === 0 ? 'skip' : 'suffix')))).toEqual({ files: 1, conflicts: 2 })
	})
})

describe('addedSuffix', () => {
	// spec: MOVE-004.7
	it('names the suffix the plan added to the rendered name', () => {
		const rendered = { folder: 'A', name: 'IMG_2', extension: 'NEF.xmp' }

		expect(addedSuffix(rendered, '/Out/A/IMG_2-3.NEF.xmp')).toBe('-3')
		expect(addedSuffix(rendered, '/Out/A/IMG_2.NEF.xmp')).toBeNull()
	})
})
