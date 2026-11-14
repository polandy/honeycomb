// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { TOAST_MS, useToast } from '../../src/toast.ts'
import { fakeScheduler } from './fake-scheduler.ts'

describe('useToast', () => {
	// spec: LOUPE-002.8
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

	it('closes a toast by the closer its show returned, unless another toast replaced it', () => {
		const scheduler = fakeScheduler()
		const toast = useToast(scheduler.schedule)
		const closeFirst = toast.show('first')
		toast.show('second')

		closeFirst()
		expect(toast.current.value).toEqual({ message: 'second', action: null })

		const closeThird = toast.show('third')
		closeThird()
		expect(toast.current.value).toBeNull()
		expect(scheduler.timers.map((timer) => timer.cancelled)).toEqual([true, true, true])
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

	// spec: LOUPE-002.16
	it('runs its offer like its action, hidden first, and keeps no offer it was not given', () => {
		const scheduler = fakeScheduler()
		const toast = useToast(scheduler.schedule)
		const ran: string[] = []
		const offer = { label: 'Reject the other 2', run: () => ran.push('offer') }
		toast.show('Picked IMG_2', { label: 'Undo', run: () => ran.push('undo') }, offer)

		expect(toast.current.value?.offer).toEqual(offer)
		toast.offer()
		expect(toast.current.value).toBeNull()
		toast.offer()
		expect(ran).toEqual(['offer'])
		toast.show('Rejected IMG_1')
		toast.offer()
		expect(ran).toEqual(['offer'])
	})

	describe('held by focus or a press', () => {
		const shown = () => {
			const scheduler = fakeScheduler()
			const toast = useToast(scheduler.schedule)
			toast.show('Rejected IMG_1', { label: 'Undo', run: () => undefined })
			return { scheduler, toast }
		}
		const live = (scheduler: ReturnType<typeof fakeScheduler>) => scheduler.timers.filter((timer) => !timer.cancelled).length

		// spec: LOUPE-002.12
		it('stops its timer while the focus is inside and restarts the full time when it leaves', () => {
			const { scheduler, toast } = shown()

			toast.setFocused(true)
			expect(live(scheduler)).toBe(0)
			toast.setFocused(false)

			expect(live(scheduler)).toBe(1)
			expect(scheduler.timers.map((timer) => timer.ms)).toEqual([TOAST_MS, TOAST_MS])
		})

		// spec: LOUPE-002.12
		it('stops its timer while a pointer is pressed on it and restarts the full time on release', () => {
			const { scheduler, toast } = shown()

			toast.setPressed(true)
			expect(live(scheduler)).toBe(0)
			toast.setPressed(false)

			expect(live(scheduler)).toBe(1)
			scheduler.fire()
			expect(toast.current.value).toBeNull()
		})

		// spec: LOUPE-002.12
		it('stays held until both the focus and the press have ended', () => {
			const { scheduler, toast } = shown()

			toast.setFocused(true)
			toast.setPressed(true)
			toast.setPressed(false)
			expect(live(scheduler)).toBe(0)
			toast.setFocused(false)

			expect(live(scheduler)).toBe(1)
		})

		it('does not start a second timer when a hold ends twice', () => {
			const { scheduler, toast } = shown()

			toast.setFocused(false)
			toast.setPressed(false)

			expect(scheduler.timers).toHaveLength(1)
		})

		it('holds a replacing toast while the focus is still inside, and forgets the hold once hidden', () => {
			const { scheduler, toast } = shown()
			toast.setFocused(true)

			toast.show('second', { label: 'Undo', run: () => undefined })
			expect(live(scheduler)).toBe(0)
			toast.act()
			toast.setPressed(false)
			expect(live(scheduler)).toBe(0)

			toast.show('third')
			expect(live(scheduler)).toBe(1)
		})
	})
})
