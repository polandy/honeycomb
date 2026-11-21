// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import SeriesReduction from '../../src/components/SeriesReduction.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { decidedFlags, mountApp, openCull, SET, toolbarProps } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { listingEntry } from './logic/listing-entries.ts'

const sharp = (sharpness: number) => ({ quality: { method: 1, sharpness, focusTile: 0 } })
// IMG_2 is the sharpest of the first series; the second has no clear sharpest
const SHOTS = [
	listingEntry(1, '/Trip/IMG_1.JPG', { captureTime: 100, ...sharp(100) }),
	listingEntry(2, '/Trip/IMG_2.JPG', { captureTime: 101, ...sharp(200) }),
	listingEntry(3, '/Trip/IMG_3.JPG', { captureTime: 102, ...sharp(100) }),
	listingEntry(4, '/Trip/IMG_4.JPG', { captureTime: 200, ...sharp(100) }),
	listingEntry(5, '/Trip/IMG_5.JPG', { captureTime: 201, ...sharp(102) }),
]

async function openApp() {
	const mounted = mountApp({}, [], { NcDialog: DialogStub })
	await openCull(mounted.wrapper, SET, SHOTS)
	return mounted
}

async function openReduction(wrapper: AppWrapper) {
	wrapper.findComponent(GridToolbar).vm.$emit('reduceSeries')
	await flushPromises()
	return wrapper.findComponent(SeriesReduction)
}

const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).text()

enableAutoUnmount(afterEach)

describe('App: series reduction', () => {
	// spec: SERIES-008.2
	it('counts the series the reduction would reduce on the toolbar and opens its dialog', async () => {
		const { wrapper } = await openApp()
		expect(toolbarProps(wrapper).reducible).toBe(1)

		const dialog = await openReduction(wrapper)

		expect(dialog.exists()).toBe(true)
		expect(dialog.props('plan').reduced.map(({ kept }: { kept: { baseName: string } }) => kept.baseName)).toEqual(['IMG_2'])
		expect(dialog.props('plan').leftOut).toBe(1)
	})

	// spec: SERIES-008.5
	it('picks the sharpest and rejects the rest in one step, and undoes it whole', async () => {
		const { wrapper } = await openApp()
		const dialog = await openReduction(wrapper)

		dialog.vm.$emit('confirm', dialog.props('plan'))
		await flushPromises()

		expect(wrapper.findComponent(SeriesReduction).exists()).toBe(false)
		expect(decidedFlags(wrapper, SHOTS)).toEqual(['1 rejected', '2 picked', '3 rejected'])
		expect(toastText(wrapper)).toContain('Picked the sharpest of 1 series, rejected 2')
		expect(toolbarProps(wrapper).reducible).toBe(0)
		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))
		await flushPromises()
		expect(decidedFlags(wrapper, SHOTS)).toEqual([])
		expect(toolbarProps(wrapper).reducible).toBe(1)
	})

	// spec: SERIES-008.6
	it('closes on cancel without a change', async () => {
		const { wrapper } = await openApp()
		const dialog = await openReduction(wrapper)

		dialog.vm.$emit('cancel')
		await flushPromises()

		expect(wrapper.findComponent(SeriesReduction).exists()).toBe(false)
		expect(decidedFlags(wrapper, SHOTS)).toEqual([])
	})
})
