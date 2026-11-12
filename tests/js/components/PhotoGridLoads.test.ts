// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { IMAGE_LOADS_IN_FLIGHT } from '../../../src/logic/image-tiers.ts'
import { mountGrid } from './mount-grid.ts'

/** A loader that records each URL and settles the oldest running load on `finishOldest`. */
function fakeLoader() {
	const started: string[] = []
	const running: (() => void)[] = []
	const loadImage = (url: string) => new Promise<void>((resolve) => {
		started.push(url)
		running.push(resolve)
	})
	return { started, loadImage, finishOldest: () => running.shift()!() }
}

describe('PhotoGrid image loads', () => {
	// spec: GRID-001.15
	it('loads a few images at a time, the visible tiles first', async () => {
		const loader = fakeLoader()
		const { wrapper, resize } = mountGrid({ loadImage: loader.loadImage, imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}` })

		// 4 columns of 102 px tiles: rows 0–1 visible (tiles 1–8), rows 2–3 overscan (9–16).
		await resize(432, 220)
		expect(loader.started).toEqual(Array.from({ length: IMAGE_LOADS_IN_FLIGHT }, (_, index) => `/img/${index + 1}/256`))

		// Rows 2–3 come into view, rows 4–5 (tiles 17–24) join as overscan.
		const scroller = wrapper.find('[role="grid"]')
		Object.defineProperty(scroller.element, 'scrollTop', { value: 220, configurable: true })
		await scroller.trigger('scroll')
		for (let settled = 0; settled < 24; settled++) {
			loader.finishOldest()
			await flushPromises()
		}

		const tiles = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => `/img/${from + index}/256`)
		expect(loader.started).toEqual([...tiles(1, 6), ...tiles(9, 16), ...tiles(7, 8), ...tiles(17, 24)])
	})
})
