// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import FlagFilter from '../../../src/components/FlagFilter.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { mountToolbar } from './grid-toolbar-mount.ts'

const MARK = TRANSLATED_MARK

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

	it('opens the folder picker from Home and from the set name', async () => {
		const wrapper = mountToolbar({ paths: ['/A', '/B'], subfolders: false })

		await wrapper.find(`[aria-label="${MARK}Change folders"]`).trigger('click')
		await wrapper.find('.grid-toolbar__set').trigger('click')

		expect(wrapper.find('.grid-toolbar__set').attributes('aria-label')).toBe(`${MARK}Change folders: /A, /B`)
		expect(wrapper.emitted('changeFolders')).toEqual([[], []])
	})

	// spec: GRID-002.2
	it('passes the flag filter on and forwards its changes', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { flags: new Set(['rejected']) })

		expect(wrapper.findComponent(FlagFilter).props('flags')).toEqual(new Set(['rejected']))
		await wrapper.find(`.flag-filter [aria-label="${MARK}Picked"]`).trigger('click')

		expect(wrapper.emitted('update:flags')).toEqual([[new Set(['rejected', 'picked'])]])
	})

	// spec: GRID-002.7
	it('names the shown photos as the progress scope while the filters hide photos', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { decided: 4, total: 20, filtered: true })

		expect(wrapper.find('.cull-progress__count').text()).toContain(`${MARK}4 / 20 shown decided`)
	})

	// spec: SERIES-003.18
	it('shows the similarity beside the decided count while hashing', () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { similarity: { phase: 'running', hashed: 1, failed: 0, total: 4 } })

		expect(wrapper.find('.cull-progress + .similarity-progress').text()).toBe(`${MARK}Similarity 1/4`)
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
