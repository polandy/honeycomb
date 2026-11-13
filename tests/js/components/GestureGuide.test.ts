// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GestureGuide from '../../../src/components/GestureGuide.vue'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

enableAutoUnmount(afterEach)

describe('GestureGuide', () => {
	// spec: LOUPE-001.15
	it('lists the decision swipes, the paging gestures, the tap zones with their sketch, pinch, double-tap and the keys', () => {
		const wrapper = mount(GestureGuide, { props: { finePointer: false } })

		expect(wrapper.find('[role="dialog"]').attributes('aria-label')).toBe('How to cull')
		expect(wrapper.findAll('.gesture-guide__gestures li').map((line) => line.text())).toEqual([
			'Swipe up to pick',
			'Swipe down to reject',
			'Swipe sideways for the next or previous photo',
			'Tap the left or right side for the previous or next photo, the middle for the controls Controls',
			'Pinch to zoom, double-tap to hide the controls',
		])
		const keys = wrapper.findAll('.gesture-guide__keys li')
		expect(keys.map((key) => [key.find('kbd').text(), key.find('span').text()])).toEqual([
			['P', 'Pick'],
			['X', 'Reject'],
			['U', 'Unflag'],
			['Z', 'Zoom'],
			['?', 'All keys'],
		])
		const sketch = wrapper.find('.gesture-guide__zones')
		expect(sketch.attributes('aria-hidden')).toBe('true')
		expect(sketch.findAll('span').map((zone) => zone.text())).toEqual(['', 'Controls', ''])
	})

	// spec: LOUPE-001.24
	it.each([
		[true, ['Keys', 'Gestures']],
		[false, ['Gestures', 'Keys']],
	])('with a fine pointer %s puts its sections in the order %o', (finePointer, headings) => {
		const wrapper = mount(GestureGuide, { props: { finePointer } })

		expect(wrapper.findAll('h4').map((heading) => heading.text())).toEqual(headings)
		expect(wrapper.findAll('section').map((section) => section.find('h4').text())).toEqual(headings)
	})

	it.each([
		[{ up: 'rejected', down: 'picked' }, ['Swipe up to reject', 'Swipe down to pick']],
		[{ up: null, down: 'rejected' }, ['Swipe down to reject']],
		[{ up: 'picked', down: null }, ['Swipe up to pick']],
		[{ up: null, down: null }, []],
	] as const)('names each swipe that decides as %o sets them', (swipes, lines) => {
		const wrapper = mount(GestureGuide, { props: { swipes, finePointer: false } })

		expect(wrapper.findAll('.gesture-guide__gestures li').map((line) => line.text()).filter((line) => /^Swipe (up|down)/.test(line))).toEqual(lines)
	})

	// spec: LOUPE-001.15
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
			const wrapper = mount(GestureGuide)
			// Key caps come from the key map, which names keys rather than words.
			wrapper.findAll('kbd').forEach((cap) => cap.element.remove())

			expect(untranslatedText(wrapper.element as Element)).toEqual([])
		})
	})
})
