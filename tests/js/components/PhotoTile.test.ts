// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import PhotoTile from '../../../src/components/PhotoTile.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { createLoadQueue } from '../../../src/logic/load-queue.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { listingEntry, pictureOf, picturesOf } from '../logic/listing-entries.ts'

const MARK = TRANSLATED_MARK
const PAIR = pictureOf(listingEntry(1, '/A/IMG_0001.JPG', { mtime: 7 }), listingEntry(2, '/A/IMG_0001.CR3'))
const urlFor = (fileId: number, size: number, mtime: number) => `/img/${fileId}/${size}/${mtime}`

/** A load queue over a loader whose loads the test settles by URL. */
function fakeLoads() {
	const started: string[] = []
	const settle = new Map<string, { resolve: () => void, reject: () => void }>()
	const loads = createLoadQueue((url) => new Promise<void>((resolve, reject) => {
		started.push(url)
		settle.set(url, { resolve, reject })
	}), 10)
	const settled = async (url: string, outcome: 'resolve' | 'reject' = 'resolve') => {
		settle.get(url)![outcome]()
		await flushPromises()
	}
	return { started, loads, settled }
}

function mountTile(picture: Picture<ListingEntry>, props: Record<string, unknown> = {}) {
	return mount(PhotoTile, { props: { picture, size: 160, imageUrl: urlFor, loads: fakeLoads().loads, devicePixelRatio: 2, ...props } })
}

describe('PhotoTile', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: GRID-001.2
	it('shows the small preview of the image member once it arrived, without alt text', async () => {
		const { started, loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })
		expect(started).toEqual(['/img/1/256/7'])
		expect(wrapper.find('img').exists()).toBe(false)

		await settled('/img/1/256/7')

		expect(wrapper.find('img').attributes('src')).toBe('/img/1/256/7')
		expect(wrapper.find('img').attributes('alt')).toBe('')
		expect(wrapper.find('img').attributes('srcset')).toBeUndefined()
	})

	// spec: GRID-001.2
	it('requests the sharp tier only after the small one arrived and swaps it in once decoded', async () => {
		const { started, loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })
		await settled('/img/1/256/7')
		expect(started).toEqual(['/img/1/256/7', '/img/1/1024/7'])
		expect(wrapper.find('img').attributes('src')).toBe('/img/1/256/7')

		await settled('/img/1/1024/7')

		expect(wrapper.find('img').attributes('src')).toBe('/img/1/1024/7')
	})

	it('requests the sharp tier when the tile grows past the small one', async () => {
		const { started, loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads, size: 120 })
		await settled('/img/1/256/7')

		await wrapper.setProps({ size: 300 })

		expect(started).toEqual(['/img/1/256/7', '/img/1/1024/7'])
	})

	// spec: GRID-001.3
	it('keeps the small image when the sharp one fails to decode', async () => {
		const { loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })
		await settled('/img/1/256/7')

		await settled('/img/1/1024/7', 'reject')

		expect(wrapper.find('img').attributes('src')).toBe('/img/1/256/7')
	})

	// spec: GRID-001.12
	it('is a skeleton tile until its small preview arrived', async () => {
		const { loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })
		expect(wrapper.classes()).toContain('skeleton-tile')

		await settled('/img/1/256/7')

		expect(wrapper.classes()).not.toContain('skeleton-tile')
	})

	// spec: GRID-001.12
	it('stops being a skeleton tile and loads nothing more when its small preview fails', async () => {
		const { started, loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })

		await settled('/img/1/256/7', 'reject')

		expect(wrapper.classes()).not.toContain('skeleton-tile')
		expect(wrapper.find('img').exists()).toBe(false)
		expect(started).toEqual(['/img/1/256/7'])
	})

	// spec: GRID-001.2
	it('loads no sharp image while the small preview is sharp enough', async () => {
		const { started, loads, settled } = fakeLoads()
		mountTile(PAIR, { loads, size: 120, devicePixelRatio: 2 })

		await settled('/img/1/256/7')

		expect(started).toEqual(['/img/1/256/7'])
	})

	// spec: GRID-001.15
	it('moves its waiting load to the front once visible and drops it when unmounted', async () => {
		const loader = { started: [] as string[], finish: [] as (() => void)[] }
		const loads = createLoadQueue((url) => new Promise<void>((resolve) => {
			loader.started.push(url)
			loader.finish.push(resolve)
		}), 1)
		loads.enqueue('busy', 0, () => undefined)
		const near = mountTile(PAIR, { loads, offscreen: true })
		const far = mountTile(pictureOf(listingEntry(3, '/A/IMG_0003.JPG', { mtime: 7 })), { loads, offscreen: true })
		const gone = mountTile(pictureOf(listingEntry(4, '/A/IMG_0004.JPG', { mtime: 7 })), { loads })

		await far.setProps({ offscreen: false })
		gone.unmount()
		loader.finish[0]!()
		await flushPromises()
		loader.finish[1]!()
		await flushPromises()

		expect(loader.started).toEqual(['busy', '/img/3/256/7', '/img/3/1024/7'])
		near.unmount()
	})

	it('starts over when the image member changes', async () => {
		const { started, loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })
		await settled('/img/1/256/7')

		await wrapper.setProps({ picture: pictureOf(listingEntry(1, '/A/IMG_0001.JPG', { mtime: 8 })) })

		expect(wrapper.find('img').exists()).toBe(false)
		expect(started.at(-1)).toBe('/img/1/256/8')
	})

	// spec: GRID-001.4
	it('shows no badge on a complete pair but names both extensions in its label', () => {
		const wrapper = mountTile(PAIR, { decision: UNDECIDED })

		expect(wrapper.find('.photo-tile__pair').exists()).toBe(false)
		expect(wrapper.attributes('aria-label')).toBe('IMG_0001, JPG+CR3')
	})

	it.each([
		['/A/IMG_0002.JPEG', `${MARK}JPG only`],
		['/A/IMG_0003.NEF', `${MARK}NEF only`],
	// spec: GRID-001.4
	])('highlights the single %s as %s', (path, label) => {
		const badge = mountTile(pictureOf(listingEntry(3, path))).find('.photo-tile__pair')

		expect(badge.text()).toBe(label)
		expect(badge.classes()).toContain('photo-tile__pair--single')
	})

	// spec: GRID-001.5, LISTING-002.4
	it('names the photo, its badge and an ambiguous name for assistive technology', () => {
		const [ambiguous] = picturesOf([listingEntry(4, '/A/x.jpg'), listingEntry(5, '/A/X.JPG')])
		const wrapper = mountTile(ambiguous!)

		expect(wrapper.attributes('aria-label')).toBe(`x, ${MARK}JPG only, ${MARK}ambiguous name`)
		expect(wrapper.find('.photo-tile__ambiguous').text()).toBe('!')
		expect(mountTile(PAIR).find('.photo-tile__ambiguous').exists()).toBe(false)
	})

	it('renders no text that bypasses the catalogue but the file names and extensions', () => {
		const wrapper = mountTile(pictureOf(listingEntry(3, '/A/IMG_0002.JPG')))

		expect(wrapper.html()).toContain(`${MARK}JPG only`)
		expect(untranslatedText(wrapper.element as Element)).toEqual([`IMG_0002, ${MARK}JPG only`])
	})
	// spec: GRID-001.4, GRID-001.6
	it('shows rating, colour label, flag and Keep RAW on the tile and in its label', () => {
		const wrapper = mountTile(PAIR, { decision: { rating: 3, colourLabel: 'green', flag: 'rejected', keepRaw: true } })

		expect(wrapper.find('.photo-tile__stars').text()).toBe('★★★')
		expect(wrapper.find('.photo-tile__colour').attributes('style')).toContain('background-color')
		expect(wrapper.find('.photo-tile__flag--rejected').exists()).toBe(true)
		expect(wrapper.find('.photo-tile__pair--keep-raw').text()).toBe('JPG+CR3 ✓')
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, 3 stars, Colour label: Green, Rejected, Keep RAW')
	})

	// spec: GRID-001.16
	it('puts the flag mark, colour dot and stars in one marks shade', () => {
		const wrapper = mountTile(PAIR, { decision: { rating: 2, colourLabel: 'red', flag: 'picked', keepRaw: false } })
		const marks = wrapper.find('.photo-tile__marks')

		expect(marks.find('.photo-tile__flag').exists()).toBe(true)
		expect(marks.find('.photo-tile__colour').exists()).toBe(true)
		expect(marks.find('.photo-tile__stars').exists()).toBe(true)
	})

	// spec: GRID-001.16
	it('has no marks shade without a mark', () => {
		expect(mountTile(PAIR, { decision: UNDECIDED }).find('.photo-tile__marks').exists()).toBe(false)
	})

	// spec: GRID-001.6
	it('shows no overlay for an undecided picture', () => {
		const wrapper = mountTile(PAIR, { decision: UNDECIDED })

		expect(wrapper.find('.photo-tile__stars').exists()).toBe(false)
		expect(wrapper.find('.photo-tile__colour').exists()).toBe(false)
		expect(wrapper.find('[class*="photo-tile__flag"]').exists()).toBe(false)
		expect(wrapper.find('.photo-tile__pair--keep-raw').exists()).toBe(false)
	})

	// spec: SERIES-002.10
	it('shows the series badge with the series\' size on the first tile of a run, says the tile\'s place in its label, and none outside a series', () => {
		const wrapper = mountTile(PAIR, { series: { position: 1, size: 3, run: 3 } })
		const badge = wrapper.find('button.photo-tile__series')

		expect(badge.text()).toBe('⧉ 3')
		expect(badge.attributes('data-tip')!.replaceAll(MARK, '')).toBe('Compare this series')
		expect(badge.attributes('aria-label')!.replaceAll(MARK, '')).toBe('Series of 3 – compare')
		expect(badge.attributes('tabindex')).toBe('-1')
		expect(badge.classes()).not.toContain('photo-tile__series--settled')
		expect(wrapper.attributes('data-tip-hover-only')).toBeDefined()
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, Series, photo 1 of 3')
		expect(mountTile(PAIR).find('.photo-tile__series').exists()).toBe(false)
		expect(mountTile(PAIR).attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3')
	})

	// spec: SERIES-002.10
	it('counts the run against the series when the run holds only part of it, and shows no badge further into a run', () => {
		expect(mountTile(PAIR, { series: { position: 4, size: 5, run: 2 } }).find('.photo-tile__series').text().replaceAll(MARK, '')).toBe('⧉ 2 of 5')
		const inside = mountTile(PAIR, { series: { position: 2, size: 5, run: null } })

		expect(inside.find('.photo-tile__series').exists()).toBe(false)
		expect(inside.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, Series, photo 2 of 5')
	})

	// spec: SERIES-002.10
	it('fades the badge of a settled series', () => {
		expect(mountTile(PAIR, { series: { position: 1, size: 3, run: 3 }, seriesSettled: true }).find('.photo-tile__series').classes()).toContain('photo-tile__series--settled')
	})

	// spec: SERIES-002.13
	it('asks to compare the series on a badge tap without the tile seeing the tap', async () => {
		const wrapper = mountTile(PAIR, { series: { position: 1, size: 3, run: 3 } })
		const seen: string[] = []
		wrapper.element.addEventListener('click', () => seen.push('click'))
		wrapper.element.addEventListener('pointerdown', () => seen.push('pointerdown'))
		await wrapper.find('.photo-tile__series').trigger('pointerdown')
		await wrapper.find('.photo-tile__series').trigger('click')

		expect(wrapper.emitted('compareSeries')).toHaveLength(1)
		expect(seen).toEqual([])
	})

	// spec: SERIES-003.25
	it('outlines the badge of a series that may still change and says so in the label', () => {
		const wrapper = mountTile(PAIR, { series: { position: 1, size: 3, run: 3 }, seriesOpen: true })
		const badge = wrapper.find('.photo-tile__series')

		expect(badge.classes()).toContain('photo-tile__series--open')
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, Series, photo 1 of 3, Series may still change')
		expect(mountTile(PAIR, { series: { position: 1, size: 3, run: 3 } }).find('.photo-tile__series').classes()).not.toContain('photo-tile__series--open')
	})

	it('shows the selection check only in selection mode and marks a selected tile', async () => {
		const wrapper = mountTile(PAIR)
		expect(wrapper.find('.photo-tile__check').exists()).toBe(false)
		expect(wrapper.attributes('aria-selected')).toBeUndefined()

		await wrapper.setProps({ selecting: true })
		expect(wrapper.find('.photo-tile__check').exists()).toBe(true)
		expect(wrapper.attributes('aria-selected')).toBe('false')

		await wrapper.setProps({ selected: true })
		expect(wrapper.classes()).toContain('photo-tile--selected')
		expect(wrapper.attributes('aria-selected')).toBe('true')
	})

	// spec: TAGS-004.7
	it('shows a tag icon and the tag count in the marks shade and the label, nothing untagged', () => {
		const wrapper = mountTile(PAIR, { tags: 2 })

		expect(wrapper.find('.photo-tile__marks .photo-tile__tags').text()).toBe('2')
		expect(wrapper.find('.photo-tile__tags svg').exists()).toBe(true)
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, 2 tags')
		expect(mountTile(PAIR).find('.photo-tile__tags').exists()).toBe(false)
		expect(mountTile(PAIR, { tags: 0 }).find('.photo-tile__marks').exists()).toBe(false)
	})

	// spec: XMP-003.28
	it('marks a picture whose sidecars are not saved yet in the marks shade and the label, nothing once saved', async () => {
		const wrapper = mountTile(PAIR, { unsaved: true })

		expect(wrapper.find('.photo-tile__marks .photo-tile__unsaved').exists()).toBe(true)
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, Not saved yet')

		await wrapper.setProps({ unsaved: false })
		expect(wrapper.find('.photo-tile__marks').exists()).toBe(false)
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3')
	})
})
