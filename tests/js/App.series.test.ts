// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import SeriesCompare from '../../src/components/SeriesCompare.vue'
import SeriesViewer from '../../src/components/SeriesViewer.vue'
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

async function openApp(props: Record<string, unknown> = {}) {
	const mounted = mountApp(props, [], { NcDialog: DialogStub, SeriesCompare: false, ShortcutSheet: true })
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
const viewer = (wrapper: AppWrapper) => wrapper.findComponent(SeriesViewer)
/** The viewer's pictures by name and the shown one's name. */
function viewed(wrapper: AppWrapper) {
	const { pictures: shownPictures, index } = viewer(wrapper).props()
	return [shownPictures.map((picture) => picture.baseName), shownPictures[index]!.baseName]
}
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
		await press('ArrowRight')
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

	// spec: SERIES-001.23
	it('makes the tapped card active', async () => {
		const { wrapper } = await openApp()
		await press('n')
		compare(wrapper).vm.$emit('activate', 2)
		await flushPromises()

		expect(compare(wrapper).props('active')).toBe(2)
	})

	// spec: SERIES-002.1, SERIES-002.6, SERIES-002.9
	it('opens the viewer from a card, rejects with a toast, shows the photo again on undo and returns to the compare', async () => {
		const { wrapper } = await openApp()
		await press('n')
		compare(wrapper).vm.$emit('view', 1)
		await flushPromises()
		expect(compare(wrapper).exists()).toBe(false)
		expect(viewed(wrapper)).toEqual([['IMG_1', 'IMG_2', 'IMG_3'], 'IMG_2'])
		expect(viewer(wrapper).props('position')).toBe(0)
		expect(viewer(wrapper).props('count')).toBe(2)

		await press('ArrowRight')
		await press('x')
		expect(toastText(wrapper)).toContain('Rejected IMG_3')
		expect(viewed(wrapper)).toEqual([['IMG_1', 'IMG_2'], 'IMG_2'])
		await press('z', { ctrlKey: true })
		expect(viewed(wrapper)).toEqual([['IMG_1', 'IMG_2', 'IMG_3'], 'IMG_3'])

		await press('Escape')
		expect(viewer(wrapper).exists()).toBe(false)
		expect(compare(wrapper).props('active')).toBe(2)
	})

	// spec: SERIES-002.7, SERIES-002.8
	it('closes the viewer by pick-rest and once one photo is left, the compare showing the next series', async () => {
		const { wrapper } = await openApp()
		await press('n')
		compare(wrapper).vm.$emit('view', 0)
		await flushPromises()
		await press('K', { shiftKey: true })
		expect(toastText(wrapper)).toContain('Picked IMG_1, rejected the rest')
		expect(viewer(wrapper).exists()).toBe(false)
		expect(shown(wrapper)).toEqual(['IMG_4', 'IMG_5'])

		compare(wrapper).vm.$emit('view', 1)
		await flushPromises()
		await press('x')
		expect(viewer(wrapper).exists()).toBe(false)
		expect(compare(wrapper).text()).toContain('All series compared')
		await press('z', { ctrlKey: true })
		expect(viewer(wrapper).exists()).toBe(false)
	})

	// spec: SERIES-002.10
	it('hands the grid the size of each picture\'s series for its badge', async () => {
		const { wrapper } = await openApp()
		const sizes = wrapper.findComponent(PhotoGrid).props('seriesSizes') as ReadonlyMap<{ baseName: string }, number>

		expect([...sizes].map(([picture, size]) => `${picture.baseName} ${size}`)).toEqual(['IMG_1 3', 'IMG_2 3', 'IMG_3 3', 'IMG_4 2', 'IMG_5 2'])
	})

	// spec: LOUPE-001.19
	it('hands the loupe each picture\'s series, a series of picks included', async () => {
		const { wrapper } = await openApp()
		wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
		await flushPromises()
		const loupe = wrapper.findComponent(PhotoLoupe)
		for (const picture of loupe.props('pictures').slice(0, 3)) {
			loupe.vm.$emit('decide', { kind: 'flag', flag: 'picked' }, picture)
		}
		await flushPromises()
		const members = loupe.props('seriesOf') as ReadonlyMap<{ baseName: string }, readonly { baseName: string }[]>

		expect([...members].map(([picture, series]) => `${picture.baseName} ${series.length}`)).toEqual(['IMG_1 3', 'IMG_2 3', 'IMG_3 3', 'IMG_4 2', 'IMG_5 2'])
	})

	// spec: SERIES-001.15, SERIES-001.18
	it('splits off a photo that looks different once hashed, but not while the compare is open', async () => {
		const settle: (() => void)[] = []
		const hashImage = (member: { fileId: number }) => new Promise<string>((resolve) => settle.push(() => resolve(member.fileId === 3 ? 'ffffffffffffffff' : '0000000000000000')))
		const { wrapper } = await openApp({ hashImage })
		await press('n')
		for (let next = settle.shift(); next !== undefined; next = settle.shift()) {
			next()
			await flushPromises()
		}
		expect(shown(wrapper)).toEqual(['IMG_1', 'IMG_2', 'IMG_3'])

		await press('Escape')
		const sizes = wrapper.findComponent(PhotoGrid).props('seriesSizes') as ReadonlyMap<{ baseName: string }, number>
		expect([...sizes].map(([picture, size]) => `${picture.baseName} ${size}`)).toEqual(['IMG_1 2', 'IMG_2 2', 'IMG_4 2', 'IMG_5 2'])
	})
})
