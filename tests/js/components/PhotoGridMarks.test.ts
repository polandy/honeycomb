// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mountGrid } from './mount-grid.ts'

const tile = (wrapper: ReturnType<typeof mountGrid>['wrapper'], index: number) => wrapper.findAll('[role="gridcell"]')[index]!

describe('PhotoGrid tile marks', () => {
	// spec: GRID-001.10
	it('marks the selected tiles and shows each decision', async () => {
		const decisionOf = (picture: { baseName: string }) => ({ rating: picture.baseName === 'IMG_1' ? 2 : 0, colourLabel: null, flag: 'unflagged' as const, keepRaw: false })
		const { wrapper, resize } = mountGrid({ selection: { ids: new Set([2]), anchor: 2 }, selecting: true, decisionOf })
		await resize(432, 220)

		expect(tile(wrapper, 1).attributes('aria-selected')).toBe('true')
		expect(tile(wrapper, 0).attributes('aria-selected')).toBe('false')
		expect(tile(wrapper, 1).find('.photo-tile__stars').text()).toBe('★★')
	})

	// spec: TAGS-004.7
	it('counts each picture\'s tags on its tile', async () => {
		const tagsOf = (picture: { baseName: string }) => (picture.baseName === 'IMG_1' ? ['Anna', 'Sunrise'] : [])
		const { wrapper, resize } = mountGrid({ tagsOf })
		await resize(432, 220)

		expect(tile(wrapper, 1).find('.photo-tile__tags').text()).toBe('2')
		expect(tile(wrapper, 0).find('.photo-tile__tags').exists()).toBe(false)
	})
})
