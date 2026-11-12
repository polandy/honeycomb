// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Flag } from '../../../src/logic/decision.ts'
import type { FolderSet } from '../../../src/logic/folder-set.ts'
import type { SortOrder } from '../../../src/logic/picture-order.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FlagFilter from '../../../src/components/FlagFilter.vue'
import GridToolbar from '../../../src/components/GridToolbar.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { PopoverStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

const CULL: { flags: ReadonlySet<Flag>, decided: number, total: number, activeFilters: number, filtersOpen: boolean, sortOrder: SortOrder, selecting: boolean, selected: number, rejected: number, series: number, rawRemovable: number, sidecarsShared: boolean, movable: number, resumeName: string | null } = {
	movable: 0,
	resumeName: null,
	selecting: false,
	rejected: 0,
	series: 0,
	rawRemovable: 0,
	sidecarsShared: false,
	selected: 0,
	flags: new Set(['picked', 'unflagged']),
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
		expect(button.attributes('data-tip')!.replaceAll(MARK, '')).toBe('Review rejects')
		expect(button.attributes('data-tip-key')).toBe('Ctrl+Backspace')
		expect(button.find('.grid-toolbar__badge').text()).toBe('12')
		await button.trigger('click')
		expect(wrapper.emitted('reviewRejects')).toHaveLength(1)
	})

	// spec: SERIES-001.6
	it('compares the series from a button with their count, held while there are none', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const none = mountToolbar(set).find('[aria-label*="Compare series"]')
		const wrapper = mountToolbar(set, 1, { series: 3 })
		const button = wrapper.find('[aria-label*="Compare series"]')

		expect(none.attributes('disabled')).toBeDefined()
		expect(none.find('.grid-toolbar__badge').exists()).toBe(false)
		expect(button.attributes('aria-label')!.replaceAll(MARK, '')).toBe('Compare series (3)')
		expect(button.attributes('data-tip')!.replaceAll(MARK, '')).toBe('Compare series')
		expect(button.attributes('data-tip-key')).toBe('N')
		expect(button.find('.grid-toolbar__badge').text()).toBe('3')
		await button.trigger('click')
		expect(wrapper.emitted('compareSeries')).toHaveLength(1)
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

	// spec: DECISIONS-002.7
	it('resumes at the stored picture from the More menu, shown only while there is one', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('button').find((button) => button.text().includes('Resume'))
		const wrapper = mountToolbar(set, 1, { resumeName: 'IMG_9' })

		expect(item(mountToolbar(set))).toBeUndefined()
		expect(item(wrapper)!.text()).toBe(`${MARK}Resume at IMG_9`)
		await item(wrapper)!.trigger('click')
		expect(wrapper.emitted('resume')).toHaveLength(1)
	})

	// spec: MOVE-004.2
	it('moves the picks, or the filtered photos while a filter is on, from the More menu with their count, held at 0', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('button').find((button) => button.text().replaceAll(MARK, '').startsWith('Move'))!
		const filtered = mountToolbar(set, 1, { movable: 5, activeFilters: 1 })

		expect(item(mountToolbar(set)).attributes('disabled')).toBeDefined()
		expect(item(mountToolbar(set, 1, { movable: 3 })).text().replaceAll(MARK, '')).toBe('Move picks… 3')
		expect(item(filtered).text().replaceAll(MARK, '')).toBe('Move filtered… 5')
		await item(filtered).trigger('click')
		expect(filtered.emitted('move')).toHaveLength(1)
	})

	// spec: XMP-003.12
	it('offers writing to sidecars in the More menu only with photos in a shared folder', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('button').find((button) => button.text().includes('Write decisions to sidecars'))
		const wrapper = mountToolbar(set, 1, { sidecarsShared: true })

		expect(item(mountToolbar(set))).toBeUndefined()
		expect(item(wrapper)!.text().replaceAll(MARK, '')).toBe('Write decisions to sidecars…')
		await item(wrapper)!.trigger('click')
		expect(wrapper.emitted('writeSidecars')).toHaveLength(1)
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

	// spec: GRID-002.2
	it('passes the flag filter on and forwards its changes', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { flags: new Set(['rejected']) })

		expect(wrapper.findComponent(FlagFilter).props('flags')).toEqual(new Set(['rejected']))
		await wrapper.find(`.flag-filter [aria-label="${MARK}Picked"]`).trigger('click')

		expect(wrapper.emitted('update:flags')).toEqual([[new Set(['rejected', 'picked'])]])
	})

	// spec: GRID-002.7
	it('shows how many photos are decided as text and as a progress bar', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const bar = wrapper.find('[role="progressbar"]')

		expect(wrapper.text()).toContain(`${MARK}1,840 / 2,000 decided`)
		expect(bar.attributes()).toMatchObject({ 'aria-label': `${MARK}Decided`, 'aria-valuemin': '0', 'aria-valuemax': '2000', 'aria-valuenow': '1840' })
		expect(bar.find('.cull-progress__done').attributes('style')).toContain('width: 92%')
	})

	// spec: GRID-002.7
	it('shows an empty progress bar for a cull without photos', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { decided: 0, total: 0 })

		expect(wrapper.find('.cull-progress__done').attributes('style')).toContain('width: 0%')
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

	// spec: GRID-001.14
	it.each([
		['Filters', { activeFilters: 2 }, false],
		['Filters', { activeFilters: 2, filtersOpen: true }, true],
		['Select', { selecting: true, selected: 4 }, true],
		['Review rejects', { rejected: 12 }, false],
		['Compare series', { series: 3 }, false],
	] as const)('colours the %s badge for %o as pressed: %s', (label, cull, pressed) => {
		const badge = mountToolbar({ paths: ['/A'], subfolders: false }, 1, cull).find(`[aria-label^="${MARK}${label}"] .grid-toolbar__badge`)
		expect(badge.classes('grid-toolbar__badge--pressed')).toBe(pressed)
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
		const wrapper = mountToolbar({ paths: ['/Photos/Trip'], subfolders: false }, 2, { activeFilters: 1 })

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
