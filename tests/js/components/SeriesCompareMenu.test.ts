// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { Series } from '../../../src/logic/series.ts'

import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import SeriesCompareMenu from '../../../src/components/SeriesCompareMenu.vue'
import { formatTime } from '../../../src/l10n.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { ActionsStub } from './stubs.ts'

type P = Picture<ListingEntry>

enableAutoUnmount(afterEach)
beforeEach(installMarkedCatalogue)
afterEach(uninstallMarkedCatalogue)

const [A, B, C, D, E] = picturesOf([1, 2, 3, 4, 5].map((fileId) => listingEntry(fileId, `/P/IMG_${fileId}.JPG`, { captureTime: 5000 + fileId * 70 }))) as [P, P, P, P, P]
const shown: Series<P> = { key: 3, members: [C, D] }
const plain = (text: string | undefined) => text?.replaceAll(TRANSLATED_MARK, '').replace(/\s+/g, ' ').trim()

/** The title row's menu on `shown` with the given neighbours, and its entries as plain text with whether each is disabled. */
function mountMenu(previous: Series<P> | null, next: Series<P> | null, series = shown) {
	const wrapper = mount(SeriesCompareMenu, {
		props: { series, previous, next, container: 'body' },
		global: { stubs: { NcActions: ActionsStub } },
	})
	const buttons = () => wrapper.findAllComponents(NcActionButton)
	const entries = () => buttons().map((button) => [plain(button.findAll('.action-button__longtext-wrapper > span').map((part) => part.text()).join(' ')), button.props('disabled')])
	return { wrapper, buttons, entries }
}

describe('SeriesCompareMenu', () => {
	// spec: SERIES-005.8
	it('offers to merge with the next and the previous series, each with its size and first capture time', async () => {
		const { wrapper, buttons, entries } = mountMenu({ key: 1, members: [A, B] }, { key: 5, members: [E, A, B] })

		expect(plain(wrapper.find('[data-actions]').attributes('data-actions'))).toBe('Series menu')
		expect(plain(wrapper.text())).toContain('This series · ⧉ 2')
		expect(entries()).toEqual([
			[`Merge with the next series ⧉ 3 · starts ${formatTime(5350)}`, false],
			[`Merge with the previous series ⧉ 2 · starts ${formatTime(5070)}`, false],
			['Series done Its unflagged photos count as decided', false],
			['Dissolve this series Its photos are never grouped again automatically', false],
		])
		await buttons()[0]!.find('button').trigger('click')
		await buttons()[1]!.find('button').trigger('click')
		await buttons()[3]!.find('button').trigger('click')

		expect(wrapper.emitted('merge')).toEqual([['next'], ['previous']])
		expect(wrapper.emitted('dissolve')).toHaveLength(1)
	})

	// spec: SERIES-005.8
	it('disables a merge without a series that way and says why', () => {
		const { entries } = mountMenu(null, null)

		expect(entries().slice(0, 2)).toEqual([
			['Merge with the next series None after this one', true],
			['Merge with the previous series None before this one', true],
		])
	})

	// spec: SERIES-005.14, SERIES-005.15
	it('marks the series done, or reopens it once it is done, its entry pressed while done', async () => {
		const open = mountMenu(null, null)
		const done = mountMenu(null, null, { ...shown, stored: { id: 9, status: 'done', elsewhere: false } })
		await open.buttons()[2]!.find('button').trigger('click')
		await done.buttons()[2]!.find('button').trigger('click')

		expect([open.buttons()[2]!.props('modelValue'), done.buttons()[2]!.props('modelValue')]).toEqual([false, true])
		expect(open.wrapper.emitted('markDone')).toEqual([[true]])
		expect(done.wrapper.emitted('markDone')).toEqual([[false]])
	})

	// spec: SERIES-005.8
	it('reports its menu opening and closing', () => {
		const { wrapper } = mountMenu(null, null)
		wrapper.findComponent(ActionsStub).vm.$emit('update:open', true)

		expect(wrapper.emitted('menu')).toEqual([[true]])
	})
})
