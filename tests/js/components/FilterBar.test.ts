// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Filters } from '../../../src/logic/picture-filter.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FilterBar from '../../../src/components/FilterBar.vue'
import { DEFAULT_FILTERS } from '../../../src/logic/picture-filter.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK

function mountBar(filters: Partial<Filters> = {}, folders = ['/Trip', '/Trip/Day 2']) {
	return mount(FilterBar, {
		props: { filters: { ...DEFAULT_FILTERS, ...filters }, folders, folderSet: { paths: ['/Trip'], subfolders: true }, shown: 1840, total: 2000 },
	})
}

type Bar = ReturnType<typeof mountBar>

const plain = (text: string | undefined) => text?.replaceAll(MARK, '')
const chip = (wrapper: Bar, label: string) => wrapper.findAll('button').find((button) => plain(button.attributes('aria-label')) === label || plain(button.text()) === label)!
const comparison = (wrapper: Bar) => wrapper.find('.filter-bar__comparison')
const emitted = (wrapper: Bar) => wrapper.emitted<[Filters]>('update:filters')!.map(([filters]) => filters)

describe('FilterBar', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: GRID-002.3
	it('selects Any while no rating filter is active and disables the comparison', () => {
		const wrapper = mountBar()

		expect(chip(wrapper, 'Any').attributes('aria-pressed')).toBe('true')
		expect(comparison(wrapper).attributes('disabled')).toBeDefined()
		expect(comparison(wrapper).text()).toBe('≥')
		expect(comparison(wrapper).attributes('aria-label')).toBe(`${MARK}Rating comparison: pick a star count first`)
		// spec: APP-002.9
		expect(comparison(wrapper).attributes('data-tip')).toBe(`${MARK}Rating comparison: pick a star count first`)
	})

	// spec: GRID-002.3
	it('names each star chip by the comparison and filters by it', async () => {
		const wrapper = mountBar()
		const stars = wrapper.findAll('.filter-bar__star')

		expect(stars.map((star) => star.text())).toEqual(['0★', '1★', '2★', '3★', '4★', '5★'])
		expect(plain(stars[1]!.attributes('aria-label'))).toBe('At least 1 star')
		await stars[3]!.trigger('click')

		expect(emitted(wrapper)[0]).toMatchObject({ rating: 3, comparison: 'at-least' })
	})

	it.each([
		['at-least', '≥', 'At least', 'At most', 'at-most'],
		['at-most', '≤', 'At most', 'Exactly', 'exactly'],
		['exactly', '=', 'Exactly', 'At least', 'at-least'],
	// spec: GRID-002.3
	] as const)('cycles the comparison from %s', async (current, symbol, now, next, after) => {
		const wrapper = mountBar({ rating: 2, comparison: current })

		expect(comparison(wrapper).text()).toBe(symbol)
		expect(comparison(wrapper).attributes('aria-label')).toBe(`${MARK}Rating comparison: ${MARK}${now}. Tap for: ${MARK}${next}`)
		expect(chip(wrapper, `${now} 2 stars`).attributes('aria-pressed')).toBe('true')
		await comparison(wrapper).trigger('click')

		expect(emitted(wrapper)).toEqual([{ ...DEFAULT_FILTERS, rating: 2, comparison: after }])
	})

	// spec: GRID-002.3
	it('turns the rating filter off by Any or by the pressed star chip', async () => {
		const wrapper = mountBar({ rating: 4 })

		await chip(wrapper, 'Any').trigger('click')
		await chip(wrapper, 'At least 4 stars').trigger('click')

		expect(emitted(wrapper).map((filters) => filters.rating)).toEqual([null, null])
	})

	it.each([
		['Red', 'colourLabels', 'red'],
		['White', 'colourLabels', 'white'],
		['Picked', 'flags', 'picked'],
		['Rejected', 'flags', 'rejected'],
		['Unflagged', 'flags', 'unflagged'],
		['Pairs', 'pairings', 'pair'],
		['JPEG only', 'pairings', 'rendered-only'],
		['RAW only', 'pairings', 'raw-only'],
		['Marked', 'keepRaw', 'marked'],
		['Not marked', 'keepRaw', 'not-marked'],
	// spec: GRID-002.4
	] as const)('switches the %s chip', async (label, group, value) => {
		const off = mountBar()
		expect(chip(off, label).attributes('aria-pressed')).toBe('false')
		await chip(off, label).trigger('click')
		expect([...emitted(off)[0]![group]]).toEqual([value])

		const on = mountBar({ [group]: new Set([value]) })
		expect(chip(on, label).attributes('aria-pressed')).toBe('true')
		await chip(on, label).trigger('click')
		expect(emitted(on)[0]![group].size).toBe(0)
	})

	// spec: GRID-002.4
	it('offers a swatch for each of the nine colour labels', () => {
		const swatches = mountBar().findAll('.filter-bar__swatch')
		const names = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Magenta', 'Gray', 'Black', 'White']

		expect(swatches.map((swatch) => swatch.attributes('aria-label'))).toEqual(names.map((name) => `${MARK}${name}`))
		// spec: APP-002.9
		expect(swatches.map((swatch) => swatch.attributes('data-tip'))).toEqual(names.map((name) => `${MARK}${name}`))
	})

	// spec: GRID-002.4
	it('labels the folder chips relative to the folder set and filters by folder', async () => {
		const wrapper = mountBar()

		expect(wrapper.text()).toContain(`${MARK}Folder`)
		await chip(wrapper, 'Day 2').trigger('click')

		expect([...emitted(wrapper)[0]!.folders]).toEqual(['/Trip/Day 2'])
	})

	// spec: GRID-002.4
	it('has no folder group for a single folder', () => {
		expect(mountBar({}, ['/Trip']).text()).not.toContain(`${MARK}Folder`)
	})

	// spec: GRID-002.5
	it('says how filters combine and how many photos pass', () => {
		const text = mountBar().text()

		expect(text).toContain(`${MARK}Within a group: any. Across groups: all.`)
		expect(text).toContain(`${MARK}1,840 of 2,000`)
	})

	// spec: GRID-002.6
	it('clears the filters but keeps the scope, and is disabled while none is active', async () => {
		expect(chip(mountBar({ scope: 'all' }), 'Clear filters').attributes('disabled')).toBeDefined()
		const wrapper = mountBar({ scope: 'undecided', rating: 3, flags: new Set(['picked']) })

		await chip(wrapper, 'Clear filters').trigger('click')

		expect(emitted(wrapper)).toEqual([{ ...DEFAULT_FILTERS, scope: 'undecided' }])
	})

	it('renders no text that bypasses the catalogue but folder names', () => {
		const wrapper = mountBar({ rating: 1 })

		expect(untranslatedText(wrapper.element as Element)).toEqual(['Trip', 'Day 2'])
	})
})
