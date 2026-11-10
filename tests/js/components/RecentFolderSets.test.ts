// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import NcListItem from '@nextcloud/vue/components/NcListItem'
import RecentFolderSets from '../../../src/components/RecentFolderSets.vue'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const trip = { folderSet: { paths: ['/Photos/Trip'], subfolders: true }, fileId: 2, decided: 1, total: 3 }
const pair = { folderSet: { paths: ['/A', '/B'], subfolders: false }, fileId: 9, decided: 0, total: 40 }
const ITEMS = [
	{ position: trip, current: true, decided: 2, total: 3 },
	{ position: pair, current: false, decided: 0, total: 40 },
]

describe('RecentFolderSets', () => {
	// spec: DECISIONS-002.8, LISTING-003.13
	it('lists each folder set with its progress, marks the open one and opens one on a tap', async () => {
		const wrapper = mount(RecentFolderSets, { props: { items: ITEMS } })
		await nextTick()
		const rows = wrapper.findAllComponents(NcListItem)

		expect(rows.map((row) => row.text())).toEqual(['Trip + subfolders2 / 3 decided', '2 folders0 / 40 decided'])
		expect(rows.map((row) => row.props('active'))).toEqual([true, false])
		await rows[1]!.find('a').trigger('click')

		expect(wrapper.emitted('open')).toEqual([[pair]])
	})

	describe('translations', () => {
		beforeEach(installMarkedCatalogue)
		afterEach(uninstallMarkedCatalogue)

		it('renders no text that bypasses the catalogue but folder names', async () => {
			const wrapper = mount(RecentFolderSets, { props: { items: [{ ...ITEMS[1]! }] } })
			await nextTick()
			expect(untranslatedText(wrapper.element)).toEqual([])
		})
	})
})
