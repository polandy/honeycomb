// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { VueWrapper } from '@vue/test-utils'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ActionBar from '../../../src/components/ActionBar.vue'
import ImmichScreen from '../../../src/components/ImmichScreen.vue'
import PhotoGrid from '../../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../../src/components/PhotoLoupe.vue'
import { imageMember } from '../../../src/logic/image-tiers.ts'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { fakeStorage, fakeViewState } from '../app-cull.ts'
import { COUNTS, cullOn, page } from '../immich-cull-fixtures.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const IDS = Array.from({ length: 100 }, (_, at) => `a${at + 1}`)

/** The Immich screen over a fake server with the first page of 100 loaded. */
async function mountScreen() {
	const on = cullOn()
	on.cull.open('andy-phone')
	const toggleFullscreen = vi.fn()
	const wrapper = mount(ImmichScreen, {
		props: { cull: on.cull, settings: DEFAULT_SETTINGS, storage: fakeStorage({}), viewState: fakeViewState({ gesture_guide_seen: true, series_hint_seen: true }, []), toggleFullscreen },
		global: { stubs: { teleport: true } },
	})
	on.assets[0]!.answer(page(IDS, 'c2'))
	on.counts[0]!.answer(COUNTS)
	await flushPromises()
	const keys = () => (wrapper.vm as unknown as { hotkeys: () => Record<string, ((...args: unknown[]) => unknown) | undefined> }).hotkeys()
	return { ...on, wrapper, keys, toggleFullscreen }
}

/** The button with the text, if shown. */
const button = (wrapper: VueWrapper, text: string) => wrapper.findAll('button').find((each) => each.text() === text)

describe('ImmichScreen grid keys and selection', () => {
	// spec: IMMICH-003.25
	it('decides the focused asset by key with an Undo toast and opens the loupe on the one that took its place', async () => {
		const { wrapper, keys, saves, toast } = await mountScreen()

		keys().decide!({ kind: 'flag', flag: 'rejected' }, false)
		await flushPromises()

		expect(saves.map(({ rows }) => rows.map(({ assetId, flag }) => `${assetId}:${flag}`))).toEqual([['a1:rejected']])
		expect(toast.show).toHaveBeenCalledWith('Rejected a1.jpg', expect.objectContaining({ label: 'Undo' }))
		expect(keys().loupe!()).toBe(true)
		await flushPromises()
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(0)
		expect(wrapper.findComponent(PhotoLoupe).props('pictures')[0]).toBe(wrapper.findComponent(PhotoGrid).props('pictures')[0])
		expect(keys().grid).toBeTypeOf('function')
		expect(keys()['select-all']).toBeUndefined()
	})

	// spec: IMMICH-003.25
	it('leaves out the keys of a toolbar and filter bar the screen does not have, and of what Immich does not offer', async () => {
		const { keys, toggleFullscreen, wrapper } = await mountScreen()

		for (const absent of ['header', 'filter-bar', 'filter-focus', 'filters-off', 'tag', 'pick-rest', 'compare', 'previous-series', 'next-series', 'delete', 'move']) {
			expect(keys()[absent], absent).toBeUndefined()
		}
		expect(keys().close!()).toBe(false)
		keys().fullscreen!()
		expect(toggleFullscreen).toHaveBeenCalledWith(document.documentElement)
		keys()['file-names']!()
		expect(wrapper.emitted('updateSettings')).toEqual([[{ showFileNames: !DEFAULT_SETTINGS.showFileNames }]])
	})

	// spec: IMMICH-003.26
	it('decides a selection in one save and one undo step, by key and from the action bar without Keep RAW and tags', async () => {
		const { wrapper, keys, saves, cull } = await mountScreen()
		await button(wrapper, 'Select')!.trigger('click')
		const bar = wrapper.findComponent(ActionBar)
		expect(bar.props()).toMatchObject({ disabled: true, keepRaw: false, tags: false })
		const three = cull.pictures.value.slice(1, 4)
		wrapper.findComponent(PhotoGrid).vm.$emit('update:selection', { ids: new Set(three.map((picture) => imageMember(picture).fileId)), anchor: null })
		await flushPromises()
		expect(wrapper.text()).toContain('3 selected')

		keys().decide!({ kind: 'rating', rating: 2 }, false)
		await flushPromises()
		saves[0]!.answer()
		await flushPromises()
		expect(wrapper.findComponent(ActionBar).props()).toMatchObject({ disabled: false, common: expect.objectContaining({ rating: 2 }) })
		wrapper.findComponent(ActionBar).vm.$emit('decide', { kind: 'rating', rating: 4 })
		await flushPromises()
		saves[1]!.answer()
		cull.undo()
		await flushPromises()

		const ratings = saves.map(({ rows }) => rows.map(({ assetId, rating }) => `${assetId}:${rating}`))
		expect(ratings).toEqual([['a2:2', 'a3:2', 'a4:2'], ['a2:4', 'a3:4', 'a4:4'], ['a2:2', 'a3:2', 'a4:2']])
	})

	// spec: IMMICH-003.26
	it('does nothing on a decision key while nothing is selected', async () => {
		const { wrapper, keys, saves } = await mountScreen()
		await button(wrapper, 'Select')!.trigger('click')

		expect(keys().decide!({ kind: 'flag', flag: 'picked' }, false)).toBe(false)
		await flushPromises()
		expect(saves).toEqual([])
	})

	// spec: IMMICH-003.27
	it('selects the loaded assets, not the whole connection, by key and by button, and then none', async () => {
		const { wrapper, keys } = await mountScreen()

		keys()['select-all']!()
		await flushPromises()
		expect(wrapper.findComponent(PhotoGrid).props('selecting')).toBe(true)
		expect(wrapper.findComponent(PhotoGrid).props('selection')!.ids.size).toBe(100)
		expect(wrapper.text()).toContain('100 selected')
		expect(keys()['select-none']!()).toBe(true)
		await flushPromises()
		expect(wrapper.text()).toContain('0 selected')

		await button(wrapper, 'Select all (loaded)')!.trigger('click')
		expect(wrapper.text()).toContain('100 selected')
		await button(wrapper, 'None')!.trigger('click')
		expect(wrapper.findComponent(PhotoGrid).props('selection')!.ids.size).toBe(0)
	})

	// spec: IMMICH-003.28
	it('ends selection mode on a filter change, on Esc and on Done', async () => {
		const { wrapper, keys, cull } = await mountScreen()
		const ended = () => wrapper.findComponent(ActionBar).exists() === false && !wrapper.text().includes('selected')

		keys()['select-all']!()
		await flushPromises()
		expect(keys().close!()).toBe(true)
		await flushPromises()
		expect(ended()).toBe(true)

		keys()['select-all']!()
		await flushPromises()
		await button(wrapper, 'Done')!.trigger('click')
		expect(ended()).toBe(true)

		keys()['select-all']!()
		await flushPromises()
		cull.setFilters({ ...cull.filters.value, flags: new Set(['picked']) })
		await flushPromises()
		expect(ended()).toBe(true)
		expect(button(wrapper, 'Select')!.attributes('aria-pressed')).toBe('false')
	})
})
