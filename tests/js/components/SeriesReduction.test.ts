// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ReductionPlan } from '../../../src/logic/series-reduction.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SeriesReduction from '../../../src/components/SeriesReduction.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { listingEntry, pictureOf } from '../logic/listing-entries.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK
const photo = (fileId: number) => pictureOf(listingEntry(fileId, `/Trip/IMG_${fileId}.JPG`))
const PLAN: ReductionPlan<ReturnType<typeof photo>> = {
	reduced: [
		{ key: 1, kept: photo(2), rejected: [photo(1), photo(3)] },
		{ key: 4, kept: photo(4), rejected: [photo(5), photo(6), photo(7)] },
	],
	leftOut: 1,
}

function mountDialog(plan = PLAN) {
	return mount(SeriesReduction, {
		props: { plan, imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}` },
		global: { stubs: { NcDialog: DialogStub } },
	})
}

const text = (wrapper: ReturnType<typeof mountDialog>) => wrapper.text().replaceAll(MARK, '')
const confirmButton = (wrapper: ReturnType<typeof mountDialog>) => wrapper.findAll('button').at(-1)!
const thumbs = (wrapper: ReturnType<typeof mountDialog>) => wrapper.findAll('.picture-thumbs__tile')

describe('SeriesReduction', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SERIES-008.3
	it('counts the plan, shows each sharpest photo with its series size and notes the series left out', () => {
		const wrapper = mountDialog()

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe(`${MARK}Reduce series to the sharpest`)
		expect(text(wrapper)).toContain('2series')
		expect(text(wrapper)).toContain('2to pick')
		expect(text(wrapper)).toContain('5to reject')
		expect(thumbs(wrapper).map((tile) => tile.text().replaceAll(MARK, ''))).toEqual(['IMG_2Sharpest of 3Leave out', 'IMG_4Sharpest of 4Leave out'])
		expect(text(wrapper)).toContain('1 series is left out, for you to compare.')
		expect(confirmButton(wrapper).text().replaceAll(MARK, '')).toBe('Pick 2, reject 5')
	})

	// spec: SERIES-008.4
	it('leaves a series out on a tap and holds the confirm once none is left', async () => {
		const wrapper = mountDialog()

		await thumbs(wrapper)[0]!.trigger('click')
		expect(confirmButton(wrapper).text().replaceAll(MARK, '')).toBe('Pick 1, reject 3')
		expect(text(wrapper)).toContain('2 series are left out, for you to compare.')
		await thumbs(wrapper)[0]!.trigger('click')

		expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()
	})

	// spec: SERIES-008.5
	it('confirms the plan as it stands', async () => {
		const wrapper = mountDialog()

		await thumbs(wrapper)[1]!.trigger('click')
		await confirmButton(wrapper).trigger('click')

		expect(wrapper.emitted('confirm')![0]![0]).toEqual({ reduced: [PLAN.reduced[0]], leftOut: 2 })
	})

	// spec: SERIES-008.6
	it('cancels without confirming', async () => {
		const wrapper = mountDialog()

		await wrapper.findAll('button').find((button) => button.text().includes('Cancel'))!.trigger('click')

		expect(wrapper.emitted('cancel')).toHaveLength(1)
		expect(wrapper.emitted('confirm')).toBeUndefined()
	})

	it('says so when no series has a clear sharpest', () => {
		const wrapper = mountDialog({ reduced: [], leftOut: 3 })

		expect(text(wrapper)).toContain('No series to reduce')
		expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()
	})
})
