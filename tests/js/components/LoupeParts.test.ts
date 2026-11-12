// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import NcButton from '@nextcloud/vue/components/NcButton'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import LoupeFilmstrip from '../../../src/components/LoupeFilmstrip.vue'
import LoupeInfo from '../../../src/components/LoupeInfo.vue'
import LoupeTitleRow from '../../../src/components/LoupeTitleRow.vue'
import PanelDivider from '../../../src/components/PanelDivider.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { FILMSTRIP_OVERSCAN, FILMSTRIP_THUMB } from '../../../src/logic/filmstrip.ts'
import { INFO_PANEL } from '../../../src/logic/panel-width.ts'
import { listingEntry, pictureOf, picturesOf } from '../logic/listing-entries.ts'
import { pointer } from './loupe-pointer.ts'

const SET = { paths: ['/P'], subfolders: true }

/** The definition list under the info panel's headings, as term → value. */
function infoRows(wrapper: ReturnType<typeof mount>) {
	const terms = wrapper.findAll('dt').map((term) => term.text())
	const values = wrapper.findAll('dd').map((value) => value.text())
	return Object.fromEntries(terms.map((term, at) => [term, values[at]]))
}

describe('PanelDivider', () => {
	const mountDivider = () => mount(PanelDivider, { props: { width: 300, limits: INFO_PANEL, label: 'Resize' } })

	it('is a labelled vertical separator with its width and limits', () => {
		const divider = mountDivider().find('[role="separator"]')
		expect(divider.attributes()).toMatchObject({ 'aria-label': 'Resize', 'aria-orientation': 'vertical', 'aria-valuenow': '300', 'aria-valuemin': '220', 'aria-valuemax': '480' })
	})

	// spec: LOUPE-001.13
	it('widens the panel while dragged left and stops at the pointer up', async () => {
		const wrapper = mountDivider()
		const divider = wrapper.find('[role="separator"]')
		await pointer(divider, 'pointerdown', { id: 1, x: 500, time: 0 })
		await pointer(divider, 'pointermove', { id: 2, x: 400, time: 0 })
		await pointer(divider, 'pointermove', { id: 1, x: 450, time: 0 })
		await pointer(divider, 'pointerup', { id: 1, x: 450, time: 0 })
		await pointer(divider, 'pointermove', { id: 1, x: 300, time: 0 })
		expect(wrapper.emitted('update:width')).toEqual([[350]])
	})

	// spec: LOUPE-001.13
	it('resizes by keys and leaves other keys alone', async () => {
		const wrapper = mountDivider()
		const divider = wrapper.find('[role="separator"]')
		await divider.trigger('keydown', { key: 'End' })
		await divider.trigger('keydown', { key: 'a' })
		expect(wrapper.emitted('update:width')).toEqual([[480]])
	})
})

describe('LoupeInfo', () => {
	const mountInfo = (picture: Picture<ListingEntry>, decision: Decision = UNDECIDED) => mount(LoupeInfo, {
		props: { picture, folderSet: SET, decision, preloaded: 2, neighbours: 5 },
	})

	// spec: LOUPE-001.13
	it('lists a pair\'s file facts, its decision and the preloading state', () => {
		const picture = pictureOf(
			listingEntry(1, '/P/Trip/IMG_1.JPG', { size: 4 * 1024 ** 2, width: 6000, height: 4000, captureTime: 1_700_000_000 }),
			listingEntry(2, '/P/Trip/IMG_1.CR3', { size: 25 * 1024 ** 2, mime: 'image/x-canon-cr3' }),
			listingEntry(3, '/P/Trip/IMG_1.xmp', { mime: 'application/octet-stream' }),
		)
		const wrapper = mountInfo(picture, { rating: 3, colourLabel: 'red', flag: 'picked', keepRaw: true })
		expect(infoRows(wrapper)).toMatchObject({
			Name: 'IMG_1',
			Folder: 'Trip',
			Size: '6,000 × 4,000',
			JPG: '4 MB',
			CR3: '25 MB',
			Sidecar: 'XMP',
			Rating: '3 stars',
			'Colour label': 'Red',
			Flag: 'Picked',
			'Keep RAW': 'yes',
		})
		expect(infoRows(wrapper).Captured).toBeTruthy()
		expect(wrapper.text()).toContain('2 of 5 neighbours loaded')
	})

	it('shows a lone RAW without unknown facts or the keep RAW row', () => {
		const wrapper = mountInfo(pictureOf(listingEntry(2, '/P/IMG_2.CR3', { mime: 'image/x-canon-cr3' })), { ...UNDECIDED, flag: 'rejected' })
		const rows = infoRows(wrapper)
		expect(rows).toMatchObject({ Sidecar: 'none', Rating: 'none', 'Colour label': 'none', Flag: 'Rejected' })
		expect(Object.keys(rows)).not.toContain('Captured')
		expect(Object.keys(rows)).not.toContain('Size')
		expect(Object.keys(rows)).not.toContain('Keep RAW')
		expect(Object.keys(rows)).not.toContain('JPG')
	})

	it('names an unflagged and unkept pair so', () => {
		const picture = pictureOf(listingEntry(1, '/P/IMG_1.JPG'), listingEntry(2, '/P/IMG_1.CR3', { mime: 'image/x-canon-cr3' }))
		expect(infoRows(mountInfo(picture))).toMatchObject({ Flag: 'Unflagged', 'Keep RAW': 'no' })
	})
})

describe('LoupeFilmstrip', () => {
	const PICTURES = picturesOf(Array.from({ length: 30 }, (_, at) => listingEntry(at + 1, `/P/IMG_${String(at + 1).padStart(2, '0')}.JPG`)))
	const mountStrip = (index: number) => mount(LoupeFilmstrip, {
		props: {
			pictures: PICTURES,
			index,
			decisionOf: (picture: Picture<ListingEntry>) => ({ ...UNDECIDED, flag: picture.baseName === 'IMG_11' ? 'picked' as const : 'unflagged' as const }),
			imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
			observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
				onSize(1000, FILMSTRIP_THUMB)
				return () => undefined
			},
		},
	})
	const labels = (wrapper: ReturnType<typeof mountStrip>) => wrapper.findAll('button').map((button) => button.attributes('aria-label'))
	const strip = (wrapper: ReturnType<typeof mountStrip>) => wrapper.find('.loupe-filmstrip').element as HTMLElement

	// spec: LOUPE-001.13, LOUPE-001.19
	it('scrolls the shown picture to the middle and renders the ones in view, marked current, with small thumbnails and flags', async () => {
		const wrapper = mountStrip(15)
		await nextTick()
		expect(strip(wrapper).scrollLeft).toBe(15 * FILMSTRIP_THUMB)
		expect(labels(wrapper)).toEqual(PICTURES.slice(6 - FILMSTRIP_OVERSCAN, 25 + FILMSTRIP_OVERSCAN).map((picture) => picture.baseName))
		expect(wrapper.find('[aria-current="true"]').attributes('aria-label')).toBe('IMG_16')
		expect(wrapper.find('[aria-current="true"] img').attributes('src')).toBe('/img/16/256')
		expect(wrapper.findAll('.loupe-filmstrip__flag')).toHaveLength(1)
	})

	// spec: LOUPE-001.19
	it('places each picture by its index, edge to edge, after half the strip', async () => {
		const wrapper = mountStrip(0)
		await nextTick()
		const left = (label: string) => wrapper.find(`button[aria-label="${label}"]`).attributes('style')
		expect(left('IMG_01')).toContain(`left: ${500 - FILMSTRIP_THUMB / 2}px`)
		expect(left('IMG_02')).toContain(`left: ${500 + FILMSTRIP_THUMB / 2}px`)
	})

	// spec: LOUPE-001.19
	it('follows the shown picture and a scroll by the user', async () => {
		const wrapper = mountStrip(0)
		await nextTick()
		expect(labels(wrapper)).toHaveLength(10 + FILMSTRIP_OVERSCAN)

		await wrapper.setProps({ index: 29 })
		expect(strip(wrapper).scrollLeft).toBe(29 * FILMSTRIP_THUMB)
		expect(labels(wrapper).at(-1)).toBe('IMG_30')

		strip(wrapper).scrollLeft = 0
		await wrapper.find('.loupe-filmstrip').trigger('scroll')
		expect(labels(wrapper)[0]).toBe('IMG_01')
	})

	it('selects a tapped picture', async () => {
		const wrapper = mountStrip(0)
		await nextTick()
		await wrapper.find('button[aria-label="IMG_05"]').trigger('click')
		expect(wrapper.emitted('select')).toEqual([[4]])
	})
})

describe('LoupeTitleRow', () => {
	const mountRow = (zoom: number | null) => mount(LoupeTitleRow, {
		props: { name: 'IMG_7', index: 6, count: 120, zoom, infoOpen: false, filmstripOpen: true, navigationShown: false, flagButtonsShown: true },
	})
	const button = (wrapper: ReturnType<typeof mountRow>, label: string) => wrapper.find(`button[aria-label="${label}"]`)

	it('names the picture, its position and the zoom', () => {
		expect(mountRow(null).text()).toMatch(/IMG_7\s*7 of 120/)
	})

	// spec: LOUPE-001.13
	it('draws the zoom, move, info and fullscreen buttons as icons without a word', () => {
		const wrapper = mountRow(42)
		for (const label of ['Toggle fit and 100 percent', 'Move this photo', 'Toggle info panel', 'Enter fullscreen']) {
			const each = button(wrapper, label)
			expect(each.text(), label).toBe('')
			expect(each.find('svg.app-icon').exists(), label).toBe(true)
			const nc = wrapper.findAllComponents(NcButton).find((c) => c.attributes('aria-label') === label)
			expect(nc?.props('variant'), label).toBe('tertiary')
		}
	})

	it('shows the zoom button pressed while zoomed in', () => {
		expect(button(mountRow(null), 'Toggle fit and 100 percent').attributes('aria-pressed')).toBe('false')
		expect(button(mountRow(42), 'Toggle fit and 100 percent').attributes('aria-pressed')).toBe('true')
	})

	it('emits close, the zoom toggle and the panel toggles', async () => {
		const wrapper = mountRow(null)
		await button(wrapper, 'Close loupe').trigger('click')
		await button(wrapper, 'Toggle fit and 100 percent').trigger('click')
		await button(wrapper, 'Toggle info panel').trigger('click')
		await button(wrapper, 'Toggle filmstrip').trigger('click')
		await button(wrapper, 'Toggle Nextcloud navigation').trigger('click')
		await button(wrapper, 'Flag buttons').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(1)
		expect(wrapper.emitted('toggleZoom')).toHaveLength(1)
		expect(wrapper.emitted('update:infoOpen')).toEqual([[true]])
		expect(wrapper.emitted('update:filmstripOpen')).toEqual([[false]])
		expect(wrapper.emitted('update:navigationShown')).toEqual([[true]])
		expect(wrapper.emitted('update:flagButtonsShown')).toEqual([[false]])
	})
})
