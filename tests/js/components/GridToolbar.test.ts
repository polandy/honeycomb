// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderSet } from '../../../src/logic/folder-set.ts'
import type { Scope } from '../../../src/logic/picture-filter.ts'
import type { SortOrder } from '../../../src/logic/picture-order.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../../src/components/GridToolbar.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { PopoverStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

const CULL: { scope: Scope, scopeLocked: boolean, decided: number, total: number, activeFilters: number, filtersOpen: boolean, sortOrder: SortOrder, selecting: boolean, selected: number, rejected: number, rawRemovable: number } = {
	selecting: false,
	rejected: 0,
	rawRemovable: 0,
	selected: 0,
	scope: 'not-rejected',
	scopeLocked: false,
	decided: 1840,
	total: 2000,
	activeFilters: 0,
	filtersOpen: false,
	sortOrder: 'file-name',
}

function mountToolbar(folderSet: FolderSet, folders = 1, cull: Partial<typeof CULL> = {}) {
	return mount(GridToolbar, {
		props: { folderSet, folders, tileSize: 150.4, groupByFolder: false, ...CULL, ...cull },
		global: { stubs: { NcPopover: PopoverStub } },
	})
}

const setName = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.find('.grid-toolbar__set').text().replaceAll(MARK, '')

describe('GridToolbar', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	it.each([
		[{ paths: ['/Photos/Trip'], subfolders: false }, 'Trip'],
		[{ paths: ['/Photos/Trip'], subfolders: true }, 'Trip + subfolders'],
		[{ paths: ['/A', '/B'], subfolders: false }, '2 folders'],
		[{ paths: ['/A', '/B'], subfolders: true }, '2 folders + subfolders'],
	])('names the folder set %o "%s"', (folderSet, name) => {
		expect(setName(mountToolbar(folderSet))).toBe(name)
	})

	it('reviews the rejects from a button with their count, held while there are none', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const none = mountToolbar(set).find('[aria-label*="Review rejects"]')
		const wrapper = mountToolbar(set, 1, { rejected: 12 })
		const button = wrapper.find('[aria-label*="Review rejects"]')

		expect(none.attributes('disabled')).toBeDefined()
		expect(none.find('.grid-toolbar__badge').exists()).toBe(false)
		expect(button.attributes('title')!.replaceAll(MARK, '')).toBe('Review rejects (Ctrl+Backspace)')
		expect(button.find('.grid-toolbar__badge').text()).toBe('12')
		await button.trigger('click')
		expect(wrapper.emitted('reviewRejects')).toHaveLength(1)
	})

	it('removes RAWs from the More menu with their count, held while there are none', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('button').find((button) => button.text().includes('Remove RAWs'))!
		const none = item(mountToolbar(set))
		const wrapper = mountToolbar(set, 1, { rawRemovable: 88 })

		expect(none.attributes('disabled')).toBeDefined()
		expect(item(wrapper).text().replaceAll(MARK, '')).toBe('Remove RAWs… 88')
		await item(wrapper).trigger('click')
		expect(wrapper.emitted('removeRaws')).toHaveLength(1)
	})

	it('opens the settings from the More menu', async () => {
		const wrapper = mountToolbar({ paths: ['/Trip'], subfolders: false })
		const item = wrapper.findAll('button').find((button) => button.text().replaceAll(MARK, '') === 'Settings')!

		await item.trigger('click')

		expect(wrapper.emitted('openSettings')).toHaveLength(1)
	})

	it('opens the folder picker from Home and from the set name', async () => {
		const wrapper = mountToolbar({ paths: ['/A', '/B'], subfolders: false })

		await wrapper.find(`[aria-label="${MARK}Change folders"]`).trigger('click')
		await wrapper.find('.grid-toolbar__set').trigger('click')

		expect(wrapper.find('.grid-toolbar__set').attributes('aria-label')).toBe(`${MARK}Change folders: /A, /B`)
		expect(wrapper.emitted('changeFolders')).toEqual([[], []])
	})

	// spec: GRID-001.7
	it('sets the thumbnail size from the More menu', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const range = wrapper.find(`input[type="range"][aria-label="${MARK}Thumbnail size"]`)

		expect(wrapper.find(`[aria-label="${MARK}More"]`).exists()).toBe(true)
		expect(range.attributes()).toMatchObject({ min: '90', max: '340' })
		expect((range.element as HTMLInputElement).value).toBe('150')
		await range.setValue('200')

		expect(wrapper.emitted('update:tileSize')).toEqual([[200]])
	})

	// spec: GRID-001.9
	it('offers Group by folder only when the cull spans more than one folder', async () => {
		expect(mountToolbar({ paths: ['/A'], subfolders: true }, 1).text()).not.toContain('Group by folder')
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: true }, 2)

		await wrapper.find('input[type="checkbox"]').setValue(true)

		expect(wrapper.text()).toContain(`${MARK}Group by folder`)
		expect(wrapper.emitted('update:groupByFolder')).toEqual([[true]])
	})

	it('shows the scope pressed and switches it', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { scope: 'undecided' })
		const scope = (name: string) => wrapper.find(`.scope-progress__scope [aria-label="${MARK}${name}"]`)

		expect(scope('Not rejected').attributes('aria-pressed')).toBe('false')
		expect(scope('Undecided').attributes('aria-pressed')).toBe('true')
		await scope('All').trigger('click')
		await scope('Not rejected').trigger('click')

		expect(wrapper.emitted('update:scope')).toEqual([['all'], ['not-rejected']])
		expect(wrapper.text()).not.toContain('The flag filter overrides this')
	})

	// spec: GRID-002.2
	it('disables the scope while a flag filter overrides it and says why', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { scopeLocked: true })
		const buttons = wrapper.findAll('.scope-progress__scope button')

		expect(buttons).toHaveLength(3)
		expect(buttons.every((button) => button.attributes('disabled') !== undefined)).toBe(true)
		expect(wrapper.text()).toContain(`${MARK}The flag filter overrides this`)
	})

	// spec: GRID-002.7
	it('shows how many photos are decided as text and as a progress bar', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const bar = wrapper.find('[role="progressbar"]')

		expect(wrapper.text()).toContain(`${MARK}1,840 / 2,000 decided`)
		expect(bar.attributes()).toMatchObject({ 'aria-label': `${MARK}Decided`, 'aria-valuemin': '0', 'aria-valuemax': '2000', 'aria-valuenow': '1840' })
		expect(bar.find('.scope-progress__done').attributes('style')).toContain('width: 92%')
	})

	// spec: GRID-002.7
	it('shows an empty progress bar for a cull without photos', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { decided: 0, total: 0 })

		expect(wrapper.find('.scope-progress__done').attributes('style')).toContain('width: 0%')
	})

	// spec: GRID-002.6
	it('toggles the filter bar and counts the active filters', async () => {
		const closed = mountToolbar({ paths: ['/A'], subfolders: false })
		const filters = () => closed.find(`[aria-label^="${MARK}Filters"]`)

		expect(filters().attributes()).toMatchObject({ 'aria-pressed': 'false', 'aria-expanded': 'false' })
		expect(closed.find('.grid-toolbar__badge').exists()).toBe(false)
		await filters().trigger('click')
		expect(closed.emitted('update:filtersOpen')).toEqual([[true]])

		const open = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { filtersOpen: true, activeFilters: 2 })
		const button = open.find(`[aria-label="${MARK}Filters (2)"]`)
		expect(button.attributes()).toMatchObject({ 'aria-pressed': 'true', 'aria-expanded': 'true' })
		expect(open.find('.grid-toolbar__badge').text()).toBe('2')
		await button.trigger('click')
		expect(open.emitted('update:filtersOpen')).toEqual([[false]])
	})

	// spec: GRID-002.8
	it('chooses the sort order in the More menu', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const radios = wrapper.findAll('input[type="radio"]')

		expect(wrapper.text()).toContain(`${MARK}Sort by`)
		expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true, false])
		await radios[1]!.setValue(true)

		expect(wrapper.text()).toContain(`${MARK}File name`)
		expect(wrapper.text()).toContain(`${MARK}Capture time`)
		expect(wrapper.emitted('update:sortOrder')).toEqual([['capture-time']])
	})

	it('renders no text that bypasses the catalogue but the folder name', () => {
		const wrapper = mountToolbar({ paths: ['/Photos/Trip'], subfolders: false }, 2, { scopeLocked: true, activeFilters: 1 })

		expect(untranslatedText(wrapper.element as Element)).toEqual(['Trip'])
	})
	// spec: GRID-003.1
	it('enters and leaves selection mode with Select', async () => {
		const wrapper = mountToolbar({ paths: ['/Photos/Trip'], subfolders: false })
		const select = wrapper.find(`[aria-label="${MARK}Select"]`)
		expect(select.attributes('aria-pressed')).toBe('false')
		expect(wrapper.find('.grid-toolbar__selection').exists()).toBe(false)

		await select.trigger('click')
		await wrapper.setProps({ selecting: true })
		await wrapper.find(`[aria-label="${MARK}Select"]`).trigger('click')

		expect(wrapper.emitted('update:selecting')).toEqual([[true], [false]])
	})

	// spec: GRID-003.4
	it('counts the selection and selects all, none or is done', async () => {
		const wrapper = mountToolbar({ paths: ['/Photos/Trip'], subfolders: false }, 1, { selecting: true, selected: 1234 })
		const row = wrapper.find('.grid-toolbar__selection')
		const named = (label: string) => row.findAll('button').find((found) => found.text() === `${MARK}${label}`)!

		expect(row.text()).toContain('1,234 selected')
		expect(wrapper.find(`[aria-label="${MARK}Select"]`).attributes('aria-pressed')).toBe('true')
		await named('Select all (filtered)').trigger('click')
		await named('None').trigger('click')
		await named('Done').trigger('click')

		expect(wrapper.emitted('selectAll')).toEqual([[]])
		expect(wrapper.emitted('selectNone')).toEqual([[]])
		expect(wrapper.emitted('update:selecting')).toEqual([[false]])
		expect(untranslatedText(row.element)).toEqual([])
	})
})
