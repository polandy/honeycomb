// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HotkeyCommand, HotkeyIntent } from './logic/hotkeys.ts'

import { onBeforeUnmount, onMounted } from 'vue'
import { formatCaps, hotkey, KEYMAP } from './logic/hotkeys.ts'

/** What a screen's keys act on; a handler that returns false did not handle its key. */
export type HotkeyHandlers = {
	readonly decide?: (intent: HotkeyIntent, advance: boolean) => boolean | void
} & { readonly [C in HotkeyCommand]?: () => boolean | void }

/** Whether a key goes to a text field rather than to the screen. */
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/** Whether Tab and Space belong to the screen: on the page body or the screen's own element, not on a focused control. */
const onScreen = (target: EventTarget | null) => !(target instanceof HTMLElement) || target === document.body || target.dataset.hotkeysScreen !== undefined

/** The keydown listener that resolves a key through the key map and runs the handler the screen supplies. */
export function hotkeyListener(handlers: () => HotkeyHandlers | null, vi: () => boolean) {
	let pendingG = false
	return (event: KeyboardEvent) => {
		if (event.defaultPrevented || typing(event.target) || ((event.key === 'Tab' || event.key === ' ') && !onScreen(event.target))) {
			return
		}
		const resolved = hotkey({ key: event.key, code: event.code, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey, capsLock: event.getModifierState('CapsLock') }, { vi: vi(), pendingG })
		pendingG = resolved.state.pendingG
		const action = resolved.action
		const screen = handlers()
		if (action === null || screen === null) {
			return
		}
		const handler = action.kind === 'decide' ? screen.decide?.bind(null, action.intent, action.advance) : screen[action.kind]
		if (handler !== undefined && handler() !== false) {
			event.preventDefault()
		}
	}
}

/** The one window keydown listener of the app, for the screen `handlers` returns. */
export function useHotkeys(handlers: () => HotkeyHandlers | null, vi: () => boolean) {
	const listener = hotkeyListener(handlers, vi)
	onMounted(() => window.addEventListener('keydown', listener))
	onBeforeUnmount(() => window.removeEventListener('keydown', listener))
}

/** Whether the keyboard has ⌘ in place of Ctrl. */
export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform)

/** A key cap of the key map as shown, e.g. `keyCap('pick')` is "P". */
export function keyCap(id: string, at = 0, mac = isMac()): string {
	return formatCaps(KEYMAP.find((entry) => entry.id === id)!.caps[at]!, mac)
}
