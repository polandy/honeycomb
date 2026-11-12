// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Selection } from '../../../src/logic/selection.ts'

import { describe, expect, it } from 'vitest'
import { AUTO_SCROLL_MAX_STEP } from '../../../src/logic/auto-scroll.ts'
import { NO_SELECTION } from '../../../src/logic/selection.ts'
import { fakeScheduler } from '../fake-scheduler.ts'
import { mountGrid } from './mount-grid.ts'

// A 432 x 220 px grid: four columns of 102 px tiles, rows 110 px apart; picture i has the key i + 1.
const ROW = 110
const COLUMN = 110
const keys = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index)

/** The grid after a long-press on the second tile, with a drag that moves the finger. */
async function pressSecondTile(props: Record<string, unknown> = {}) {
	const press = fakeScheduler()
	const frames = fakeScheduler()
	const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: false, schedule: press.schedule, frame: frames.schedule, ...props })
	await resize(432, 220)
	const scroller = wrapper.find('[role="grid"]')
	await wrapper.findAll('[role="gridcell"]')[1]!.trigger('pointerdown', { button: 0, clientX: COLUMN + 50, clientY: 50 })
	press.fire()
	const selections = () => (wrapper.emitted('update:selection') ?? []).map(([selection]) => selection as Selection)
	return {
		wrapper,
		frames,
		selections,
		last: () => [...selections().at(-1)!.ids].sort((a, b) => a - b),
		move: (clientX: number, clientY: number) => scroller.trigger('pointermove', { clientX, clientY }),
		lift: () => scroller.trigger('pointerup'),
		scroller,
	}
}

describe('PhotoGrid drag selection', () => {
	// spec: GRID-003.11
	it('selects every tile from the pressed one to the one under the finger in grid order', async () => {
		const drag = await pressSecondTile()

		await drag.move(3 * COLUMN + 50, ROW + 50)

		expect(drag.last()).toEqual(keys(2, 8))
		expect(drag.selections().at(-1)!.anchor).toBe(2)
	})

	// spec: GRID-003.11
	it('deselects what the drag added when the finger goes back, never what was selected before', async () => {
		const drag = await pressSecondTile({ selection: { ids: new Set([4]), anchor: 4 }, selecting: true })

		await drag.move(3 * COLUMN + 50, ROW + 50)
		await drag.move(50, 50)

		expect(drag.last()).toEqual([1, 2, 4])
	})

	// spec: GRID-003.11
	it('keeps the range while the finger stays on one tile, and ends with the finger lifted', async () => {
		const drag = await pressSecondTile()

		await drag.move(COLUMN + 60, 52)
		await drag.lift()
		await drag.move(3 * COLUMN + 50, ROW + 50)

		expect(drag.selections()).toHaveLength(1)
	})

	// spec: GRID-003.11
	it('ends with a cancelled pointer', async () => {
		const drag = await pressSecondTile()

		await drag.scroller.trigger('pointercancel')
		await drag.move(3 * COLUMN + 50, ROW + 50)

		expect(drag.selections()).toHaveLength(1)
	})

	// spec: GRID-003.11
	it('starts no drag on a move before the long-press', async () => {
		const press = fakeScheduler()
		const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: false, schedule: press.schedule })
		await resize(432, 220)

		await wrapper.findAll('[role="gridcell"]')[1]!.trigger('pointerdown', { button: 0, clientX: COLUMN + 50, clientY: 50 })
		await wrapper.find('[role="grid"]').trigger('pointermove', { clientX: 3 * COLUMN + 50, clientY: ROW + 50 })
		press.fire()

		expect(wrapper.emitted('update:selection')).toBeUndefined()
	})

	// spec: GRID-003.12
	it('scrolls on by itself at the bottom edge and extends the range to the tile now under the finger', async () => {
		const drag = await pressSecondTile()

		await drag.move(50, 208)
		expect(drag.last()).toEqual(keys(2, 5))

		drag.frames.fire()
		await drag.wrapper.vm.$nextTick()

		expect(drag.scroller.element.scrollTop).toBe(AUTO_SCROLL_MAX_STEP * 3 / 4)
		expect(drag.last()).toEqual(keys(2, 9))
	})

	// spec: GRID-003.12
	it('scrolls back up at the top edge and stops at the top of the grid', async () => {
		const drag = await pressSecondTile()

		await drag.move(50, 220)
		drag.frames.fire()
		drag.frames.fire()
		await drag.move(50, 0)
		Array.from({ length: 5 }, drag.frames.fire)

		expect(drag.scroller.element.scrollTop).toBe(0)
		expect(drag.frames.timers.filter((timer) => !timer.cancelled)).toEqual([])
	})

	// spec: GRID-003.12
	it('stops at the end of the grid, when the finger leaves the edge and when it lifts', async () => {
		const drag = await pressSecondTile()
		const pending = () => drag.frames.timers.filter((timer) => !timer.cancelled).length

		await drag.move(50, 220)
		await drag.move(50, 110)
		expect(pending()).toBe(0)

		await drag.move(50, 220)
		await drag.lift()
		expect(pending()).toBe(0)
	})

	// spec: GRID-003.12
	it('reaches the last row and stays there', async () => {
		const drag = await pressSecondTile()

		await drag.move(50, 220)
		Array.from({ length: 200 }, drag.frames.fire)
		await drag.wrapper.vm.$nextTick()

		expect(drag.scroller.element.scrollTop).toBe(24 * ROW + 102 - 220)
		expect(drag.last()).toEqual(keys(2, 97))
		expect(drag.frames.timers.filter((timer) => !timer.cancelled)).toEqual([])
	})

	// spec: GRID-003.13
	it('keeps the browser from scrolling by the finger during the drag only', async () => {
		const drag = await pressSecondTile()
		const touchMove = () => {
			const event = new Event('touchmove', { cancelable: true })
			drag.scroller.element.dispatchEvent(event)
			return event.defaultPrevented
		}

		expect(touchMove()).toBe(true)
		await drag.lift()
		expect(touchMove()).toBe(false)
	})

	// spec: GRID-003.13
	it('keeps the pressed tile rendered while the drag scrolls it far out of view', async () => {
		const drag = await pressSecondTile()
		const pressedShown = () => drag.wrapper.findAll('[role="gridcell"]').some((tile) => tile.attributes('aria-label')!.startsWith('IMG_1,'))

		await drag.move(50, 220)
		Array.from({ length: 200 }, drag.frames.fire)
		await drag.wrapper.vm.$nextTick()
		expect(pressedShown()).toBe(true)

		await drag.lift()
		expect(pressedShown()).toBe(false)
	})
})
