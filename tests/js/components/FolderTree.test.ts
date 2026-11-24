// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FolderTree from '../../../src/components/FolderTree.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { fakeFolders, focused, FOLDERS, item, items, mountTree, shown, twisty } from './folder-tree-fixture.ts'

const MARK = TRANSLATED_MARK

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

	// spec: LISTING-003.17
	it('counts the ticked folders below a folder, collapsed or not, without ticking it', async () => {
		const { wrapper, answer } = await mountTree(['/Photos', '/Photos/2026', '/Photos/2025'])
		const badge = () => item(wrapper, 'Photos').find('.folder-tree__badge')

		expect(badge().find('[aria-hidden="true"]').text()).toBe(`${MARK}${MARK}2 inside`)
		expect(badge().find('.hidden-visually').text()).toBe(`${MARK}${MARK}2 ticked folders inside`)
		expect(item(wrapper, 'Photos').attributes('aria-selected')).toBe('true')
		expect(item(wrapper, 'Day 9').find('.folder-tree__badge').exists()).toBe(false)

		await answer('/Photos')
		await twisty(wrapper, 'Photos').trigger('click')
		expect(item(wrapper, 'Photos').attributes('aria-expanded')).toBe('false')
		expect(badge().find('[aria-hidden="true"]').text()).toBe(`${MARK}${MARK}2 inside`)
		expect(item(wrapper, 'Photos').attributes('aria-checked')).toBeUndefined()
	})

	// spec: LISTING-003.18
	it('marks the folders below a ticked one as included while Include subfolders is on, still tappable', async () => {
		const hidden = { name: '.cache', path: '/Photos/.cache', hasSubfolders: false, pictures: null, picturesBelow: null, picturesBelowApproximate: false, orphanedSidecars: null, orphanedSidecarsBelow: null }
		const { wrapper, answer } = await mountTree(['/Photos'], true, { ...FOLDERS, '/Photos': [...FOLDERS['/Photos']!, hidden] })
		await twisty(wrapper, 'Photos').trigger('click')
		await answer('/Photos')
		const included = (name: string) => item(wrapper, name).find('.folder-tree__included')

		expect(included('2025').find('[aria-hidden="true"]').text()).toBe(`${MARK}included`)
		expect(included('2025').find('.hidden-visually').text()).toBe(`${MARK}included with Photos`)
		expect(item(wrapper, '2025').find('.folder-tree__box--included').exists()).toBe(true)
		expect(item(wrapper, '2025').attributes('aria-selected')).toBe('false')
		expect(included('Photos').exists()).toBe(false)
		expect(included('.cache').exists()).toBe(false)
		expect(item(wrapper, '.cache').find('.folder-tree__box--included').exists()).toBe(false)

		await item(wrapper, '2025').trigger('click')
		expect(wrapper.emitted('toggle')).toEqual([['/Photos/2025']])
	})

	// spec: LISTING-003.18
	it('marks no folder as included while Include subfolders is off', async () => {
		const { wrapper, answer } = await mountTree(['/Photos'])
		await twisty(wrapper, 'Photos').trigger('click')
		await answer('/Photos')

		expect(wrapper.find('.folder-tree__included').exists()).toBe(false)
		expect(wrapper.find('.folder-tree__box--included').exists()).toBe(false)
	})

	// spec: LISTING-003.19
	it('shows the photos of each folder last in its row, spoken as part of the folder', async () => {
		const { wrapper, answer } = await mountTree(['/Photos/2025'])
		const count = (name: string) => item(wrapper, name).find('.folder-tree__count')

		expect(count('Photos').find('[aria-hidden="true"]').text()).toBe('3')
		expect(count('Photos').find('.hidden-visually').text()).toBe(`${MARK}${MARK}3 photos`)
		expect(item(wrapper, 'Photos').element.lastElementChild?.classList).toContain('folder-tree__count')
		expect(count('Day 9').find('.hidden-visually').text()).toBe(`${MARK}${MARK}1 photo`)
		expect(count('Day 10').exists()).toBe(false)
		expect(count('.hidden').exists()).toBe(false)

		await answer('/Photos')
		expect(count('Photos').find('[aria-hidden="true"]').text()).toBe('3')
		expect(count('2025').find('[aria-hidden="true"]').text()).toBe('1,200')
		expect(count('2026').exists()).toBe(false)
	})

	// spec: LISTING-003.20
	it('shows the photos below a collapsed folder and its own once it is expanded', async () => {
		const { wrapper, answer } = await mountTree()
		const count = (name: string) => item(wrapper, name).find('.folder-tree__count')

		expect(count('Photos').find('[aria-hidden="true"]').text()).toBe('1,203')
		expect(count('Photos').find('.hidden-visually').text()).toBe(`${MARK}${MARK}1,203 photos with subfolders`)
		expect(count('Day 9').find('.hidden-visually').text()).toBe(`${MARK}${MARK}1 photo`)

		await twisty(wrapper, 'Photos').trigger('click')
		await answer('/Photos')
		expect(count('Photos').find('[aria-hidden="true"]').text()).toBe('3')
		expect(count('Photos').find('.hidden-visually').text()).toBe(`${MARK}${MARK}3 photos`)

		await twisty(wrapper, 'Photos').trigger('click')
		expect(count('Photos').find('[aria-hidden="true"]').text()).toBe('1,203')
	})

	// spec: LISTING-003.20
	it('puts a tilde before a collapsed count that may be incomplete and speaks "about", but not on its own count', async () => {
		const approximate = { ...FOLDERS['']![0]!, picturesBelowApproximate: true }
		const { wrapper, answer } = await mountTree([], false, { ...FOLDERS, '': [approximate, ...FOLDERS['']!.slice(1)] })
		const count = (name: string) => item(wrapper, name).find('.folder-tree__count')

		expect(count('Photos').find('[aria-hidden="true"]').text()).toBe('~1,203')
		expect(count('Photos').find('.hidden-visually').text()).toBe(`${MARK}${MARK}about 1,203 photos with subfolders`)
		expect(count('Day 9').find('[aria-hidden="true"]').text()).toBe('1')

		await twisty(wrapper, 'Photos').trigger('click')
		await answer('/Photos')
		expect(count('Photos').find('[aria-hidden="true"]').text()).toBe('3')
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

	// spec: SETTINGS-001.35
	it('shows the note of a folder that is refused and does not toggle it', async () => {
		const folders = fakeFolders()
		const disabledNote = (path: string) => (path === '/Day 9' ? 'Already a root' : null)
		const wrapper = mount(FolderTree, { props: { ticked: [], listFolders: folders.listFolders, single: true, disabledNote } })
		await folders.answer('')

		expect(item(wrapper, 'Day 9').attributes('aria-disabled')).toBe('true')
		expect(item(wrapper, 'Day 9').text()).toContain('Already a root')
		expect(item(wrapper, 'Day 10').attributes('aria-disabled')).toBeUndefined()

		await item(wrapper, 'Day 9').trigger('click')
		await item(wrapper, 'Day 10').trigger('click')

		expect(wrapper.emitted('toggle')).toEqual([['/Day 10']])
	})

	// spec: LISTING-003.17, MOVE-004.4
	it('marks the folders above the chosen one', async () => {
		const folders = fakeFolders()
		const wrapper = mount(FolderTree, { props: { ticked: ['/Photos/2025'], listFolders: folders.listFolders, single: true } })
		await folders.answer('')

		expect(item(wrapper, 'Photos').find('.folder-tree__badge .hidden-visually').text()).toBe('1 chosen folder inside')
	})
})
