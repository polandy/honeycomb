// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderSet } from '../../../src/logic/folder-set.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FolderPicker from '../../../src/components/FolderPicker.vue'
import FolderTree from '../../../src/components/FolderTree.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { listingEntry } from '../logic/listing-entries.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

/** /Trip with one photo of its own and one in /Trip/Day 2, which an exclusion leaves out. */
function listingOf(excluded: readonly string[]): ListingEntry[] {
	const own = [listingEntry(1, '/Trip/A.JPG')]
	return excluded.includes('/Trip/Day 2') ? own : [...own, listingEntry(2, '/Trip/Day 2/B.JPG')]
}

async function mountPicker(current: FolderSet) {
	const calls: unknown[][] = []
	const listEntries = (path: string, subfolders: boolean, excluded: readonly string[] = []) => {
		calls.push([path, subfolders, excluded])
		return Promise.resolve({ entries: listingOf(excluded), truncated: false })
	}
	const wrapper = mount(FolderPicker, {
		props: { current, listFolders: () => Promise.resolve([]), listEntries },
		global: { stubs: { NcDialog: DialogStub } },
	})
	await flushPromises()
	const tap = async (path: string) => {
		wrapper.findComponent(FolderTree).vm.$emit('toggle', path)
		await flushPromises()
	}
	const countLine = () => `${MARK}${wrapper.find('[aria-live="polite"]').text().replaceAll(MARK, '')}`
	return { wrapper, calls, tap, countLine }
}

describe('FolderPicker excluded folders', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: LISTING-003.21
	it('excludes an included folder on a tap, counts without it, and includes it again on the next', async () => {
		const picker = await mountPicker({ paths: ['/Trip'], subfolders: true })
		expect(picker.countLine()).toBe(`${MARK}${MARK}2 photos in ${MARK}2 folders`)

		await picker.tap('/Trip/Day 2')

		expect(picker.wrapper.findComponent(FolderTree).props('excluded')).toEqual(['/Trip/Day 2'])
		expect(picker.calls.at(-1)).toEqual(['/Trip', true, ['/Trip/Day 2']])
		expect(picker.countLine()).toBe(`${MARK}${MARK}1 photo in ${MARK}1 folder`)

		await picker.tap('/Trip/Day 2')

		expect(picker.wrapper.findComponent(FolderTree).props('excluded')).toEqual([])
		expect(picker.countLine()).toBe(`${MARK}${MARK}2 photos in ${MARK}2 folders`)
		expect(picker.calls).toHaveLength(2)
	})

	// spec: LISTING-003.21
	it('hands the excluded folders to the cull', async () => {
		const picker = await mountPicker({ paths: ['/Trip'], subfolders: true, excluded: ['/Trip/Day 2'] })

		await picker.wrapper.findAll('button').at(-1)!.trigger('click')

		expect(picker.wrapper.emitted('confirm')?.[0]?.[0]).toEqual({ paths: ['/Trip'], subfolders: true, excluded: ['/Trip/Day 2'] })
	})
})
