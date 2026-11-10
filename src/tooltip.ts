// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TipSeams } from './logic/tooltip.ts'

import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { tipController } from './logic/tooltip.ts'

/** The id of the one tooltip bubble, which controls point at with `aria-describedby`. */
export const TIP_ID = 'honeycomb-tip'

/** A control with a tooltip. */
const TIP = '[data-tip]'

/** An area whose controls have faded out and show no tooltip. */
const TIPS_OFF = '[data-tips-off]'

/** An area whose long-press means something else, so its tooltips show on mouse hover only. */
const HOVER_ONLY = '[data-tip-hover-only]'

/** The attributes that give a control its tooltip. */
export interface TipAttributes {
	readonly 'data-tip': string
	readonly 'data-tip-key'?: string
}

/** The tooltip of a control: its label and, where it has one, the key cap from the key map. */
export function tip(label: string, key?: string): TipAttributes {
	return key === undefined ? { 'data-tip': label } : { 'data-tip': label, 'data-tip-key': key }
}

/** The control with a tooltip that the event target is in, if any. */
const tipOf = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>(TIP) : null

/** The control the event target is in, unless its area has faded out. */
function liveTip(target: EventTarget | null) {
	const found = tipOf(target)
	return found === null || found.closest(TIPS_OFF) !== null ? null : found
}

/** Listens on the window in the capture phase, ahead of the app's own listeners; returns the remover. */
function listen<K extends keyof WindowEventMap>(type: K, listener: (event: WindowEventMap[K]) => void) {
	window.addEventListener(type, listener, true)
	return () => window.removeEventListener(type, listener, true)
}

/** Drives the app's one tooltip from the page's pointer, focus, key and scroll events (APP-002). */
export function useTooltip(seams: TipSeams, bubble: () => HTMLElement | null) {
	const anchor = shallowRef<HTMLElement | null>(null)
	const tips = tipController<HTMLElement>(seams, (next) => {
		anchor.value?.removeAttribute('aria-describedby')
		next?.setAttribute('aria-describedby', TIP_ID)
		anchor.value = next
	})
	const inBubble = (target: EventTarget | null) => target instanceof Node && bubble()?.contains(target) === true
	const observer = new MutationObserver(() => tips.hideIf((shown) => !shown.isConnected || shown.closest(TIPS_OFF) !== null))
	let stops: (() => void)[] = []

	/** The mouse left a control: hide the tooltip, or let the next control take over. */
	function onPointerOut(event: PointerEvent) {
		const from = tipOf(event.target)
		const to = event.relatedTarget
		if (event.pointerType !== 'mouse' || (from === null && !inBubble(event.target)) || inBubble(to) || (from !== null && tipOf(to) === from)) {
			return
		}
		if (liveTip(to) === null) {
			tips.leave()
		} else {
			tips.cancelPending()
		}
	}

	/** A finger or pen went down: start a long-press on a control that has a tooltip. */
	function onPointerDown(event: PointerEvent) {
		const next = event.pointerType === 'mouse' || !event.isPrimary ? null : liveTip(event.target)
		tips.pressDown(next?.closest(HOVER_ONLY) === null ? next : null, event.clientX, event.clientY)
	}

	/** Stops the event before it reaches the page. */
	function swallow(event: Event) {
		event.preventDefault()
		event.stopImmediatePropagation()
	}

	onMounted(() => {
		stops = [
			listen('pointerover', (event) => {
				const next = event.pointerType === 'mouse' && !inBubble(event.target) ? liveTip(event.target) : null
				if (next !== null) {
					tips.hover(next)
				}
			}),
			listen('pointerout', onPointerOut),
			listen('focusin', (event) => {
				const next = liveTip(event.target)
				if (next !== null) {
					tips.focus(next, next.matches(':focus-visible'))
				}
			}),
			listen('focusout', (event) => {
				const previous = tipOf(event.target)
				if (previous !== null) {
					tips.blur(previous)
				}
			}),
			listen('keydown', (event) => {
				if (event.key === 'Escape' && tips.escape()) {
					swallow(event)
				}
			}),
			listen('pointerdown', onPointerDown),
			listen('pointermove', (event) => tips.pressMove(event.clientX, event.clientY)),
			listen('pointerup', (event) => {
				if (event.pointerType !== 'mouse') {
					tips.pressEnd()
				}
			}),
			listen('pointercancel', tips.pressEnd),
			listen('click', (event) => {
				if (tips.takeClick()) {
					swallow(event)
				}
			}),
			// A long-press on a control shows its tooltip, not the browser's menu.
			listen('contextmenu', (event) => {
				if (liveTip(event.target)?.closest(HOVER_ONLY) === null) {
					event.preventDefault()
				}
			}),
			listen('scroll', (event) => tips.hideIf((shown) => event.target instanceof Node && event.target.contains(shown))),
		]
		observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tips-off'] })
	})
	onBeforeUnmount(() => {
		stops.forEach((stop) => stop())
		observer.disconnect()
		tips.hide()
	})

	return { anchor }
}
