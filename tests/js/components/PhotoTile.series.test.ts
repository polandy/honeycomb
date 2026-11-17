// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import PhotoTile from '../../../src/components/PhotoTile.vue'
import { createLoadQueue } from '../../../src/logic/load-queue.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { listingEntry, pictureOf } from '../logic/listing-entries.ts'

const MARK = TRANSLATED_MARK
const PAIR = pictureOf(listingEntry(1, '/A/IMG_0001.JPG', { mtime: 7 }), listingEntry(2, '/A/IMG_0001.CR3'))

function mountTile(picture: Picture<ListingEntry>, props: Record<string, unknown> = {}) {
	const loads = createLoadQueue(() => new Promise<void>(() => {}), 10)
	return mount(PhotoTile, { props: { picture, size: 160, imageUrl: () => '/img', loads, devicePixelRatio: 2, ...props } })
}

describe('PhotoTile series badge', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SERIES-002.10
	it('shows the series badge with the series\' size on the first tile of a run, says the tile\'s place in its label, and none outside a series', () => {
		const wrapper = mountTile(PAIR, { series: { position: 1, size: 3, run: 3 } })
		const badge = wrapper.find('button.photo-tile__series')

		expect(badge.text()).toBe('⧉ 3')
		expect(badge.attributes('data-tip')!.replaceAll(MARK, '')).toBe('Compare this series')
		expect(badge.attributes('aria-label')!.replaceAll(MARK, '')).toBe('Series of 3 – compare')
		expect(badge.attributes('tabindex')).toBe('-1')
		expect(badge.classes()).not.toContain('photo-tile__series--settled')
		expect(wrapper.attributes('data-tip-hover-only')).toBeDefined()
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, Series, photo 1 of 3')
		expect(mountTile(PAIR).find('.photo-tile__series').exists()).toBe(false)
		expect(mountTile(PAIR).attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3')
	})

	// spec: SERIES-002.10
	it('counts the run against the series when the run holds only part of it, and shows no badge further into a run', () => {
		expect(mountTile(PAIR, { series: { position: 4, size: 5, run: 2 } }).find('.photo-tile__series').text().replaceAll(MARK, '')).toBe('⧉ 2 of 5')
		const inside = mountTile(PAIR, { series: { position: 2, size: 5, run: null } })

		expect(inside.find('.photo-tile__series').exists()).toBe(false)
		expect(inside.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, Series, photo 2 of 5')
	})

	// spec: SERIES-002.10
	it('fades the badge of a settled series', () => {
		expect(mountTile(PAIR, { series: { position: 1, size: 3, run: 3 }, seriesSettled: true }).find('.photo-tile__series').classes()).toContain('photo-tile__series--settled')
	})

	// spec: SERIES-002.13
	it('asks to compare the series on a badge tap without the tile seeing the tap', async () => {
		const wrapper = mountTile(PAIR, { series: { position: 1, size: 3, run: 3 } })
		const seen: string[] = []
		wrapper.element.addEventListener('click', () => seen.push('click'))
		wrapper.element.addEventListener('pointerdown', () => seen.push('pointerdown'))
		await wrapper.find('.photo-tile__series').trigger('pointerdown')
		await wrapper.find('.photo-tile__series').trigger('click')

		expect(wrapper.emitted('compareSeries')).toHaveLength(1)
		expect(seen).toEqual([])
	})

	// spec: SERIES-003.25
	it('outlines the badge of a series that may still change and says so in the label', () => {
		const wrapper = mountTile(PAIR, { series: { position: 1, size: 3, run: 3 }, seriesOpen: true })
		const badge = wrapper.find('.photo-tile__series')

		expect(badge.classes()).toContain('photo-tile__series--open')
		expect(wrapper.attributes('aria-label')!.replaceAll(MARK, '')).toBe('IMG_0001, JPG+CR3, Series, photo 1 of 3, Series may still change')
		expect(mountTile(PAIR, { series: { position: 1, size: 3, run: 3 } }).find('.photo-tile__series').classes()).not.toContain('photo-tile__series--open')
	})
})
