// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { TOAST_MS, useToast } from '../../src/toast.ts'
import { fakeScheduler } from './fake-scheduler.ts'

describe('useToast', () => {
	it('shows a message with its action until its time is up', () => {
		const scheduler = fakeScheduler()
		const toast = useToast(scheduler.schedule)
		const action = { label: 'Undo', run: () => undefined }

		toast.show('Rejected IMG_1', action)

		expect(toast.current.value).toEqual({ message: 'Rejected IMG_1', action })
		expect(scheduler.timers.map((timer) => timer.ms)).toEqual([TOAST_MS])
		scheduler.fire()
		expect(toast.current.value).toBeNull()
	})

	it('replaces the shown toast and its timer with the next one', () => {
		const scheduler = fakeScheduler()
		const toast = useToast(scheduler.schedule)

		toast.show('first', { label: 'Undo', run: () => undefined })
		toast.show('second')

		expect(toast.current.value).toEqual({ message: 'second', action: null })
		expect(scheduler.timers.map((timer) => timer.cancelled)).toEqual([true, false])
	})

	it('hides the toast before it runs the action, so the action can show the next one', () => {
		const scheduler = fakeScheduler()
		const toast = useToast(scheduler.schedule)
		toast.show('Rejected IMG_1', { label: 'Undo', run: () => toast.show('Undid: Rejected IMG_1') })

		toast.act()

		expect(toast.current.value).toEqual({ message: 'Undid: Rejected IMG_1', action: null })
		expect(scheduler.timers.map((timer) => timer.cancelled)).toEqual([true, false])
		toast.act()
		expect(toast.current.value).toEqual({ message: 'Undid: Rejected IMG_1', action: null })
	})
})
