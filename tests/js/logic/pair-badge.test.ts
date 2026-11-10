// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { pairBadge } from '../../../src/logic/pair-badge.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

describe('pairBadge', () => {
	it.each([
		['a JPEG and CR3 pair', ['/P/A.CR3', '/P/A.jpg'], { kind: 'pair', label: 'JPG+CR3' }],
		['a .jpeg file as JPG', ['/P/A.nef', '/P/A.JPEG'], { kind: 'pair', label: 'JPG+NEF' }],
		['a HEIC and DNG pair', ['/P/A.dng', '/P/A.heic'], { kind: 'pair', label: 'HEIC+DNG' }],
		['a JPEG single', ['/P/A.jpg'], { kind: 'rendered-only', extension: 'JPG' }],
		['a HIF single', ['/P/A.hif'], { kind: 'rendered-only', extension: 'HIF' }],
		['a RAW single', ['/P/A.Arw'], { kind: 'raw-only', extension: 'ARW' }],
	])('labels %s', (_case, paths, badge) => {
		const picture = pictureOf(...paths.map((path, index) => listingEntry(index + 1, path)))

		expect(pairBadge(picture)).toEqual(badge)
	})
})
