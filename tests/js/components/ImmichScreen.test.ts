// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichCullApi } from '../../../src/immich/immich-picture-source.ts'
import type { ImmichCounts } from '../../../src/logic/immich-counts.ts'
import type { Page } from '../../../src/logic/immich-paging.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppIcon from '../../../src/components/AppIcon.vue'
import ImmichFilterBar from '../../../src/components/ImmichFilterBar.vue'
import ImmichScreen from '../../../src/components/ImmichScreen.vue'
import PhotoGrid from '../../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../../src/components/PhotoLoupe.vue'
import { useImmichCull } from '../../../src/immich/immich-cull.ts'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { logger } from '../../../src/shared/logger.ts'
import { fakeStorage, fakeViewState } from '../app-cull.ts'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { immichEntry, NOW, UTC_CALENDAR } from '../logic/immich-fixtures.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const COUNTS: ImmichCounts = { total: 3660, undecided: 3412, decided: 248, matching: 3412, flags: { picked: 200, rejected: 48, unflagged: 3412 }, ratings: {}, colourLabels: {}, devices: [], kinds: { photo: 3660, live: 0, video: 0 }, periods: [] }

/** A page of `count` entries from `first` on. */
const page = (first: number, count: number, nextCursor: string | null): Page => ({ entries: Array.from({ length: count }, (_, at) => immichEntry(`a${first + at}`)), nextCursor, previousCursor: null })

/** The Immich screen over a fake server whose requests wait until the test answers them. */
async function mountScreen() {
	const assets: { cursor: string | null, answer: (page: Page) => void, fail: (error: Error) => void }[] = []
	const counts: ((counts: ImmichCounts) => void)[] = []
	const api: ImmichCullApi = {
		assets: (_id, request) => new Promise((answer, fail) => assets.push({ cursor: request.cursor, answer, fail })),
		counts: () => new Promise((answer) => counts.push(answer)),
		saveDecisions: async (_id, rows) => rows.map((row) => row.assetId),
		imageUrl: (id, assetId, size) => `/${id}/${assetId}/${size}`,
	}
	const cull = useImmichCull({ api, now: () => NOW, calendar: UTC_CALENDAR, dayLabel: () => 'Friday, 20 November', toast: { show: vi.fn(), showError: vi.fn() }, saveFilters: vi.fn() })
	cull.open('andy-phone')
	const wrapper = mount(ImmichScreen, {
		props: {
			cull,
			settings: DEFAULT_SETTINGS,
			storage: fakeStorage({}),
			viewState: fakeViewState({ gesture_guide_seen: true, series_hint_seen: true }, []),
		},
		global: { stubs: { teleport: true } },
	})
	await flushPromises()
	return { wrapper, assets, counts, cull }
}

describe('ImmichScreen', () => {
	// spec: IMMICH-002.13
	it('counts in the toolbar from the server, not from the loaded page', async () => {
		const { wrapper, assets, counts } = await mountScreen()
		expect(wrapper.find('.immich-screen__count').text()).toBe('Counting…')

		assets[0]!.answer(page(1, 100, 'c2'))
		counts[0]!(COUNTS)
		await flushPromises()

		expect(wrapper.find('.immich-screen__count').text()).toBe('3,412 of 3,660 photos · 248 decided')
	})

	// spec: IMMICH-002.18
	it('says no picture matches when the counts say 0 and clears the filters on request', async () => {
		const { wrapper, cull, assets, counts } = await mountScreen()
		cull.setFilters({ ...cull.filters.value, kinds: new Set(['video']) })
		assets[1]!.answer(page(1, 0, null))
		counts[1]!({ ...COUNTS, matching: 0 })
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(wrapper.find('.immich-screen__empty').findComponent(AppIcon).props('name')).toBe('server')
		expect(wrapper.text()).toContain('No photos match. Change the time, device or flag filter.')
		const clear = wrapper.find('.immich-screen__empty').findAll('button').find((each) => each.text() === 'Clear filters')
		expect(clear).toBeDefined()

		await clear!.trigger('click')

		expect(cull.filters.value.kinds.size).toBe(0)
		expect(cull.filters.value.flags).toEqual(new Set(['picked', 'unflagged']))
	})

	// spec: IMMICH-002.18
	it('offers no Clear filters when nothing matches the default filters', async () => {
		const { wrapper, assets, counts } = await mountScreen()
		assets[0]!.answer(page(1, 0, null))
		counts[0]!({ ...COUNTS, matching: 0 })
		await flushPromises()

		expect(wrapper.text()).toContain('No photos match. Change the time, device or flag filter.')
		expect(wrapper.find('.immich-screen__empty').findAll('button')).toHaveLength(0)
	})

	// spec: APP-001.4
	it('renders no empty-state text that bypasses the catalogue', async () => {
		installMarkedCatalogue()
		try {
			const { wrapper, assets, counts } = await mountScreen()
			assets[0]!.answer(page(1, 0, null))
			counts[0]!({ ...COUNTS, matching: 0 })
			await flushPromises()

			expect(untranslatedText(wrapper.find('.immich-screen__empty').element)).toEqual([])
		} finally {
			uninstallMarkedCatalogue()
		}
	})

	// spec: IMMICH-002.19
	it('keeps the loaded pages when one fails and asks the same cursor on Try again', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		const { wrapper, assets } = await mountScreen()
		assets[0]!.answer(page(1, 100, 'c2'))
		await flushPromises()
		wrapper.findComponent(PhotoGrid).vm.$emit('shown', 99)
		assets[1]!.fail(new Error('Immich is down'))
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).props('pictures')).toHaveLength(100)
		const footer = wrapper.find('.immich-screen__footer')
		expect(footer.text()).toContain('Could not load more photos.')
		await footer.find('button').trigger('click')
		expect(assets[2]!.cursor).toBe('c2')
	})

	// spec: IMMICH-002.19
	it('names the connection state a page failed with at the end of the grid', async () => {
		vi.spyOn(logger, 'error').mockReturnValue()
		const { wrapper, assets } = await mountScreen()
		assets[0]!.answer(page(1, 100, 'c2'))
		await flushPromises()
		wrapper.findComponent(PhotoGrid).vm.$emit('shown', 99)
		assets[1]!.fail(Object.assign(new Error('status 502'), { response: { status: 502, data: { error: 'unreachable' } } }))
		await flushPromises()

		expect(wrapper.find('.immich-screen__footer').text()).toContain('Immich unreachable. The photos above stay.')
		expect(wrapper.find('.immich-screen__footer').text()).not.toContain('Could not load more photos.')
	})

	// spec: IMMICH-002.37
	it('gives the grid each asset\'s pills', async () => {
		const { wrapper, assets, cull } = await mountScreen()
		assets[0]!.answer({ entries: [immichEntry('a1', { kind: 'live' })], nextCursor: null, previousCursor: null })
		await flushPromises()

		const badgesOf = wrapper.findComponent(PhotoGrid).props('badgesOf') as (picture: unknown) => unknown
		expect(badgesOf(cull.pictures.value[0])).toEqual({ label: 'Motion photo', pills: [{ icon: 'live', text: 'LIVE' }] })
	})

	// spec: IMMICH-002.9
	it('opens the loupe on a tile, counts against the server\'s total and loads past the page', async () => {
		const { wrapper, assets, counts } = await mountScreen()
		assets[0]!.answer(page(1, 100, 'c2'))
		counts[0]!(COUNTS)
		await flushPromises()

		wrapper.findComponent(PhotoGrid).vm.$emit('open', 89)
		await flushPromises()
		const loupe = wrapper.findComponent(PhotoLoupe)
		expect(loupe.props('counter')).toEqual({ position: 90, total: 3412 })
		expect(loupe.props('capabilities')).toMatchObject({ move: false, tags: false, series: false })

		loupe.vm.$emit('update:index', 90)
		await flushPromises()

		expect(assets).toHaveLength(2)
		expect(assets[1]!.cursor).toBe('c2')
		expect(wrapper.findComponent(PhotoLoupe).props('counter')).toEqual({ position: 91, total: 3412 })
	})

	// spec: IMMICH-002.9
	it('passes the loupe\'s decisions, toasts and settings on', async () => {
		const { wrapper, assets, cull } = await mountScreen()
		const decide = vi.spyOn(cull, 'decide')
		assets[0]!.answer(page(1, 3, null))
		await flushPromises()
		wrapper.findComponent(PhotoGrid).vm.$emit('open', 1)
		await flushPromises()
		const loupe = wrapper.findComponent(PhotoLoupe)

		loupe.vm.$emit('decide', { kind: 'flag', flag: 'picked' }, cull.pictures.value[1])
		loupe.vm.$emit('toast', { text: 'Done' })
		loupe.vm.$emit('updateSettings', { flagButtonsShown: true })
		wrapper.findComponent(PhotoGrid).vm.$emit('update:tileSize', 200)
		await flushPromises()

		expect(decide).toHaveBeenCalledWith({ kind: 'flag', flag: 'picked' }, [cull.pictures.value[1]])
		expect(wrapper.emitted('toast')).toEqual([[{ text: 'Done' }]])
		expect(wrapper.emitted('updateSettings')).toEqual([[{ flagButtonsShown: true }]])
		expect(wrapper.emitted('update:tileSize')).toEqual([[200]])
	})

	// spec: IMMICH-002.30, IMMICH-002.31
	it('wires the filter bar to the cull: a choice starts over, Clear filters brings back the defaults', async () => {
		const { wrapper, assets, counts, cull } = await mountScreen()
		assets[0]!.answer(page(1, 3, null))
		counts[0]!({ ...COUNTS, devices: [{ model: 'Pixel 9 Pro', count: 3660 }] })
		await flushPromises()
		const bar = wrapper.findComponent(ImmichFilterBar)
		expect(bar.props('changed')).toBe(false)
		expect(bar.props('choices').devices).toEqual([{ value: 'Pixel 9 Pro', count: 3660 }])

		bar.vm.$emit('update:filters', { ...cull.filters.value, kinds: new Set(['video']) })
		await flushPromises()
		expect(assets[1]!.cursor).toBeNull()
		expect(wrapper.findComponent(ImmichFilterBar).props('changed')).toBe(true)

		wrapper.findComponent(ImmichFilterBar).vm.$emit('clear')
		await flushPromises()
		expect(assets).toHaveLength(3)
		expect(cull.filters.value.kinds.size).toBe(0)
		expect(wrapper.findComponent(ImmichFilterBar).props('changed')).toBe(false)
	})
})
