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

	it('shows the message alone without an action', () => {
		const wrapper = mountToast(null)

		expect(wrapper.text()).toBe('Rejected IMG_1')
		expect(wrapper.find('button').exists()).toBe(false)
	})

	describe('with the marked catalogue', () => {
		beforeEach(installMarkedCatalogue)
		afterEach(uninstallMarkedCatalogue)

		it('renders its own text through the catalogue; the message and label come translated', () => {
			expect(untranslatedText(mountToast({ label: 'Undo' }).element as Element)).toEqual(['Rejected IMG_1', 'Undo'])
		})
	})
})
