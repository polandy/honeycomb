// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StarRating from '../../../src/components/StarRating.vue'

describe('StarRating', () => {
	it('names the first button Clear and the others by their count', () => {
		const wrapper = mount(StarRating, { props: { rating: 0 } })
		const buttons = wrapper.findAll('button')

		expect(buttons.map((button) => button.text())).toEqual(['Clear', '1★', '2★', '3★', '4★', '5★'])
		expect(buttons.map((button) => button.attributes('aria-label'))).toEqual([
			'Clear rating: 0 stars',
			'Rate 1 star',
			'Rate 2 stars',
			'Rate 3 stars',
			'Rate 4 stars',
			'Rate 5 stars',
		])
	})

	it('clears with the first button and rates with a star', async () => {
		const wrapper = mount(StarRating, { props: { rating: 3 } })
		const buttons = wrapper.findAll('button')

		expect(buttons[0]!.attributes('aria-pressed')).toBe('false')
		expect(buttons[3]!.attributes('aria-pressed')).toBe('true')
		await buttons[0]!.trigger('click')
		await buttons[5]!.trigger('click')

		expect(wrapper.emitted('rate')).toEqual([[0], [5]])
	})
})
