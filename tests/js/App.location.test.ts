// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import { locationHash } from '../../src/logic/cull-location.ts'
import { ENTRIES, mountApp, openCull, SET, shownNames } from './app-cull.ts'

/** The app over a server that lists /Trip, with an address that is `hash` and records each address written. */
async function openApp(hash: string, listEntries = async () => ({ entries: ENTRIES, truncated: false, folders: [] })) {
	const written: string[] = []
	const mounted = mountApp({ location: { read: () => hash, write: (next: string) => written.push(next) }, listEntries })
	await flushPromises()
	return { ...mounted, written }
}

describe('App: the address', () => {
	// spec: DECISIONS-002.17
	it('opens the folder set of the address at its picture', async () => {
		const { wrapper } = await openApp(locationHash(SET, 4))

		expect(shownNames(wrapper)).toContain('IMG_9')
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(shownNames(wrapper).indexOf('IMG_9'))
	})

	// spec: DECISIONS-002.17
	it('opens the folder set of the address without a picture in the grid', async () => {
		const { wrapper } = await openApp(locationHash(SET, null))

		expect(shownNames(wrapper).length).toBeGreaterThan(0)
		expect(wrapper.findComponent(PhotoLoupe).exists()).toBe(false)
	})

	// spec: DECISIONS-002.17
	it('writes the folder set when a cull opens and the picture while the loupe is open', async () => {
		const { wrapper, written } = await openApp('')
		await openCull(wrapper)
		expect(written.at(-1)).toBe(locationHash(SET, null))

		wrapper.findComponent(PhotoGrid).vm.$emit('open', shownNames(wrapper).indexOf('IMG_9'))
		await flushPromises()
		expect(written.at(-1)).toBe(locationHash(SET, 4))

		wrapper.findComponent(PhotoLoupe).vm.$emit('close')
		await flushPromises()
		expect(written.at(-1)).toBe(locationHash(SET, null))
	})

	// spec: DECISIONS-002.17
	it('opens as usual and clears the address when the folder set of the address cannot be listed', async () => {
		const { wrapper, written } = await openApp(locationHash(SET, 4), async () => {
			throw new Error('gone')
		})

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(written.at(-1)).toBe('')
	})

	// spec: DECISIONS-002.17
	it('opens as usual for an address that names no folder set', async () => {
		const { wrapper, written } = await openApp('#nonsense')

		expect(wrapper.findComponent(PhotoGrid).exists()).toBe(false)
		expect(written).toEqual([''])
	})
})
