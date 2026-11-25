// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { Series } from '../../../src/logic/series.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import LoupeFilmstrip from '../../../src/components/LoupeFilmstrip.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { FILMSTRIP_TAB, FILMSTRIP_THUMB } from '../../../src/logic/filmstrip.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { mountLoupe } from './mount-loupe.ts'

const PICTURES = picturesOf(Array.from({ length: 30 }, (_, at) => listingEntry(at + 1, `/P/IMG_${String(at + 1).padStart(2, '0')}.JPG`)))

/** Each picture of the given index runs mapped to its run as one series. */
function seriesOf(...runs: [first: number, end: number][]) {
	return new Map(runs.flatMap(([first, end]) => {
		const series = { key: first + 1, members: PICTURES.slice(first, end) }
		return series.members.map((picture) => [picture, series] as const)
	}))
}

async function mountStrip(index: number, members: ReadonlyMap<Picture<ListingEntry>, Series<Picture<ListingEntry>>>, onCompareSeries?: (index: number) => void, decisionOf: (picture: Picture<ListingEntry>) => Decision = () => UNDECIDED) {
	const wrapper = mount(LoupeFilmstrip, {
		props: {
			pictures: PICTURES,
			index,
			pinned: false,
			decisionOf,
			seriesOf: members,
			imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
			observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
				onSize(1000, FILMSTRIP_THUMB)
				return () => undefined
			},
			...(onCompareSeries && { onCompareSeries }),
		},
	})
	await nextTick()
	return wrapper
}

const frames = (wrapper: Awaited<ReturnType<typeof mountStrip>>) => wrapper.findAll('.loupe-filmstrip__frame').map((frame) => frame.attributes('style'))

describe('LoupeFilmstrip: the series frame', () => {
	// spec: LOUPE-001.19
	it('draws one frame around each run of a series, over its photos', async () => {
		const wrapper = await mountStrip(0, seriesOf([2, 5], [5, 7]))

		expect(frames(wrapper)).toEqual([
			`left: ${2 * FILMSTRIP_THUMB}px; width: ${3 * FILMSTRIP_THUMB}px;`,
			`left: ${5 * FILMSTRIP_THUMB}px; width: ${2 * FILMSTRIP_THUMB}px;`,
		])
		expect(wrapper.find('.loupe-filmstrip__frame').element.closest('.loupe-filmstrip__track')).not.toBeNull()
	})

	// spec: LOUPE-001.19
	it('draws one frame across a rejected photo between two photos of a series, its ring inside the frame', async () => {
		const series = { key: 3, members: [PICTURES[2]!, PICTURES[4]!] }
		const members = new Map(series.members.map((picture) => [picture, series] as const))
		const wrapper = await mountStrip(3, members, undefined, (picture) => (picture.baseName === PICTURES[3]!.baseName ? { ...UNDECIDED, flag: 'rejected' } : UNDECIDED))

		expect(frames(wrapper)).toEqual([`left: ${2 * FILMSTRIP_THUMB}px; width: ${3 * FILMSTRIP_THUMB}px;`])
		expect(wrapper.find('button[aria-label="IMG_04"]').classes()).toContain('loupe-filmstrip__photo--framed')
	})

	// spec: LOUPE-001.19
	it('draws only the frames that reach the rendered photos', async () => {
		const wrapper = await mountStrip(29, seriesOf([0, 3], [27, 30]))

		expect(frames(wrapper)).toEqual([`left: ${27 * FILMSTRIP_THUMB}px; width: ${3 * FILMSTRIP_THUMB}px;`])
	})

	// spec: LOUPE-001.19
	it('keeps the ring of the shown photo inside the frame', async () => {
		const wrapper = await mountStrip(3, seriesOf([2, 5]))
		const classes = (label: string) => wrapper.find(`button[aria-label="${label}"]`).classes()

		expect(classes('IMG_04')).toContain('loupe-filmstrip__photo--framed')
		expect(classes('IMG_02')).not.toContain('loupe-filmstrip__photo--framed')
	})

	// spec: LOUPE-001.19
	it('shows no tab until a listener opens the compare from it', async () => {
		const wrapper = await mountStrip(0, seriesOf([2, 5]))

		expect(wrapper.find('.loupe-filmstrip__tab').exists()).toBe(false)
	})

	// spec: LOUPE-001.19
	it('puts the tab in a column before each frame\'s first photo and shifts the photos after it', async () => {
		const wrapper = await mountStrip(0, seriesOf([2, 5], [5, 7]), () => undefined)
		const left = (label: string) => wrapper.find(`button[aria-label="${label}"]`).attributes('style')

		expect(frames(wrapper)).toEqual([
			`left: ${2 * FILMSTRIP_THUMB}px; width: ${3 * FILMSTRIP_THUMB + FILMSTRIP_TAB}px;`,
			`left: ${5 * FILMSTRIP_THUMB + FILMSTRIP_TAB}px; width: ${2 * FILMSTRIP_THUMB + FILMSTRIP_TAB}px;`,
		])
		expect(left('IMG_02')).toBe(`left: ${FILMSTRIP_THUMB}px;`)
		expect(left('IMG_03')).toBe(`left: ${2 * FILMSTRIP_THUMB + FILMSTRIP_TAB}px;`)
		expect(left('IMG_06')).toBe(`left: ${5 * FILMSTRIP_THUMB + 2 * FILMSTRIP_TAB}px;`)
		expect(wrapper.find('.loupe-filmstrip__track').attributes('style')).toBe(`width: ${30 * FILMSTRIP_THUMB + 2 * FILMSTRIP_TAB}px;`)
	})

	// spec: LOUPE-001.19
	it('opens the compare on the series from the tab at the frame\'s start, named with its key', async () => {
		const opened: number[] = []
		const wrapper = await mountStrip(0, seriesOf([2, 5]), (index) => opened.push(index))
		const tab = wrapper.find('.loupe-filmstrip__frame .loupe-filmstrip__tab')

		expect(tab.text()).toBe('⧉ 3')
		expect(tab.attributes('aria-label')).toBe('Series of 3 – compare')
		expect(tab.attributes('data-tip')).toBe('Compare this series')
		expect(tab.attributes('data-tip-key')).toBe('N')
		await tab.trigger('click')
		expect(opened).toEqual([2])
	})
})

describe('PhotoLoupe: the series frame', () => {
	// spec: LOUPE-001.19
	it('frames the series it is handed in its filmstrip', async () => {
		const { wrapper } = await mountLoupe(4)
		expect(wrapper.find('.loupe-filmstrip__frame').exists()).toBe(false)

		await wrapper.setProps({ seriesOf: new Map(wrapper.props('pictures').slice(0, 2).map((picture, _at, members) => [picture, { key: 1, members }])) })
		expect(wrapper.findAll('.loupe-filmstrip__frame')).toHaveLength(1)
	})

	// spec: LOUPE-001.19
	it('keeps the strip as high as its photos while the folder has a series', async () => {
		const { wrapper } = await mountLoupe(4)
		await wrapper.setProps({ seriesOf: new Map(wrapper.props('pictures').slice(0, 2).map((picture, _at, members) => [picture, { key: 1, members }])) })

		expect(wrapper.attributes('style')).toContain(`--photo-loupe-filmstrip-height: ${FILMSTRIP_THUMB}px;`)
		expect(wrapper.attributes('style')).not.toContain('tab-band')
	})
})
