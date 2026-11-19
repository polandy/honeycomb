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

/** One message at the bottom of the screen, with an optional action, an optional offer before it and details for a dialog; an error stays until closed (APP-001.13). */
export interface Toast {
	readonly message: string
	readonly action: ToastAction | null
	readonly offer?: ToastAction
	readonly details?: readonly string[]
	readonly kind?: 'error'
}

/** A toast's message with the details its dialog lists (APP-001.14). */
export interface DetailedToast {
	readonly message: string
	readonly details: readonly string[]
}

/** One toast at a time: a new one replaces the shown one and its timer; focus or a press holds it; an error has no timer. */
export function useToast(schedule: Schedule) {
	const current = ref<Toast | null>(null)
	const detailed = ref<DetailedToast | null>(null)
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
		if (!focused && !pressed && current.value?.kind !== 'error') {
			cancel = schedule(hide, TOAST_MS)
		}
	}

	/** Shows the message for TOAST_MS and returns a closer that hides it unless another toast replaced it. */
	function show(message: string, action: ToastAction | null = null, offer?: ToastAction, details: readonly string[] = []): () => void {
		const shown: Toast = { message, action, ...(offer === undefined ? {} : { offer }), ...(details.length === 0 ? {} : { details }) }
		replace(shown)
		return () => close(shown)
	}

	/** Shows the error until the user closes it or another toast replaces it, and returns its closer. */
	function showError(message: string, action: ToastAction | null = null, details: readonly string[] = []): () => void {
		const shown: Toast = { message, action, ...(details.length === 0 ? {} : { details }), kind: 'error' }
		replace(shown)
		return () => close(shown)
	}

	/** Hands the toast's message and details to the dialog and hides the toast. */
	function openDetails() {
		const details = current.value?.details
		if (details) {
			detailed.value = { message: current.value!.message, details }
			hide()
		}
	}

	/** Closes the details dialog. */
	function closeDetails() {
		detailed.value = null
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
		run(current.value?.action)
	}

	/** Hides the toast, then runs its offer (LOUPE-002.16). */
	function offer() {
		run(current.value?.offer)
	}

	/** Hides the toast, then runs the button's action, if it has one. */
	function run(action: ToastAction | null | undefined) {
		if (action) {
			hide()
			action.run()
		}
	}

	/** The events of `UndoToast`, to bind as they are. */
	const listeners = { onAct: act, onOffer: offer, onDetails: openDetails, onClose: hide, onFocus: setFocused, onPress: setPressed }

	return { current: readonly(current), detailed: readonly(detailed), show, showError, dismiss: hide, openDetails, closeDetails, act, offer, setFocused, setPressed, listeners }
}
