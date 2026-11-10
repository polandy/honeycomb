// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderSet } from '../../../src/logic/folder-set.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../../src/components/GridToolbar.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { PopoverStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

const CULL = { scope: 'not-rejected', scopeLocked: false, decided: 1840, total: 2000, activeFilters: 0, filtersOpen: false, sortOrder: 'file-name' } as const

function mountToolbar(folderSet: FolderSet, folders = 1, cull: Partial<Record<keyof typeof CULL, unknown>> = {}) {
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

	it('opens the folder picker from Home and from the set name', async () => {
		const wrapper = mountToolbar({ paths: ['/A', '/B'], subfolders: false })

		await wrapper.find(`[aria-label="${MARK}Change folders"]`).trigger('click')
		await wrapper.find('.grid-toolbar__set').trigger('click')

		expect(wrapper.find('.grid-toolbar__set').attributes('aria-label')).toBe(`${MARK}Change folders: /A, /B`)
		expect(wrapper.emitted('changeFolders')).toEqual([[], []])
	})

	it('sets the thumbnail size from the More menu', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const range = wrapper.find(`input[type="range"][aria-label="${MARK}Thumbnail size"]`)

		expect(wrapper.find(`[aria-label="${MARK}More"]`).exists()).toBe(true)
		expect(range.attributes()).toMatchObject({ min: '90', max: '340' })
		expect((range.element as HTMLInputElement).value).toBe('150')
		await range.setValue('200')

		expect(wrapper.emitted('update:tileSize')).toEqual([[200]])
	})

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

	it('disables the scope while a flag filter overrides it and says why', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { scopeLocked: true })
		const buttons = wrapper.findAll('.scope-progress__scope button')

		expect(buttons).toHaveLength(3)
		expect(buttons.every((button) => button.attributes('disabled') !== undefined)).toBe(true)
		expect(wrapper.text()).toContain(`${MARK}The flag filter overrides this`)
	})

	it('shows how many photos are decided as text and as a progress bar', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const bar = wrapper.find('[role="progressbar"]')

		expect(wrapper.text()).toContain(`${MARK}1,840 / 2,000 decided`)
		expect(bar.attributes()).toMatchObject({ 'aria-label': `${MARK}Decided`, 'aria-valuemin': '0', 'aria-valuemax': '2000', 'aria-valuenow': '1840' })
		expect(bar.find('.scope-progress__done').attributes('style')).toContain('width: 92%')
	})

	it('shows an empty progress bar for a cull without photos', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { decided: 0, total: 0 })

		expect(wrapper.find('.scope-progress__done').attributes('style')).toContain('width: 0%')
	})

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
})
