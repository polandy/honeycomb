// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { seriesReport } from '../../../scripts/sharpness-calibration/report.ts'

describe('seriesReport', () => {
	// spec: SERIES-006.21
	it('ranks the photos of a series by sharpness and names the sharpest', () => {
		const report = seriesReport('birds', [
			{ name: 'a.jpg', sharpness: 100, focusTile: 3 },
			{ name: 'b.jpg', sharpness: 250.25, focusTile: 27 },
			{ name: 'c.jpg', sharpness: 200, focusTile: 63 },
		])

		expect(report).toEqual([
			'birds: 3 photos, sharpest b.jpg',
			'  1. b.jpg  250.3  tile 27',
			'  2. c.jpg  200.0  tile 63',
			'  3. a.jpg  100.0  tile 3',
		])
	})

	// spec: SERIES-006.21
	it('names no sharpest when the two best are closer than the margin', () => {
		expect(seriesReport('dogs', [
			{ name: 'a.jpg', sharpness: 100, focusTile: 0 },
			{ name: 'b.jpg', sharpness: 104, focusTile: 1 },
		])[0]).toBe('dogs: 2 photos, sharpest none')
	})

	// spec: SERIES-006.21
	it('reports a photo it could not measure at the end', () => {
		expect(seriesReport('cats', [
			{ name: 'a.jpg', sharpness: 100, focusTile: 0 },
			{ name: 'b.jpg', error: 'not a JPEG' },
		])).toEqual([
			'cats: 2 photos, sharpest none',
			'  1. a.jpg  100.0  tile 0',
			'  -  b.jpg  not measured: not a JPEG',
		])
	})
})
