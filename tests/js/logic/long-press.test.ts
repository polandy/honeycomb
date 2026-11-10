// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { LONG_PRESS_MS, longPress } from '../../../src/logic/long-press.ts'
import { fakeScheduler } from '../fake-scheduler.ts'

describe('longPress', () => {
	it('presses once the finger stays down long enough and swallows the click that follows', () => {
		const { timers, schedule, fire } = fakeScheduler()
		const press = longPress(schedule)
		const pressed: string[] = []

		press.down(0, 0, () => pressed.push('tile'))
		fire()

		expect(timers.map((timer) => timer.ms)).toEqual([LONG_PRESS_MS])
		expect(pressed).toEqual(['tile'])
		expect(press.takeClick()).toBe(true)
		expect(press.takeClick()).toBe(false)
	})

	it('lets a short tap through', () => {
		const { schedule, fire } = fakeScheduler()
		const press = longPress(schedule)
		const pressed: string[] = []

		press.down(0, 0, () => pressed.push('tile'))
		press.stop()
		fire()

		expect(pressed).toEqual([])
		expect(press.takeClick()).toBe(false)
	})

	it('cancels when the finger moves more than 10 px, not before', () => {
		const { schedule, fire } = fakeScheduler()
		const press = longPress(schedule)
		const pressed: string[] = []

		press.down(100, 100, () => pressed.push('tile'))
		press.move(106, 108)
		fire()
		press.down(100, 100, () => pressed.push('again'))
		press.move(108, 108)
		fire()

		expect(pressed).toEqual(['tile'])
	})

	it('forgets a fired press when the next one starts', () => {
		const { schedule, fire } = fakeScheduler()
		const press = longPress(schedule)

		press.down(0, 0, () => undefined)
		fire()
		press.down(0, 0, () => undefined)
		press.stop()

		expect(press.takeClick()).toBe(false)
	})
})
