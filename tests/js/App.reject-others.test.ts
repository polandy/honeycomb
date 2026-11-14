// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import SeriesCompare from '../../src/components/SeriesCompare.vue'
import SeriesViewer from '../../src/components/SeriesViewer.vue'
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

/** The app with its cull open, and the loupe open on the picture at `index` unless it is null. */
async function openApp(index: number | null) {
	const mounted = mountApp({}, [], { NcDialog: DialogStub, SeriesCompare: false, PhotoLoupe: false })
	await openCull(mounted.wrapper, SET, SHOTS)
	if (index !== null) {
		mounted.wrapper.findComponent(PhotoGrid).vm.$emit('open', index)
		await flushPromises()
	}
	return mounted
}

async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

const toast = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast)
const offer = (wrapper: AppWrapper) => toast(wrapper).find('.undo-toast__offer')
/** Taps the toast's offer. */
async function takeOffer(wrapper: AppWrapper) {
	await offer(wrapper).trigger('click')
	await flushPromises()
}
const flags = (saved: { fileId: number, flag: string }[][]) => saved.at(-1)!.map(({ fileId, flag }) => `${fileId} ${flag}`).sort()
/** Opens the series viewer on the compare's picture at `at`. */
async function view(wrapper: AppWrapper, at: number) {
	wrapper.findComponent(SeriesCompare).vm.$emit('view', at)
	await flushPromises()
}
/** The name of the picture the loupe shows. */
function inLoupe(wrapper: AppWrapper) {
	const loupe = wrapper.findComponent(PhotoLoupe)
	return loupe.props('pictures')[loupe.props('index')]!.baseName
}

enableAutoUnmount(afterEach)

describe('App: Reject the other N in the undo toast', () => {
	// spec: LOUPE-002.16
	it('offers it after a plain Pick in the loupe, rejects the others as one undo step and lands after the series', async () => {
		const { wrapper, saved } = await openApp(1)
		await press('p')

		expect(toast(wrapper).text()).toBe('Picked IMG_2·Reject the other 2Undo')
		await takeOffer(wrapper)
		expect(flags(saved)).toEqual(['1 rejected', '3 rejected'])
		expect(toast(wrapper).text()).toContain('Picked IMG_2, rejected the rest')
		expect(inLoupe(wrapper)).toBe('IMG_4')
		await press('z', { ctrlKey: true })
		expect(flags(saved)).toEqual(['1 unflagged', '3 unflagged'])
		expect(inLoupe(wrapper)).toBe('IMG_4')
	})

	// spec: LOUPE-002.16
	it('lands after the series while the loupe shows a member after Shift+P, and stays once it moved past the series', async () => {
		const first = await openApp(1)
		await press('P', { shiftKey: true })
		expect(inLoupe(first.wrapper)).toBe('IMG_3')
		await takeOffer(first.wrapper)
		expect(inLoupe(first.wrapper)).toBe('IMG_4')
		first.wrapper.unmount()

		const second = await openApp(2)
		await press('P', { shiftKey: true })
		expect(inLoupe(second.wrapper)).toBe('IMG_4')
		await takeOffer(second.wrapper)
		expect(flags(second.saved)).toEqual(['1 rejected', '2 rejected'])
		expect(inLoupe(second.wrapper)).toBe('IMG_4')
	})

	// spec: LOUPE-002.16
	it('offers nothing after a rating or a reject, or once no other photo of the series is unflagged', async () => {
		const { wrapper } = await openApp(3)
		await press('3')
		expect(offer(wrapper).exists()).toBe(false)
		await press('p')
		expect(offer(wrapper).text()).toBe('Reject the other 1')
		await press('ArrowRight')
		await press('p')
		expect(toast(wrapper).text()).toBe('Picked IMG_5·Undo')
		await press('x')
		expect(offer(wrapper).exists()).toBe(false)
	})

	// spec: SERIES-002.11
	it('offers it after a Pick in the series viewer opened from the loupe, closes the compare and lands after the series', async () => {
		const { wrapper, saved } = await openApp(0)
		await press('n')
		await view(wrapper, 0)
		await press('p')

		expect(offer(wrapper).text()).toBe('Reject the other 2')
		await takeOffer(wrapper)
		expect(flags(saved)).toEqual(['2 rejected', '3 rejected'])
		expect(wrapper.findComponent(SeriesViewer).exists()).toBe(false)
		expect(wrapper.findComponent(SeriesCompare).exists()).toBe(false)
		expect(inLoupe(wrapper)).toBe('IMG_4')
	})

	// spec: SERIES-002.11
	it('leaves the compare opened from the grid on the next series, and offers nothing after a Pick on a card', async () => {
		const { wrapper } = await openApp(null)
		await press('n')
		await press('p')
		expect(offer(wrapper).exists()).toBe(false)
		await view(wrapper, 1)
		await press('p')
		await takeOffer(wrapper)

		expect(wrapper.findComponent(SeriesViewer).exists()).toBe(false)
		expect(wrapper.findComponent(SeriesCompare).props('series')!.map((picture: { baseName: string }) => picture.baseName)).toEqual(['IMG_4', 'IMG_5'])
	})
})
