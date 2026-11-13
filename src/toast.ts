// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './logic/long-press.ts'

import { readonly, ref, toRaw } from 'vue'

/** How long a toast stays, as in the mockup. */
export const TOAST_MS = 5200

/** A toast's button: its label and what it does. */
export interface ToastAction {
	readonly label: string
	readonly run: () => void
}

/** One message at the bottom of the screen, with an optional action. */
export interface Toast {
	readonly message: string
	readonly action: ToastAction | null
}

/** One toast at a time: a new one replaces the shown one and its timer; focus or a press holds it. */
export function useToast(schedule: Schedule) {
	const current = ref<Toast | null>(null)
	let cancel: (() => void) | null = null
	let focused = false
	let pressed = false

	/** Stops the timer. */
	function stop() {
		cancel?.()
		cancel = null
	}

	/** Hides the toast and stops its timer. */
	function hide() {
		stop()
		focused = false
		pressed = false
		current.value = null
	}

	/** Replaces the toast at once; the hold stays, as the focus may still be inside. */
	function replace(next: Toast) {
		stop()
		current.value = next
		start()
	}

	/** Hides `shown` if it is still the current toast. */
	function close(shown: Toast) {
		if (toRaw(current.value) === shown) {
			hide()
		}
	}

	/** Runs the full time from now, unless the toast is held. */
	function start() {
		stop()
		if (!focused && !pressed) {
			cancel = schedule(hide, TOAST_MS)
		}
	}

	/** Shows the message for TOAST_MS and returns a closer that hides it unless another toast replaced it. */
	function show(message: string, action: ToastAction | null = null): () => void {
		const shown = { message, action }
		replace(shown)
		return () => close(shown)
	}

	/** Holds the toast while the focus is inside it; leaving restarts its full time. */
	function setFocused(inside: boolean) {
		focused = inside
		update()
	}

	/** Holds the toast while a pointer is pressed on it; releasing restarts its full time. */
	function setPressed(down: boolean) {
		pressed = down
		update()
	}

	/** Stops the timer of a held toast and restarts that of a released one. */
	function update() {
		if (current.value === null) {
			return
		}
		if (focused || pressed) {
			stop()
		} else if (cancel === null) {
			start()
		}
	}

	/** Hides the toast, then runs its action. */
	function act() {
		const action = current.value?.action
		if (action) {
			hide()
			action.run()
		}
	}

	/** The events of `UndoToast`, to bind as they are. */
	const listeners = { onAct: act, onFocus: setFocused, onPress: setPressed }

	return { current: readonly(current), show, act, setFocused, setPressed, listeners }
}
