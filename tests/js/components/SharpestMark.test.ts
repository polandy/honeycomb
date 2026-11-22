// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SourceEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { QualityValue, SharpnessPlace } from '../../../src/logic/sharpness.ts'

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import LoupeFilmstrip from '../../../src/components/LoupeFilmstrip.vue'
import LoupeInfo from '../../../src/components/LoupeInfo.vue'
import LoupeStage from '../../../src/components/LoupeStage.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { SHARPNESS_METHOD } from '../../../src/logic/sharpness.ts'
import { fakeViewState } from '../app-cull.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { mountSeriesCompare, SERIES } from './mount-compare.ts'
import { mountLoupe, PICTURES } from './mount-loupe.ts'

/** A quality value of `sharpness` whose focus tile is `focusTile`. */
const quality = (sharpness: number, focusTile = 0): QualityValue => ({ method: SHARPNESS_METHOD, sharpness, focusTile })

/** Looks the picture's quality value up by its name. */
const qualities = (values: Record<string, QualityValue>) => (picture: Picture<SourceEntry>) => values[picture.baseName] ?? null

/** The definition list under the info panel's headings, as term → value. */
function infoRows(wrapper: { findAll: ReturnType<typeof mount>['findAll'] }) {
	const terms = wrapper.findAll('dt').map((term) => term.text())
	const values = wrapper.findAll('dd').map((value) => value.text())
	return Object.fromEntries(terms.map((term, at) => [term, values[at]]))
}

const headings = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('h3').map((heading) => heading.text())

enableAutoUnmount(afterEach)

describe('the Sharpest mark in the series compare', () => {
	const cards = (wrapper: ReturnType<typeof mountSeriesCompare>) => wrapper.findAll('.series-compare__card')
	const marked = (wrapper: ReturnType<typeof mountSeriesCompare>) => cards(wrapper).map((card) => card.find('.series-compare__frame .sharpest-mark').exists())

	// spec: SERIES-007.1
	it('marks the sharpest card and leaves the first card active', async () => {
		const wrapper = mountSeriesCompare({}, SERIES, () => 0, false, { active: 0, qualityOf: qualities({ IMG_1: quality(100), IMG_2: quality(200), IMG_3: quality(150) }) })
		await flushPromises()
		expect(marked(wrapper)).toEqual([false, true, false])
		expect(cards(wrapper)[1]!.find('.sharpest-mark').text()).toBe('Sharpest')
		expect(cards(wrapper).map((card) => card.classes('series-compare__card--active'))).toEqual([true, false, false])
		expect(cards(wrapper).some((card) => card.find('.flag-mark').exists())).toBe(false)
	})

	// spec: SERIES-007.2
	it('marks no card when the best two lie within 5 % or a value is missing', async () => {
		const close = mountSeriesCompare({}, SERIES, () => 0, false, { qualityOf: qualities({ IMG_1: quality(100), IMG_2: quality(200), IMG_3: quality(195) }) })
		const missing = mountSeriesCompare({}, SERIES, () => 0, false, { qualityOf: qualities({ IMG_1: quality(100), IMG_2: quality(200) }) })
		const unmeasured = mountSeriesCompare()
		await flushPromises()
		expect(marked(close)).toEqual([false, false, false])
		expect(marked(missing)).toEqual([false, false, false])
		expect(marked(unmeasured)).toEqual([false, false, false])
	})
})

describe('the Sharpest mark in the loupe', () => {
	const STRIP = picturesOf([1, 2, 3].map((id) => listingEntry(id, `/P/IMG_${id}.JPG`)))

	// spec: SERIES-007.4
	it('marks the thumbnails of the sharpest photos with a tooltip', async () => {
		const wrapper = mount(LoupeFilmstrip, {
			props: {
				pictures: STRIP,
				index: 0,
				pinned: false,
				decisionOf: () => UNDECIDED,
				seriesOf: new Map(),
				sharpest: new Set([STRIP[1]!]),
				imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
				observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
					onSize(1000, 100)
					return () => undefined
				},
			},
		})
		await flushPromises()
		const photos = wrapper.findAll('.loupe-filmstrip__photo')
		expect(photos.map((photo) => photo.find('.sharpest-mark').exists())).toEqual([false, true, false])
		expect(photos[1]!.find('.sharpest-mark').attributes('data-tip')).toBe('Sharpest')
		expect(photos[1]!.find('.sharpest-mark').attributes('aria-label')).toBe('Sharpest')
	})

	// spec: SERIES-007.5
	it('ranks the photo in the info panel and leaves the section out without a rank', () => {
		const info = (sharpness: SharpnessPlace | null) => mount(LoupeInfo, { props: { picture: STRIP[0]!, folderSet: { paths: ['/P'], subfolders: true }, decision: UNDECIDED, sharpness } })
		const sharpest = info({ rank: 1, count: 4, sharpest: true })
		expect(headings(sharpest)).toContain('Quality')
		expect(infoRows(sharpest).Sharpness).toBe('Sharpest of 4')
		expect(sharpest.find('.loupe-info__note').text()).toBe('Compared within its series only')
		expect(infoRows(info({ rank: 2, count: 4, sharpest: false })).Sharpness).toBe('Rank 2 of 4')
		const unranked = info(null)
		expect(headings(unranked)).not.toContain('Quality')
		expect(infoRows(unranked).Sharpness).toBeUndefined()
	})

	// spec: SERIES-007.4, SERIES-007.5, SERIES-007.7
	it('takes the quality values of the series to its filmstrip, info panel and zoom', async () => {
		const series = { key: 1, members: PICTURES.slice(0, 4) }
		const { wrapper } = await mountLoupe(1, {}, false, {
			seriesOf: new Map(series.members.map((picture) => [picture, series])),
			qualityOf: qualities({ IMG_1: quality(100), IMG_2: quality(300), IMG_3: quality(100), IMG_4: quality(50) }),
			viewState: fakeViewState({ gesture_guide_seen: true, series_hint_seen: true, info_panel_open: true }),
		})
		await flushPromises()
		expect(infoRows(wrapper.find('.loupe-info')).Sharpness).toBe('Sharpest of 4')
		expect(wrapper.findAll('.loupe-filmstrip__photo').filter((photo) => photo.find('.sharpest-mark').exists()).map((photo) => photo.attributes('aria-label'))).toEqual(['IMG_2'])

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }))
		await flushPromises()
		expect(wrapper.find('.loupe-stage img[alt="IMG_2"]').attributes('style')).toContain('translate(1000px, 700px)')

		await wrapper.setProps({ index: 2 })
		expect(infoRows(wrapper.find('.loupe-info')).Sharpness).toBe('Rank 2 of 4')
	})
})

describe('the zoom onto the focus tile', () => {
	const PHOTOS = picturesOf([1, 2].map((id) => listingEntry(id, `/P/IMG_${id}.JPG`, { width: 3000, height: 2000 })))

	/** The stage on a 1000 × 600 area showing the second photo, zoomed by its exposed toggle. */
	async function zoomedStage(qualityOf?: (picture: Picture<SourceEntry>) => QualityValue | null) {
		const wrapper = mount(LoupeStage, {
			props: {
				pictures: PHOTOS,
				index: 1,
				imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
				load: async () => undefined,
				ready: reactive(new Set<string>()),
				devicePixelRatio: 1,
				observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
					onSize(1000, 600)
					return () => undefined
				},
				...(qualityOf && { qualityOf }),
			},
		})
		await wrapper.vm.$nextTick()
		;(wrapper.vm as unknown as { toggleZoom: () => void }).toggleZoom()
		await wrapper.vm.$nextTick()
		return wrapper.find('img[alt="IMG_2"]').attributes('style')
	}

	// spec: SERIES-007.7
	it('centres the focus tile as far as the photo\'s edges allow, and the middle without a value', async () => {
		expect(await zoomedStage(qualities({ IMG_2: quality(100, 0) }))).toContain('translate(1000px, 700px)')
		expect(await zoomedStage(qualities({ IMG_2: quality(100, 27) }))).toContain('translate(187.5px, 125px)')
		expect(await zoomedStage(qualities({}))).toContain('translate(0px, 0px)')
		expect(await zoomedStage()).toContain('translate(0px, 0px)')
	})
})
