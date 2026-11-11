// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { INFO_WIDTH_KEY, NAVIGATION_SHOWN_KEY } from '../../../src/loupe-panels.ts'
import { tap } from './loupe-pointer.ts'
import { button, indices, mountLoupe } from './mount-loupe.ts'

enableAutoUnmount(afterEach)

describe('PhotoLoupe', () => {
	// spec: LOUPE-001.15, LOUPE-003.6
	it('shows the gesture guide above the overlays on its first opening, until Got it, then never again', async () => {
		const { wrapper, root, savedViewState } = await mountLoupe(4, {}, true)
		const guide = () => wrapper.find('.gesture-guide')
		expect(guide().exists()).toBe(true)
		expect(root.element.lastElementChild).toBe(guide().element)
		expect(document.activeElement).toBe(guide().find('button').element)

		await guide().find('button').trigger('click')

		expect(guide().exists()).toBe(false)
		expect(document.activeElement).toBe(root.element)
		expect(savedViewState).toEqual([{ gestureGuideSeen: true }])
		const viewState = wrapper.props('viewState')
		wrapper.unmount()
		const again = await mountLoupe(4, {}, true, { viewState })
		expect(again.wrapper.find('.gesture-guide').exists()).toBe(false)
	})

	// spec: LOUPE-001.1, LOUPE-001.12
	it('opens focused as a modal dialog on the picture and preloads it, then 3 ahead and 2 behind', async () => {
		const { wrapper, root, decoded } = await mountLoupe()
		expect(root.attributes('aria-modal')).toBe('true')
		expect(document.activeElement).toBe(root.element)
		expect(wrapper.find('h2').text()).toBe('IMG_5')
		expect(decoded).toEqual([5, 6, 4, 7, 3, 8].map((id) => `/img/${id}/4096`))
	})

	// spec: LOUPE-001.3
	it('pages by arrows, Home and End, never past either end', async () => {
		const { wrapper, root } = await mountLoupe(0)
		for (const key of ['ArrowLeft', 'ArrowRight', 'End', 'ArrowRight', 'Home']) {
			await root.trigger('keydown', { key })
		}
		expect(indices(wrapper)).toEqual([1, 9, 0])
	})

	// spec: LOUPE-001.3, KEYS-001.7
	it('pages by ArrowUp and ArrowDown, and by h and l with the vi keys on', async () => {
		const { wrapper, root } = await mountLoupe(4, {}, false, { settings: { ...DEFAULT_SETTINGS, viKeys: true } })
		for (const key of ['ArrowDown', 'ArrowUp', 'l', 'h']) {
			await root.trigger('keydown', { key })
		}
		expect(indices(wrapper)).toEqual([5, 4, 5, 4])
	})

	// spec: LOUPE-001.3
	it('pages by the navigation buttons, shown only where there is a neighbour', async () => {
		const { wrapper } = await mountLoupe(0)
		expect(button(wrapper, 'Previous photo').exists()).toBe(false)
		await button(wrapper, 'Next photo').trigger('click')
		expect(button(wrapper, 'Previous photo').exists()).toBe(true)
		await button(wrapper, 'Previous photo').trigger('click')
		expect(indices(wrapper)).toEqual([1, 0])
	})

	// spec: LOUPE-001.4
	it('pages by a tap on the stage and by the filmstrip', async () => {
		const { wrapper } = await mountLoupe()
		await tap(wrapper.find('.loupe-stage'), 900, 0)
		await wrapper.find('.loupe-filmstrip button[aria-label="IMG_1"]').trigger('click')
		expect(indices(wrapper)).toEqual([5, 0])
	})

	// spec: LOUPE-001.2
	it('closes by Escape, by G and by the close button', async () => {
		const { wrapper, root } = await mountLoupe()
		await root.trigger('keydown', { key: 'Escape' })
		await root.trigger('keydown', { key: 'g' })
		await button(wrapper, 'Close loupe').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(3)
	})

	// spec: MOVE-004.1
	it('asks to move its photo from the title row', async () => {
		const { wrapper } = await mountLoupe()
		await button(wrapper, 'Move this photo').trigger('click')
		expect(wrapper.emitted('move')).toHaveLength(1)
	})

	// spec: KEYS-001.9
	it('is the screen its keys belong to', async () => {
		const { root } = await mountLoupe()
		expect(root.attributes('data-hotkeys-screen')).toBeDefined()
	})

	// spec: LOUPE-001.10
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

	// spec: KEYS-001.8
	it('ignores keys with modifiers or already handled', async () => {
		const { wrapper, root } = await mountLoupe()
		await root.trigger('keydown', { key: 'ArrowRight', ctrlKey: true })
		const handled = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
		handled.preventDefault()
		root.element.dispatchEvent(handled)
		expect(indices(wrapper)).toBeUndefined()
	})

	// spec: LOUPE-001.10
	it('goes browser fullscreen by F', async () => {
		const { root, fullscreen } = await mountLoupe()
		await root.trigger('keydown', { key: 'f' })
		expect(fullscreen).toEqual([root.element])
	})

	// spec: LOUPE-001.7
	it('zooms to 100 percent by Z or the zoom button and loads the full image', async () => {
		const { wrapper, root, decoded } = await mountLoupe()
		const zoomButton = button(wrapper, 'Toggle fit and 100 percent')
		await root.trigger('keydown', { key: 'z' })
		expect(zoomButton.text()).toBe('100 %')
		expect(decoded).toContain('/img/5/0')
		await zoomButton.trigger('click')
		expect(zoomButton.text()).toBe('Fit')
	})

	// spec: LOUPE-001.9
	it('zooms in by Ctrl+= only when fitted and out by Ctrl+- only when zoomed, leaving other presses to the browser', async () => {
		const { wrapper, root } = await mountLoupe()
		const zoomButton = button(wrapper, 'Toggle fit and 100 percent')
		const press = async (key: string) => {
			const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true })
			root.element.dispatchEvent(event)
			await flushPromises()
			return event.defaultPrevented
		}
		expect(await press('-')).toBe(false)
		expect(zoomButton.text()).toBe('Fit')
		expect(await press('=')).toBe(true)
		expect(zoomButton.text()).toBe('100 %')
		expect(await press('=')).toBe(false)
		expect(zoomButton.text()).toBe('100 %')
		expect(await press('-')).toBe(true)
		expect(zoomButton.text()).toBe('Fit')
	})

	// spec: LOUPE-001.13, LOUPE-003.6
	it('opens the info panel by I beside the overlays, keeps its state and width, and counts the loaded neighbours', async () => {
		const { wrapper, root, stored, savedViewState } = await mountLoupe(4, { [INFO_WIDTH_KEY]: '320' })
		expect(wrapper.find('.loupe-info').exists()).toBe(false)
		expect(root.attributes('style')).toContain('--photo-loupe-panel: 0px')
		await root.trigger('keydown', { key: 'i' })
		expect(wrapper.find('.loupe-info').attributes('style')).toContain('width: 320px')
		expect(root.attributes('style')).toContain('--photo-loupe-panel: 324px')
		expect(wrapper.find('.loupe-info').text()).toContain('5 of 5 neighbours loaded')
		await wrapper.find('[role="separator"]').trigger('keydown', { key: 'Home' })
		expect(stored).toEqual({ [INFO_WIDTH_KEY]: '220' })
		expect(savedViewState).toEqual([{ infoPanelOpen: true }])
		await button(wrapper, 'Toggle info panel').trigger('click')
		expect(wrapper.find('.loupe-info').exists()).toBe(false)
	})

	// spec: LOUPE-001.13
	it('hides the filmstrip by its toggle', async () => {
		const { wrapper } = await mountLoupe()
		await button(wrapper, 'Toggle filmstrip').trigger('click')
		expect(wrapper.find('.loupe-filmstrip').exists()).toBe(false)
	})

	// spec: LOUPE-001.14
	it('shows the Nextcloud navigation above it by its toggle and keeps the choice', async () => {
		const { wrapper, root, stored } = await mountLoupe()
		const toggle = () => button(wrapper, 'Toggle Nextcloud navigation')
		expect(root.classes('photo-loupe--below-header')).toBe(false)
		expect(toggle().attributes('aria-pressed')).toBe('false')

		await toggle().trigger('click')

		expect(root.classes('photo-loupe--below-header')).toBe(true)
		expect(toggle().attributes('aria-pressed')).toBe('true')
		expect(root.attributes('aria-modal')).toBe('false')
		expect(stored).toEqual({ [NAVIGATION_SHOWN_KEY]: 'true' })

		await root.trigger('keydown', { key: 'Tab' })
		expect(root.classes('photo-loupe--below-header')).toBe(false)
	})

	// spec: LOUPE-001.14
	it('opens below the Nextcloud navigation when it was shown before', async () => {
		const { root } = await mountLoupe(4, { [NAVIGATION_SHOWN_KEY]: 'true' })
		expect(root.classes('photo-loupe--below-header')).toBe(true)
	})

	// spec: LOUPE-001.11
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
