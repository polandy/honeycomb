// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeScheduler } from '../fake-scheduler.ts'
import { mountGrid } from './mount-grid.ts'

/** The grid at 432 × 220 px with touch and the name bar on, and a timer the test fires. */
async function mountTouch(props: Record<string, unknown> = {}) {
	const scheduler = fakeScheduler()
	const grid = mountGrid({ schedule: scheduler.schedule, touch: true, fileNames: true, ...props }, true)
	await grid.resize(432, 220)
	return { ...scheduler, ...grid }
}

type Touch = Awaited<ReturnType<typeof mountTouch>>
const tile = (touch: Touch, index: number) => touch.wrapper.findAll<HTMLElement>('[role="gridcell"]')[index]!
const infoButton = (touch: Touch, index: number) => tile(touch, index).find<HTMLElement>('button[aria-label="Tile info"]')
const bubble = () => document.querySelector<HTMLElement>('.tile-info')

/** Dispatches a touch pointer event and lets Vue render. */
async function touchEvent(target: Element, type: string) {
	target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true }))
	await flushPromises()
}

/** A tap: press, lift and the click after it. */
async function tap(target: Element) {
	await touchEvent(target, 'pointerdown')
	await touchEvent(target, 'pointerup')
	target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
	await flushPromises()
}

enableAutoUnmount(afterEach)

describe('PhotoGrid tile info button', () => {
	// spec: GRID-004.12
	it('puts an ⓘ button on each tile at its name bar on touch', async () => {
		const touch = await mountTouch()

		expect(infoButton(touch, 0).exists()).toBe(true)
		expect(tile(touch, 0).find('.photo-tile__name--info').exists()).toBe(true)
		expect(touch.wrapper.findAll('button[aria-label="Tile info"]').length).toBe(touch.wrapper.findAll('[role="gridcell"]').length)
	})

	// spec: GRID-004.12
	it.each([
		['a fine pointer', { touch: false }],
		['no name bar', { fileNames: false }],
	])('has no button with %s', async (_case, props) => {
		const touch = await mountTouch(props)

		expect(touch.wrapper.find('button[aria-label="Tile info"]').exists()).toBe(false)
	})

	// spec: GRID-004.12
	it('opens the tile info of the tile on a tap, without selecting or opening it', async () => {
		const touch = await mountTouch()
		await tap(infoButton(touch, 1).element)

		expect(bubble()!.textContent).toContain('IMG_1')
		expect(touch.timers).toEqual([])
		expect(touch.wrapper.emitted('update:selecting')).toBeUndefined()
		expect(touch.wrapper.emitted('update:selection')).toBeUndefined()
		expect(touch.wrapper.emitted('open')).toBeUndefined()
	})

	// spec: GRID-004.12
	it('opens it in selection mode without toggling the selection', async () => {
		const touch = await mountTouch({ selecting: true })
		await tap(infoButton(touch, 0).element)

		expect(bubble()).not.toBeNull()
		expect(touch.wrapper.emitted('update:selection')).toBeUndefined()
	})

	// spec: GRID-004.12
	it('closes on a second tap on the button, and moves to another tile on its button', async () => {
		const touch = await mountTouch()
		await tap(infoButton(touch, 0).element)
		await tap(infoButton(touch, 1).element)
		expect(document.querySelectorAll('.tile-info').length).toBe(1)
		expect(bubble()!.textContent).toContain('IMG_1')

		await tap(infoButton(touch, 1).element)

		expect(bubble()).toBeNull()
	})

	// spec: GRID-004.12
	it.each([
		['a tap elsewhere in the grid', async (touch: Touch) => tap(tile(touch, 2).element)],
		['a tap outside the grid', async () => touchEvent(document.body, 'pointerdown')],
		['a scroll of the grid', async (touch: Touch) => touch.wrapper.find('[role="grid"]').trigger('scroll')],
		['Esc', async () => {
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
			await flushPromises()
		}],
	])('closes on %s', async (_case, close) => {
		const touch = await mountTouch()
		await tap(infoButton(touch, 0).element)
		expect(bubble()).not.toBeNull()

		await close(touch)

		expect(bubble()).toBeNull()
	})

	// spec: GRID-004.12
	it('leaves a long-press elsewhere on the tile as selection', async () => {
		const touch = await mountTouch()
		await touchEvent(tile(touch, 0).find('.photo-tile__photo').element, 'pointerdown')

		expect(touch.timers.length).toBe(1)
	})
})
