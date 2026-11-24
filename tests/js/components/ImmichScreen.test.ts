// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichCullApi } from '../../../src/immich-cull.ts'
import type { ImmichCounts } from '../../../src/logic/immich-counts.ts'
import type { Page } from '../../../src/logic/immich-paging.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImmichScreen from '../../../src/components/ImmichScreen.vue'
import PhotoGrid from '../../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../../src/components/PhotoLoupe.vue'
import { useImmichCull } from '../../../src/immich-cull.ts'
import { logger } from '../../../src/logger.ts'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { fakeStorage, fakeViewState } from '../app-cull.ts'
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
	const cull = useImmichCull({ api, now: () => NOW, calendar: UTC_CALENDAR, dayLabel: () => 'Friday, 20 November', toast: { show: vi.fn(), showError: vi.fn() } })
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

		expect(wrapper.find('.immich-screen__count').text()).toBe('3,412 of 3,660 pictures · 248 decided')
	})

	// spec: IMMICH-002.18
	it('says no picture matches when the counts say 0', async () => {
		const { wrapper, assets, counts } = await mountScreen()
		assets[0]!.answer(page(1, 0, null))
		counts[0]!({ ...COUNTS, matching: 0 })
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(wrapper.text()).toContain('No pictures match. Change the time, device or flag filter.')
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
		expect(footer.text()).toContain('Could not load more pictures.')
		await footer.find('button').trigger('click')
		expect(assets[2]!.cursor).toBe('c2')
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
})
