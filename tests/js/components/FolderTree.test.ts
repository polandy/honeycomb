// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { VueWrapper } from '@vue/test-utils'
import type { Folder } from '../../../src/api.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FolderTree from '../../../src/components/FolderTree.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK
const FOLDERS: Record<string, Folder[]> = {
	'': [
		{ name: 'Photos', path: '/Photos', hasSubfolders: true },
		{ name: '.hidden', path: '/.hidden', hasSubfolders: false },
		{ name: 'Day 10', path: '/Day 10', hasSubfolders: false },
		{ name: 'Day 9', path: '/Day 9', hasSubfolders: false },
	],
	'/Photos': [{ name: '2026', path: '/Photos/2026', hasSubfolders: true }, { name: '2025', path: '/Photos/2025', hasSubfolders: false }],
	// The server saw a subfolder that is gone by the time the folder opens.
	'/Photos/2026': [],
}

/** A folder endpoint over FOLDERS whose answers the test settles per path. */
function fakeFolders() {
	const pending: { path: string, settle: () => void, fail: () => void }[] = []
	const listFolders = (path: string) => new Promise<Folder[]>((resolve, reject) => {
		pending.push({ path, settle: () => resolve(FOLDERS[path]!), fail: () => reject(new Error(`no ${path}`)) })
	})
	/** Answers the oldest request for `path`. */
	const answer = async (path: string, outcome: 'settle' | 'fail' = 'settle') => {
		const index = pending.findIndex((each) => each.path === path)
		pending.splice(index, 1)[0]![outcome]()
		await flushPromises()
	}
	return { pending, listFolders, answer }
}

async function mountTree(ticked: string[] = []) {
	const folders = fakeFolders()
	const wrapper = mount(FolderTree, { props: { ticked, listFolders: folders.listFolders }, attachTo: document.body })
	await folders.answer('')
	return { wrapper, ...folders }
}

const items = (wrapper: VueWrapper) => wrapper.findAll('[role="treeitem"]')
const item = (wrapper: VueWrapper, name: string) => items(wrapper).find((each) => each.find('.folder-tree__name').text() === name)!
const shown = (wrapper: VueWrapper) => items(wrapper).map((each) => `${each.find('.folder-tree__name').text()}@${each.attributes('aria-level')}`)
const twisty = (wrapper: VueWrapper, name: string) => item(wrapper, name).find('.folder-tree__twisty')
const focused = () => document.activeElement?.querySelector('.folder-tree__name')?.textContent

describe('FolderTree', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: LISTING-003.4
	it('shows the root folders as a collapsed tree, sorted with digits by value', async () => {
		const { wrapper } = await mountTree()

		expect(wrapper.find('[role="tree"]').attributes('aria-multiselectable')).toBe('true')
		expect(shown(wrapper)).toEqual(['.hidden@1', 'Day 9@1', 'Day 10@1', 'Photos@1'])
		expect(item(wrapper, 'Photos').attributes('aria-expanded')).toBe('false')
		expect(item(wrapper, 'Day 9').attributes('aria-expanded')).toBeUndefined()
	})

	// spec: LISTING-003.4
	it('marks the ticked folders as selected', async () => {
		const { wrapper } = await mountTree(['/Day 9'])

		expect(items(wrapper).map((each) => each.attributes('aria-selected'))).toEqual(['false', 'true', 'false', 'false'])
	})

	// spec: LISTING-003.4
	it.each([['click', {}], ['keydown', { key: 'Enter' }], ['keydown', { key: ' ' }]] as const)('toggles a folder by %s %o', async (event, init) => {
		const { wrapper } = await mountTree()

		await item(wrapper, 'Day 9').trigger(event, init)

		expect(wrapper.emitted('toggle')).toEqual([['/Day 9']])
	})

	// spec: LISTING-003.5
	it('disables a hidden folder and says why', async () => {
		const { wrapper } = await mountTree()
		const hidden = item(wrapper, '.hidden')

		await hidden.trigger('click')

		expect(hidden.attributes('aria-disabled')).toBe('true')
		expect(hidden.text()).toContain(`${MARK}Hidden folder, always skipped`)
		expect(wrapper.emitted('toggle')).toBeUndefined()
	})

	// spec: LISTING-003.4, APP-002.9
	it('expands a folder by its arrow, loading its subfolders once, without ticking it, and collapses it', async () => {
		const { wrapper, pending, answer } = await mountTree()
		expect(twisty(wrapper, 'Photos').attributes('data-tip')).toBe(`${MARK}Expand Photos`)

		await twisty(wrapper, 'Photos').trigger('click')
		expect(wrapper.text()).toContain(`${MARK}Loading…`)
		await answer('/Photos')

		expect(wrapper.emitted('toggle')).toBeUndefined()
		expect(item(wrapper, 'Photos').attributes('aria-expanded')).toBe('true')
		expect(shown(wrapper)).toEqual(['.hidden@1', 'Day 9@1', 'Day 10@1', 'Photos@1', '2025@2', '2026@2'])
		expect(twisty(wrapper, 'Photos').attributes('data-tip')).toBe(`${MARK}Collapse Photos`)

		await twisty(wrapper, 'Photos').trigger('click')
		expect(shown(wrapper)).not.toContain('2026@2')
		await twisty(wrapper, 'Photos').trigger('click')
		expect(pending).toEqual([])
		expect(shown(wrapper)).toContain('2026@2')
	})

	// spec: LISTING-003.4
	it('offers no arrow for a folder without subfolders', async () => {
		const { wrapper } = await mountTree()

		expect(twisty(wrapper, 'Day 9').exists()).toBe(false)
	})

	it('says when an expanded folder has no subfolders', async () => {
		const { wrapper, answer } = await mountTree()
		await twisty(wrapper, 'Photos').trigger('click')
		await answer('/Photos')

		await twisty(wrapper, '2026').trigger('click')
		await answer('/Photos/2026')

		expect(wrapper.text()).toContain(`${MARK}This folder has no subfolders.`)
	})

	// spec: LISTING-003.10
	it('says when a folder cannot be loaded and tries again when expanded again', async () => {
		const { wrapper, answer } = await mountTree()
		await twisty(wrapper, 'Photos').trigger('click')

		await answer('/Photos', 'fail')
		expect(wrapper.text()).toContain(`${MARK}Could not load this folder.`)

		await twisty(wrapper, 'Photos').trigger('click')
		await twisty(wrapper, 'Photos').trigger('click')
		await answer('/Photos')
		expect(shown(wrapper)).toContain('2026@2')
	})

	// spec: LISTING-003.10
	it('says when the root folders cannot be loaded', async () => {
		const folders = fakeFolders()
		const wrapper = mount(FolderTree, { props: { ticked: [], listFolders: folders.listFolders } })

		await folders.answer('', 'fail')

		expect(wrapper.text()).toContain(`${MARK}Could not load this folder.`)
		expect(items(wrapper)).toEqual([])
	})

	// spec: LISTING-003.11
	it('starts with the folders above the ticked ones expanded', async () => {
		const { wrapper, answer } = await mountTree(['/Photos/2026'])

		await answer('/Photos')

		expect(shown(wrapper)).toContain('2026@2')
		expect(item(wrapper, '2026').attributes('aria-selected')).toBe('true')
	})

	// spec: LISTING-003.16
	it('has one tab stop and moves it with the arrow keys', async () => {
		const { wrapper, answer } = await mountTree()
		expect(items(wrapper).map((each) => each.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])

		await item(wrapper, '.hidden').trigger('keydown', { key: 'End' })
		expect(focused()).toBe('Photos')
		await item(wrapper, 'Photos').trigger('keydown', { key: 'ArrowRight' })
		await answer('/Photos')
		expect(item(wrapper, 'Photos').attributes('aria-expanded')).toBe('true')

		await item(wrapper, 'Photos').trigger('keydown', { key: 'ArrowRight' })
		expect(focused()).toBe('2025')
		expect(item(wrapper, '2025').attributes('tabindex')).toBe('0')
		await item(wrapper, '2025').trigger('keydown', { key: 'ArrowLeft' })
		expect(focused()).toBe('Photos')
		await item(wrapper, 'Photos').trigger('keydown', { key: 'ArrowLeft' })
		expect(item(wrapper, 'Photos').attributes('aria-expanded')).toBe('false')
		expect(wrapper.emitted('toggle')).toBeUndefined()
	})

	it('moves the tab stop to a folder clicked', async () => {
		const { wrapper } = await mountTree()

		await item(wrapper, 'Day 10').trigger('click')

		expect(item(wrapper, 'Day 10').attributes('tabindex')).toBe('0')
	})

	// spec: APP-001.4
	it('renders no text that bypasses the catalogue but folder names', async () => {
		const { wrapper } = await mountTree()

		expect(untranslatedText(wrapper.element as Element)).toEqual(['.hidden', 'Day 9', 'Day 10', 'Photos'])
	})
})

describe('FolderTree: one folder', () => {
	// spec: MOVE-004.4
	it('offers one folder and refuses the blocked ones', async () => {
		const folders = fakeFolders()
		const wrapper = mount(FolderTree, { props: { ticked: [], listFolders: folders.listFolders, single: true, blocked: ['/Day 9'] } })
		await folders.answer('')

		expect(wrapper.find('[role="tree"]').attributes('aria-multiselectable')).toBe('false')
		expect(item(wrapper, 'Day 9').attributes('aria-disabled')).toBe('true')
		expect(item(wrapper, 'Day 9').text()).toContain('Open folder, cannot be the target')

		await item(wrapper, 'Day 9').trigger('click')
		await item(wrapper, 'Day 10').trigger('click')

		expect(wrapper.emitted('toggle')).toEqual([['/Day 10']])
	})
})
