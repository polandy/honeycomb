// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { AUTO_SCROLL_EDGE, AUTO_SCROLL_MAX_STEP, autoScrollStep } from '../../../src/logic/auto-scroll.ts'

describe('autoScrollStep', () => {
	const height = 500

	// spec: GRID-003.12
	it.each([
		['the middle', 250, 0],
		['the inner end of the top band', AUTO_SCROLL_EDGE, 0],
		['the top edge', 0, -AUTO_SCROLL_MAX_STEP],
		['half way into the top band', AUTO_SCROLL_EDGE / 2, -AUTO_SCROLL_MAX_STEP / 2],
		['above the grid', -40, -AUTO_SCROLL_MAX_STEP],
		['half way into the bottom band', height - AUTO_SCROLL_EDGE / 2, AUTO_SCROLL_MAX_STEP / 2],
		['the bottom edge', height, AUTO_SCROLL_MAX_STEP],
		['below the grid', height + 40, AUTO_SCROLL_MAX_STEP],
	])('scrolls a frame by the finger\'s depth into the edge at %s', (_, y, step) => {
		expect(autoScrollStep(y, height)).toBe(step)
	})

	it.each([48, 96])('keeps a grid of %d px from scrolling both ways at once', (small) => {
		expect(autoScrollStep(small / 2, small)).toBe(0)
	})

	it('is 48 px wide and at most 16 px a frame', () => {
		expect([AUTO_SCROLL_EDGE, AUTO_SCROLL_MAX_STEP]).toEqual([48, 16])
	})
})
