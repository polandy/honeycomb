// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NO_SELECTION } from '../../../src/logic/selection.ts'
import { fakeScheduler } from '../fake-scheduler.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { mountGrid, picturesIn } from './mount-grid.ts'

async function scrollTo(wrapper: ReturnType<typeof mountGrid>['wrapper'], top: number) {
	const scroller = wrapper.find('[role="grid"]')
	Object.defineProperty(scroller.element, 'scrollTop', { value: top, configurable: true })
	await scroller.trigger('scroll')
}

const tileNames = (wrapper: ReturnType<typeof mountGrid>['wrapper']) => wrapper.findAll('[role="gridcell"]').map((tile) => tile.attributes('aria-label')!.split(',')[0])

describe('PhotoGrid', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	it('renders only the rows of the viewport and one viewport around it', async () => {
		const { wrapper, resize } = mountGrid()

		// 432 px fit 4 columns of 102 px tiles with 8 px gaps; 220 px show 2 rows, overscan adds 2 below.
		await resize(432, 220)

		expect(wrapper.findAll('[role="gridcell"]')).toHaveLength(16)
		expect(wrapper.find('.photo-grid__spacer').attributes('style')).toContain(`height: ${25 * 102 + 24 * 8}px`)
	})

	it('renders the rows the scroll position reaches', async () => {
		const { wrapper, resize } = mountGrid()
		await resize(432, 220)

		await scrollTo(wrapper, 110 * 10)

		expect(tileNames(wrapper)[0]).toBe('IMG_32')
		expect(tileNames(wrapper)).toContain('IMG_40')
		expect(tileNames(wrapper)).not.toContain('IMG_0')
	})

	it('starts at the top again when the pictures of another cull arrive', async () => {
		const { wrapper, resize } = mountGrid()
		await resize(432, 220)
		const scroller = wrapper.find('[role="grid"]').element
		Object.defineProperty(scroller, 'scrollTop', { value: 110 * 10, writable: true, configurable: true })
		await wrapper.find('[role="grid"]').trigger('scroll')
		expect(tileNames(wrapper)).not.toContain('IMG_0')

		await wrapper.setProps({ pictures: picturesIn({ '/Q': 100 }) })

		expect(scroller.scrollTop).toBe(0)
		expect(tileNames(wrapper)[0]).toBe('IMG_0')
	})

	it('places each tile at its row and column', async () => {
		const { wrapper, resize } = mountGrid()
		await resize(432, 220)

		const second = wrapper.findAll('[role="row"]')[1]!
		expect(second.attributes('style')).toContain('top: 110px')
		expect(second.findAll('[role="gridcell"]')[1]!.attributes('style')).toContain('left: 110px')
	})

	it('stops observing its size when it unmounts', () => {
		const { wrapper, stopped } = mountGrid()

		wrapper.unmount()

		expect(stopped()).toBe(true)
	})

	it('heads each folder with its name relative to the picked folder and its count', async () => {
		const { wrapper, resize } = mountGrid({ pictures: picturesIn({ '/P/A': 2, '/P/B/C': 3 }), groupByFolder: true })
		await resize(432, 600)

		const headers = wrapper.findAll('.photo-grid__header')
		expect(headers.map((header) => header.text())).toEqual(['A 2', 'B/C 3'])
		expect(wrapper.find('.photo-grid__sticky').text()).toBe('A')
	})

	it('sticks the header of the folder at the top of the viewport', async () => {
		const { wrapper, resize } = mountGrid({ pictures: picturesIn({ '/P/A': 40, '/P/B': 40 }), groupByFolder: true })
		await resize(432, 220)

		await scrollTo(wrapper, 48 + 10 * 110 + 20)

		expect(wrapper.find('.photo-grid__sticky').text()).toBe('B')
	})

	it('shows no folder headers unless grouped by folder', async () => {
		const { wrapper, resize } = mountGrid({ pictures: picturesIn({ '/P/A': 2, '/P/B': 3 }) })
		await resize(432, 600)

		expect(wrapper.findAll('[role="gridcell"]')).toHaveLength(5)
		expect(wrapper.find('.photo-grid__header').exists()).toBe(false)
		expect(wrapper.find('.photo-grid__sticky').exists()).toBe(false)
	})

	it('zooms the tiles with Ctrl and the wheel, and leaves a plain wheel to scrolling', async () => {
		const { wrapper } = mountGrid()
		const scroller = wrapper.find('[role="grid"]').element

		const wheel = (ctrlKey: boolean) => {
			const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true })
			// happy-dom's WheelEvent drops the modifier keys of its init.
			Object.defineProperty(event, 'ctrlKey', { value: ctrlKey })
			scroller.dispatchEvent(event)
			return event
		}
		const plain = wheel(false)
		const zoom = wheel(true)

		expect(wrapper.emitted('update:tileSize')).toEqual([[100 * Math.exp(1)]])
		expect(plain.defaultPrevented).toBe(false)
		expect(zoom.defaultPrevented).toBe(true)
	})

	it('zooms the tiles with a two-finger pinch', async () => {
		const { wrapper } = mountGrid()
		const scroller = wrapper.find('[role="grid"]').element
		const touch = (type: string, ...xs: number[]) => {
			const event = new Event(type, { cancelable: true })
			Object.defineProperty(event, 'touches', { value: xs.map((clientX) => ({ clientX, clientY: 0 })) })
			scroller.dispatchEvent(event)
			return event
		}

		touch('touchstart', 0, 100)
		const pinch = touch('touchmove', 0, 150)
		touch('touchend', 0)
		touch('touchmove', 0, 300)

		expect(pinch.defaultPrevented).toBe(true)
		expect(wrapper.emitted('update:tileSize')).toEqual([[150]])
	})

	it('lets the first tile take the focus by Tab and the focused one keep it', async () => {
		const { wrapper, resize } = mountGrid()
		await resize(432, 220)
		const tiles = wrapper.findAll('[role="gridcell"]')
		expect(tiles.map((tile) => tile.attributes('tabindex')).filter((index) => index === '0')).toHaveLength(1)
		expect(tiles[0]!.attributes('tabindex')).toBe('0')

		await tiles[2]!.trigger('focus')

		expect(wrapper.findAll('[role="gridcell"]')[2]!.attributes('tabindex')).toBe('0')
		expect(wrapper.findAll('[role="gridcell"]')[0]!.attributes('tabindex')).toBe('-1')
	})

	it('renders no text that bypasses the catalogue but folder and file names', async () => {
		const { wrapper, resize } = mountGrid({ pictures: picturesIn({ '/P/A': 1, '/P/B': 1 }), groupByFolder: true })
		await resize(432, 600)

		expect(wrapper.find('[role="grid"]').attributes('aria-label')).toBe(`${TRANSLATED_MARK}Photos`)
		expect(untranslatedText(wrapper.element as Element)).toEqual(['A', 'A', 'IMG_0, JPG+', 'B', 'IMG_0, JPG+'].map((text) => text.replace(', JPG+', `, ${TRANSLATED_MARK}JPG only`)))
	})
	describe('selection', () => {
		const tile = (wrapper: ReturnType<typeof mountGrid>['wrapper'], index: number) => wrapper.findAll('[role="gridcell"]')[index]!

		it('opens the loupe on a plain click, Enter or Space outside selection mode', async () => {
			const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: false })
			await resize(432, 220)

			await tile(wrapper, 1).trigger('click')
			await tile(wrapper, 2).trigger('keydown', { key: 'Enter' })
			await tile(wrapper, 3).trigger('keydown', { key: ' ' })
			await tile(wrapper, 3).trigger('keydown', { key: 'a' })

			expect(wrapper.emitted('update:selection')).toBeUndefined()
			expect(wrapper.emitted('open')).toEqual([[1], [2], [3]])
		})

		it('focuses a tile on reveal, scrolled into view only when it is out of view', async () => {
			const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: false }, true)
			await resize(432, 220)
			const { reveal } = wrapper.vm as unknown as { reveal: (index: number) => Promise<void> }
			const scroller = wrapper.find('.photo-grid__scroller').element

			await reveal(1)
			expect(scroller.scrollTop).toBe(0)
			await reveal(41)

			const focused = document.activeElement as HTMLElement
			expect(focused.getAttribute('aria-label')).toMatch(/^IMG_41,/)
			expect(focused.getAttribute('tabindex')).toBe('0')
			expect(scroller.scrollTop).toBeGreaterThan(0)
			wrapper.unmount()
		})

		it('moves the focus a step by the keys\' moves, keeping the column across rows, and reports it', async () => {
			const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: false }, true)
			await resize(432, 220)
			const grid = wrapper.vm as unknown as { step: (move: string) => Promise<void>, focusedIndex: () => number }
			expect(grid.focusedIndex()).toBe(0)

			await grid.step('previous')
			expect(grid.focusedIndex()).toBe(0)
			await grid.step('down')
			await grid.step('next')
			expect(grid.focusedIndex()).toBe(5)
			await grid.step('last')

			expect(grid.focusedIndex()).toBe(99)
			expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toMatch(/^IMG_99,/)
			await grid.step('up')
			expect(grid.focusedIndex()).toBe(95)
			wrapper.unmount()
		})

		it('toggles a tile on click, by Enter or Space in selection mode', async () => {
			const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: true })
			await resize(432, 220)

			await tile(wrapper, 1).trigger('click')
			await tile(wrapper, 2).trigger('keydown', { key: 'Enter' })
			await tile(wrapper, 3).trigger('keydown', { key: ' ' })

			const ids = (wrapper.emitted('update:selection') as [{ ids: Set<number> }][]).map(([selection]) => [...selection.ids])
			expect(ids).toEqual([[2], [3], [4]])
			expect(wrapper.emitted('update:selecting')).toBeUndefined()
		})

		it('enters selection mode with Ctrl-click and ranges with Shift-click', async () => {
			const { wrapper, resize } = mountGrid({ selection: { ids: new Set([1]), anchor: 1 }, selecting: false })
			await resize(432, 220)

			await tile(wrapper, 3).trigger('click', { shiftKey: true })

			expect(wrapper.emitted('update:selecting')).toEqual([[true]])
			expect(wrapper.emitted('update:selection')).toEqual([[{ ids: new Set([1, 2, 3, 4]), anchor: 1 }]])
		})

		it('marks the selected tiles and shows each decision', async () => {
			const decisionOf = (picture: { baseName: string }) => ({ rating: picture.baseName === 'IMG_1' ? 2 : 0, colourLabel: null, flag: 'unflagged' as const, keepRaw: false })
			const { wrapper, resize } = mountGrid({ selection: { ids: new Set([2]), anchor: 2 }, selecting: true, decisionOf })
			await resize(432, 220)

			expect(tile(wrapper, 1).attributes('aria-selected')).toBe('true')
			expect(tile(wrapper, 0).attributes('aria-selected')).toBe('false')
			expect(tile(wrapper, 1).find('.photo-tile__stars').text()).toBe('★★')
		})

		it('selects a tile on a long-press and swallows the click that follows', async () => {
			const { schedule, fire } = fakeScheduler()
			const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: false, schedule })
			await resize(432, 220)

			await tile(wrapper, 2).trigger('pointerdown', { button: 0, clientX: 10, clientY: 10 })
			fire()
			await tile(wrapper, 2).trigger('pointerup')
			await tile(wrapper, 2).trigger('click')

			expect(wrapper.emitted('update:selecting')).toEqual([[true]])
			expect(wrapper.emitted('update:selection')).toEqual([[{ ids: new Set([3]), anchor: 3 }]])
		})

		it.each([
			['lifting the finger', 'pointerup', {}],
			['moving more than 10 px', 'pointermove', { clientX: 30, clientY: 10 }],
			['the browser taking the pointer', 'pointercancel', {}],
		])('cancels the long-press on %s', async (_, event, fields) => {
			const { schedule, fire } = fakeScheduler()
			const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: false, schedule })
			await resize(432, 220)

			await tile(wrapper, 2).trigger('pointerdown', { button: 0, clientX: 10, clientY: 10 })
			await tile(wrapper, 2).trigger(event, fields)
			fire()

			expect(wrapper.emitted('update:selection')).toBeUndefined()
		})

		it('ignores a secondary button and the context menu', async () => {
			const { schedule, fire } = fakeScheduler()
			const { wrapper, resize } = mountGrid({ selection: NO_SELECTION, selecting: false, schedule })
			await resize(432, 220)

			await tile(wrapper, 2).trigger('pointerdown', { button: 2 })
			fire()
			const menu = new Event('contextmenu', { cancelable: true })
			wrapper.find('[role="grid"]').element.dispatchEvent(menu)

			expect(wrapper.emitted('update:selection')).toBeUndefined()
			expect(menu.defaultPrevented).toBe(true)
		})
	})
})
