// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import PickRestButton from '../../src/components/PickRestButton.vue'
import SeriesCompare from '../../src/components/SeriesCompare.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { decidedFlags, mountApp, openCull, SET } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { listingEntry } from './logic/listing-entries.ts'

const SHOTS = [
	listingEntry(1, '/Trip/IMG_1.JPG', { captureTime: 100 }),
	listingEntry(2, '/Trip/IMG_2.JPG', { captureTime: 101 }),
	listingEntry(3, '/Trip/IMG_3.JPG', { captureTime: 102 }),
	listingEntry(4, '/Trip/IMG_4.JPG', { captureTime: 200 }),
	listingEntry(5, '/Trip/IMG_5.JPG', { captureTime: 201 }),
]

const WITH_LONE = [...SHOTS, listingEntry(6, '/Trip/IMG_6.JPG', { captureTime: 900 })]

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
const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).text()
const shown = (wrapper: AppWrapper) => compare(wrapper).props('series')?.members.map((picture: { baseName: string }) => picture.baseName) ?? null
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
	it('lands on the first picture after the series on Shift+P', async () => {
		const { wrapper } = await openLoupe(1)
		await press('n')
		await press('P', { shiftKey: true })

		expect(compare(wrapper).exists()).toBe(false)
		expect(inLoupe(wrapper)).toBe('IMG_4')
	})

	// spec: SERIES-001.24
	it('stays on the picked picture when no picture follows the series', async () => {
		const { wrapper } = await openLoupe(3)
		await press('n')
		await press('ArrowRight')
		await press('P', { shiftKey: true })

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

describe('App: Pick this, reject the rest in the loupe', () => {
	// spec: LOUPE-002.15
	it('picks the shown photo by Shift+P, rejects the rest in one step and lands on the first photo after the series', async () => {
		const { wrapper } = await openLoupe(1)
		await press('P', { shiftKey: true })

		expect(decidedFlags(wrapper, SHOTS)).toEqual(['1 rejected', '2 picked', '3 rejected'])
		expect(toastText(wrapper)).toContain('Picked 1, rejected 2')
		expect(inLoupe(wrapper)).toBe('IMG_4')
		await press('z', { ctrlKey: true })
		expect(decidedFlags(wrapper, SHOTS)).toEqual([])
	})

	// spec: LOUPE-002.15
	it('does the same by the rating row\'s button and stays on the picked photo when no photo follows the series', async () => {
		const { wrapper } = await openLoupe(4)
		await wrapper.findComponent(PickRestButton).trigger('click')
		await flushPromises()

		expect(decidedFlags(wrapper, SHOTS)).toEqual(['4 rejected', '5 picked'])
		expect(inLoupe(wrapper)).toBe('IMG_5')
	})
})

describe('App: Pick this, reject the rest in the grid', () => {
	/** The app's grid on the shots and a lone photo, focused on the picture at `index`. */
	async function openGrid(index: number) {
		const mounted = mountApp({}, [], { NcDialog: DialogStub, SeriesCompare: false })
		await openCull(mounted.wrapper, SET, WITH_LONE)
		mounted.grid.focused = index
		return mounted
	}

	// spec: KEYS-001.13
	it('picks the focused photo by Shift+P, rejects the rest of its series in one step that one undo takes back', async () => {
		const { wrapper } = await openGrid(1)
		await press('P', { shiftKey: true })

		expect(decidedFlags(wrapper, WITH_LONE)).toEqual(['1 rejected', '2 picked', '3 rejected'])
		expect(toastText(wrapper)).toBe('Picked 1, rejected 2·Undo')
		await press('z', { ctrlKey: true })
		expect(decidedFlags(wrapper, WITH_LONE)).toEqual([])
	})

	// spec: KEYS-001.13
	it('rejects another picked photo of the series too and says so', async () => {
		const { wrapper, grid } = await openGrid(0)
		await press('p')
		grid.focused = 2
		await press('P', { shiftKey: true })

		expect(decidedFlags(wrapper, WITH_LONE)).toEqual(['1 rejected', '2 rejected', '3 picked'])
		expect(toastText(wrapper)).toBe('Picked 1, rejected 2·Undo')
		await press('z', { ctrlKey: true })
		expect(decidedFlags(wrapper, WITH_LONE)).toEqual(['1 picked'])
	})

	// spec: KEYS-001.13
	it('decides nothing and only gives a short hint by Shift+P on a photo outside a series', async () => {
		const { wrapper } = await openGrid(5)
		await press('P', { shiftKey: true })

		expect(decidedFlags(wrapper, WITH_LONE)).toEqual([])
		expect(toastText(wrapper)).toBe('Not in a series · Shift+P picks a photo and rejects the rest of its series')
	})
})
