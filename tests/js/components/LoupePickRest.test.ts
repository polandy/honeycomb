// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PickRestButton from '../../../src/components/PickRestButton.vue'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { mountLoupe, PICTURES } from './mount-loupe.ts'

enableAutoUnmount(afterEach)

const SERIES = PICTURES.slice(3, 6)
const SERIES_OF = new Map(SERIES.map((picture) => [picture, SERIES] as const))

/** The pick-rest requests the loupe emitted, as the series' names and the picked one's. */
function requests(wrapper: Awaited<ReturnType<typeof mountLoupe>>['wrapper']) {
	return (wrapper.emitted('pickRest') as [readonly Picture<ListingEntry>[], Picture<ListingEntry>][] | undefined)
		?.map(([series, picked]) => `${series.map((picture) => picture.baseName).join(' ')}: ${picked.baseName}`)
}

describe('PhotoLoupe: Pick this, reject the rest', () => {
	// spec: LOUPE-002.15
	it('ends the rating row with a secondary button named with Shift+K that asks to pick the shown photo of its series', async () => {
		const { wrapper } = await mountLoupe(4, {}, false, { seriesOf: SERIES_OF })
		const button = wrapper.findComponent(PickRestButton)

		expect(wrapper.find('.action-bar__row > :last-child').classes()).toContain('pick-rest-button')
		expect(button.props('secondary')).toBe(true)
		expect(button.attributes('data-tip-key')).toBe('Shift+K')
		await button.trigger('click')
		expect(requests(wrapper)).toEqual(['IMG_4 IMG_5 IMG_6: IMG_5'])
	})

	// spec: LOUPE-002.15
	it('asks the same by Shift+K', async () => {
		const { wrapper, root } = await mountLoupe(4, {}, false, { seriesOf: SERIES_OF })
		await root.trigger('keydown', { key: 'K', shiftKey: true })

		expect(requests(wrapper)).toEqual(['IMG_4 IMG_5 IMG_6: IMG_5'])
	})

	// spec: LOUPE-002.15
	it('keeps the button in the rating row while the flag buttons are hidden', async () => {
		const { wrapper } = await mountLoupe(4, {}, false, { seriesOf: SERIES_OF, settings: { ...DEFAULT_SETTINGS, flagButtonsShown: false } })

		expect(wrapper.find('.action-bar__flags').exists()).toBe(false)
		expect(wrapper.find('.action-bar__row .pick-rest-button').exists()).toBe(true)
	})

	// spec: LOUPE-002.15
	it('shows no button and asks nothing by Shift+K outside a series', async () => {
		const { wrapper, root } = await mountLoupe(0, {}, false, { seriesOf: SERIES_OF })
		await root.trigger('keydown', { key: 'K', shiftKey: true })

		expect(wrapper.findComponent(PickRestButton).exists()).toBe(false)
		expect(requests(wrapper)).toBeUndefined()
	})
})
