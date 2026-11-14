// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CullProgress from '../../../src/components/CullProgress.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK
const DONE = { phase: 'done', hashed: 0, failed: 0, total: 0 } as const

describe('CullProgress', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: GRID-002.7
	it('shows how many photos are decided as text and as a progress bar', () => {
		const wrapper = mount(CullProgress, { props: { decided: 1840, total: 2000, filtered: false, similarity: DONE } })
		const bar = wrapper.find('[role="progressbar"]')

		expect(wrapper.text()).toContain(`${MARK}1,840 / 2,000 decided`)
		expect(bar.attributes()).toMatchObject({ 'aria-label': `${MARK}Decided`, 'aria-valuemin': '0', 'aria-valuemax': '2000', 'aria-valuenow': '1840' })
		expect(bar.find('.progress-bar__done').attributes('style')).toContain('width: 92%')
	})

	// spec: GRID-002.7
	it('shows an empty progress bar for a cull without photos', () => {
		const wrapper = mount(CullProgress, { props: { decided: 0, total: 0, filtered: false, similarity: DONE } })

		expect(wrapper.find('.progress-bar__done').attributes('style')).toContain('width: 0%')
	})

	// spec: SERIES-003.18
	it('stacks the similarity bar under the decided bar while hashing, with its text', () => {
		const wrapper = mount(CullProgress, { props: { decided: 0, total: 3000, filtered: false, similarity: { phase: 'running', hashed: 1200, failed: 0, total: 3000 } } })
		const bars = wrapper.findAll('.cull-progress__bars [role="progressbar"]')

		expect(bars.map((bar) => bar.attributes('aria-label'))).toEqual([`${MARK}Decided`, `${MARK}Similarity`])
		expect(bars[1]!.attributes()).toMatchObject({ 'aria-valuemax': '3000', 'aria-valuenow': '1200' })
		expect(bars[1]!.find('.progress-bar__done').attributes('style')).toContain('width: 40%')
		expect(wrapper.find('.similarity-progress').text()).toBe(`${MARK}Similarity 1,200/3,000`)
	})

	// spec: SERIES-003.19, SERIES-003.20
	it('shows no similarity bar once hashing is over', () => {
		const failed = mount(CullProgress, { props: { decided: 0, total: 3, filtered: false, similarity: { phase: 'failed', hashed: 2, failed: 1, total: 3 } } })
		const done = mount(CullProgress, { props: { decided: 0, total: 3, filtered: false, similarity: DONE } })

		expect(failed.findAll('[role="progressbar"]')).toHaveLength(1)
		expect(done.findAll('[role="progressbar"]')).toHaveLength(1)
	})
})
