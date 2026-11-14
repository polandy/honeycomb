// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import LoupeTitleRow from '../../../src/components/LoupeTitleRow.vue'
import { mountLoupe, PICTURES } from './mount-loupe.ts'

enableAutoUnmount(afterEach)

const CHIP = '.loupe-title-row__series'

describe('LoupeTitleRow: the series chip', () => {
	const mountRow = (series: { position: number, count: number } | null) => mount(LoupeTitleRow, {
		props: { name: 'IMG_7', index: 6, count: 120, zoom: null, infoOpen: false, filmstripOpen: true, navigationShown: false, flagButtonsShown: true, series },
	})

	// spec: LOUPE-001.25
	it('follows the position count with the photo\'s place in its series, named with its key', async () => {
		const wrapper = mountRow({ position: 2, count: 5 })
		const chip = wrapper.find(CHIP)

		expect(wrapper.find('.loupe-title-row__count + ' + CHIP).exists()).toBe(true)
		expect(chip.text()).toMatch(/^⧉\s*Series\s*2\/5$/)
		expect(chip.find('.loupe-title-row__series-word').text()).toBe('Series')
		expect(chip.attributes('aria-label')).toBe('Photo 2 of a series of 5 – compare')
		expect(chip.attributes('data-tip')).toBe('Compare this series')
		expect(chip.attributes('data-tip-key')).toBe('N')
		await chip.trigger('click')
		expect(wrapper.emitted('compareSeries')).toHaveLength(1)
	})

	// spec: LOUPE-001.25
	it('shows no chip outside a series', () => {
		expect(mountRow(null).find(CHIP).exists()).toBe(false)
	})
})

/** The series of the pictures from `first` to before `end`, each mapped to it. */
function seriesOf(first: number, end: number) {
	const series = PICTURES.slice(first, end)
	return new Map(series.map((picture) => [picture, series] as const))
}

/** The compare openings the loupe emitted, as the series' names and the active one's. */
function openings(wrapper: Awaited<ReturnType<typeof mountLoupe>>['wrapper']) {
	return (wrapper.emitted('compareSeries') as [readonly Picture<ListingEntry>[], Picture<ListingEntry>][] | undefined)
		?.map(([series, active]) => `${series.map((picture) => picture.baseName).join(' ')}: ${active.baseName}`)
}

describe('PhotoLoupe: the series chip and N', () => {
	// spec: LOUPE-001.25
	it('opens the compare on the shown photo\'s series by the chip or N, the shown photo active', async () => {
		const { wrapper, root } = await mountLoupe(4, {}, false, { seriesOf: seriesOf(3, 6) })

		expect(wrapper.find(CHIP).text()).toContain('2/3')
		await wrapper.find(CHIP).trigger('click')
		await root.trigger('keydown', { key: 'n' })
		expect(openings(wrapper)).toEqual(['IMG_4 IMG_5 IMG_6: IMG_5', 'IMG_4 IMG_5 IMG_6: IMG_5'])
	})

	// spec: LOUPE-001.25
	it('shows no chip and opens nothing by N outside a series', async () => {
		const { wrapper, root } = await mountLoupe(0, {}, false, { seriesOf: seriesOf(3, 6) })
		await root.trigger('keydown', { key: 'n' })

		expect(wrapper.find(CHIP).exists()).toBe(false)
		expect(openings(wrapper)).toBeUndefined()
	})

	// spec: LOUPE-001.19
	it('opens the compare from the filmstrip frame\'s tab, the shown photo active inside the series, else the frame\'s first', async () => {
		const { wrapper } = await mountLoupe(4, {}, false, { seriesOf: new Map([...seriesOf(0, 2), ...seriesOf(3, 6)]) })
		const tabs = wrapper.findAll('.loupe-filmstrip__tab')

		expect(tabs.map((tab) => tab.text())).toEqual(['⧉ 2', '⧉ 3'])
		await tabs[1]!.trigger('click')
		await tabs[0]!.trigger('click')
		expect(openings(wrapper)).toEqual(['IMG_4 IMG_5 IMG_6: IMG_5', 'IMG_1 IMG_2: IMG_1'])
	})
})
