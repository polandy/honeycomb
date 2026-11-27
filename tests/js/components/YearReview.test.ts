// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { YearReview as Review } from '../../../src/logic/year-review.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import YearReview from '../../../src/components/YearReview.vue'

const BARE: Review = {
	year: 2026,
	decided: 0,
	trashed: 0,
	freedBytes: 0,
	deletedForGood: 0,
	rawsRemoved: 0,
	rawsRemovedBytes: 0,
	sidecarsCreated: 0,
	sidecarsUpdated: 0,
	sidecarsForeign: 0,
	seriesDone: 0,
	longestStreak: 0,
	activeMs: 0,
	perMinute: null,
	busiest: null,
	calendar: [{ day: '2026-01-01', shade: 0 }],
	activeDays: 0,
	countedSince: null,
}

const BUSY: Review = {
	...BARE,
	decided: 120,
	trashed: 30,
	freedBytes: 5_000_000,
	deletedForGood: 2,
	rawsRemoved: 10,
	rawsRemovedBytes: 1_000_000,
	sidecarsCreated: 4,
	sidecarsUpdated: 5,
	sidecarsForeign: 3,
	seriesDone: 2,
	longestStreak: 6,
	activeMs: 3_600_000,
	perMinute: 2.04,
	busiest: { day: '2026-03-04', decided: 50 },
	activeDays: 12,
}

describe('YearReview', () => {
	// spec: STATS-001.46
	it('shows a note under a number only where it has something to say', async () => {
		const wrapper = mount(YearReview, { props: { review: BUSY } })
		await wrapper.find('.year-review__toggle').trigger('click')
		const text = wrapper.text()

		expect(text).toContain('2 deleted for good')
		expect(text).toContain('3 from digiKam or darktable')
		expect(text).toContain('2 photos a minute')
		expect(text).toContain('50 photos decided')
	})

	// spec: STATS-001.46
	it('leaves out the notes, the active time and the busiest day of a quiet year', async () => {
		const wrapper = mount(YearReview, { props: { review: BARE } })
		await wrapper.find('.year-review__toggle').trigger('click')
		const text = wrapper.text()

		expect(text).not.toContain('deleted for good')
		expect(text).not.toContain('Active time')
		expect(text).not.toContain('Busiest day')
	})

	// spec: STATS-001.25
	it('tells the page once, when the year is first shown', async () => {
		const wrapper = mount(YearReview, { props: { review: BUSY } })
		const toggle = wrapper.find('.year-review__toggle')

		await toggle.trigger('click')
		await toggle.trigger('click')
		await toggle.trigger('click')

		expect(wrapper.emitted('open')).toHaveLength(1)
	})
})
