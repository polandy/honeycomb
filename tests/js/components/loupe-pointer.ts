// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DOMWrapper } from '@vue/test-utils'

import { flushPromises } from '@vue/test-utils'

/** One pointer event on the element, with its time set as the gestures read it. */
export async function pointer(target: DOMWrapper<Element>, type: string, fields: { id?: number, x: number, y?: number, time: number, kind?: string }) {
	const event = new PointerEvent(type, { bubbles: true, pointerId: fields.id ?? 1, clientX: fields.x, clientY: fields.y ?? 300, pointerType: fields.kind ?? 'touch' })
	Object.defineProperty(event, 'timeStamp', { value: fields.time })
	target.element.dispatchEvent(event)
	await flushPromises()
}

/** A tap of one finger at `x`, starting at `time`. */
export async function tap(target: DOMWrapper<Element>, x: number, time: number, kind = 'touch') {
	await pointer(target, 'pointerdown', { x, time, kind })
	await pointer(target, 'pointerup', { x, time: time + 50, kind })
}
