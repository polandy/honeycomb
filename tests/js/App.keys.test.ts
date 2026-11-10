// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import FilterBar from '../../src/components/FilterBar.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import ShortcutSheet from '../../src/components/ShortcutSheet.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { VI_KEYS_KEY } from '../../src/hotkeys.ts'
import { DEFAULT_FILTERS } from '../../src/logic/picture-filter.ts'
import { fakeStorage, mountApp, openCull, shownNames } from './app-cull.ts'

/** Presses a key on the page and returns whether the app handled it. */
async function press(key: string, fields: KeyboardEventInit = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields })
	document.body.dispatchEvent(event)
	await flushPromises()
	return event.defaultPrevented
}

/** The app on an open cull of IMG_2, IMG_9 and IMG_10, in that order. */
async function openApp(props: Record<string, unknown> = {}, stubs: Record<string, unknown> = {}) {
	const mounted = mountApp(props, [], stubs)
	await openCull(mounted.wrapper)
	expect(shownNames(mounted.wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
	return mounted
}

const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).exists() ? wrapper.findComponent(UndoToast).text() : null
function flagOf(wrapper: AppWrapper, at: number) {
	const grid = wrapper.findComponent(PhotoGrid)
	return grid.props('decisionOf')!(grid.props('pictures')[at]!).flag
}

enableAutoUnmount(afterEach)

describe('App: keys on the grid', () => {
	afterEach(() => vi.restoreAllMocks())

	it('decides the focused photo by a key and says so', async () => {
		const { wrapper, grid, saved } = await openApp()
		grid.focused = 1

		expect(await press('p')).toBe(true)

		expect(saved).toEqual([[{ fileId: 4, rating: 0, colourLabel: null, flag: 'picked', keepRaw: false }]])
		expect(toastText(wrapper)).toBe('Picked IMG_9·Undo')
		expect(grid.steps).toEqual([])
	})

	it('moves the focus on after Shift and a decision, unless the photo left the view', async () => {
		const { wrapper, grid } = await openApp()
		await press('U', { shiftKey: true })
		expect(grid.steps).toEqual(['next'])

		grid.focused = 1
		await press('X', { shiftKey: true })

		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_10'])
		expect(grid.steps).toEqual(['next'])
		expect(grid.revealed).toEqual([1])
	})

	it('decides the selection in selection mode, stepping the rating they share', async () => {
		const { wrapper, saved } = await openApp()
		await press('a', { ctrlKey: true })
		await press('3')
		await press(']')

		expect(saved.map((rows) => rows.map(({ fileId, rating }) => [fileId, rating]))).toEqual([
			[[1, 3], [4, 3], [2, 3], [3, 3]],
			[[1, 4], [4, 4], [2, 4], [3, 4]],
		])
		expect(wrapper.findComponent(GridToolbar).props('selected')).toBe(3)
	})

	it('does nothing for a decision key with nothing selected', async () => {
		const { saved } = await openApp()
		await press('a', { ctrlKey: true })
		await press('d', { ctrlKey: true })
		expect(await press('p')).toBe(false)
		expect(saved).toEqual([])
	})

	it('undoes by Ctrl+Z and redoes by Ctrl+Shift+Z, saying so', async () => {
		const { wrapper } = await openApp()
		await press('p')
		await press('z', { ctrlKey: true })
		expect(flagOf(wrapper, 0)).toBe('unflagged')
		expect(toastText(wrapper)).toBe('Undid: Picked IMG_2')

		await press('Z', { ctrlKey: true, shiftKey: true })

		expect(flagOf(wrapper, 0)).toBe('picked')
		expect(toastText(wrapper)).toBe('Redid: Picked IMG_2')
		await press('Z', { metaKey: true, shiftKey: true })
		expect(toastText(wrapper)).toBe('Redid: Picked IMG_2')
	})

	it('moves the grid\'s focus by the arrows, Home and End, and by the vi keys when on', async () => {
		const { grid } = await openApp({ storage: fakeStorage({ [VI_KEYS_KEY]: 'true' }) })
		for (const key of ['ArrowDown', 'ArrowLeft', 'End', 'Home', 'k', 'l']) {
			await press(key)
		}
		await press('G', { shiftKey: true })
		expect(grid.steps).toEqual(['down', 'previous', 'last', 'first', 'up', 'next', 'last'])
	})

	it('opens the loupe by E on the focused photo', async () => {
		const { wrapper, grid } = await openApp()
		grid.focused = 2
		await press('e')
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(2)
	})

	it('hides the toolbar and the filter bar by Tab and toggles the filter bar by \\', async () => {
		const { wrapper } = await openApp()
		await press('\\')
		expect(wrapper.findComponent(FilterBar).exists()).toBe(true)

		await press('Tab')
		expect(wrapper.findComponent(GridToolbar).exists()).toBe(false)
		expect(wrapper.findComponent(FilterBar).exists()).toBe(false)
		await press('Tab')
		await press('\\')

		expect(wrapper.findComponent(GridToolbar).exists()).toBe(true)
		expect(wrapper.findComponent(FilterBar).exists()).toBe(false)
	})

	it('turns the filters off by Ctrl+L and on again', async () => {
		const { wrapper } = await openApp()
		await press('\\')
		wrapper.findComponent(FilterBar).vm.$emit('update:filters', { ...DEFAULT_FILTERS, rating: 3 })
		await flushPromises()
		const active = () => wrapper.findComponent(GridToolbar).props('activeFilters')

		await press('l', { ctrlKey: true })
		expect(active()).toBe(0)
		await press('l', { ctrlKey: true })
		expect(active()).toBe(1)
	})

	it('opens the filter bar and focuses its first control by / with the vi keys on', async () => {
		const focus = vi.spyOn(HTMLElement.prototype, 'focus')
		const { wrapper } = await openApp({ storage: fakeStorage({ [VI_KEYS_KEY]: 'true' }) }, { FilterBar: false })
		await press('Tab')

		await press('/')

		expect(wrapper.findComponent(GridToolbar).exists()).toBe(true)
		const bar = wrapper.findComponent(FilterBar)
		expect(bar.exists()).toBe(true)
		expect(focus.mock.contexts).toEqual([bar.find('button, input, select').element])
	})

	it('selects none by Ctrl+D and leaves selection mode by Escape only while selecting', async () => {
		const { wrapper } = await openApp()
		expect(await press('d', { ctrlKey: true })).toBe(false)
		expect(await press('Escape')).toBe(false)
		await press('a', { ctrlKey: true })

		expect(await press('Escape')).toBe(true)
		expect(wrapper.findComponent(PhotoGrid).props('selecting')).toBe(false)
	})

	it('goes browser fullscreen by F', async () => {
		const fullscreen: HTMLElement[] = []
		await openApp({ toggleFullscreen: (element: HTMLElement) => fullscreen.push(element) })
		await press('f')
		expect(fullscreen).toEqual([document.documentElement])
	})

	it('leaves the keys to the loupe while it is open, but for undo', async () => {
		const next = vi.fn()
		const LoupeStub = defineComponent({
			props: ['index', 'pictures'],
			setup(_props, { expose }) {
				expose({ hotkeys: { next } })
				return () => h('div')
			},
		})
		const { wrapper, grid } = await openApp({}, { PhotoLoupe: LoupeStub })
		await press('p')
		wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
		await flushPromises()

		await press('ArrowRight')
		await press('z', { ctrlKey: true })

		expect(next).toHaveBeenCalledOnce()
		expect(grid.steps).toEqual([])
		expect(toastText(wrapper)).toBe('Undid: Picked IMG_2')
	})

	it('acts on no key while the folder picker is open', async () => {
		const { wrapper, saved } = await openApp()
		wrapper.findComponent(GridToolbar).vm.$emit('changeFolders')
		await flushPromises()

		expect(await press('p')).toBe(false)
		expect(saved).toEqual([])
	})
})

describe('App: the shortcut sheet', () => {
	it('opens by ? and closes by Ctrl+/, keeping the other keys away while open', async () => {
		const { wrapper, saved } = await openApp({}, { ShortcutSheet: true })
		const sheet = () => wrapper.findComponent(ShortcutSheet)
		expect(await press('?', { shiftKey: true })).toBe(true)
		expect(sheet().props('container')).toBeUndefined()

		expect(await press('p')).toBe(false)
		expect(saved).toEqual([])
		await press('/', { ctrlKey: true })
		expect(sheet().exists()).toBe(false)
		await press('/', { metaKey: true })
		sheet().vm.$emit('close')
		await flushPromises()
		expect(sheet().exists()).toBe(false)
	})

	it('opens inside the loupe while the loupe is open', async () => {
		const { wrapper } = await openApp({}, { ShortcutSheet: true })
		wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
		await flushPromises()
		await press('?', { shiftKey: true })
		expect(wrapper.findComponent(ShortcutSheet).props('container')).toBe('.photo-loupe')
	})

	it('opens on the empty screen before a cull', async () => {
		const empty = mountApp({}, [], { ShortcutSheet: true })
		empty.wrapper.findComponent(FolderPicker).vm.$emit('cancel')
		await flushPromises()
		await press('?', { shiftKey: true })
		expect(empty.wrapper.findComponent(ShortcutSheet).exists()).toBe(true)
	})
})
