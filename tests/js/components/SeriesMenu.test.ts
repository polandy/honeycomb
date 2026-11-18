// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { Series } from '../../../src/logic/series.ts'

import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import SeriesMenu from '../../../src/components/SeriesMenu.vue'
import { seriesOffer } from '../../../src/logic/series-menu.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { ActionsStub } from './stubs.ts'

type P = Picture<ListingEntry>

enableAutoUnmount(afterEach)
beforeEach(installMarkedCatalogue)
afterEach(uninstallMarkedCatalogue)

const [A, B, C, D, E, F] = picturesOf([1, 2, 3, 4, 5, 6].map((fileId) => listingEntry(fileId, `/P/IMG_${fileId}.JPG`))) as [P, P, P, P, P, P]
const first: Series<P> = { key: 1, members: [A, B, C] }
const second: Series<P> = { key: 4, members: [D, E] }
const seriesOf = new Map<P, Series<P>>([[A, first], [B, first], [C, first], [D, second], [E, second]])
const plain = (text: string | undefined) => text?.replaceAll(TRANSLATED_MARK, '').replace(/\s+/g, ' ').trim()

/** The menu over the selection, and its entries as plain text with whether each is disabled. */
function mountMenu(selected: readonly P[]) {
	const wrapper = mount(SeriesMenu, {
		props: { offer: seriesOffer(selected, seriesOf) },
		global: { stubs: { NcActions: ActionsStub } },
	})
	const buttons = () => wrapper.findAllComponents(NcActionButton)
	const entries = () => buttons().map((button) => [plain(button.findAll('.action-button__longtext-wrapper > span').map((part) => part.text()).join(' ')), button.props('disabled')])
	return { wrapper, buttons, entries }
}

describe('SeriesMenu', () => {
	// spec: SERIES-005.4
	it('offers a new series of loose photos and says why the other entries do not fit', () => {
		const { wrapper, entries } = mountMenu([F])

		expect(plain(wrapper.find('[data-actions]').attributes('data-actions'))).toBe('Series…')
		expect(plain(wrapper.text())).toContain('1 photo, none in a series')
		expect(entries()).toEqual([
			['New series from 1 photo Select two photos or more', true],
			['Add to a series Select a photo of the series too', true],
			['Remove from their series None of them is in a series', true],
			['Series done Select a photo of the series', true],
		])
	})

	// spec: SERIES-005.6, SERIES-005.11
	it('offers to add the loose photos to the one series the selection touches', () => {
		const { wrapper, entries } = mountMenu([A, F])

		expect(plain(wrapper.text())).toContain('1 photo in series ⧉ 3 · 1 loose')
		expect(entries()).toEqual([
			['Add 1 photo to series ⧉ 3 It stays in the series from now on', false],
			['New series from 2 photos Takes it out of its series', false],
			['Remove 1 photo from its series It is never grouped again automatically', false],
			['Series done Its unflagged photos count as decided', false],
		])
		expect(mountMenu([A, B]).entries()[0]).toEqual(['Add to series ⧉ 3 Select photos outside the series too', true])
	})

	// spec: SERIES-005.7
	it('offers to merge the series the selection touches, counting their whole series', () => {
		const { wrapper, entries } = mountMenu([A, D, F])

		expect(plain(wrapper.text())).toContain('2 photos in 2 series · 1 loose')
		expect(entries()[0]).toEqual(['Merge 2 series · 6 photos Their whole series and 1 loose photo', false])
		expect(mountMenu([A, D]).entries()[0]).toEqual(['Merge 2 series · 5 photos Their whole series become one', false])
		expect(mountMenu([A, B, D]).entries()[1]).toEqual(['New series from 3 photos Takes them out of their series', false])
	})

	// spec: SERIES-005.28, SERIES-005.29
	it('offers series done for one series, reopen for a done one, and says why not', () => {
		expect(mountMenu([A, D]).entries().at(-1)).toEqual(['Series done Select photos of one series only', true])
		const wrapper = mount(SeriesMenu, {
			props: { offer: seriesOffer([A], new Map([[A, { ...first, stored: { id: 7, status: 'done', elsewhere: false } }]])) },
			global: { stubs: { NcActions: ActionsStub } },
		})
		const last = wrapper.findAllComponents(NcActionButton).at(-1)!

		expect(plain(last.text())).toContain('Reopen series')
		expect(last.props('disabled')).toBe(false)
	})

	// spec: SERIES-005.4, SERIES-005.7
	it('emits the chosen edit', async () => {
		const { wrapper, buttons } = mountMenu([A, D, F])

		await buttons()[0]!.find('button').trigger('click')
		await buttons()[2]!.find('button').trigger('click')
		await buttons()[3]!.find('button').trigger('click')

		expect(wrapper.emitted('edit')).toEqual([['merge'], ['remove']])
	})

	// spec: SERIES-005.4
	it('emits nothing for an entry that does not fit', async () => {
		const { wrapper, buttons } = mountMenu([F])

		await buttons()[0]!.find('button').trigger('click')

		expect(wrapper.emitted('edit')).toBeUndefined()
	})

	it('is disabled without a selection', () => {
		const { wrapper } = mountMenu([])

		expect(wrapper.findComponent(ActionsStub).attributes('disabled')).toBeDefined()
	})
})
