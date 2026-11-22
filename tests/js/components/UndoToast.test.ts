// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import UndoToast from '../../../src/components/UndoToast.vue'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const mountToast = (action: { label: string } | null, top = false) => mount(UndoToast, { props: { toast: { message: 'Rejected IMG_1', action: action && { ...action, run: () => undefined } }, top } })

describe('UndoToast', () => {
	// spec: LOUPE-002.12
	it('reports the focus entering and leaving it, not moving between its own parts', async () => {
		const wrapper = mountToast({ label: 'Undo' })

		await wrapper.trigger('focusin')
		await wrapper.trigger('focusout', { relatedTarget: wrapper.find('button').element })
		await wrapper.trigger('focusout', { relatedTarget: null })

		expect(wrapper.emitted('focus')).toEqual([[true], [false]])
	})

	// spec: LOUPE-002.12
	it('reports a press on it until the pointer is lifted or cancelled anywhere', async () => {
		const wrapper = mountToast({ label: 'Undo' })

		await wrapper.trigger('pointerdown')
		window.dispatchEvent(new Event('pointerup'))
		await wrapper.trigger('pointerdown')
		window.dispatchEvent(new Event('pointercancel'))
		window.dispatchEvent(new Event('pointerup'))

		expect(wrapper.emitted('press')).toEqual([[true], [false], [true], [false]])
	})

	// spec: LOUPE-002.12
	it('stops listening for the release when it goes away', async () => {
		const presses: boolean[] = []
		const wrapper = mount(UndoToast, { props: { toast: { message: 'Rejected IMG_1', action: null }, onPress: (down: boolean) => presses.push(down) } })
		await wrapper.trigger('pointerdown')

		wrapper.unmount()
		window.dispatchEvent(new Event('pointerup'))

		expect(presses).toEqual([true])
	})

	// spec: APP-001.14
	it('offers its details as a button that asks for the dialog, and none without details', async () => {
		const wrapper = mount(UndoToast, { props: { toast: { message: 'Rejected IMG_1; 1 photo not changed', action: null, details: ['IMG_2: read only'] } } })

		expect(wrapper.find('details').exists()).toBe(false)
		await wrapper.find('.undo-toast__details').trigger('click')
		expect(wrapper.emitted('details')).toHaveLength(1)
		expect(mountToast(null).find('.undo-toast__details').exists()).toBe(false)
	})

	// spec: APP-001.13, APP-001.18
	it('is an alert when it reports an error and a status otherwise, each with a Close button', async () => {
		const error = mount(UndoToast, { props: { toast: { message: 'Could not clear the cache.', action: null, kind: 'error' } } })

		expect(error.attributes('role')).toBe('alert')
		await error.find('.undo-toast__close').trigger('click')
		expect(error.emitted('close')).toHaveLength(1)
		expect(error.find('.undo-toast__close').attributes('aria-label')).toBe('Close')
		expect(mountToast(null).attributes('role')).toBe('status')
		const success = mountToast({ label: 'Undo' })
		await success.find('.undo-toast__close').trigger('click')
		expect(success.emitted('close')).toHaveLength(1)
	})

	it('says the change, a dot and its action as a status', async () => {
		const wrapper = mountToast({ label: 'Undo' })

		expect(wrapper.attributes('role')).toBe('status')
		expect(wrapper.text()).toBe('Rejected IMG_1·Undo')
		await wrapper.find('button').trigger('click')
		expect(wrapper.emitted('act')).toHaveLength(1)
	})

	// spec: LOUPE-002.8
	it('leaves the focus where it is when its button is pressed', async () => {
		const wrapper = mountToast({ label: 'Undo' })
		const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })

		wrapper.find('button').element.dispatchEvent(press)

		expect(press.defaultPrevented).toBe(true)
	})

	// spec: LOUPE-002.8
	it('sits at the bottom, or at the top where the loupe keeps its controls at the bottom', () => {
		expect(mountToast(null).classes()).not.toContain('undo-toast--top')
		expect(mountToast(null, true).classes()).toContain('undo-toast--top')
	})

	// spec: LOUPE-002.16
	it('shows its offer before the action, its tooltip naming Shift+K', async () => {
		const wrapper = mount(UndoToast, { props: { toast: { message: 'Picked IMG_2', action: { label: 'Undo', run: () => undefined }, offer: { label: 'Reject the other 2', run: () => undefined } } } })
		const offer = wrapper.find('.undo-toast__offer')

		expect(wrapper.text()).toBe('Picked IMG_2·Reject the other 2Undo')
		expect(offer.attributes()).toMatchObject({ 'data-tip': 'Reject the other 2', 'data-tip-key': 'Shift+K' })
		const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
		offer.element.dispatchEvent(press)
		expect(press.defaultPrevented).toBe(true)
		await offer.trigger('click')
		expect(wrapper.emitted('offer')).toHaveLength(1)
		expect(wrapper.emitted('act')).toBeUndefined()
	})

	it('shows the message and its Close button alone without an action', () => {
		const wrapper = mountToast(null)

		expect(wrapper.text()).toBe('Rejected IMG_1')
		expect(wrapper.findAll('button').map((each) => each.classes())).toEqual([['undo-toast__action', 'undo-toast__close']])
	})

	describe('swipe', () => {
		/** A pointer pressed on the toast at (x, y) and released at (x + dx, y + dy) on the page. */
		async function swipe(wrapper: ReturnType<typeof mountToast>, dx: number, dy: number, pointerType = 'touch') {
			await wrapper.trigger('pointerdown', { clientX: 100, clientY: 200, pointerType })
			window.dispatchEvent(new PointerEvent('pointerup', { clientX: 100 + dx, clientY: 200 + dy, pointerType }))
		}

		// spec: APP-001.18
		it('asks to close on a sideways touch move of at least 60 px', async () => {
			const wrapper = mountToast({ label: 'Undo' })

			await swipe(wrapper, -60, 10)

			expect(wrapper.emitted('close')).toHaveLength(1)
			expect(wrapper.emitted('press')).toEqual([[true], [false]])
		})

		// spec: APP-001.18
		it('stays on a short, a mostly vertical or a mouse move', async () => {
			const wrapper = mountToast({ label: 'Undo' })

			await swipe(wrapper, 59, 0)
			await swipe(wrapper, 70, 90)
			await swipe(wrapper, 120, 0, 'mouse')

			expect(wrapper.emitted('close')).toBeUndefined()
		})
	})

	describe('with the marked catalogue', () => {
		beforeEach(installMarkedCatalogue)
		afterEach(uninstallMarkedCatalogue)

		it('renders its own text through the catalogue; the message and label come translated', () => {
			expect(untranslatedText(mountToast({ label: 'Undo' }).element as Element)).toEqual(['Rejected IMG_1', 'Undo'])
		})
	})
})
