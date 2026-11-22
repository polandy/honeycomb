// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { Filters } from './logic/picture-filter.ts'
import type { SortOrder } from './logic/picture-order.ts'

import { computed, ref, shallowRef } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { activeFilterCount, DEFAULT_FILTERS } from './logic/picture-filter.ts'
import { defaultSortOrder } from './logic/picture-order.ts'
import { parseTileSize } from './logic/tile-size.ts'

/** The browser storage key of the thumbnail size. */
const TILE_SIZE_KEY = 'honeycomb.tileSize'

/** How the cull is shown: filters, sort order, grouping, thumbnail size and the open panels; `folders` counts the cull's folders. */
export function useViewOptions(storage: BrowserStorage, folders: () => number) {
	const filters = shallowRef<Filters>(DEFAULT_FILTERS)
	const sortOrder = ref<SortOrder>('file-name')
	const filtersOpen = ref(false)
	const pickerOpen = ref(false)
	const groupByFolder = ref(false)
	const tileSize = ref(parseTileSize(readStored(storage, TILE_SIZE_KEY)))
	const activeFilters = computed(() => activeFilterCount(filters.value))
	const grouped = computed(() => groupByFolder.value && folders() > 1)
	let filtersOff: Filters | null = null

	/** Starts a newly opened cull with fresh filters, the sort order its folders suggest and the picker closed. */
	function reset() {
		filtersOff = null
		filters.value = DEFAULT_FILTERS
		sortOrder.value = defaultSortOrder(folders())
		pickerOpen.value = false
	}

	/** Replaces the flag filter and keeps the other groups. */
	function setFlags(flags: Filters['flags']) {
		filters.value = { ...filters.value, flags }
	}

	/** Turns the filters off; the next press turns them back on unless others were set meanwhile. */
	function toggleFiltersOff() {
		if (filtersOff !== null && activeFilters.value === 0) {
			filters.value = filtersOff
			filtersOff = null
		} else {
			filtersOff = filters.value
			filters.value = DEFAULT_FILTERS
		}
	}

	/** Sets the thumbnail size and keeps it for the next visit. */
	function setTileSize(size: number) {
		tileSize.value = size
		writeStored(storage, TILE_SIZE_KEY, String(size))
	}

	return { filters, sortOrder, filtersOpen, pickerOpen, groupByFolder, tileSize, activeFilters, grouped, reset, setFlags, toggleFiltersOff, setTileSize }
}
