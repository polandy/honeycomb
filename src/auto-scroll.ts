// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Runs `run` on the next frame; returns the function that cancels it. */
export type Frame = (run: () => void) => () => void

/** Runs `run` on the browser's next animation frame. */
export const browserFrame: Frame = (run) => {
	const id = window.requestAnimationFrame(run)
	return () => window.cancelAnimationFrame(id)
}

/** Scrolls by the step `follow` sets, once a frame while `scrollBy` reports it moved, each followed by `afterScroll`. */
export function autoScroll(frame: Frame, scrollBy: (step: number) => boolean, afterScroll: () => void) {
	let step = 0
	let cancel: (() => void) | null = null

	/** Cancels the pending frame. */
	function stop() {
		cancel?.()
		cancel = null
	}

	/** Scrolls one frame and asks for the next while it moves. */
	function tick() {
		cancel = null
		if (scrollBy(step)) {
			afterScroll()
			cancel = frame(tick)
		}
	}

	return {
		/** Sets the step of each frame; 0 stops scrolling. */
		follow(next: number) {
			step = next
			if (step === 0) {
				stop()
			} else if (cancel === null) {
				cancel = frame(tick)
			}
		},
		stop,
	}
}
