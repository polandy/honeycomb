// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LoupeFilmstrip from '../../../src/components/LoupeFilmstrip.vue'
import LoupeInfo from '../../../src/components/LoupeInfo.vue'
import LoupeTitleRow from '../../../src/components/LoupeTitleRow.vue'
import PanelDivider from '../../../src/components/PanelDivider.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
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
		},
	})

	it('shows eight pictures on each side of the shown one, marked current, with small thumbnails and flags', () => {
		const wrapper = mountStrip(10)
		const buttons = wrapper.findAll('button')
		expect(buttons.map((button) => button.attributes('aria-label'))).toEqual(PICTURES.slice(2, 19).map((picture) => picture.baseName))
		expect(wrapper.find('[aria-current="true"]').attributes('aria-label')).toBe('IMG_11')
		expect(wrapper.find('[aria-current="true"] img').attributes('src')).toBe('/img/11/256')
		expect(wrapper.findAll('.loupe-filmstrip__flag')).toHaveLength(1)
	})

	it('clips the window at the first picture and selects a tapped one', async () => {
		const wrapper = mountStrip(0)
		const buttons = wrapper.findAll('button')
		expect(buttons).toHaveLength(9)
		await buttons[4]!.trigger('click')
		expect(wrapper.emitted('select')).toEqual([[4]])
	})
})

describe('LoupeTitleRow', () => {
	const mountRow = (zoom: number | null) => mount(LoupeTitleRow, {
		props: { name: 'IMG_7', index: 6, count: 120, zoom, infoOpen: false, filmstripOpen: true, navigationShown: false, flagButtonsShown: true },
	})
	const button = (wrapper: ReturnType<typeof mountRow>, label: string) => wrapper.find(`button[aria-label="${label}"]`)

	it('names the picture, its position and the zoom', () => {
		expect(mountRow(null).text()).toMatch(/IMG_7\s*7 of 120\s*Fit/)
		expect(button(mountRow(42), 'Toggle fit and 100 percent').text()).toBe('42 %')
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
