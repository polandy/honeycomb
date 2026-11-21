// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Flag } from '../../../src/logic/decision.ts'
import type { FolderSet } from '../../../src/logic/folder-set.ts'
import type { SortOrder } from '../../../src/logic/picture-order.ts'

import { mount } from '@vue/test-utils'
import GridToolbar from '../../../src/components/GridToolbar.vue'
import { PopoverStub } from './stubs.ts'

/** A cull that shows the toolbar with nothing to review, compare or move. */
const CULL: { flags: ReadonlySet<Flag>, decided: number, total: number, filtered: boolean, activeFilters: number, filtersOpen: boolean, sortOrder: SortOrder, selecting: boolean, selected: number, rejected: number, series: number, reducible: number, rawRemovable: number, movable: number, clearable: number, xmpToWrite: number, resumeName: string | null } = {
	movable: 0,
	clearable: 0,
	xmpToWrite: 0,
	resumeName: null,
	selecting: false,
	rejected: 0,
	series: 0,
	reducible: 0,
	rawRemovable: 0,
	selected: 0,
	flags: new Set(['picked', 'unflagged']),
	decided: 1840,
	total: 2000,
	filtered: false,
	activeFilters: 0,
	filtersOpen: false,
	sortOrder: 'file-name',
}

/** Mounts the toolbar on the folder set with the cull changed by `cull`, the popover in place. */
export function mountToolbar(folderSet: FolderSet, folders = 1, cull: Partial<typeof CULL> = {}) {
	const { flags, decided, total, filtered, activeFilters, filtersOpen, sortOrder, selecting, selected, ...tasks } = { ...CULL, ...cull }
	return mount(GridToolbar, {
		props: {
			folders: { set: folderSet, count: folders },
			view: { tileSize: 150.4, groupByFolder: false, fileNames: false, sortOrder, flags, filtersOpen, activeFilters },
			progress: { decided, total, filtered },
			selection: { selecting, selected },
			tasks,
		},
		global: { stubs: { NcPopover: PopoverStub } },
	})
}
