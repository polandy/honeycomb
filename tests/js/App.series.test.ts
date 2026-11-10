// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import SeriesCompare from '../../src/components/SeriesCompare.vue'
import ShortcutSheet from '../../src/components/ShortcutSheet.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { mountApp, openCull, SET } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { listingEntry } from './logic/listing-entries.ts'

const SHOTS = [
	listingEntry(1, '/Trip/IMG_1.JPG', { captureTime: 100 }),
	listingEntry(2, '/Trip/IMG_2.JPG', { captureTime: 101 }),
	listingEntry(3, '/Trip/IMG_3.JPG', { captureTime: 102 }),
	listingEntry(4, '/Trip/IMG_4.JPG', { captureTime: 200 }),
	listingEntry(5, '/Trip/IMG_5.JPG', { captureTime: 201 }),
]

async function openApp() {
	const mounted = mountApp({}, [], { NcDialog: DialogStub, SeriesCompare: false, ShortcutSheet: true })
	await openCull(mounted.wrapper, SET, SHOTS)
	return mounted
}

async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

const compare = (wrapper: AppWrapper) => wrapper.findComponent(SeriesCompare)
const pictures = (wrapper: AppWrapper) => compare(wrapper).props('series')!
const shown = (wrapper: AppWrapper) => compare(wrapper).props('series')?.map((picture: { baseName: string }) => picture.baseName) ?? null
const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).text()

enableAutoUnmount(afterEach)

describe('App: series compare', () => {
	// spec: SERIES-001.6
	it('counts the series on the toolbar and opens the compare from it', async () => {
		const { wrapper } = await openApp()
		const toolbar = wrapper.findComponent(GridToolbar)
		expect(toolbar.props('series')).toBe(2)

		toolbar.vm.$emit('compareSeries')
		await flushPromises()

		expect(shown(wrapper)).toEqual(['IMG_1', 'IMG_2', 'IMG_3'])
		expect(compare(wrapper).props('position')).toBe(0)
		expect(compare(wrapper).props('count')).toBe(2)
	})

	// spec: SERIES-001.9, SERIES-001.8
	it('picks the active photo by Shift+K, rejects the rest in one step, and brings the series back on undo', async () => {
		const { wrapper, saved } = await openApp()
		await press('n')
		await press('ArrowRight')
		expect(compare(wrapper).props('active')).toBe(1)

		await press('K', { shiftKey: true })

		expect(toastText(wrapper)).toContain('Picked IMG_2, rejected the rest')
		expect(saved.at(-1)!.map(({ fileId, flag }) => `${fileId} ${flag}`)).toEqual(['2 picked', '1 rejected', '3 rejected'])
		expect(shown(wrapper)).toEqual(['IMG_4', 'IMG_5'])
		await press('z', { ctrlKey: true })
		expect(shown(wrapper)).toEqual(['IMG_1', 'IMG_2', 'IMG_3'])
		expect(toastText(wrapper)).toContain('Undid: Picked IMG_2, rejected the rest')
	})

	// spec: SERIES-001.8, SERIES-001.10
	it('decides the active photo by its key and from its card, each with a toast', async () => {
		const { wrapper } = await openApp()
		await press('n')
		await press('x')

		expect(toastText(wrapper)).toContain('Rejected IMG_1')
		expect(shown(wrapper)).toEqual(['IMG_2', 'IMG_3'])
		compare(wrapper).vm.$emit('decide', { kind: 'flag', flag: 'picked' }, pictures(wrapper)[1])
		compare(wrapper).vm.$emit('pickRest', pictures(wrapper)[0])
		compare(wrapper).vm.$emit('activate', 1)
		await flushPromises()
		expect(shown(wrapper)).toEqual(['IMG_4', 'IMG_5'])
		expect(compare(wrapper).props('active')).toBe(1)
	})

	// spec: SERIES-001.11, SERIES-001.12
	it('skips, closes by Escape, and keeps the grid keys away while open', async () => {
		const { wrapper } = await openApp()
		await press('n')
		compare(wrapper).vm.$emit('skip')
		await flushPromises()
		expect(shown(wrapper)).toEqual(['IMG_4', 'IMG_5'])

		await press('?')
		expect(wrapper.findComponent(ShortcutSheet).exists()).toBe(true)
		await press('?')
		await press('Escape')
		expect(compare(wrapper).exists()).toBe(false)

		await press('n')
		compare(wrapper).vm.$emit('close')
		await flushPromises()
		expect(compare(wrapper).exists()).toBe(false)
	})
})
