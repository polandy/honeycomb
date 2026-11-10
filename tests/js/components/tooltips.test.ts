// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { VueWrapper } from '@vue/test-utils'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ColourLabels from '../../../src/components/ColourLabels.vue'
import FlagButtons from '../../../src/components/FlagButtons.vue'
import FlagButtonsToggle from '../../../src/components/FlagButtonsToggle.vue'
import GridToolbar from '../../../src/components/GridToolbar.vue'
import LoupeNavButtons from '../../../src/components/LoupeNavButtons.vue'
import LoupeTitleRow from '../../../src/components/LoupeTitleRow.vue'
import PickRestButton from '../../../src/components/PickRestButton.vue'
import StarRating from '../../../src/components/StarRating.vue'
import { PopoverStub } from './stubs.ts'

/** Each tooltip in the component as label and key cap, in document order. */
const tips = (wrapper: VueWrapper) => wrapper.findAll('[data-tip]').map((found) => [found.attributes('data-tip'), found.attributes('data-tip-key') ?? null])

/** Whether any element uses the native title. */
const hasTitle = (wrapper: VueWrapper) => wrapper.find('[title]').exists()

describe('the tooltips of the icon-only controls', () => {
	// spec: APP-002.9
	it('name the grid toolbar\'s controls and their keys', () => {
		const wrapper = mount(GridToolbar, {
			props: { folderSet: { paths: ['/Trip'], subfolders: false }, folders: 1, tileSize: 150, groupByFolder: false, scope: 'all', scopeLocked: false, decided: 0, total: 1, activeFilters: 0, filtersOpen: false, sortOrder: 'file-name', selecting: false, selected: 0, rejected: 2, series: 1, rawRemovable: 0, sidecarsShared: false, movable: 0, resumeName: null },
			global: { stubs: { NcPopover: PopoverStub } },
		})

		expect(tips(wrapper)).toEqual([
			['Change folders', null],
			['Filter', '\\'],
			['Select', null],
			['Review rejects', 'Ctrl+Backspace'],
			['Compare series', 'N'],
			['More', null],
		])
		expect(hasTitle(wrapper)).toBe(false)
	})

	// spec: APP-002.9
	it('name the loupe\'s title row and paging buttons and their keys', () => {
		const row = mount(LoupeTitleRow, { props: { name: 'IMG_7', index: 1, count: 3, zoom: null, infoOpen: false, filmstripOpen: true, navigationShown: false, flagButtonsShown: true } })
		const paging = mount(LoupeNavButtons, { props: { index: 1, count: 3 } })

		expect(tips(row)).toEqual([
			['Close loupe', 'Esc'],
			['Fit / 100 %', 'Z'],
			['Move this photo', 'M'],
			['Flag buttons', 'B'],
			['Info panel', 'I'],
			['Filmstrip', null],
			['Nextcloud navigation', null],
		])
		expect(tips(paging)).toEqual([['Previous photo', '←'], ['Next photo', '→']])
		expect(tips(mount(FlagButtonsToggle, { props: { shown: false } }))).toEqual([['Flag buttons', 'B']])
	})

	// spec: APP-002.9
	it('name the decision controls and their keys', async () => {
		const labels = mount(ColourLabels, { props: { colourLabel: null } })
		await labels.find('.colour-labels__opener').trigger('click')

		expect(tips(mount(FlagButtons, { props: { flag: undefined } }))).toEqual([['Pick', 'P'], ['Reject', 'X'], ['Unflag', 'U']])
		expect(tips(mount(StarRating, { props: { rating: 0 } }))).toEqual([
			['Clear rating', '0'],
			['Rate 1 star', '1'],
			['Rate 2 stars', '2'],
			['Rate 3 stars', '3'],
			['Rate 4 stars', '4'],
			['Rate 5 stars', '5'],
		])
		expect(tips(labels)).toEqual([
			['Colour label', null],
			['Red', '6'],
			['Orange', null],
			['Yellow', '7'],
			['Green', '8'],
			['Blue', '9'],
			['Magenta', null],
			['Gray', null],
			['Black', null],
			['White', null],
			['No label', null],
		])
		const pickRest = mount(PickRestButton)
		expect(tips(pickRest)).toEqual([['Pick this, reject the rest', 'Shift+K']])
		expect(hasTitle(pickRest)).toBe(false)
	})
})
