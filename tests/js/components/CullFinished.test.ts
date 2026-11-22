// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import CullFinished from '../../../src/components/CullFinished.vue'
import { pageUrl } from '../../../src/navigation-items.ts'

const NUMBERS = {
	decided: 3,
	picked: 2,
	unflagged: 0,
	rejected: 1,
	trashed: 1,
	deleted: 0,
	freedBytes: 1024,
	sidecarsCreated: 1,
	sidecarsUpdated: 0,
	before: { pictures: 3, bytes: 3072 },
	after: { pictures: 2, bytes: 2048 },
	activeMs: 0,
	perMinute: null,
}

enableAutoUnmount(afterEach)

describe('CullFinished', () => {
	// spec: STATS-001.40
	it('opens the statistics page from Statistics', () => {
		const wrapper = mount(CullFinished, { props: { numbers: NUMBERS }, attachTo: document.body })

		const link = [...document.body.querySelectorAll('a')].find((each) => each.textContent?.trim() === 'Statistics')

		expect(link?.getAttribute('href')).toBe(pageUrl('statistics'))
		wrapper.unmount()
	})

	// spec: FOLDERS-008.8
	it('offers Mark folder done when the folder may be marked, and asks for it', async () => {
		const wrapper = mount(CullFinished, { props: { numbers: NUMBERS, markable: true }, attachTo: document.body })

		const button = [...document.body.querySelectorAll('button')].find((each) => each.textContent?.trim() === 'Mark folder done')
		button!.click()
		await wrapper.vm.$nextTick()

		expect(wrapper.emitted('markDone')).toHaveLength(1)
		expect(wrapper.emitted('close')).toHaveLength(1)
		wrapper.unmount()
	})

	// spec: FOLDERS-008.9
	it('offers no Mark folder done otherwise', () => {
		const wrapper = mount(CullFinished, { props: { numbers: NUMBERS }, attachTo: document.body })

		expect([...document.body.querySelectorAll('button')].map((each) => each.textContent?.trim())).not.toContain('Mark folder done')
		wrapper.unmount()
	})
})
