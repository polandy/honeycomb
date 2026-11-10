// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import { mountApp, openCull, shownNames } from './app-cull.ts'

/** The app on a cull whose grid records what it is asked to reveal. */
async function openApp() {
	const revealed: number[] = []
	const GridStub = defineComponent({
		props: ['pictures', 'selecting'],
		setup(_props, { expose }) {
			expose({
				reveal: async (index: number) => {
					revealed.push(index)
				},
			})
			return () => h('div')
		},
	})
	const { wrapper } = mountApp({}, [], { PhotoGrid: GridStub })
	await openCull(wrapper)
	return { wrapper, revealed }
}

describe('App: the loupe', () => {
	it('opens on the grid\'s picture over the pictures the grid shows', async () => {
		const { wrapper } = await openApp()
		expect(wrapper.findComponent(PhotoLoupe).exists()).toBe(false)

		wrapper.findComponent(PhotoGrid).vm.$emit('open', 1)
		await flushPromises()

		const loupe = wrapper.findComponent(PhotoLoupe)
		expect(loupe.props('index')).toBe(1)
		expect(loupe.props('pictures').map((picture: { baseName: string }) => picture.baseName)).toEqual(shownNames(wrapper))
	})

	it('pages and, on close, reveals the last shown picture in the grid', async () => {
		const { wrapper, revealed } = await openApp()
		wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
		await flushPromises()
		wrapper.findComponent(PhotoLoupe).vm.$emit('update:index', 2)
		await flushPromises()
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(2)

		wrapper.findComponent(PhotoLoupe).vm.$emit('close')
		await flushPromises()

		expect(wrapper.findComponent(PhotoLoupe).exists()).toBe(false)
		expect(revealed).toEqual([2])
	})

	it('keeps the grid\'s selection keys away while it is open', async () => {
		const { wrapper } = await openApp()
		wrapper.findComponent(GridToolbar).vm.$emit('update:selecting', true)
		wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
		await flushPromises()

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).props('selecting')).toBe(true)
	})
})
