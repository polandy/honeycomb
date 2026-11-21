// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { assetDecision, assetPicture, decisionRow, withDecision } from '../../../src/logic/immich-asset.ts'
import { immichEntry, NOW } from './immich-fixtures.ts'

const PICKED = { rating: 3, colourLabel: 'red', flag: 'picked', keepRaw: false } as const

describe('assetPicture', () => {
	// spec: IMMICH-002.4
	it('makes each entry one picture of its rendered member under the grid id, without RAW or sidecars', () => {
		const live = immichEntry('a1', { name: 'PXL_20261120.MP.jpg', kind: 'live', duration: 2.5, flag: 'picked' })

		expect(assetPicture(live, 7, 'Friday, 20 November 2026')).toEqual({
			raw: null,
			rendered: { fileId: 7, path: 'PXL_20261120.MP.jpg', mtime: NOW, mime: 'image/jpeg', captureTime: NOW, orientation: null, width: 4000, height: 3000, camera: 'Pixel 9 Pro', flag: 'picked', keepRaw: false, flagUpdated: null, asset: live },
			folder: 'Friday, 20 November 2026',
			baseName: 'PXL_20261120.MP',
			sidecars: [],
			ambiguous: false,
		})
	})

	// spec: IMMICH-002.4
	it('keeps the stack size and the video duration on the member', () => {
		const stack = assetPicture(immichEntry('s1', { stackSize: 3 }), 1, '')
		const video = assetPicture(immichEntry('v1', { name: 'clip.mp4', kind: 'video', duration: 12 }), 2, '')

		expect(stack.rendered?.asset.stackSize).toBe(3)
		expect(video.rendered?.asset.duration).toBe(12)
		expect(video.rendered?.mime).toBe('video/mp4')
		expect(video.baseName).toBe('clip')
	})
})

describe('assetDecision', () => {
	// spec: IMMICH-002.4
	it('reads the decision the entry carries', () => {
		expect(assetDecision(immichEntry('a1', PICKED))).toEqual(PICKED)
	})
})

describe('withDecision', () => {
	it('gives the entry the new decision and keeps its asset fields', () => {
		const entry = immichEntry('a1')

		expect(withDecision(entry, PICKED)).toEqual({ ...entry, ...PICKED })
	})
})

describe('decisionRow', () => {
	// spec: IMMICH-003.3
	it('saves the whole decision with the asset fields the decision table keeps', () => {
		const entry = immichEntry('a1', { takenAt: 1700000000, cameraModel: null, kind: 'video', updatedAt: '2026-11-19T08:00:00.000Z' })

		expect(decisionRow(entry, PICKED)).toEqual({
			assetId: 'a1',
			...PICKED,
			takenAt: 1700000000,
			cameraModel: null,
			kind: 'video',
			assetUpdatedAt: '2026-11-19T08:00:00.000Z',
		})
	})
})
