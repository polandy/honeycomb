// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './logic/long-press.ts'
import type { Box } from './logic/tooltip.ts'

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { tileInfoTimer } from './logic/tile-info.ts'

/** The tile whose tile info shows: its index in the grid and its box in the viewport. */
export interface ShownTileInfo {
	readonly index: number
	readonly anchor: Box
}

/** A grid's tile: the element with its index in `data-index`. */
const tileOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('[data-index]') : null)

/** Shows the tile info of the tile the mouse rests on in the grid's scroller, and hides it (GRID-004.7, GRID-004.8). */
export function useTileInfo(scroller: () => HTMLElement | null, schedule: Schedule) {
	const shown = ref<ShownTileInfo | null>(null)
	const timer = tileInfoTimer<HTMLElement>(schedule, (tile) => {
		const box = tile?.getBoundingClientRect()
		shown.value = tile === null ? null : { index: Number(tile.dataset.index), anchor: { left: box!.left, top: box!.top, right: box!.right, bottom: box!.bottom } }
	})
	const hide = () => {
		timer.hide()
	}

	/** The mouse came onto a tile, or onto a control of it with its own tooltip. */
	function onPointerOver(event: PointerEvent) {
		const tile = tileOf(event.target)
		if (event.pointerType !== 'mouse') {
			return
		}
		if (tile === null || (event.target as Element).closest('[data-tip]') !== null) {
			timer.hide()
		} else {
			timer.rest(tile)
		}
	}

	/** The mouse left a tile, unless for a part of it. */
	function onPointerOut(event: PointerEvent) {
		if (!(tileOf(event.target)?.contains(event.relatedTarget as Node | null) ?? false)) {
			timer.hide()
		}
	}

	/** An Esc that hid the tile info goes no further. */
	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && timer.hide()) {
			event.preventDefault()
			event.stopImmediatePropagation()
		}
	}

	const listeners = { pointerover: onPointerOver, pointerout: onPointerOut, pointerdown: hide, scroll: hide } as const
	onMounted(() => {
		const element = scroller()!
		Object.entries(listeners).forEach(([type, listener]) => element.addEventListener(type, listener as EventListener))
		window.addEventListener('keydown', onKeydown, true)
	})
	onBeforeUnmount(() => {
		window.removeEventListener('keydown', onKeydown, true)
		timer.hide()
	})

	return shown
}
