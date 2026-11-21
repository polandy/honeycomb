// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installMarkedCatalogue, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { listingEntry, pictureOf } from '../logic/listing-entries.ts'
import { fakeLoads, mountTile } from './tile-loads.ts'

const PAIR = pictureOf(listingEntry(1, '/A/IMG_0001.JPG', { mtime: 7 }), listingEntry(2, '/A/IMG_0001.CR3'))

describe('PhotoTile failed preview', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: GRID-001.23
	it('dims a tile whose small preview failed, with a broken-image glyph, its name and the failure in its label', async () => {
		const { loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })
		expect(wrapper.find('.photo-tile__failed').exists()).toBe(false)

		await settled('/img/1/256/7', 'reject')

		expect(wrapper.classes()).toContain('photo-tile--failed')
		expect(wrapper.find('.photo-tile__failed svg').exists()).toBe(true)
		expect(wrapper.find('.photo-tile__failed').text()).toBe('IMG_0001')
		expect(wrapper.attributes('aria-label')).toContain('Preview failed to load')
		expect(wrapper.emitted('imageFailed')).toEqual([[true]])
	})

	// spec: GRID-001.23
	it('loads the small preview again on a retry and shows it when it arrives', async () => {
		const { started, loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })
		await settled('/img/1/256/7', 'reject')

		await wrapper.setProps({ retry: 1 })
		expect(started).toEqual(['/img/1/256/7', '/img/1/256/7'])
		expect(wrapper.classes()).not.toContain('photo-tile--failed')
		expect(wrapper.classes()).toContain('skeleton-tile')
		await settled('/img/1/256/7')

		expect(wrapper.find('img').attributes('src')).toBe('/img/1/256/7')
		expect(wrapper.find('.photo-tile__failed').exists()).toBe(false)
		expect(wrapper.emitted('imageFailed')).toEqual([[true], [false]])
	})

	// spec: GRID-001.23
	it('reports that it no longer failed when it unmounts', async () => {
		const { loads, settled } = fakeLoads()
		const reports: boolean[] = []
		const wrapper = mountTile(PAIR, { loads, onImageFailed: (failed: boolean) => reports.push(failed) })
		await settled('/img/1/256/7', 'reject')

		wrapper.unmount()

		expect(reports).toEqual([true, false])
	})

	// spec: GRID-001.23
	it('ignores a retry while the preview shows or is on its way', async () => {
		const { started, loads, settled } = fakeLoads()
		const wrapper = mountTile(PAIR, { loads })

		await wrapper.setProps({ retry: 1 })
		await settled('/img/1/256/7')
		await wrapper.setProps({ retry: 2 })

		expect(started).toEqual(['/img/1/256/7', '/img/1/1024/7'])
	})
})
