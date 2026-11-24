// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useModalDialog } from '../../src/modal-dialog.ts'

enableAutoUnmount(afterEach)

const close = vi.fn()

const Dialog = defineComponent({
	setup() {
		const root = ref<HTMLElement | null>(null)
		const { onKeydown } = useModalDialog(root, close)
		return () => h('div', { ref: root, class: 'dialog', onKeydown }, [h('button', { class: 'first' }, 'one'), h('input', { class: 'middle' }), h('button', { class: 'last', disabled: false }, 'two')])
	},
})

/** The dialog beside two page siblings, one already inert, attached so the focus works. */
function mountDialog() {
	const page = document.createElement('main')
	page.id = 'page'
	const text = document.createElement('p')
	text.id = 'text'
	text.textContent = 'page'
	page.append(text)
	const already = document.createElement('aside')
	already.id = 'already'
	already.inert = true
	const host = document.createElement('section')
	host.id = 'host'
	document.body.replaceChildren(page, already, host)
	const wrapper = mount(Dialog, { attachTo: document.getElementById('host')! })
	return wrapper
}

const press = (wrapper: ReturnType<typeof mountDialog>, key: string, shiftKey = false) => wrapper.find('.dialog').trigger('keydown', { key, shiftKey })

describe('useModalDialog', () => {
	afterEach(() => {
		close.mockClear()
		document.body.replaceChildren()
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
