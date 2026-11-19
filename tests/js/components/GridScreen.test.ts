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
			view: { tileSize: expect.any(Number), groupByFolder: false, fileNames: false, sortOrder: 'capture-time', flags: new Set(['picked', 'unflagged']), filtersOpen: false, activeFilters: 0 },
			progress: { decided: 0, total: 3, filtered: false },
			selection: { selecting: false, selected: 0 },
			tasks: { rejected: 1, series: 0, rawRemovable: 1, movable: 0, resumeName: 'IMG_9' },
		})
	})

	it.each([
		['openSettings', [], 'openSettings'],
		['reviewRejects', [], 'review'],
		['compareSeries', [], 'compareSeries'],
		['removeRaws', [], 'removeRaws'],
		['resume', [], 'resume'],
		['move', [[]], 'move'],
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

	// spec: SERIES-002.13
	it('opens the compare on a tapped badge\'s series and lands the grid where the compare closes', async () => {
		const { wrapper, context, calls, grid } = await mountScreen()
		const [first, second] = context.cull.view.value
		const series = { key: 1, members: [first!, second!] }

		wrapper.findComponent(PhotoGrid).vm.$emit('compareSeries', series, second)
		expect(calls).toEqual([['compareSeriesOn', series, second, expect.any(Function), 'grid']])
		const land = calls[0]![3] as (landing: unknown) => void
		land({ kind: 'on', picture: second })
		land({ kind: 'after', series, picked: first })
		await flushPromises()

		expect(grid.revealed).toEqual([1, 2])
	})

	// spec: SERIES-002.14
	it('selects or deselects a tapped badge\'s series in selection mode', async () => {
		const { wrapper, context, calls } = await mountScreen(({ context }) => context.selection.setSelecting(true))
		const [first, second] = context.cull.view.value
		const series = { key: 1, members: [first!, second!] }
		const badge = () => wrapper.findComponent(PhotoGrid).vm.$emit('compareSeries', series, first)

		badge()
		expect(context.selection.selected.value).toEqual([first, second])
		badge()
		expect(context.selection.selected.value).toEqual([])
		expect(calls).toEqual([])
	})

	it('decides, tags, moves and deletes the selection from the selection bar', async () => {
		const { wrapper, context, calls } = await mountScreen(({ context }) => {
			context.selection.setSelecting(true)
			context.selection.selectAll()
		})
		const chosen = context.cull.view.value
		const bar = wrapper.findComponent(SelectionBar)

		bar.vm.$emit('decide', { kind: 'flag', flag: 'picked' })
		bar.vm.$emit('tag')
		bar.vm.$emit('move')
		bar.vm.$emit('delete')
		bar.vm.$emit('series', 'new')

		expect(calls).toEqual([['decide', { kind: 'flag', flag: 'picked' }, chosen], ['tag', chosen], ['move', chosen], ['summarise', chosen], ['editSeries', 'new', chosen]])
	})

	// spec: SERIES-005.4
	it('offers the selection bar\'s series menu what the selection touches', async () => {
		const { wrapper, context } = await mountScreen(({ context }) => {
			context.selection.setSelecting(true)
			context.selection.selectAll()
		})

		expect(wrapper.findComponent(SelectionBar).props('seriesOffer')).toEqual({ selected: context.cull.view.value, touched: [], inSeries: [], loose: context.cull.view.value })
	})

	it.each([
		['clearFilters', DEFAULT_FILTERS.flags],
		['showAll', new Set()],
	])('shows the empty state while the flag filter hides every photo, and the photos again after %s', async (event, flags) => {
		const { wrapper, context } = await mountScreen(({ context }) => context.cull.setFlags(new Set(['rejected'])))

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		wrapper.findComponent(CullEmptyState).vm.$emit(event)
		await flushPromises()

		expect(context.cull.filters.value.flags).toEqual(flags)
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
