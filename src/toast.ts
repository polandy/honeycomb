// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './logic/long-press.ts'

import { readonly, ref } from 'vue'

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

/** One toast at a time: a new one replaces the shown one and its timer. */
export function useToast(schedule: Schedule) {
	const current = ref<Toast | null>(null)
	let cancel: (() => void) | null = null

	/** Hides the toast and stops its timer. */
	function hide() {
		cancel?.()
		cancel = null
		current.value = null
	}

	/** Shows the message for TOAST_MS. */
	function show(message: string, action: ToastAction | null = null) {
		hide()
		current.value = { message, action }
		cancel = schedule(hide, TOAST_MS)
	}

	/** Hides the toast, then runs its action. */
	function act() {
		const action = current.value?.action
		if (action) {
			hide()
			action.run()
		}
	}

	return { current: readonly(current), show, act }
}
