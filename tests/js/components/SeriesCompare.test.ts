// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NcButton from '@nextcloud/vue/components/NcButton'
import PickRestButton from '../../../src/components/PickRestButton.vue'
import SeriesCompare from '../../../src/components/SeriesCompare.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK
const SERIES = picturesOf([
	listingEntry(1, '/Trip/IMG_1.JPG'),
	listingEntry(2, '/Trip/IMG_2.JPG'),
	listingEntry(3, '/Trip/IMG_3.JPG'),
]) as Picture<ListingEntry>[]
const DECISIONS: Record<string, Decision> = { IMG_2: { ...UNDECIDED, rating: 3, flag: 'picked' } }

function mountCompare(series: Picture<ListingEntry>[] | null = SERIES, now = () => 0) {
	return mount(SeriesCompare, {
		attachTo: document.body,
		props: {
			now,
			series,
			position: 1,
			count: 4,
			active: 1,
			decisionOf: (picture: Picture<ListingEntry>) => DECISIONS[picture.baseName] ?? UNDECIDED,
			imageUrl: (fileId: number, size: number) => `/image/${fileId}/${size}`,
			observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
				onSize(1416, 760)
				return () => undefined
			},
		},
		global: { stubs: { NcDialog: DialogStub } },
	})
}

const plain = (text: string | undefined) => text?.replaceAll(MARK, '')
const cards = (wrapper: ReturnType<typeof mountCompare>) => wrapper.findAll('.series-compare__card')
const button = (wrapper: ReturnType<typeof mountCompare>, label: string) => wrapper.findAllComponents(NcButton).find((found) => plain(found.text()) === label)!

enableAutoUnmount(afterEach)

describe('SeriesCompare', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SERIES-001.7
	it('shows the series as a full-screen grid of cards with name, stars, flag and flag buttons, the active one framed', () => {
		const wrapper = mountCompare()

		expect(plain(wrapper.find('[role="dialog"]').attributes('name'))).toBe('Compare series 2 of 4 · photo 2 of 3')
		expect(wrapper.find('[role="dialog"]').attributes('size')).toBe('full')
		expect(cards(wrapper)).toHaveLength(3)
		expect(cards(wrapper).map((card) => card.classes('series-compare__card--active'))).toEqual([false, true, false])
		const photos = wrapper.findAll('.series-compare__photo')
		expect(photos.map((photo) => plain(photo.attributes('aria-label')))).toEqual(['Photo 1: IMG_1', 'Photo 2: IMG_2', 'Photo 3: IMG_3'])
		expect(plain(photos[0]!.attributes('data-tip'))).toBe('Make active, double-tap to view full screen')
		expect(photos[0]!.attributes('title')).toBeUndefined()
		expect(photos.map((photo) => photo.attributes('aria-pressed'))).toEqual(['false', 'true', 'false'])
		expect(photos[0]!.find('img').attributes('src')).toBe('/image/1/256')
		expect(cards(wrapper)[1]!.text()).toContain('2 · IMG_2')
		expect(cards(wrapper)[1]!.find('.star-rating--readonly').text()).toBe('★★★')
		expect(cards(wrapper)[1]!.find('.flag-mark--picked').exists()).toBe(true)
		expect(cards(wrapper)[0]!.find('.flag-mark').exists()).toBe(false)
		expect(cards(wrapper)[1]!.find('[aria-label$="Pick"]').attributes('aria-pressed')).toBe('true')
		expect(cards(wrapper)[0]!.findAll('.flag-buttons button').map((found) => plain(found.attributes('aria-label')))).toEqual(['Pick', 'Unflag', 'Reject'])
		expect(cards(wrapper)[0]!.findComponent(PickRestButton).exists()).toBe(false)
	})

	// spec: SERIES-001.7
	it('names the active photo\'s position in its title as the active card moves', async () => {
		const wrapper = mountCompare()

		await wrapper.setProps({ active: 2 })

		expect(plain(wrapper.find('[role="dialog"]').attributes('name'))).toBe('Compare series 2 of 4 · photo 3 of 3')
	})

	// spec: SERIES-001.7, SERIES-001.19
	it('ends in a bottom bar with one line of instructions, Skip secondary and Pick this, reject the rest primary', () => {
		const wrapper = mountCompare()
		const bar = wrapper.find('.series-compare__bar')

		expect(plain(bar.find('.series-compare__hint').text())).toBe('Tap a photo to make it active, double-tap it or press ⤢ to view it full screen, or decide right here.')
		expect(wrapper.findAllComponents(PickRestButton)).toHaveLength(1)
		expect(wrapper.findComponent(PickRestButton).findComponent(NcButton).props('variant')).toBe('primary')
		expect(button(wrapper, 'Skip').props('variant')).toBe('secondary')
		expect(bar.findAll('button').map((found) => plain(found.text()))).toEqual(['Skip', 'Pick this, reject the rest'])
	})

	// spec: SERIES-001.7, SERIES-001.9
	it('decides from a card and picks the active picture and rejects the rest from the bar', async () => {
		const wrapper = mountCompare()

		await cards(wrapper)[2]!.find('[aria-label$="Reject"]').trigger('click')
		await wrapper.find('.pick-rest-button').trigger('click')
		await wrapper.setProps({ active: 0 })
		await wrapper.find('.pick-rest-button').trigger('click')

		expect(wrapper.emitted('decide')).toEqual([[{ kind: 'flag', flag: 'rejected' }, SERIES[2]]])
		expect(wrapper.emitted('pickRest')).toEqual([[SERIES[1]], [SERIES[0]]])
	})

	// spec: SERIES-001.23
	it('makes a card active by a single tap and opens no viewer', async () => {
		let time = 0
		const wrapper = mountCompare(SERIES, () => time)

		await wrapper.findAll('.series-compare__photo')[2]!.trigger('click')
		time = 1000
		await wrapper.findAll('.series-compare__photo')[2]!.trigger('click')
		await wrapper.findAll('.series-compare__photo')[0]!.trigger('click')

		expect(wrapper.emitted('activate')).toEqual([[2], [2], [0]])
		expect(wrapper.emitted('view')).toBeUndefined()
	})

	// spec: SERIES-001.23, SERIES-002.1
	it('opens a card in the viewer by a double tap, the first tap making it active', async () => {
		let time = 0
		const wrapper = mountCompare(SERIES, () => time)

		await wrapper.findAll('.series-compare__photo')[2]!.trigger('click')
		time = 200
		await wrapper.findAll('.series-compare__photo')[2]!.trigger('click')

		expect(wrapper.emitted('activate')).toEqual([[2]])
		expect(wrapper.emitted('view')).toEqual([[2]])
	})

	// spec: SERIES-001.23, SERIES-002.1
	it('opens a card in the viewer by its View full screen button, which names Enter', async () => {
		const wrapper = mountCompare()
		const full = cards(wrapper)[0]!.find('.series-compare__full')

		expect(plain(full.attributes('aria-label'))).toBe('View photo 1 full screen')
		expect(plain(full.attributes('data-tip'))).toBe('View full screen')
		expect(full.attributes('data-tip-key')).toBe('Enter')
		await full.trigger('click')

		expect(wrapper.emitted('view')).toEqual([[0]])
		expect(wrapper.emitted('activate')).toBeUndefined()
	})

	// spec: SERIES-001.23, SERIES-002.1
	it('opens the active card in the viewer by Enter, focus following the active card', async () => {
		const wrapper = mountCompare()
		const photos = () => wrapper.findAll('.series-compare__photo')

		await wrapper.setProps({ active: 2 })
		expect(document.activeElement).toBe(photos()[2]!.element)
		await photos()[2]!.trigger('keydown', { key: 'Enter' })

		expect(wrapper.emitted('view')).toEqual([[2]])
		expect(wrapper.emitted('activate')).toBeUndefined()
	})

	// spec: SERIES-001.23
	it('leaves focus outside the cards where it is as the active card moves', async () => {
		const wrapper = mountCompare()
		const skip = button(wrapper, 'Skip').element as HTMLElement
		skip.focus()

		await wrapper.setProps({ active: 2 })

		expect(document.activeElement).toBe(skip)
	})

	// spec: SERIES-001.21
	it('lays the cards out by the grid sizing rule and reports its columns', async () => {
		const wrapper = mountCompare()
		await flushPromises()
		const grid = wrapper.find('.series-compare')

		expect(grid.attributes('style')).toContain('grid-template-columns: repeat(3, 465px)')
		expect(grid.attributes('style')).toContain('--series-compare-photo-width: 453px')
		expect(wrapper.emitted('columns')).toEqual([[3]])
	})

	// spec: SERIES-001.21
	it('keeps the active card in view as it moves', async () => {
		const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function(this: Element) {})
		const wrapper = mountCompare()
		await flushPromises()

		expect(scrolled.mock.contexts).toEqual([cards(wrapper)[1]!.element])
		await wrapper.setProps({ active: 2 })

		expect(scrolled.mock.contexts).toEqual([cards(wrapper)[1]!.element, cards(wrapper)[2]!.element])
		expect(scrolled).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest' })
		scrolled.mockRestore()
	})

	// spec: SERIES-001.21
	it('starts focus on the active card\'s photo, so the focus trap keeps the grid where it is', () => {
		const focused = vi.spyOn(HTMLElement.prototype, 'focus')
		const wrapper = mountCompare()

		expect(focused.mock.contexts).toEqual([wrapper.findAll('.series-compare__photo')[1]!.element])
		expect(focused).toHaveBeenCalledWith({ preventScroll: true })
		focused.mockRestore()
	})

	// spec: SERIES-001.11
	it('skips by Skip and closes by the dialog\'s close button', async () => {
		const wrapper = mountCompare()

		await button(wrapper, 'Skip').trigger('click')
		wrapper.findComponent(DialogStub).vm.$emit('update:open', false)

		expect(wrapper.emitted('skip')).toHaveLength(1)
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	// spec: SERIES-001.12
	it('says when every series is compared and only closes', async () => {
		const wrapper = mountCompare(null)

		expect(plain(wrapper.find('[role="dialog"]').attributes('name'))).toBe('Compare series')
		expect(plain(wrapper.text())).toContain('All series compared')
		expect(wrapper.findComponent(PickRestButton).exists()).toBe(false)
		expect(wrapper.find('.series-compare__bar').findAll('button').map((found) => plain(found.text()))).toEqual(['Close'])
		await button(wrapper, 'Close').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(1)
		expect(wrapper.emitted('skip')).toBeUndefined()
	})
})
