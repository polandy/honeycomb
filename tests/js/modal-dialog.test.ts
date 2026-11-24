// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { useModalDialog } from '../../src/shared/modal-dialog.ts'

enableAutoUnmount(afterEach)

const close = vi.fn()

const Dialog = defineComponent({
	setup() {
		const root = ref<HTMLElement | null>(null)
		const { onKeydown } = useModalDialog(root, close)
		return () => h('div', { ref: root, class: 'dialog', onKeydown }, [h('button', { class: 'first' }, 'one'), h('input', { class: 'middle' }), h('button', { class: 'last', disabled: false }, 'two')])
	},
})

const shown = ref(true)
const Host = defineComponent({ setup: () => () => (shown.value ? h(Dialog) : h('span')) })

/** The dialog beside two page siblings, one already inert, attached so the focus works. */
function mountDialog() {
	const page = document.createElement('main')
	page.id = 'page'
	const text = document.createElement('p')
	text.id = 'text'
	text.textContent = 'page'
	const opener = document.createElement('button')
	opener.id = 'opener'
	page.append(text, opener)
	const already = document.createElement('aside')
	already.id = 'already'
	already.inert = true
	const host = document.createElement('section')
	host.id = 'host'
	document.body.replaceChildren(page, already, host)
	opener.focus()
	shown.value = true
	const wrapper = mount(Host, { attachTo: document.getElementById('host')! })
	return wrapper
}

const press = (wrapper: ReturnType<typeof mountDialog>, key: string, shiftKey = false) => wrapper.find('.dialog').trigger('keydown', { key, shiftKey })

describe('useModalDialog', () => {
	afterEach(() => {
		close.mockClear()
		document.body.replaceChildren()
	})

	// spec: APP-001.20
	it('leaves the focus alone when the caller already moved it out of the dialog', async () => {
		const wrapper = mountDialog()
		wrapper.find<HTMLElement>('.first').element.focus()
		const elsewhere = document.getElementById('host')!
		elsewhere.tabIndex = -1
		elsewhere.focus()

		shown.value = false
		await nextTick()

		expect(document.activeElement?.id).toBe('host')
	})

	// spec: APP-001.20
	it('gives the focus back to the control that opened it', async () => {
		const wrapper = mountDialog()
		wrapper.find<HTMLElement>('.first').element.focus()
		expect(document.activeElement?.className).toBe('first')

		shown.value = false
		await nextTick()

		expect(document.activeElement?.id).toBe('opener')
	})

	// spec: APP-001.20
	it('makes the rest of the page inert while it is open and gives it back after, keeping what was inert before', () => {
		const wrapper = mountDialog()

		expect(document.getElementById('page')!.hasAttribute('inert')).toBe(true)
		expect(document.getElementById('already')!.hasAttribute('inert')).toBe(true)
		expect(wrapper.find('.dialog').element.closest('[inert]')).toBeNull()

		wrapper.unmount()

		expect(document.getElementById('page')!.hasAttribute('inert')).toBe(false)
		expect(document.getElementById('already')!.hasAttribute('inert')).toBe(true)
	})

	// spec: APP-001.20
	it('closes on Escape and keeps the key from the page', async () => {
		const wrapper = mountDialog()
		const outside = vi.fn()
		document.addEventListener('keydown', outside)

		await press(wrapper, 'Escape')
		document.removeEventListener('keydown', outside)

		expect(close).toHaveBeenCalledTimes(1)
		expect(outside).not.toHaveBeenCalled()
	})

	// spec: APP-001.20
	it('wraps Tab from the last control to the first and Shift+Tab back, and leaves Tab inside alone', async () => {
		const wrapper = mountDialog()
		const [first, middle, last] = ['.first', '.middle', '.last'].map((selector) => wrapper.find<HTMLElement>(selector).element)

		last!.focus()
		await press(wrapper, 'Tab')
		expect(document.activeElement).toBe(first)

		await press(wrapper, 'Tab', true)
		expect(document.activeElement).toBe(last)

		middle!.focus()
		await press(wrapper, 'Tab')
		expect(document.activeElement).toBe(middle)
		expect(close).not.toHaveBeenCalled()
	})

	// spec: APP-001.20
	it('ignores other keys', async () => {
		const wrapper = mountDialog()

		await press(wrapper, 'a')

		expect(close).not.toHaveBeenCalled()
	})
})
