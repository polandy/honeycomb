// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import { gridStub, mountApp, openCull } from './app-cull.ts'

describe('App: the image URL', () => {
	it('hands its image URL seam to the grid and the loupe through the cull context', async () => {
		const imageUrl = (fileId: number | string, size: number, mtime: number) => `/fake/${fileId}/${size}/${mtime}`
		const { wrapper } = mountApp({ imageUrl }, [], { PhotoGrid: gridStub().component })
		await openCull(wrapper)

		expect(wrapper.findComponent(PhotoGrid).props('imageUrl')).toBe(imageUrl)
		wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
		await flushPromises()
		expect(wrapper.findComponent(PhotoLoupe).props('imageUrl')).toBe(imageUrl)
	})
})
