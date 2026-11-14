// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import SeriesCompare from '../../src/components/SeriesCompare.vue'
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

/** The app with the loupe open on the picture at `index`. */
async function openLoupe(index: number) {
	const mounted = mountApp({}, [], { NcDialog: DialogStub, SeriesCompare: false, PhotoLoupe: false })
	await openCull(mounted.wrapper, SET, SHOTS)
	mounted.wrapper.findComponent(PhotoGrid).vm.$emit('open', index)
	await flushPromises()
	return mounted
}

async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

const compare = (wrapper: AppWrapper) => wrapper.findComponent(SeriesCompare)
const shown = (wrapper: AppWrapper) => compare(wrapper).props('series')?.map((picture: { baseName: string }) => picture.baseName) ?? null
/** The name of the picture the loupe shows. */
function inLoupe(wrapper: AppWrapper) {
	const loupe = wrapper.findComponent(PhotoLoupe)
	return loupe.props('pictures')[loupe.props('index')]!.baseName
}

enableAutoUnmount(afterEach)

describe('App: the series compare opened from the loupe', () => {
	// spec: LOUPE-001.25, SERIES-001.24
	it('opens on the loupe\'s series by N inside the loupe and returns on the active picture by Esc', async () => {
		const { wrapper } = await openLoupe(1)
		await press('n')

		expect(shown(wrapper)).toEqual(['IMG_1', 'IMG_2', 'IMG_3'])
		expect(compare(wrapper).props()).toMatchObject({ oneSeries: true, active: 1, container: '.photo-loupe' })
		await press('ArrowRight')
		await press('Escape')
		expect(compare(wrapper).exists()).toBe(false)
		expect(inLoupe(wrapper)).toBe('IMG_3')
	})

	// spec: SERIES-001.24
	it('lands on the first picture after the series on Shift+K', async () => {
		const { wrapper } = await openLoupe(1)
		await press('n')
		await press('K', { shiftKey: true })

		expect(compare(wrapper).exists()).toBe(false)
		expect(inLoupe(wrapper)).toBe('IMG_4')
	})

	// spec: SERIES-001.24
	it('stays on the picked picture when no picture follows the series', async () => {
		const { wrapper } = await openLoupe(3)
		await press('n')
		await press('ArrowRight')
		await press('K', { shiftKey: true })

		expect(inLoupe(wrapper)).toBe('IMG_5')
	})

	// spec: SERIES-001.6
	it('opens on every series from the grid, in the page', async () => {
		const { wrapper } = await openLoupe(1)
		await press('Escape')
		await press('n')

		expect(compare(wrapper).props()).toMatchObject({ oneSeries: false, count: 2, container: 'body' })
	})
})
