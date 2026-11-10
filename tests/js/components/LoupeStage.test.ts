// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import LoupeStage from '../../../src/components/LoupeStage.vue'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { pointer, tap } from './loupe-pointer.ts'

const imageUrl = (fileId: number, size: number) => `/img/${fileId}/${size}`
const PICTURES = picturesOf([1, 2, 3].map((id) => listingEntry(id, `/P/IMG_${id}.JPG`, { width: 3000, height: 2000 })))

/** The stage on a 1000 × 600 area, with the sources in `ready` loaded. */
async function mountStage(props: Record<string, unknown> = {}) {
	const loads: string[] = []
	let stopped = false
	const ready = reactive(new Set<string>())
	const wrapper = mount(LoupeStage, {
		props: {
			pictures: PICTURES,
			index: 1,
			imageUrl,
			load: async (src: string) => {
				loads.push(src)
			},
			ready,
			devicePixelRatio: 1,
			observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
				onSize(1000, 600)
				return () => {
					stopped = true
				}
			},
			...props,
		},
	})
	const stage = wrapper.find('.loupe-stage')
	await wrapper.vm.$nextTick()
	return { wrapper, stage, loads, ready, stopped: () => stopped }
}

const images = (wrapper: Awaited<ReturnType<typeof mountStage>>['wrapper']) => wrapper.findAll('img')
const current = (wrapper: Awaited<ReturnType<typeof mountStage>>['wrapper']) => wrapper.find('img[alt="IMG_2"]')

describe('LoupeStage', () => {
	it('shows the picture between its neighbours, each fitted, from the grid tier until the loupe tier loads', async () => {
		const { wrapper, ready } = await mountStage()
		expect(images(wrapper).map((image) => image.attributes('src'))).toEqual(['/img/1/512', '/img/2/512', '/img/3/512'])
		expect(current(wrapper).attributes('style')).toContain('width: 900px; height: 600px')

		ready.add('/img/2/2048')
		await wrapper.vm.$nextTick()

		expect(current(wrapper).attributes('src')).toBe('/img/2/2048')
	})

	it('shows no neighbour beyond the first picture', async () => {
		const { wrapper } = await mountStage({ index: 0 })

		expect(images(wrapper)).toHaveLength(2)
	})

	it.each([
		['the left 30 %', 100, [['page', [-1]]]],
		['the right 30 %', 900, [['page', [1]]]],
		['the middle', 500, [['overlays', []]]],
	])('pages or toggles the overlays on a tap on %s', async (_zone, x, emitted) => {
		const { wrapper, stage } = await mountStage()

		await tap(stage, x, 0)

		expect(['page', 'overlays', 'chromeFree'].flatMap((name) => (wrapper.emitted(name) ?? []).map((args) => [name, args]))).toEqual(emitted)
	})

	it('toggles the chrome-free mode on a double-tap in the middle', async () => {
		const { wrapper, stage } = await mountStage()

		await tap(stage, 500, 0)
		await tap(stage, 505, 200)

		expect(wrapper.emitted('chromeFree')).toHaveLength(1)
	})

	it('follows a drag and pages once it passes 22 % of the width', async () => {
		const { wrapper, stage } = await mountStage()
		await pointer(stage, 'pointerdown', { x: 600, time: 0 })
		await pointer(stage, 'pointermove', { x: 500, time: 1000 })
		expect(wrapper.find('.loupe-stage__track').attributes('style')).toContain('translateX(-100px)')

		await pointer(stage, 'pointermove', { x: 300, time: 2000 })
		await pointer(stage, 'pointerup', { x: 300, time: 2000 })

		expect(wrapper.emitted('page')).toEqual([[1]])
		expect(wrapper.find('.loupe-stage__track').attributes('style')).toContain('translateX(0px)')
	})

	it('settles back after a short, slow drag and after a cancel', async () => {
		const { wrapper, stage } = await mountStage()
		await pointer(stage, 'pointerdown', { x: 600, time: 0 })
		await pointer(stage, 'pointermove', { x: 550, time: 1000 })
		await pointer(stage, 'pointerup', { x: 550, time: 2000 })
		await pointer(stage, 'pointerdown', { x: 600, time: 3000 })
		await pointer(stage, 'pointermove', { x: 550, time: 4000 })
		await pointer(stage, 'pointercancel', { x: 550, time: 4000 })

		expect(wrapper.emitted('page')).toBeUndefined()
		expect(wrapper.find('.loupe-stage__track').attributes('style')).toContain('translateX(0px)')
	})

	it('zooms to 100 % and back, and loads the full image while zoomed', async () => {
		const { wrapper, loads, ready } = await mountStage()
		expect(wrapper.emitted('update:zoom')).toEqual([[null]])

		;(wrapper.vm as unknown as { toggleZoom: () => void }).toggleZoom()
		await wrapper.vm.$nextTick()
		ready.add('/img/2/0')
		await wrapper.vm.$nextTick()

		expect(wrapper.emitted('update:zoom')!.at(-1)).toEqual([100])
		expect(loads).toEqual(['/img/2/0'])
		expect(current(wrapper).attributes('src')).toBe('/img/2/0')
		;(wrapper.vm as unknown as { toggleZoom: () => void }).toggleZoom()
		await wrapper.vm.$nextTick()
		expect(wrapper.emitted('update:zoom')!.at(-1)).toEqual([null])
	})

	it('pans the zoomed photo instead of paging, and fits again on another picture', async () => {
		const { wrapper, stage } = await mountStage()
		;(wrapper.vm as unknown as { toggleZoom: () => void }).toggleZoom()
		await wrapper.vm.$nextTick()

		await pointer(stage, 'pointerdown', { x: 500, time: 0 })
		await pointer(stage, 'pointermove', { x: 300, y: 250, time: 100 })
		await pointer(stage, 'pointerup', { x: 300, y: 250, time: 200 })
		expect(current(wrapper).attributes('style')).toContain('translate(-200px, -50px)')
		expect(wrapper.emitted('page')).toBeUndefined()

		await wrapper.setProps({ index: 2 })
		expect(wrapper.emitted('update:zoom')!.at(-1)).toEqual([null])
	})

	it('zooms with two fingers and snaps back to fit below the threshold', async () => {
		const { wrapper, stage } = await mountStage()
		await pointer(stage, 'pointerdown', { id: 1, x: 450, time: 0 })
		await pointer(stage, 'pointerdown', { id: 2, x: 550, time: 0 })
		await pointer(stage, 'pointermove', { id: 2, x: 650, time: 50 })
		expect(wrapper.emitted('update:zoom')!.at(-1)).toEqual([60])
		await pointer(stage, 'pointermove', { id: 2, x: 551, time: 100 })
		await pointer(stage, 'pointerup', { id: 2, x: 551, time: 150 })
		await pointer(stage, 'pointerup', { id: 1, x: 450, time: 150 })

		expect(wrapper.emitted('update:zoom')!.at(-1)).toEqual([null])
		expect(current(wrapper).attributes('style')).toContain('scale(1)')
	})

	it('learns the aspect from the loaded image when the listing has none', async () => {
		const pictures = picturesOf([listingEntry(1, '/P/IMG_1.JPG')])
		const { wrapper } = await mountStage({ pictures, index: 0 })
		const image = wrapper.find('img')
		expect(image.attributes('style')).toContain('width: 900px')

		Object.defineProperties(image.element, { naturalWidth: { value: 400 }, naturalHeight: { value: 800 } })
		await image.trigger('load')

		expect(image.attributes('style')).toContain('width: 300px; height: 600px')
	})

	it('ignores a load event without a size and stops observing on unmount', async () => {
		const { wrapper, stopped } = await mountStage()
		await current(wrapper).trigger('load')
		expect(current(wrapper).attributes('style')).toContain('width: 900px')

		wrapper.unmount()

		expect(stopped()).toBe(true)
	})
})
