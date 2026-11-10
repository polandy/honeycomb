// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { hotkeyListener, keyCap } from '../../src/hotkeys.ts'

/** Dispatches a key on `target` (the body unless given) and returns whether it was handled. */
function press(listener: (event: KeyboardEvent) => void, key: string, fields: KeyboardEventInit = {}, target: HTMLElement = document.body) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields })
	target.addEventListener('keydown', listener, { once: true })
	target.dispatchEvent(event)
	return event.defaultPrevented
}

describe('hotkeyListener', () => {
	it('runs the screen\'s handler and prevents the default only when it handled the key', () => {
		const close = vi.fn(() => false)
		const decide = vi.fn()
		const listener = hotkeyListener(() => ({ decide, close }), () => false)
		expect(press(listener, 'p')).toBe(true)
		expect(decide).toHaveBeenCalledWith({ kind: 'flag', flag: 'picked' }, false)
		expect(press(listener, 'Escape')).toBe(false)
		expect(close).toHaveBeenCalledOnce()
	})

	it('does nothing for a key with no handler on the screen, or with no screen', () => {
		expect(press(hotkeyListener(() => ({}), () => false), 'z')).toBe(false)
		expect(press(hotkeyListener(() => null, () => false), 'p')).toBe(false)
	})

	it('reads Caps Lock as auto-advance', () => {
		const decide = vi.fn()
		const event = new KeyboardEvent('keydown', { key: 'P', cancelable: true })
		event.getModifierState = (key: string) => key === 'CapsLock'
		hotkeyListener(() => ({ decide }), () => false)(event)
		expect(decide).toHaveBeenCalledWith({ kind: 'flag', flag: 'picked' }, true)
	})

	it('ignores keys typed into a field and keys already handled', () => {
		const decide = vi.fn()
		const listener = hotkeyListener(() => ({ decide }), () => false)
		const field = document.body.appendChild(document.createElement('input'))
		expect(press(listener, 'p', {}, field)).toBe(false)
		const handled = new KeyboardEvent('keydown', { key: 'p', cancelable: true })
		handled.preventDefault()
		listener(handled)
		expect(decide).not.toHaveBeenCalled()
		field.remove()
	})

	it('leaves Tab and Space to a focused control, but acts on them on the body or the screen', () => {
		const header = vi.fn()
		const listener = hotkeyListener(() => ({ header, zoom: header }), () => false)
		const button = document.body.appendChild(document.createElement('button'))
		const screen = document.body.appendChild(document.createElement('div'))
		screen.dataset.hotkeysScreen = ''
		expect(press(listener, 'Tab', {}, button)).toBe(false)
		expect(press(listener, ' ', {}, button)).toBe(false)
		expect(press(listener, 'Tab')).toBe(true)
		expect(press(listener, ' ', {}, screen)).toBe(true)
		expect(header).toHaveBeenCalledTimes(2)
		button.remove()
		screen.remove()
	})

	it('keeps a waiting g of the vi keys from one key to the next', () => {
		const first = vi.fn()
		const listener = hotkeyListener(() => ({ first }), () => true)
		expect(press(listener, 'g')).toBe(false)
		expect(press(listener, 'g')).toBe(true)
		expect(first).toHaveBeenCalledOnce()
	})
})

describe('keyCap', () => {
	it('shows a key of the key map, Ctrl as ⌘ on a Mac', () => {
		expect(keyCap('pick')).toBe('P')
		expect(keyCap('shortcuts', 1)).toBe('?')
		expect(keyCap('undo', 0, true)).toBe('⌘+Z')
	})
})
