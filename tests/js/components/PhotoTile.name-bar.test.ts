// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PhotoTile from '../../../src/components/PhotoTile.vue'
import { createLoadQueue } from '../../../src/logic/load-queue.ts'
import { listingEntry, pictureOf } from '../logic/listing-entries.ts'

const PAIR = pictureOf(listingEntry(1, '/A/IMG_0001.JPG'), listingEntry(2, '/A/IMG_0001.CR3'))

function mountTile(picture: Picture<ListingEntry>, props: Record<string, unknown> = {}) {
	return mount(PhotoTile, { props: { picture, size: 160, loads: createLoadQueue(async () => undefined, 1), ...props } })
}

describe('PhotoTile name bar', () => {
	// spec: GRID-004.4, GRID-004.11
	it('shows the base name in a name bar above the photo only when asked, its label unchanged', async () => {
		const wrapper = mountTile(PAIR)
		expect(wrapper.find('.photo-tile__name').exists()).toBe(false)

		await wrapper.setProps({ nameBar: true })
		const bar = wrapper.find('.photo-tile__name')
		expect(bar.text()).toBe('IMG_0001')
		expect(bar.attributes('aria-hidden')).toBe('true')
		expect(wrapper.element.firstElementChild).toBe(bar.element)
		expect(bar.element.nextElementSibling!.classList).toContain('photo-tile__photo')
		expect(wrapper.attributes('aria-label')).toBe('IMG_0001, JPG+CR3')
	})

	// spec: GRID-004.5
	it('splits the name so the trailing number stays when the bar shortens it', () => {
		const wrapper = mountTile(pictureOf(listingEntry(3, '/A/2026-11-17 wedding_0042.JPG')), { nameBar: true })

		expect(wrapper.find('.photo-tile__name-head').text()).toBe('2026-11-17 wedding')
		expect(wrapper.find('.photo-tile__name-tail').text()).toBe('_0042')
	})
})
