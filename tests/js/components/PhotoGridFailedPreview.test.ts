// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountGrid } from './mount-grid.ts'

/** A loader whose loads the test settles by URL, in order of start. */
function fakeLoader() {
	const started: string[] = []
	const settle: { url: string, resolve: () => void, reject: () => void }[] = []
	const loadImage = (url: string) => new Promise<void>((resolve, reject) => {
		started.push(url)
		settle.push({ url, resolve, reject })
	})
	const finish = async (outcome: 'resolve' | 'reject') => {
		settle.shift()![outcome]()
		await flushPromises()
	}
	const finishAll = async () => {
		while (settle.length > 0) {
			await finish('resolve')
		}
	}
	return { started, loadImage, finish, finishAll }
}

async function mountFailed() {
	const loader = fakeLoader()
	const { wrapper, resize } = mountGrid({ loadImage: loader.loadImage, imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}` })
	await resize(432, 100)
	await loader.finish('reject')
	await loader.finishAll()
	return { wrapper, loader, tile: wrapper.find('[data-index="0"]') }
}

describe('PhotoGrid failed previews', () => {
	// spec: GRID-001.23
	it('loads a failed tile again on a click and opens the loupe once it loaded', async () => {
		const { wrapper, loader, tile } = await mountFailed()
		expect(tile.classes()).toContain('photo-tile--failed')
		const requested = loader.started.length

		await tile.trigger('click')
		expect(loader.started.slice(requested)).toEqual(['/img/1/256'])
		expect(wrapper.emitted('open')).toBeUndefined()
		await loader.finishAll()
		await tile.trigger('click')

		expect(wrapper.emitted('open')).toEqual([[0]])
	})

	// spec: GRID-001.23
	it('loads a failed tile again on Enter and Space', async () => {
		const { wrapper, loader, tile } = await mountFailed()
		const requested = loader.started.length

		await tile.trigger('keydown', { key: 'Enter' })
		await loader.finish('reject')
		await loader.finishAll()
		await tile.trigger('keydown', { key: ' ' })

		expect(loader.started.slice(requested)).toEqual(['/img/1/256', '/img/1/256'])
		expect(wrapper.emitted('open')).toBeUndefined()
	})

	// spec: GRID-001.23
	it('keeps a modified click on a failed tile for the selection', async () => {
		const { wrapper, loader, tile } = await mountFailed()
		const requested = loader.started.length

		await tile.trigger('click', { shiftKey: true })

		expect(loader.started.length).toBe(requested)
		expect(wrapper.emitted('update:selection')).toBeDefined()
	})

	// spec: GRID-001.23
	it('lets a click select a failed tile in selection mode', async () => {
		const loader = fakeLoader()
		const { wrapper, resize } = mountGrid({ loadImage: loader.loadImage, selecting: true })
		await resize(432, 100)
		await loader.finish('reject')
		const requested = loader.started.length

		await wrapper.find('[data-index="0"]').trigger('click')

		expect(loader.started.length).toBe(requested)
		expect(wrapper.emitted('update:selection')).toBeDefined()
	})
})
