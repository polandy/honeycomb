// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SimilarityProgress from '../../../src/components/SimilarityProgress.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK

describe('SimilarityProgress', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SERIES-003.18
	it('shows the hashed and the hashable count and a bar while hashing', () => {
		const wrapper = mount(SimilarityProgress, { props: { progress: { phase: 'running', hashed: 1200, failed: 0, total: 3000 } } })
		const bar = wrapper.find('[role="progressbar"]')

		expect(wrapper.text()).toBe(`${MARK}Similarity 1,200/3,000`)
		expect(bar.attributes()).toMatchObject({ 'aria-label': `${MARK}Similarity`, 'aria-valuemax': '3000', 'aria-valuenow': '1200' })
		expect(bar.find('.progress-bar__done').attributes('style')).toContain('width: 40%')
	})

	// spec: SERIES-003.19
	it('names how many photos were not compared, in the warning colour', () => {
		const wrapper = mount(SimilarityProgress, { props: { progress: { phase: 'failed', hashed: 297, failed: 3, total: 300 } } })

		// The test catalogue marks a plural form twice, once as a form and once as the chosen text.
		expect(wrapper.text()).toBe(`${MARK}${MARK}Similarity: 3 photos not compared`)
		expect(wrapper.classes()).toContain('similarity-progress--failed')
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
	})

	// spec: SERIES-003.19
	it('says the hashes were not saved when only the save failed', () => {
		const wrapper = mount(SimilarityProgress, { props: { progress: { phase: 'failed', hashed: 300, failed: 0, total: 300 } } })

		expect(wrapper.text()).toBe(`${MARK}Similarity: not saved`)
	})

	// spec: SERIES-003.20
	it('shows nothing once every hash is there', () => {
		const wrapper = mount(SimilarityProgress, { props: { progress: { phase: 'done', hashed: 300, failed: 0, total: 300 } } })

		expect(wrapper.text()).toBe('')
		expect(wrapper.find('.similarity-progress').exists()).toBe(false)
	})
})
