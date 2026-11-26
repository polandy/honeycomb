// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { listingEntry, pictureOf } from '../logic/listing-entries.ts'
import { mountTile } from './tile-loads.ts'

const SINGLE = pictureOf(listingEntry(1, '/A/IMG_0001.JPG'))
const BADGES = { label: 'Video, 0:12, Stack of 3 photos', pills: [{ icon: 'play', text: '0:12' }, { icon: 'stack', text: '3' }] }

describe('PhotoTile pills', () => {
	// spec: IMMICH-002.37
	it('shows the source\'s pills at the top left in place of the pair badge, and their label', () => {
		const wrapper = mountTile(SINGLE, { badges: BADGES })

		const pills = wrapper.findAll('.photo-tile__pills .photo-tile__pill')
		expect(pills.map((pill) => pill.text())).toEqual(['0:12', '3'])
		expect(pills.every((pill) => pill.find('svg').exists())).toBe(true)
		expect(wrapper.find('.photo-tile__pair').exists()).toBe(false)
		expect(wrapper.attributes('aria-label')).toBe('IMG_0001, Video, 0:12, Stack of 3 photos')
	})

	// spec: IMMICH-002.37
	it('shows no pills box for a source picture without pills, but its label', () => {
		const wrapper = mountTile(SINGLE, { badges: { label: 'Photo', pills: [] } })

		expect(wrapper.find('.photo-tile__pills').exists()).toBe(false)
		expect(wrapper.find('.photo-tile__pair').exists()).toBe(false)
		expect(wrapper.attributes('aria-label')).toBe('IMG_0001, Photo')
	})

	it('keeps the pair badge and its label without the source\'s badges', () => {
		const wrapper = mountTile(SINGLE)

		expect(wrapper.find('.photo-tile__pills').exists()).toBe(false)
		expect(wrapper.find('.photo-tile__pair').text()).toBe('JPG only')
		expect(wrapper.attributes('aria-label')).toBe('IMG_0001, JPG only')
	})
})
