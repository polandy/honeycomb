// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { NO_SELECTION } from '../../../src/logic/selection.ts'
import { mountGrid, picturesIn } from './mount-grid.ts'

type Grid = { reveal: (index: number) => Promise<void>, focusedIndex: () => number }

/** A grid of 100 pictures in the document, sized to show a few rows. */
async function mounted() {
	const pictures = picturesIn({ '/P': 100 })
	const { wrapper, resize } = mountGrid({ pictures, selection: NO_SELECTION, selecting: false }, true)
	await resize(432, 220)
	return { wrapper, pictures, grid: wrapper.vm as unknown as Grid, scroller: wrapper.find('.photo-grid__scroller').element }
}

const focusedName = () => document.activeElement?.getAttribute('aria-label')?.split(',')[0]

describe('PhotoGrid keeps the focus when pictures leave it', () => {
	// spec: IMMICH-003.25
	it('keeps the focused photo focused when one before it leaves', async () => {
		const { wrapper, pictures, grid, scroller } = await mounted()
		await grid.reveal(41)
		const top = scroller.scrollTop

		await wrapper.setProps({ pictures: pictures.filter((_, index) => index !== 40) })

		expect(grid.focusedIndex()).toBe(40)
		expect(focusedName()).toBe('IMG_41')
		expect(scroller.scrollTop).toBe(top)
		wrapper.unmount()
	})

	// spec: IMMICH-003.25
	it('focuses the photo that takes the place of the focused one that left', async () => {
		const { wrapper, pictures, grid } = await mounted()
		await grid.reveal(1)

		await wrapper.setProps({ pictures: pictures.filter((_, index) => index !== 1) })
		await wrapper.vm.$nextTick()

		expect(grid.focusedIndex()).toBe(1)
		expect(focusedName()).toBe('IMG_2')
		wrapper.unmount()
	})

	// spec: IMMICH-003.25
	it('moves the kept index without taking the focus while the grid does not have it', async () => {
		const { wrapper, pictures, grid } = await mounted()
		await grid.reveal(3)
		const outside = document.createElement('button')
		document.body.append(outside)
		outside.focus()

		await wrapper.setProps({ pictures: pictures.filter((_, index) => index !== 0) })
		await wrapper.vm.$nextTick()

		expect(grid.focusedIndex()).toBe(2)
		expect(document.activeElement).toBe(outside)
		outside.remove()
		wrapper.unmount()
	})
})
