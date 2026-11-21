// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mountGrid, picturesIn } from './mount-grid.ts'

const PAGE = picturesIn({ '/P': 100 })

describe('PhotoGrid paging', () => {
	// spec: IMMICH-002.6
	it('keeps the scroll position when a page is added after the shown pictures', async () => {
		const { wrapper, resize } = mountGrid({ pictures: PAGE.slice(0, 60) })
		await resize(432, 220)
		const scroller = wrapper.find('[role="grid"]').element
		Object.defineProperty(scroller, 'scrollTop', { value: 110 * 10, writable: true, configurable: true })
		await wrapper.find('[role="grid"]').trigger('scroll')

		await wrapper.setProps({ pictures: PAGE })

		expect(scroller.scrollTop).toBe(110 * 10)
	})

	// spec: IMMICH-002.6
	it('tells the index of the last tile it renders, one screen below the viewport', async () => {
		const { wrapper, resize } = mountGrid()
		// 4 columns of 102 px tiles: rows 0–1 visible, rows 2–3 rendered below.
		await resize(432, 220)

		expect(wrapper.emitted('shown')!.at(-1)).toEqual([15])
	})

	// spec: IMMICH-002.7
	it('renders, and so loads previews for, only the tiles in or near the viewport', async () => {
		const { wrapper, resize } = mountGrid({ imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}` })
		await resize(432, 220)

		expect(wrapper.findAll('[role="gridcell"]')).toHaveLength(16)
	})

	it('shows a group\'s folder as it is when it has no folder set', async () => {
		const { wrapper, resize } = mountGrid({ pictures: picturesIn({ 'Friday, 20 November 2026': 2 }), folderSet: undefined, groupByFolder: true })
		await resize(432, 220)

		expect(wrapper.find('.photo-grid__header').text()).toBe('Friday, 20 November 2026 2')
	})
})
