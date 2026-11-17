// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { Series } from '../../../src/logic/series.ts'

import { describe, expect, it } from 'vitest'
import { mountGrid, picturesIn } from './mount-grid.ts'

type P = Picture<ListingEntry>

// 432 px hold four columns of 102 px tiles with 8 px gaps.
const WIDTH = 432
const PITCH = 110

/** The pictures from `first` to before `end` as one series under the key. */
function seriesOf(pictures: readonly P[], key: number, first: number, end: number): Map<P, Series<P>> {
	const series = { key, members: pictures.slice(first, end) }
	return new Map(series.members.map((picture) => [picture, series]))
}

/** Each bracket's row, offset, width and modifiers. */
function brackets(wrapper: ReturnType<typeof mountGrid>['wrapper']) {
	return wrapper.findAll('.photo-grid__bracket').map((bracket) => ({
		row: bracket.element.parentElement!.style.top,
		left: bracket.attributes('style')!.match(/left: ([\d.]+)px/)![1],
		width: bracket.attributes('style')!.match(/width: ([\d.]+)px/)![1],
		classes: bracket.classes().filter((name) => name !== 'photo-grid__bracket'),
	}))
}
const tile = (wrapper: ReturnType<typeof mountGrid>['wrapper'], index: number) => wrapper.find(`[data-index="${index}"]`)

describe('PhotoGrid series', () => {
	// spec: SERIES-002.12
	it('brackets a run over the tile gaps and a row wrap, capped at its start and end, and moves no tile', async () => {
		const pictures = picturesIn({ '/P': 12 })
		const { wrapper, resize } = mountGrid({ pictures })
		await resize(WIDTH, 400)
		const before = wrapper.findAll('[role="gridcell"]').map((cell) => cell.attributes('style'))
		await wrapper.setProps({ seriesOf: seriesOf(pictures, 7, 2, 6), offeredSeries: new Set([7]) })

		expect(brackets(wrapper)).toEqual([
			{ row: '0px', left: String(2 * PITCH), width: String(PITCH + 102), classes: ['photo-grid__bracket--start'] },
			{ row: `${PITCH}px`, left: '0', width: String(PITCH + 102), classes: ['photo-grid__bracket--end'] },
		])
		expect(wrapper.findAll('[role="gridcell"]').map((cell) => cell.attributes('style'))).toEqual(before)
	})

	// spec: SERIES-002.12, SERIES-003.25
	it('fades the bracket of a settled series and dashes one that may still change', async () => {
		const pictures = picturesIn({ '/P': 12 })
		const { wrapper, resize } = mountGrid({ pictures, seriesOf: new Map([...seriesOf(pictures, 1, 0, 2), ...seriesOf(pictures, 2, 8, 10)]), offeredSeries: new Set([2]), openSeries: new Set(pictures.slice(8, 10)) })
		await resize(WIDTH, 400)

		expect(brackets(wrapper).map(({ classes }) => classes)).toEqual([
			['photo-grid__bracket--start', 'photo-grid__bracket--end', 'photo-grid__bracket--settled'],
			['photo-grid__bracket--start', 'photo-grid__bracket--end', 'photo-grid__bracket--open'],
		])
		expect(tile(wrapper, 0).find('.photo-tile__series').classes()).toContain('photo-tile__series--settled')
		expect(tile(wrapper, 8).find('.photo-tile__series').classes()).toContain('photo-tile__series--open')
	})

	// spec: SERIES-002.10, SERIES-002.12
	it('gives each run in a folder group its own bracket and badge', async () => {
		const pictures = picturesIn({ '/P/A': 2, '/P/B': 2 })
		const { wrapper, resize } = mountGrid({ pictures, groupByFolder: true, seriesOf: seriesOf(pictures, 3, 1, 3), offeredSeries: new Set([3]) })
		await resize(WIDTH, 400)

		expect(brackets(wrapper).map(({ classes }) => classes)).toEqual([
			['photo-grid__bracket--start', 'photo-grid__bracket--end'],
			['photo-grid__bracket--start', 'photo-grid__bracket--end'],
		])
		expect([1, 2].map((index) => tile(wrapper, index).find('.photo-tile__series').text())).toEqual(['⧉ 1 of 2', '⧉ 1 of 2'])
	})

	// spec: SERIES-002.13
	it('hands on the series and the photo of a tapped badge', async () => {
		const pictures = picturesIn({ '/P': 12 })
		const series = seriesOf(pictures, 7, 2, 6)
		const { wrapper, resize } = mountGrid({ pictures, seriesOf: series, offeredSeries: new Set([7]) })
		await resize(WIDTH, 400)
		await tile(wrapper, 2).find('.photo-tile__series').trigger('click')

		expect(wrapper.emitted('compareSeries')).toEqual([[series.get(pictures[2]!), pictures[2]]])
		expect(tile(wrapper, 3).find('.photo-tile__series').exists()).toBe(false)
	})

	// spec: SERIES-002.15
	it('moves the focus to the first photo of the next or previous run and stays at either end', async () => {
		const pictures = picturesIn({ '/P': 12 })
		const { wrapper, resize } = mountGrid({ pictures, seriesOf: new Map([...seriesOf(pictures, 1, 2, 4), ...seriesOf(pictures, 2, 6, 9)]) }, true)
		await resize(WIDTH, 400)
		const jump = async (direction: 'previous' | 'next') => {
			await wrapper.vm.jumpSeries(direction)
			return wrapper.vm.focusedIndex()
		}

		expect([await jump('next'), await jump('next'), await jump('next')]).toEqual([2, 6, 6])
		expect([await jump('previous'), await jump('previous')]).toEqual([2, 2])
		wrapper.unmount()
	})
})
