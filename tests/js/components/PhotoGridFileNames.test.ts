// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { DOMWrapper } from '@vue/test-utils'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDateTimeSeconds } from '../../../src/l10n.ts'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { fakeScheduler } from '../fake-scheduler.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { mountGrid } from './mount-grid.ts'

const CAPTURED = Date.UTC(2026, 10, 10, 12, 3, 47) / 1000
const PAIR_AND_SINGLE = picturesOf([
	listingEntry(1, '/P/IMG_0001.JPG', { captureTime: CAPTURED, camera: 'Canon EOS R5' }),
	listingEntry(2, '/P/IMG_0001.CR3'),
	listingEntry(3, '/P/IMG_0002.JPG'),
])

/** The grid at 432 × 220 px, 4 columns of 102 px tiles, with a timer the test fires. */
async function mountShown(props: Record<string, unknown> = {}) {
	const scheduler = fakeScheduler()
	const grid = mountGrid({ schedule: scheduler.schedule, ...props }, true)
	await grid.resize(432, 220)
	const scroller = grid.wrapper.find<HTMLElement>('[role="grid"]')
	Object.defineProperty(scroller.element, 'scrollTop', { value: 0, writable: true, configurable: true })
	return { ...scheduler, ...grid, scroller }
}

const tile = (shown: Awaited<ReturnType<typeof mountShown>>, index: number) => shown.wrapper.findAll<HTMLElement>('[role="gridcell"]')[index]!
const bubble = () => document.querySelector<HTMLElement>('.tile-info')

/** Dispatches a pointer event on the element and lets Vue render. */
async function pointer(target: DOMWrapper<HTMLElement> | Element, type: string, init: PointerEventInit & { relatedTarget?: Element | null } = {}) {
	const element = target instanceof Element ? target : target.element
	element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', isPrimary: true, ...init }))
	await flushPromises()
}

/** Rests the mouse on the tile until its tile info shows. */
async function rest(shown: Awaited<ReturnType<typeof mountShown>>, index: number) {
	await pointer(tile(shown, index), 'pointerover')
	shown.fire()
	await flushPromises()
}

enableAutoUnmount(afterEach)
afterEach(() => vi.restoreAllMocks())

describe('PhotoGrid with file names', () => {
	// spec: GRID-004.4
	it('gives each tile a name bar and makes each row 24 px taller', async () => {
		const { wrapper, resize } = mountGrid({ fileNames: true })
		await resize(432, 220)

		expect(wrapper.find('.photo-grid__row').attributes('style')).toContain('height: 126px')
		expect(wrapper.find('.photo-grid__spacer').attributes('style')).toContain(`height: ${25 * 126 + 24 * 8}px`)
		expect(wrapper.findAll('.photo-tile__name').map((bar) => bar.text()).slice(0, 2)).toEqual(['IMG_0', 'IMG_1'])
	})

	// spec: GRID-004.6
	it('keeps the row at the top in its place when the names turn on, at once', async () => {
		const shown = await mountShown()
		shown.scroller.element.scrollTop = 110 * 10
		await shown.scroller.trigger('scroll')

		await shown.wrapper.setProps({ fileNames: true })

		expect(shown.scroller.element.scrollTop).toBe(134 * 10)
		await shown.wrapper.setProps({ fileNames: false })
		expect(shown.scroller.element.scrollTop).toBe(110 * 10)
	})

	// spec: GRID-004.6
	it('keeps the focused tile in its place while it is in view', async () => {
		const shown = await mountShown()
		shown.scroller.element.scrollTop = 110 * 10
		await shown.scroller.trigger('scroll')
		await shown.wrapper.find('[aria-label^="IMG_45,"]').trigger('focus')

		await shown.wrapper.setProps({ fileNames: true })

		expect(shown.scroller.element.scrollTop).toBe(134 * 11 - 110)
	})
})

describe('PhotoGrid tile info', () => {
	// spec: GRID-004.7, GRID-004.11
	it('shows after the mouse rests 700 ms on a tile, hidden from screen readers', async () => {
		const shown = await mountShown()
		await pointer(tile(shown, 0), 'pointerover')

		expect(shown.timers.map(({ ms }) => ms)).toEqual([700])
		expect(bubble()).toBeNull()
		shown.fire()
		await flushPromises()
		expect(bubble()!.getAttribute('aria-hidden')).toBe('true')
		expect(bubble()!.textContent).toContain('IMG_0')
	})

	// spec: GRID-004.7
	it('hides on the next tile and waits 700 ms anew', async () => {
		const shown = await mountShown()
		await rest(shown, 0)

		await pointer(tile(shown, 0), 'pointerout', { relatedTarget: tile(shown, 1).element })
		await pointer(tile(shown, 1), 'pointerover')

		expect(bubble()).toBeNull()
		shown.fire()
		await flushPromises()
		expect(bubble()!.textContent).toContain('IMG_1')
	})

	// spec: GRID-004.7, GRID-004.11
	it.each(['touch', 'pen'])('never shows for a %s, nor on keyboard focus', async (pointerType) => {
		const shown = await mountShown()
		await pointer(tile(shown, 0), 'pointerover', { pointerType })
		await tile(shown, 1).trigger('focus')

		shown.fire()
		await flushPromises()
		expect(bubble()).toBeNull()
	})

	// spec: GRID-004.7
	it('never shows on a control with its own tooltip', async () => {
		const shown = await mountShown()
		const series = { key: 1, members: shown.wrapper.props('pictures').slice(0, 2) }
		await shown.wrapper.setProps({ seriesOf: new Map(series.members.map((picture) => [picture, series])) })
		await pointer(tile(shown, 0).find<HTMLElement>('[data-tip]'), 'pointerover')

		shown.fire()
		await flushPromises()
		expect(bubble()).toBeNull()
	})

	// spec: GRID-004.8
	it.each([
		['the mouse leaves the tile', (shown: Awaited<ReturnType<typeof mountShown>>) => pointer(tile(shown, 0), 'pointerout', { relatedTarget: document.body })],
		['a press', (shown: Awaited<ReturnType<typeof mountShown>>) => pointer(tile(shown, 0), 'pointerdown')],
		['a scroll of the grid', (shown: Awaited<ReturnType<typeof mountShown>>) => shown.scroller.trigger('scroll')],
	])('hides on %s', async (_case, hide) => {
		const shown = await mountShown()
		await rest(shown, 0)

		await hide(shown)

		expect(bubble()).toBeNull()
	})

	// spec: GRID-004.8
	it('keeps a mouse move within the tile and drops a waiting tile info on leaving', async () => {
		const shown = await mountShown()
		await rest(shown, 0)
		await pointer(tile(shown, 0).find<HTMLElement>('.photo-tile__photo'), 'pointerout', { relatedTarget: tile(shown, 0).element })
		expect(bubble()).not.toBeNull()

		await pointer(tile(shown, 1), 'pointerover')
		await pointer(tile(shown, 1), 'pointerout', { relatedTarget: null })
		shown.fire()
		await flushPromises()
		expect(bubble()).toBeNull()
	})

	// spec: GRID-004.8
	it('hides on Esc, which then goes no further, and lets the next Esc through', async () => {
		const shown = await mountShown()
		const reached: string[] = []
		const record = (event: KeyboardEvent) => reached.push(event.key)
		window.addEventListener('keydown', record)
		await rest(shown, 0)

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
		await flushPromises()
		expect(bubble()).toBeNull()
		expect(reached).toEqual([])
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
		expect(reached).toEqual(['Escape'])
		window.removeEventListener('keydown', record)
	})

	// spec: GRID-004.9
	it('names the members and says the capture time with seconds, the camera and the rating', async () => {
		const shown = await mountShown({ pictures: PAIR_AND_SINGLE, decisionOf: () => ({ ...UNDECIDED, rating: 3 }) })
		await rest(shown, 0)

		const text = bubble()!.textContent!
		expect(text).toContain('IMG_0001')
		expect(text).toContain('JPG + CR3')
		expect(text).toContain(formatDateTimeSeconds(CAPTURED))
		expect(text).toContain('Canon EOS R5')
		expect(text).toContain('★★★☆☆')
	})

	// spec: GRID-004.9
	it('leaves out the capture time and camera a picture lacks', async () => {
		const shown = await mountShown({ pictures: PAIR_AND_SINGLE })
		await rest(shown, 1)

		const text = bubble()!.textContent!
		expect(text).toContain('JPG only')
		expect(text).not.toContain('Captured')
		expect(text).not.toContain('Camera')
		expect(text).toContain('☆☆☆☆☆')
	})

	// spec: GRID-004.10
	it('sits above a tile at the window\'s bottom edge, 8 px from it', async () => {
		const shown = await mountShown()
		vi.spyOn(tile(shown, 0).element, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, window.innerHeight - 110, 102, 102))
		await rest(shown, 0)

		expect(bubble()!.dataset.side).toBe('top')
		expect(bubble()!.style.top).toBe(`${window.innerHeight - 120}px`)
	})
})
