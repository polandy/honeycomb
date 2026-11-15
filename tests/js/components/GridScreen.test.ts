// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CullEmptyState from '../../../src/components/CullEmptyState.vue'
import FilterBar from '../../../src/components/FilterBar.vue'
import GridScreen from '../../../src/components/GridScreen.vue'
import GridToolbar from '../../../src/components/GridToolbar.vue'
import PhotoGrid from '../../../src/components/PhotoGrid.vue'
import SelectionBar from '../../../src/components/SelectionBar.vue'
import { DEFAULT_FILTERS } from '../../../src/logic/picture-filter.ts'
import { gridStub, SET } from '../app-cull.ts'
import { fakeCullContext, mountInCullContext } from '../cull-context-fake.ts'

/** The grid screen over a fake context, its parts stubbed. */
async function mountScreen(prepare: (context: Awaited<ReturnType<typeof fakeCullContext>>) => void = () => undefined) {
	const fake = await fakeCullContext()
	prepare(fake)
	const grid = gridStub()
	const wrapper = mountInCullContext(GridScreen, fake.context, { PhotoGrid: grid.component, GridToolbar: true, FilterBar: true, GridNotices: true, SelectionBar: true, CullEmptyState: true })
	return { ...fake, wrapper, grid: grid.calls }
}

describe('GridScreen', () => {
	it('shows the cull to the toolbar in groups', async () => {
		const { wrapper } = await mountScreen(({ context, counts }) => {
			counts.value = { rejected: [context.cull.pictures.value[0]!], rawRemovable: 1, resumeName: 'IMG_9' }
		})

		expect(wrapper.findComponent(GridToolbar).props()).toEqual({
			folders: { set: SET, count: 2 },
			view: { tileSize: expect.any(Number), groupByFolder: false, sortOrder: 'capture-time', flags: new Set(['picked', 'unflagged']), filtersOpen: false, activeFilters: 0 },
			progress: { decided: 0, total: 3, filtered: false },
			selection: { selecting: false, selected: 0 },
			tasks: { rejected: 1, series: 0, rawRemovable: 1, movable: 0, sidecarsShared: false, resumeName: 'IMG_9' },
		})
	})

	it.each([
		['openSettings', [], 'openSettings'],
		['reviewRejects', [], 'review'],
		['compareSeries', [], 'compareSeries'],
		['removeRaws', [], 'removeRaws'],
		['resume', [], 'resume'],
		['move', [[]], 'move'],
		['writeSidecars', [[]], 'writeSidecars'],
	])('passes the toolbar\'s %s to the context', async (event, args, call) => {
		const { wrapper, calls } = await mountScreen()

		wrapper.findComponent(GridToolbar).vm.$emit(event)

		expect(calls).toEqual([[call, ...args]])
	})

	it('changes the folders, the view and the selection from the toolbar', async () => {
		const { wrapper, context } = await mountScreen()
		const toolbar = wrapper.findComponent(GridToolbar)

		toolbar.vm.$emit('changeFolders')
		toolbar.vm.$emit('update:filtersOpen', true)
		toolbar.vm.$emit('update:groupByFolder', true)
		toolbar.vm.$emit('update:sortOrder', 'file-name')
		toolbar.vm.$emit('update:selecting', true)
		await flushPromises()

		expect(context.cull.pickerOpen.value).toBe(true)
		expect(toolbar.props('view')).toMatchObject({ filtersOpen: true, groupByFolder: true, sortOrder: 'file-name' })
		expect(toolbar.props('selection')).toEqual({ selecting: true, selected: 0 })
		expect(wrapper.findComponent(FilterBar).exists()).toBe(true)
		expect(wrapper.findComponent(SelectionBar).exists()).toBe(true)
	})

	it('opens the loupe from the grid and dismisses the resume offer on a scroll', async () => {
		const { wrapper, calls } = await mountScreen()

		wrapper.findComponent(PhotoGrid).vm.$emit('open', 2)
		wrapper.findComponent(PhotoGrid).vm.$emit('scroll')

		expect(calls).toEqual([['openLoupe', 2], ['dismissResume']])
	})

	it('decides, tags, moves and deletes the selection from the selection bar', async () => {
		const { wrapper, context, calls } = await mountScreen(({ context }) => context.selection.setSelecting(true))
		const chosen = context.cull.view.value.slice(0, 1)
		context.selection.select({ ids: new Set([chosen[0]!.key]), anchor: chosen[0]!.key })
		await flushPromises()
		const bar = wrapper.findComponent(SelectionBar)

		bar.vm.$emit('decide', { kind: 'flag', flag: 'picked' })
		bar.vm.$emit('tag')
		bar.vm.$emit('move')
		bar.vm.$emit('delete')

		expect(calls).toEqual([['decide', { kind: 'flag', flag: 'picked' }, chosen], ['tag', chosen], ['move', chosen], ['summarise', chosen]])
	})

	it('shows the empty state when the filters hide every photo, and clears them from it', async () => {
		const { wrapper, context } = await mountScreen(({ context }) => context.cull.setFlags(new Set(['rejected'])))

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		wrapper.findComponent(CullEmptyState).vm.$emit('showAll')
		await flushPromises()

		expect(context.cull.filters.value).toEqual(DEFAULT_FILTERS)
		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(true)
	})

	it('hides the toolbar and the filter bar while the header is hidden', async () => {
		const { wrapper, context } = await mountScreen(({ context }) => {
			context.cull.filtersOpen.value = true
			context.headerShown.value = false
		})

		expect(wrapper.findComponent(GridToolbar).exists()).toBe(false)
		expect(wrapper.findComponent(FilterBar).exists()).toBe(false)
		context.headerShown.value = true
		await flushPromises()
		expect(wrapper.findComponent(FilterBar).exists()).toBe(true)
	})

	it('lends App its grid', async () => {
		const { wrapper, grid } = await mountScreen()

		await wrapper.findComponent(GridScreen).vm.grid?.reveal(1)

		expect(grid.revealed).toEqual([1])
	})
})
