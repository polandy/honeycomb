// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PhotoLoupe from '../../../src/components/PhotoLoupe.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { INFO_OPEN_KEY, INFO_WIDTH_KEY, NAVIGATION_SHOWN_KEY } from '../../../src/loupe-panels.ts'
import { fakeStorage } from '../app-cull.ts'
import { fakeScheduler } from '../fake-scheduler.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { tap } from './loupe-pointer.ts'

const PICTURES = picturesOf(Array.from({ length: 10 }, (_, at) => listingEntry(at + 1, `/P/IMG_${at + 1}.JPG`, { width: 3000, height: 2000 })))

/** The loupe at `index` on a 1000 × 600 stage, attached so focus works. */
async function mountLoupe(index = 4, stored: Record<string, string> = {}) {
	const decoded: string[] = []
	const fullscreen: HTMLElement[] = []
	const scheduler = fakeScheduler()
	const wrapper = mount(PhotoLoupe, {
		attachTo: document.body,
		props: {
			pictures: PICTURES,
			index,
			folderSet: { paths: ['/P'], subfolders: true },
			decisionOf: () => UNDECIDED,
			storage: fakeStorage(stored),
			imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
			decode: async (src: string) => {
				decoded.push(src)
			},
			schedule: scheduler.schedule,
			toggleFullscreen: (element: HTMLElement) => fullscreen.push(element),
			devicePixelRatio: 1,
			observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
				onSize(1000, 600)
				return () => undefined
			},
			'onUpdate:index': (next: number) => wrapper.setProps({ index: next }),
		},
	})
	await flushPromises()
	return { wrapper, root: wrapper.find('[role="dialog"]'), decoded, fullscreen, scheduler, stored }
}

const button = (wrapper: Awaited<ReturnType<typeof mountLoupe>>['wrapper'], label: string) => wrapper.find(`button[aria-label="${label}"]`)
const indices = (wrapper: Awaited<ReturnType<typeof mountLoupe>>['wrapper']) => wrapper.emitted('update:index')?.map(([index]) => index)

enableAutoUnmount(afterEach)

describe('PhotoLoupe', () => {
	it('opens focused as a modal dialog on the picture and preloads it, then 3 ahead and 2 behind', async () => {
		const { wrapper, root, decoded } = await mountLoupe()
		expect(root.attributes('aria-modal')).toBe('true')
		expect(document.activeElement).toBe(root.element)
		expect(wrapper.find('h2').text()).toBe('IMG_5')
		expect(decoded).toEqual([5, 6, 4, 7, 3, 8].map((id) => `/img/${id}/2048`))
	})

	it('pages by arrows, Home and End, never past either end', async () => {
		const { wrapper, root } = await mountLoupe(0)
		for (const key of ['ArrowLeft', 'ArrowRight', 'End', 'ArrowRight', 'Home']) {
			await root.trigger('keydown', { key })
		}
		expect(indices(wrapper)).toEqual([1, 9, 0])
	})

	it('pages by the navigation buttons, shown only where there is a neighbour', async () => {
		const { wrapper } = await mountLoupe(0)
		expect(button(wrapper, 'Previous photo').exists()).toBe(false)
		await button(wrapper, 'Next photo').trigger('click')
		expect(button(wrapper, 'Previous photo').exists()).toBe(true)
		await button(wrapper, 'Previous photo').trigger('click')
		expect(indices(wrapper)).toEqual([1, 0])
	})

	it('pages by a tap on the stage and by the filmstrip', async () => {
		const { wrapper } = await mountLoupe()
		await tap(wrapper.find('.loupe-stage'), 900, 0)
		await wrapper.find('.loupe-filmstrip button[aria-label="IMG_1"]').trigger('click')
		expect(indices(wrapper)).toEqual([5, 0])
	})

	it('closes by Escape and by the close button', async () => {
		const { wrapper, root } = await mountLoupe()
		await root.trigger('keydown', { key: 'Escape' })
		await button(wrapper, 'Close loupe').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(2)
	})

	it('toggles chrome-free by Tab on itself and by a double tap, but not by Tab on a control', async () => {
		const { wrapper, root } = await mountLoupe()
		const chromeFree = () => root.classes('photo-loupe--chrome-free')
		await root.trigger('keydown', { key: 'Tab' })
		expect(chromeFree()).toBe(true)
		await tap(wrapper.find('.loupe-stage'), 500, 1000)
		await tap(wrapper.find('.loupe-stage'), 500, 1100)
		expect(chromeFree()).toBe(false)
		await button(wrapper, 'Close loupe').trigger('keydown', { key: 'Tab' })
		await button(wrapper, 'Close loupe').trigger('keydown', { key: ' ' })
		expect(chromeFree()).toBe(false)
		expect(wrapper.emitted('close')).toBeUndefined()
	})

	it('ignores keys with modifiers or already handled', async () => {
		const { wrapper, root } = await mountLoupe()
		await root.trigger('keydown', { key: 'ArrowRight', ctrlKey: true })
		const handled = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
		handled.preventDefault()
		root.element.dispatchEvent(handled)
		expect(indices(wrapper)).toBeUndefined()
	})

	it('goes browser fullscreen by F', async () => {
		const { root, fullscreen } = await mountLoupe()
		await root.trigger('keydown', { key: 'f' })
		expect(fullscreen).toEqual([root.element])
	})

	it('zooms to 100 percent by Z or the zoom button and loads the full image', async () => {
		const { wrapper, root, decoded } = await mountLoupe()
		const zoomButton = button(wrapper, 'Toggle fit and 100 percent')
		await root.trigger('keydown', { key: 'z' })
		expect(zoomButton.text()).toBe('100 %')
		expect(decoded).toContain('/img/5/0')
		await zoomButton.trigger('click')
		expect(zoomButton.text()).toBe('Fit')
	})

	it('opens the info panel by I beside the overlays, keeps its state and width, and counts the loaded neighbours', async () => {
		const { wrapper, root, stored } = await mountLoupe(4, { [INFO_WIDTH_KEY]: '320' })
		expect(wrapper.find('.loupe-info').exists()).toBe(false)
		expect(root.attributes('style')).toContain('--photo-loupe-panel: 0px')
		await root.trigger('keydown', { key: 'i' })
		expect(wrapper.find('.loupe-info').attributes('style')).toContain('width: 320px')
		expect(root.attributes('style')).toContain('--photo-loupe-panel: 324px')
		expect(wrapper.find('.loupe-info').text()).toContain('5 of 5 neighbours loaded')
		await wrapper.find('[role="separator"]').trigger('keydown', { key: 'Home' })
		expect(stored).toEqual({ [INFO_OPEN_KEY]: 'true', [INFO_WIDTH_KEY]: '220' })
		await button(wrapper, 'Toggle info panel').trigger('click')
		expect(wrapper.find('.loupe-info').exists()).toBe(false)
	})

	it('hides the filmstrip by its toggle', async () => {
		const { wrapper } = await mountLoupe()
		await button(wrapper, 'Toggle filmstrip').trigger('click')
		expect(wrapper.find('.loupe-filmstrip').exists()).toBe(false)
	})

	it('shows the Nextcloud navigation above it by its toggle and keeps the choice', async () => {
		const { wrapper, root, stored } = await mountLoupe()
		const toggle = () => button(wrapper, 'Toggle Nextcloud navigation')
		expect(root.classes('photo-loupe--below-header')).toBe(false)
		expect(toggle().attributes('aria-pressed')).toBe('false')

		await toggle().trigger('click')

		expect(root.classes('photo-loupe--below-header')).toBe(true)
		expect(toggle().attributes('aria-pressed')).toBe('true')
		expect(stored).toEqual({ [NAVIGATION_SHOWN_KEY]: 'true' })
	})

	it('opens below the Nextcloud navigation when it was shown before', async () => {
		const { root } = await mountLoupe(4, { [NAVIGATION_SHOWN_KEY]: 'true' })
		expect(root.classes('photo-loupe--below-header')).toBe(true)
	})

	it('idles its overlays after the last touch unless a control has focus, and wakes on a mouse move or a middle tap', async () => {
		const { wrapper, root, scheduler } = await mountLoupe()
		const idle = () => root.classes('photo-loupe--idle')
		scheduler.fire()
		await flushPromises()
		expect(idle()).toBe(true)

		root.element.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', bubbles: true }))
		await flushPromises()
		expect(idle()).toBe(true)
		root.element.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }))
		await flushPromises()
		expect(idle()).toBe(false)

		await tap(wrapper.find('.loupe-stage'), 500, 0)
		expect(idle()).toBe(true)
		await tap(wrapper.find('.loupe-stage'), 500, 1000)
		expect(idle()).toBe(false)

		;(button(wrapper, 'Close loupe').element as HTMLElement).focus()
		scheduler.fire()
		await flushPromises()
		expect(idle()).toBe(false)
	})
})
