// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Folder } from '../../../src/api.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FolderList from '../../../src/components/FolderList.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK
const TREE: Record<string, Folder[]> = {
	'': [
		{ name: 'Photos', path: '/Photos', hasSubfolders: true },
		{ name: '.hidden', path: '/.hidden', hasSubfolders: false },
		{ name: 'Day 10', path: '/Day 10', hasSubfolders: false },
		{ name: 'Day 9', path: '/Day 9', hasSubfolders: false },
	],
	// The server saw a subfolder that is gone by the time the folder opens.
	'/Photos': [{ name: '2026', path: '/Photos/2026', hasSubfolders: true }],
	'/Photos/2026': [],
}

/** A folder endpoint over TREE whose answers the test settles in any order. */
function fakeFolders() {
	const pending: { path: string, settle: () => void, fail: () => void }[] = []
	const listFolders = (path: string) => new Promise<Folder[]>((resolve, reject) => {
		pending.push({ path, settle: () => resolve(TREE[path]!), fail: () => reject(new Error(`no ${path}`)) })
	})
	return { pending, listFolders }
}

async function mountList(ticked: string[] = []) {
	const folders = fakeFolders()
	const wrapper = mount(FolderList, { props: { ticked, listFolders: folders.listFolders } })
	folders.pending.shift()!.settle()
	await flushPromises()
	return { wrapper, ...folders }
}

const optionNames = (wrapper: Awaited<ReturnType<typeof mountList>>['wrapper']) => wrapper.findAll('[role="option"] .folder-list__name').map((name) => name.text())

describe('FolderList', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: LISTING-003.4
	it('lists the child folders of the root, sorted with digits by value', async () => {
		const { wrapper } = await mountList()

		expect(wrapper.find('[role="listbox"]').attributes('aria-multiselectable')).toBe('true')
		expect(optionNames(wrapper)).toEqual(['.hidden', 'Day 9', 'Day 10', 'Photos'])
	})

	// spec: LISTING-003.4
	it('marks the ticked folders as selected', async () => {
		const { wrapper } = await mountList(['/Day 9'])

		expect(wrapper.findAll('[role="option"]').map((option) => option.attributes('aria-selected'))).toEqual(['false', 'true', 'false', 'false'])
	})

	// spec: LISTING-003.4
	it.each([['click', {}], ['keydown', { key: 'Enter' }], ['keydown', { key: ' ' }]] as const)('toggles a folder by %s %o', async (event, init) => {
		const { wrapper } = await mountList()

		await wrapper.findAll('[role="option"]')[1]!.trigger(event, init)

		expect(wrapper.emitted('toggle')).toEqual([['/Day 9']])
	})

	// spec: LISTING-003.5
	it('disables a hidden folder and says why', async () => {
		const { wrapper } = await mountList()
		const hidden = wrapper.findAll('[role="option"]')[0]!

		await hidden.trigger('click')

		expect(hidden.attributes('aria-disabled')).toBe('true')
		expect(hidden.text()).toContain(`${MARK}Hidden folder, always skipped`)
		expect(wrapper.emitted('toggle')).toBeUndefined()
	})

	// spec: LISTING-003.4
	it('opens a folder with subfolders by its arrow, without ticking it, and goes back by the breadcrumbs', async () => {
		const { wrapper, pending } = await mountList()
		const open = wrapper.find(`[aria-label="${MARK}Open Photos"]`)

		await open.trigger('click')
		pending.shift()!.settle()
		await flushPromises()

		expect(wrapper.emitted('toggle')).toBeUndefined()
		expect(optionNames(wrapper)).toEqual(['2026'])
		const crumbs = wrapper.findAll('.folder-list__crumbs button')
		expect(crumbs.map((crumb) => crumb.text())).toEqual([`${MARK}Home`, 'Photos'])
		expect(crumbs[1]!.attributes('aria-current')).toBe('location')

		await crumbs[0]!.trigger('click')
		pending.shift()!.settle()
		await flushPromises()
		expect(optionNames(wrapper)).toContain('Photos')
	})

	// spec: LISTING-003.4
	it('offers no arrow for a folder without subfolders', async () => {
		const { wrapper } = await mountList()

		expect(wrapper.findAll('[role="option"]')[2]!.find('button').exists()).toBe(false)
	})

	it('says when a folder has no subfolders', async () => {
		const { wrapper, pending } = await mountList()
		await wrapper.find(`[aria-label="${MARK}Open Photos"]`).trigger('click')
		pending.shift()!.settle()
		await flushPromises()

		await wrapper.find(`[aria-label="${MARK}Open 2026"]`).trigger('click')
		pending.shift()!.settle()
		await flushPromises()

		expect(wrapper.text()).toContain(`${MARK}This folder has no subfolders.`)
		expect(wrapper.findAll('.folder-list__crumbs button').map((crumb) => crumb.text())).toEqual([`${MARK}Home`, 'Photos', '2026'])
	})

	// spec: LISTING-003.9
	it('shows only the folders of the latest folder opened', async () => {
		const { wrapper, pending } = await mountList()
		await wrapper.find(`[aria-label="${MARK}Open Photos"]`).trigger('click')
		await wrapper.findAll('.folder-list__crumbs button')[0]!.trigger('click')

		pending[1]!.settle()
		await flushPromises()
		pending[0]!.settle()
		await flushPromises()

		expect(optionNames(wrapper)).toContain('Photos')
	})

	// spec: LISTING-003.10
	it('says when the folders cannot be loaded', async () => {
		const { wrapper, pending } = await mountList()
		await wrapper.find(`[aria-label="${MARK}Open Photos"]`).trigger('click')

		pending.shift()!.fail()
		await flushPromises()

		expect(wrapper.text()).toContain(`${MARK}Could not load this folder.`)
		expect(wrapper.find('[role="option"]').exists()).toBe(false)
	})

	// spec: APP-001.4
	it('renders no text that bypasses the catalogue but folder names', async () => {
		const { wrapper } = await mountList()

		expect(untranslatedText(wrapper.element as Element)).toEqual(['.hidden', 'Day 9', 'Day 10', 'Photos'])
	})
})
