// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { onMounted } from 'vue'
import { pinchTileSize, wheelTileSize } from '../logic/tile-size.ts'

/** What the grid's pinch reads and resizes. */
export interface GridPinchTargets {
	scroller: () => HTMLElement | null
	tileSize: () => number
	/** Whether a drag selection holds the touch, which then never scrolls. */
	dragging: () => boolean
	resize: (size: number) => void
}

const fingerDistance = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY)

/** Resizes the grid's tiles by a two-finger pinch or a trackpad pinch; returns the passive touch listeners. */
export function useGridPinch(targets: GridPinchTargets) {
	let pinch: { size: number, distance: number } | null = null

	/** Resizes the tiles on a trackpad pinch, which arrives as a wheel event with Ctrl. */
	function onWheel(event: WheelEvent) {
		if (event.ctrlKey) {
			event.preventDefault()
			targets.resize(wheelTileSize(targets.tileSize(), event.deltaY))
		}
	}

	/** Resizes the tiles while the pinch lasts. */
	function onTouchMove(event: TouchEvent) {
		if (targets.dragging()) {
			event.preventDefault()
		} else if (pinch !== null && event.touches.length === 2) {
			event.preventDefault()
			targets.resize(pinchTileSize(pinch.size, pinch.distance, fingerDistance(event.touches)))
		}
	}

	onMounted(() => {
		const element = targets.scroller()!
		element.addEventListener('wheel', onWheel, { passive: false })
		element.addEventListener('touchmove', onTouchMove, { passive: false })
	})

	return {
		/** Starts a two-finger pinch that resizes the tiles. */
		onTouchStart(event: TouchEvent) {
			if (event.touches.length === 2) {
				pinch = { size: targets.tileSize(), distance: fingerDistance(event.touches) }
			}
		},
		/** Ends the pinch when fewer than two fingers remain. */
		onTouchEnd(event: TouchEvent) {
			if (event.touches.length < 2) {
				pinch = null
			}
		},
	}
}
