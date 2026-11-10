// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GestureGuide from '../../../src/components/GestureGuide.vue'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

enableAutoUnmount(afterEach)

describe('GestureGuide', () => {
	it('lists the paging gestures, the tap zones with their sketch, pinch, double-tap and the keys', () => {
		const wrapper = mount(GestureGuide)

		expect(wrapper.find('[role="dialog"]').attributes('aria-label')).toBe('How to cull')
		expect(wrapper.findAll('li').map((line) => line.text())).toEqual([
			'Swipe sideways for the next or previous photo',
			'Tap the left or right side for the previous or next photo, the middle for the controls Controls',
			'Pinch to zoom, double-tap to hide the controls',
			'Keys: ← → Previous or next photo Z Zoom Esc Close',
		])
		const sketch = wrapper.find('.gesture-guide__zones')
		expect(sketch.attributes('aria-hidden')).toBe('true')
		expect(sketch.findAll('span').map((zone) => zone.text())).toEqual(['', 'Controls', ''])
		expect(wrapper.findAll('kbd').map((key) => key.text())).toEqual(['←', '→', 'Z', 'Esc'])
	})

	it('focuses Got it and is dismissed by it', async () => {
		const wrapper = mount(GestureGuide, { attachTo: document.body })
		const gotIt = wrapper.find('button')
		expect(gotIt.text()).toBe('Got it')
		expect(document.activeElement).toBe(gotIt.element)

		await gotIt.trigger('click')

		expect(wrapper.emitted('dismiss')).toHaveLength(1)
	})

	describe('with the marked catalogue', () => {
		beforeEach(installMarkedCatalogue)
		afterEach(uninstallMarkedCatalogue)

		it('renders no text that bypasses the catalogue', () => {
			const wrapper = shallowMount(GestureGuide, { global: { renderStubDefaultSlot: true } })

			expect(untranslatedText(wrapper.element as Element)).toEqual([])
		})
	})
})
