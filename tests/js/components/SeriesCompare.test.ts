// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NcButton from '@nextcloud/vue/components/NcButton'
import ConfirmDialog from '../../../src/components/ConfirmDialog.vue'
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

function mountCompare(series: Picture<ListingEntry>[] | null = SERIES) {
	return mount(SeriesCompare, {
		props: {
			series,
			position: 1,
			count: 4,
			active: 1,
			decisionOf: (picture: Picture<ListingEntry>) => DECISIONS[picture.baseName] ?? UNDECIDED,
			imageUrl: (fileId: number, size: number) => `/image/${fileId}/${size}`,
		},
		global: { stubs: { NcDialog: DialogStub } },
	})
}

const plain = (text: string | undefined) => text?.replaceAll(MARK, '')
const cards = (wrapper: ReturnType<typeof mountCompare>) => wrapper.findAll('.series-compare__card')

describe('SeriesCompare', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SERIES-001.7
	it('shows the series side by side with name, stars and flag, the active one marked', () => {
		const wrapper = mountCompare()

		expect(plain(wrapper.find('[role="dialog"]').attributes('name'))).toBe('Compare series 2 of 4 · photo 2 of 3')
		expect(cards(wrapper)).toHaveLength(3)
		const photos = wrapper.findAll('.series-compare__photo')
		expect(photos.map((photo) => plain(photo.attributes('aria-label')))).toEqual(['Open photo 1: IMG_1', 'Open photo 2: IMG_2', 'Open photo 3: IMG_3'])
		expect(plain(photos[0]!.attributes('data-tip'))).toBe('Open in the series viewer')
		expect(photos[0]!.attributes('title')).toBeUndefined()
		expect(photos.map((photo) => photo.attributes('aria-pressed'))).toEqual(['false', 'true', 'false'])
		expect(photos[0]!.find('img').attributes('src')).toBe('/image/1/256')
		expect(photos[1]!.text()).toContain('2 · IMG_2')
		expect(cards(wrapper)[1]!.find('.star-rating--readonly').text()).toBe('★★★')
		expect(cards(wrapper)[1]!.find('.flag-mark--picked').exists()).toBe(true)
		expect(cards(wrapper)[0]!.find('.flag-mark').exists()).toBe(false)
		expect(cards(wrapper)[1]!.find('[aria-label$="Pick"]').attributes('aria-pressed')).toBe('true')
		expect(cards(wrapper)[0]!.findAll('.flag-buttons button').map((button) => plain(button.attributes('aria-label')))).toEqual(['Pick', 'Unflag', 'Reject'])
	})

	// spec: SERIES-001.7
	it('names the active photo\'s position in its title as the active card moves', async () => {
		const wrapper = mountCompare()

		await wrapper.setProps({ active: 2 })

		expect(plain(wrapper.find('[role="dialog"]').attributes('name'))).toBe('Compare series 2 of 4 · photo 3 of 3')
	})

	// spec: SERIES-001.19
	it('makes Pick this, reject the rest primary on the active card only, and Skip secondary', () => {
		const wrapper = mountCompare()
		const variants = cards(wrapper).map((card) => card.findComponent(PickRestButton).findComponent(NcButton).props('variant'))

		expect(variants).toEqual(['secondary', 'primary', 'secondary'])
		expect(wrapper.findComponent(ConfirmDialog).props('secondary')).toBe(true)
	})

	// spec: SERIES-001.7
	it('gives one line of instructions above the cards', () => {
		const wrapper = mountCompare()

		expect(plain(wrapper.find('.series-compare__hint').text())).toBe('Tap a photo to open the series fullscreen, or decide right here.')
	})

	// spec: SERIES-001.7, SERIES-001.9, SERIES-002.1
	it('decides, picks the rest and opens a photo in the viewer from its card', async () => {
		const wrapper = mountCompare()

		await cards(wrapper)[2]!.find('[aria-label$="Reject"]').trigger('click')
		await cards(wrapper)[0]!.find('.pick-rest-button').trigger('click')
		await wrapper.findAll('.series-compare__photo')[2]!.trigger('click')

		expect(wrapper.emitted('decide')).toEqual([[{ kind: 'flag', flag: 'rejected' }, SERIES[2]]])
		expect(wrapper.emitted('pickRest')).toEqual([[SERIES[0]]])
		expect(wrapper.emitted('view')).toEqual([[2]])
	})

	// spec: SERIES-001.21
	it('sizes the row by the series length and scrolls the active card into view', async () => {
		const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function(this: Element) {})
		const wrapper = mountCompare()

		expect(wrapper.find('.series-compare').attributes('style')).toContain('--series-compare-count: 3')
		expect(scrolled.mock.contexts).toEqual([cards(wrapper)[1]!.element])
		await wrapper.setProps({ active: 2 })

		expect(scrolled.mock.contexts).toEqual([cards(wrapper)[1]!.element, cards(wrapper)[2]!.element])
		expect(scrolled).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest' })
		scrolled.mockRestore()
	})

	// spec: SERIES-001.21
	it('starts focus on the active card\'s photo, so the focus trap keeps the row where it is', () => {
		const focused = vi.spyOn(HTMLElement.prototype, 'focus')
		const wrapper = mountCompare()

		expect(focused.mock.contexts).toEqual([wrapper.findAll('.series-compare__photo')[1]!.element])
		expect(focused).toHaveBeenCalledWith({ preventScroll: true })
		focused.mockRestore()
	})

	// spec: SERIES-001.11
	it('skips by its confirm button and closes by Close', async () => {
		const wrapper = mountCompare()
		const dialog = wrapper.findComponent(ConfirmDialog)

		expect(plain(dialog.props('confirmLabel'))).toBe('Skip')
		expect(plain(dialog.props('cancelLabel'))).toBe('Close')
		dialog.vm.$emit('confirm')
		dialog.vm.$emit('cancel')
		expect(wrapper.emitted('skip')).toHaveLength(1)
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	// spec: SERIES-001.12
	it('says when every series is compared and only closes', async () => {
		const wrapper = mountCompare(null)
		const dialog = wrapper.findComponent(ConfirmDialog)

		expect(plain(wrapper.find('[role="dialog"]').attributes('name'))).toBe('Compare series')
		expect(plain(wrapper.text())).toContain('All series compared')
		expect(plain(dialog.props('confirmLabel'))).toBe('Close')
		expect(dialog.props('cancel')).toBe(false)
		dialog.vm.$emit('confirm')
		expect(wrapper.emitted('close')).toHaveLength(1)
		expect(wrapper.emitted('skip')).toBeUndefined()
	})
})
