// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { ENTRIES, mountApp, openCull, shownNames, stored } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

const REJECTED = [stored(1, 'rejected'), stored(2, 'rejected'), stored(3, 'rejected')]
const NEW = listingEntry(9, '/Trip/A/IMG_11.JPG')

enableAutoUnmount(afterEach)

/** The app whose trash request fails and whose folder later lists `NEW` as well; `failListing` makes the next listings fail. */
async function openApp() {
	const listed: string[] = []
	const state = { entries: ENTRIES, failListing: false }
	const { wrapper } = mountApp({
		trashPictures: async () => {
			throw new Error('stale')
		},
		listEntries: async (path: string) => {
			listed.push(path)
			if (state.failListing) {
				throw new Error('offline')
			}
			return { entries: state.entries, truncated: false, folders: [] }
		},
	}, REJECTED)
	await openCull(wrapper)
	listed.length = 0
	return { wrapper, listed, state }
}

/** Fails a delete of the rejects, so the error toast shows. */
async function failDelete(wrapper: Awaited<ReturnType<typeof openApp>>['wrapper']) {
	wrapper.findComponent(GridToolbar).vm.$emit('reviewRejects')
	await flushPromises()
	wrapper.findComponent({ name: 'RejectReview' }).vm.$emit('confirm')
	await flushPromises()
	wrapper.findComponent({ name: 'DeleteSummary' }).vm.$emit('confirm')
	await flushPromises()
}

describe('App: Reload folder', () => {
	// spec: DECISIONS-002.18
	it('lists the folder set again from the failed delete\'s message and shows what changed', async () => {
		const { wrapper, listed, state } = await openApp()
		await failDelete(wrapper)
		const toast = wrapper.findComponent(UndoToast)
		expect(toast.text()).toContain('Could not delete the photos')
		state.entries = [...ENTRIES, NEW]

		await toast.findAll('button').find((button) => button.text() === 'Reload folder')!.trigger('click')
		await flushPromises()

		expect(listed).toContain('/Trip')
		expect(shownNames(wrapper)).toContain('IMG_11')
	})

	// spec: DECISIONS-002.18
	it('keeps the loupe at the same picture', async () => {
		const { wrapper } = await openApp()
		await failDelete(wrapper)
		wrapper.findComponent(PhotoGrid).vm.$emit('open', shownNames(wrapper).indexOf('IMG_9'))
		await flushPromises()
		const shown = wrapper.findComponent(PhotoLoupe).props('pictures')[wrapper.findComponent(PhotoLoupe).props('index')].baseName

		await wrapper.findComponent(UndoToast).findAll('button').find((button) => button.text() === 'Reload folder')?.trigger('click')
		await flushPromises()

		expect(shown).toBe('IMG_9')
		const loupe = wrapper.findComponent(PhotoLoupe)
		expect(loupe.props('pictures')[loupe.props('index')].baseName).toBe('IMG_9')
	})

	// spec: DECISIONS-002.18
	it('keeps the open cull when the listing fails', async () => {
		const { wrapper, state } = await openApp()
		await failDelete(wrapper)
		state.failListing = true

		await wrapper.findComponent(UndoToast).findAll('button').find((button) => button.text() === 'Reload folder')!.trigger('click')
		await flushPromises()

		expect(shownNames(wrapper)).toEqual(['IMG_9'])
		expect(wrapper.findComponent(UndoToast).text()).toContain('Could not open')
	})
})
