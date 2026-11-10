// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import PhotoTile from '../../../src/components/PhotoTile.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { listingEntry, pictureOf, picturesOf } from '../logic/listing-entries.ts'

const MARK = TRANSLATED_MARK
const PAIR = pictureOf(listingEntry(1, '/A/IMG_0001.JPG', { mtime: 7 }), listingEntry(2, '/A/IMG_0001.CR3'))
const urlFor = (fileId: number, size: number, mtime: number) => `/img/${fileId}/${size}/${mtime}`

/** A loadImage seam whose loads the test settles one by one. */
function fakeLoader() {
	const loads: { srcset: string, sizes: string, resolve: () => void, reject: () => void }[] = []
	const loadImage = (srcset: string, sizes: string) => new Promise<void>((resolve, reject) => {
		loads.push({ srcset, sizes, resolve, reject })
	})
	return { loads, loadImage }
}

function mountTile(picture: Picture<ListingEntry>, props: Record<string, unknown> = {}) {
	return mount(PhotoTile, { props: { picture, size: 160, imageUrl: urlFor, loadImage: fakeLoader().loadImage, devicePixelRatio: 2, ...props } })
}

describe('PhotoTile', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	it('shows the small preview of the image member first, without alt text', () => {
		const img = mountTile(PAIR).find('img')

		expect(img.attributes('src')).toBe('/img/1/256/7')
		expect(img.attributes('alt')).toBe('')
		expect(img.attributes('srcset')).toBeUndefined()
	})

	it('swaps in every grid tier once the sharp image decoded', async () => {
		const { loads, loadImage } = fakeLoader()
		const wrapper = mountTile(PAIR, { loadImage })

		expect(loads.map(({ srcset, sizes }) => [srcset, sizes])).toEqual([['/img/1/256/7 256w, /img/1/512/7 512w', '160px']])
		loads[0]!.resolve()
		await flushPromises()

		expect(wrapper.find('img').attributes('srcset')).toBe('/img/1/256/7 256w, /img/1/512/7 512w')
		expect(wrapper.find('img').attributes('sizes')).toBe('160px')
	})

	it('follows a new tile size once sharp, without loading again', async () => {
		const { loads, loadImage } = fakeLoader()
		const wrapper = mountTile(PAIR, { loadImage })
		loads[0]!.resolve()
		await flushPromises()

		await wrapper.setProps({ size: 300 })

		expect(wrapper.find('img').attributes('sizes')).toBe('300px')
		expect(loads).toHaveLength(1)
	})

	it('keeps the small image when the sharp one fails to decode', async () => {
		const { loads, loadImage } = fakeLoader()
		const wrapper = mountTile(PAIR, { loadImage })

		loads[0]!.reject()
		await flushPromises()

		expect(wrapper.find('img').attributes('src')).toBe('/img/1/256/7')
		expect(wrapper.find('img').attributes('srcset')).toBeUndefined()
	})

	it('loads no sharp image while the small preview is sharp enough', () => {
		const { loads, loadImage } = fakeLoader()

		mountTile(PAIR, { loadImage, size: 120, devicePixelRatio: 2 })

		expect(loads).toEqual([])
	})

	it('ignores a sharp load that a newer size overtook', async () => {
		const { loads, loadImage } = fakeLoader()
		const wrapper = mountTile(PAIR, { loadImage })
		await wrapper.setProps({ size: 200 })

		loads[1]!.resolve()
		await flushPromises()
		loads[0]!.resolve()
		await flushPromises()

		expect(wrapper.find('img').attributes('sizes')).toBe('200px')
	})

	it('labels a pair quietly with both extensions', () => {
		const badge = mountTile(PAIR).find('.photo-tile__pair')

		expect(badge.text()).toBe('JPG+CR3')
		expect(badge.classes()).not.toContain('photo-tile__pair--single')
	})

	it.each([
		['/A/IMG_0002.JPEG', `${MARK}JPG only`],
		['/A/IMG_0003.NEF', `${MARK}NEF only`],
	])('highlights the single %s as %s', (path, label) => {
		const badge = mountTile(pictureOf(listingEntry(3, path))).find('.photo-tile__pair')

		expect(badge.text()).toBe(label)
		expect(badge.classes()).toContain('photo-tile__pair--single')
	})

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
	it('shows rating, colour label, flag and Keep RAW on the tile and in its label', () => {
		const wrapper = mountTile(PAIR, { decision: { rating: 3, colourLabel: 'green', flag: 'rejected', keepRaw: true } })

		expect(wrapper.find('.photo-tile__stars').text()).toBe('★★★')
		expect(wrapper.find('.photo-tile__colour').attributes('style')).toContain('background-color')
		expect(wrapper.find('.photo-tile__flag--rejected').exists()).toBe(true)
		expect(wrapper.find('.photo-tile__pair--keep-raw').text()).toBe('JPG+CR3 ✓')
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, 3 stars, Colour label: Green, Rejected, Keep RAW')
	})

	it('shows no overlay for an undecided picture', () => {
		const wrapper = mountTile(PAIR, { decision: UNDECIDED })

		expect(wrapper.find('.photo-tile__stars').exists()).toBe(false)
		expect(wrapper.find('.photo-tile__colour').exists()).toBe(false)
		expect(wrapper.find('[class*="photo-tile__flag"]').exists()).toBe(false)
		expect(wrapper.find('.photo-tile__pair--keep-raw').exists()).toBe(false)
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
})
