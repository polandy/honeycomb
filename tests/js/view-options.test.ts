// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { DEFAULT_FILTERS } from '../../src/logic/picture-filter.ts'
import { DEFAULT_TILE_SIZE } from '../../src/logic/tile-size.ts'
import { useViewOptions } from '../../src/view-options.ts'
import { fakeStorage } from './app-cull.ts'

/** View options over a folder count the test changes, with the given stored values. */
function viewOptions(stored: Record<string, string> = {}) {
	const folders = ref(1)
	return { options: useViewOptions(fakeStorage(stored), () => folders.value), folders, stored }
}

describe('useViewOptions: start', () => {
	// spec: FOLDERS-006.1, APP-001.3
	it('starts with the folder picker closed', () => {
		expect(viewOptions().options.pickerOpen.value).toBe(false)
	})
})

describe('useViewOptions: setFlags', () => {
	// spec: GRID-002.2
	it('replaces the flag filter and keeps the other groups', () => {
		const { options } = viewOptions()
		options.filters.value = { ...DEFAULT_FILTERS, rating: 2 }

		options.setFlags(new Set(['rejected']))

		expect(options.filters.value).toEqual({ ...DEFAULT_FILTERS, rating: 2, flags: new Set(['rejected']) })
		expect(options.activeFilters.value).toBe(2)
	})
})

describe('useViewOptions: toggleFiltersOff', () => {
	const filtered = { ...DEFAULT_FILTERS, rating: 3, flags: new Set(['picked' as const]) }

	it('clears the filters, and the second press restores them', () => {
		const { options } = viewOptions()
		options.filters.value = filtered

		options.toggleFiltersOff()
		expect(options.filters.value).toEqual(DEFAULT_FILTERS)
		options.toggleFiltersOff()
		expect(options.filters.value).toEqual(filtered)
	})

	it('turns off filters set while they were off rather than restoring the saved ones', () => {
		const { options } = viewOptions()
		options.filters.value = filtered
		options.toggleFiltersOff()
		options.filters.value = { ...options.filters.value, rating: 1 }

		options.toggleFiltersOff()
		expect(options.filters.value.rating).toBeNull()
		options.toggleFiltersOff()
		expect(options.filters.value.rating).toBe(1)
	})
})

describe('useViewOptions: reset', () => {
	it('clears the filters, forgets those turned off, sorts by the folder count and closes the picker', () => {
		const { options, folders } = viewOptions()
		options.filters.value = { ...DEFAULT_FILTERS, rating: 3 }
		options.toggleFiltersOff()
		options.filters.value = { ...DEFAULT_FILTERS, rating: 1 }
		folders.value = 2

		options.reset()

		expect(options.filters.value).toEqual(DEFAULT_FILTERS)
		expect(options.sortOrder.value).toBe('capture-time')
		expect(options.pickerOpen.value).toBe(false)
		options.toggleFiltersOff()
		expect(options.filters.value).toEqual(DEFAULT_FILTERS)
	})

	it('sorts a single folder by file name', () => {
		const { options } = viewOptions()
		options.sortOrder.value = 'capture-time'

		options.reset()

		expect(options.sortOrder.value).toBe('file-name')
	})
})

describe('useViewOptions: grouped', () => {
	it('groups by folder only when asked and the cull has more than one folder', () => {
		const { options, folders } = viewOptions()
		options.groupByFolder.value = true
		expect(options.grouped.value).toBe(false)

		folders.value = 2
		expect(options.grouped.value).toBe(true)

		options.groupByFolder.value = false
		expect(options.grouped.value).toBe(false)
	})
})

describe('useViewOptions: tile size', () => {
	it('starts from the stored size, or the default without one', () => {
		expect(viewOptions({ 'honeycomb.tileSize': '200' }).options.tileSize.value).toBe(200)
		expect(viewOptions().options.tileSize.value).toBe(DEFAULT_TILE_SIZE)
	})

	it('keeps a new size for the next visit', () => {
		const { options, stored } = viewOptions()

		options.setTileSize(250.5)

		expect(options.tileSize.value).toBe(250.5)
		expect(stored['honeycomb.tileSize']).toBe('250.5')
	})
})
