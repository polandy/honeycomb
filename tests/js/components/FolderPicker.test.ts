// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Folder } from '../../../src/api.ts'
import type { FolderSet } from '../../../src/logic/folder-set.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { PairingSettings } from '../../../src/logic/pairing.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FolderPicker from '../../../src/components/FolderPicker.vue'
import { DEFAULT_PAIRING_SETTINGS } from '../../../src/logic/pairing.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { listingEntry } from '../logic/listing-entries.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK
const ROOT: Folder[] = [
	{ name: 'Trip', path: '/Trip', hasSubfolders: true },
	{ name: 'Empty', path: '/Empty', hasSubfolders: false },
	{ name: 'Home', path: '/Home', hasSubfolders: false },
]

/** Two pairs in /Trip, one more picture in /Trip/Day 2 with subfolders, 20 001 in /Home. */
function listingOf(path: string, subfolders: boolean): ListingEntry[] {
	if (path === '/Trip') {
		const own = [listingEntry(1, '/Trip/A.JPG'), listingEntry(2, '/Trip/A.CR3', { mime: 'image/x-dcraw' }), listingEntry(3, '/Trip/B.JPG')]
		return subfolders ? [...own, listingEntry(4, '/Trip/Day 2/C.JPG')] : own
	}
	if (path === '/Home') {
		return Array.from({ length: 20_001 }, (_, index) => listingEntry(100 + index, `/Home/IMG_${index}.JPG`))
	}
	return []
}

/** Endpoints whose listing answers the test settles in any order. */
function fakeApi() {
	const calls: string[] = []
	const pending: { key: string, settle: () => void, fail: () => void }[] = []
	const listEntries = (path: string, subfolders: boolean) => {
		const key = `${path}${subfolders ? ' +' : ''}`
		calls.push(key)
		return new Promise<{ entries: ListingEntry[], truncated: boolean }>((resolve, reject) => {
			pending.push({ key, settle: () => resolve({ entries: listingOf(path, subfolders), truncated: false }), fail: () => reject(new Error(key)) })
		})
	}
	return { calls, pending, listEntries, listFolders: () => Promise.resolve(ROOT) }
}

async function mountPicker(current: FolderSet | null = null, pairing: PairingSettings = DEFAULT_PAIRING_SETTINGS) {
	const api = fakeApi()
	const wrapper = mount(FolderPicker, {
		props: { current, listFolders: api.listFolders, listEntries: api.listEntries, pairing },
		global: { stubs: { NcDialog: DialogStub } },
	})
	await flushPromises()
	return { wrapper, ...api }
}

type Picker = Awaited<ReturnType<typeof mountPicker>>

async function tick({ wrapper }: Picker, name: string) {
	await wrapper.findAll('[role="option"]').find((option) => option.text().includes(name))!.trigger('click')
}

async function settleAll({ pending }: Picker) {
	for (const call of pending.splice(0)) {
		call.settle()
	}
	await flushPromises()
}

/** The count line with one mark for the whole: the counts nested in it carry their own. */
const countLine = ({ wrapper }: Picker) => `${MARK}${wrapper.find('[aria-live="polite"]').text().replaceAll(MARK, '')}`
const confirmButton = ({ wrapper }: Picker) => wrapper.findAll('button').at(-1)!
const subfoldersSwitch = ({ wrapper }: Picker) => wrapper.find('input[type="checkbox"]')

describe('FolderPicker', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: LISTING-003.11
	it('asks to tick a folder, introduces the app and cannot be cancelled while no cull is open', async () => {
		const picker = await mountPicker()

		expect(picker.wrapper.find('[role="dialog"]').attributes('name')).toBe(`${MARK}Choose folders`)
		expect(picker.wrapper.text()).toContain(`${MARK}Choose one or more folders of photos to start culling.`)
		expect(countLine(picker)).toBe(`${MARK}Tick one or more folders.`)
		expect(confirmButton(picker).text()).toBe(`${MARK}Choose`)
		expect(confirmButton(picker).attributes('disabled')).toBeDefined()
		expect(picker.wrapper.text()).not.toContain(`${MARK}Cancel`)
		expect(picker.wrapper.find('[role="dialog"]').attributes('data-no-close')).toBe('true')
	})

	// spec: LISTING-003.6
	it('counts the photos of a ticked folder and offers to cull it', async () => {
		const picker = await mountPicker()

		await tick(picker, 'Trip')
		await settleAll(picker)

		expect(picker.calls).toEqual(['/Trip'])
		expect(countLine(picker)).toBe(`${MARK}2 photos in 1 folder`)
		expect(confirmButton(picker).text()).toBe(`${MARK}Cull Trip`)
		expect(confirmButton(picker).attributes('disabled')).toBeUndefined()
	})

	// spec: LISTING-003.6
	it('counts the photos as the pairing settings pair them', async () => {
		const picker = await mountPicker(null, { ...DEFAULT_PAIRING_SETTINGS, rawExtensions: ['nef'], renderedExtensions: ['cr3'] })

		await tick(picker, 'Trip')
		await settleAll(picker)

		expect(countLine(picker)).toBe(`${MARK}1 photo in 1 folder`)
	})

	// spec: LISTING-003.7
	it('counts the subfolders at any depth when the switch is on', async () => {
		const picker = await mountPicker()
		await tick(picker, 'Trip')

		await subfoldersSwitch(picker).setValue(true)
		await settleAll(picker)

		expect(picker.wrapper.text()).toContain(`${MARK}Any depth. Hidden folders, the trash bin and preview folders are skipped.`)
		expect(countLine(picker)).toBe(`${MARK}3 photos in 2 folders`)
		// n() passes the plural form it picked through t() once more.
		expect(confirmButton(picker).text()).toBe(`${MARK}${MARK}Cull 2 folders`)
	})

	// spec: LISTING-003.8
	it('says when the ticked folders hold no photos', async () => {
		const picker = await mountPicker()

		await tick(picker, 'Empty')
		await settleAll(picker)

		expect(countLine(picker)).toBe(`${MARK}No photos in the ticked folders.`)
		expect(confirmButton(picker).attributes('disabled')).toBeDefined()
	})

	// spec: LISTING-003.9
	it('lists each folder once per switch position and keeps the answer', async () => {
		const picker = await mountPicker()
		await tick(picker, 'Trip')
		await settleAll(picker)

		await tick(picker, 'Trip')
		await tick(picker, 'Trip')
		await settleAll(picker)

		expect(picker.calls).toEqual(['/Trip'])
		expect(countLine(picker)).toBe(`${MARK}2 photos in 1 folder`)
	})

	// spec: LISTING-003.9
	it('shows the count of the latest ticks when an older answer comes late', async () => {
		const picker = await mountPicker()
		await tick(picker, 'Trip')
		await tick(picker, 'Trip')
		await tick(picker, 'Empty')
		const [trip, empty] = picker.pending.splice(0)

		empty!.settle()
		await flushPromises()
		trip!.settle()
		await flushPromises()

		expect(countLine(picker)).toBe(`${MARK}No photos in the ticked folders.`)
	})

	// spec: LISTING-003.8
	it('warns when the ticked folders hold more photos than the grid shows', async () => {
		const picker = await mountPicker()

		await tick(picker, 'Home')
		await settleAll(picker)

		expect(picker.wrapper.text()).toContain(`${MARK}More than 20,000 photos. honeycomb shows the first 20,000 by capture time; untick folders to see the rest.`)
	})

	// spec: LISTING-003.8
	it('says when the photos cannot be counted, and counts again on the next tick', async () => {
		const picker = await mountPicker()
		await tick(picker, 'Trip')

		picker.pending.shift()!.fail()
		await flushPromises()

		expect(picker.wrapper.text()).toContain(`${MARK}Could not count the photos.`)
		expect(confirmButton(picker).attributes('disabled')).toBeDefined()
		await tick(picker, 'Empty')
		await settleAll(picker)
		expect(picker.wrapper.text()).not.toContain(`${MARK}Could not count the photos.`)
		expect(picker.calls).toEqual(['/Trip', '/Empty', '/Trip'])
	})

	// spec: LISTING-003.12
	it('emits the folder set and its merged entries on confirm', async () => {
		const picker = await mountPicker()
		await tick(picker, 'Trip')
		await settleAll(picker)

		await confirmButton(picker).trigger('click')

		const [set, entries] = picker.wrapper.emitted('confirm')![0] as [FolderSet, ListingEntry[]]
		expect(set).toEqual({ paths: ['/Trip'], subfolders: false })
		expect(entries.map((entry) => entry.fileId)).toEqual([1, 2, 3])
	})

	// spec: LISTING-003.11
	it('starts from the open cull, which it can cancel back to', async () => {
		const picker = await mountPicker({ paths: ['/Trip'], subfolders: true })
		await settleAll(picker)

		expect(picker.calls).toEqual(['/Trip +'])
		expect((subfoldersSwitch(picker).element as HTMLInputElement).checked).toBe(true)
		expect(picker.wrapper.text()).not.toContain(`${MARK}Choose one or more folders`)
		const cancel = picker.wrapper.findAll('button').find((button) => button.text() === `${MARK}Cancel`)!
		await cancel.trigger('click')
		expect(picker.wrapper.emitted('cancel')).toEqual([[]])
	})

	// spec: APP-001.4
	it('renders no text that bypasses the catalogue but folder names', async () => {
		const picker = await mountPicker()
		await tick(picker, 'Trip')
		await settleAll(picker)

		expect(untranslatedText(picker.wrapper.element as Element)).toEqual(['Empty', 'Home', 'Trip'])
	})
})
