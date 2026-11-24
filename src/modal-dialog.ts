// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'

import { onBeforeUnmount, onMounted } from 'vue'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Makes everything beside the dialog and its ancestors inert; returns what it changed, to undo it. */
function inertBackground(dialog: HTMLElement): () => void {
	const changed: Element[] = []
	for (let node: HTMLElement = dialog; node !== document.body && node.parentElement !== null; node = node.parentElement) {
		for (const sibling of node.parentElement.children) {
			if (sibling !== node && !sibling.hasAttribute('inert')) {
				sibling.setAttribute('inert', '')
				changed.push(sibling)
			}
		}
	}
	return () => changed.forEach((element) => element.removeAttribute('inert'))
}

/** Keeps the focus and the page's keys inside a dialog that is not an `NcModal`: inert page, `Tab` wraps, `Escape` closes, the focus returns to the opener. */
export function useModalDialog(root: Readonly<Ref<HTMLElement | null>>, close: () => void) {
	let restore = () => {}
	let opener: HTMLElement | null = null
	onMounted(() => {
		opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
		restore = inertBackground(root.value!)
	})
	onBeforeUnmount(() => {
		const focusInside = root.value!.contains(document.activeElement)
		restore()
		if (focusInside) opener?.focus()
	})

	/** Wraps `Tab` at the ends of the dialog and closes on `Escape`. */
	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault()
			event.stopPropagation()
			close()
		} else if (event.key === 'Tab') {
			const controls = [...root.value!.querySelectorAll<HTMLElement>(FOCUSABLE)]
			const [first, last] = [controls[0], controls.at(-1)]
			const edge = event.shiftKey ? first : last
			if (document.activeElement === edge) {
				event.preventDefault()
				;(event.shiftKey ? last : first)!.focus()
			}
		}
	}

	return { onKeydown }
}
