// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { HashProgress } from '../../../src/logic/hash-progress.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SimilarityStrip from '../../../src/components/SimilarityStrip.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK
const running = (hashed: number, total = 2000): HashProgress => ({ phase: 'running', hashed, failed: 0, total })
const DONE: HashProgress = { phase: 'done', hashed: 2000, failed: 0, total: 2000 }

/** The strip with a timer the test fires, and the delays and cancels it saw. */
function mountStrip(progress: HashProgress) {
	const timers: { ms: number, run: () => void, cancelled: boolean }[] = []
	const schedule = (run: () => void, ms: number) => {
		const timer = { ms, run, cancelled: false }
		timers.push(timer)
		return () => {
			timer.cancelled = true
		}
	}
	const wrapper = mount(SimilarityStrip, { props: { progress, schedule } })
	return { wrapper, timers }
}

const shown = (wrapper: ReturnType<typeof mountStrip>['wrapper']) => wrapper.find('.similarity-strip__text')
const live = (wrapper: ReturnType<typeof mountStrip>['wrapper']) => wrapper.find('[aria-live="polite"]').text()

describe('SimilarityStrip', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SERIES-003.18
	it('shows a bar and the hashed and the hashable count while hashing', () => {
		const { wrapper } = mountStrip(running(640))
		const bar = wrapper.find('[role="progressbar"]')

		expect(shown(wrapper).text()).toBe(`${MARK}Comparing photos 640/2,000`)
		expect(bar.attributes()).toMatchObject({ 'aria-label': `${MARK}Similarity`, 'aria-valuemax': '2000', 'aria-valuenow': '640' })
		expect(bar.find('.progress-bar__done').attributes('style')).toContain('width: 32%')
	})

	// spec: SERIES-003.24
	it('tells screen readers the progress only in steps of 10 %', async () => {
		const { wrapper } = mountStrip(running(640))
		expect(live(wrapper)).toBe(`${MARK}Comparing photos: 30 %`)

		await wrapper.setProps({ progress: running(790) })
		expect(live(wrapper)).toBe(`${MARK}Comparing photos: 30 %`)
		expect(shown(wrapper).text()).toBe(`${MARK}Comparing photos 790/2,000`)

		await wrapper.setProps({ progress: running(800) })
		expect(live(wrapper)).toBe(`${MARK}Comparing photos: 40 %`)
	})

	// spec: SERIES-003.20, SERIES-003.24
	it('says the photos are compared for 2 s once the last one is hashed, then shows nothing', async () => {
		const { wrapper, timers } = mountStrip(running(1999))
		await wrapper.setProps({ progress: DONE })

		expect(shown(wrapper).text()).toBe(`${MARK}Photos compared`)
		expect(live(wrapper)).toBe(`${MARK}Photos compared`)
		expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
		expect(timers.map((timer) => timer.ms)).toEqual([2000])

		timers[0]!.run()
		await wrapper.vm.$nextTick()
		expect(wrapper.find('.similarity-strip').exists()).toBe(false)
		expect(live(wrapper)).toBe('')
	})

	// spec: SERIES-003.20
	it('shows nothing for a cull that opens with every hash there', () => {
		const { wrapper, timers } = mountStrip(DONE)

		expect(wrapper.find('.similarity-strip').exists()).toBe(false)
		expect(timers).toEqual([])
	})

	// spec: SERIES-003.18
	it('shows the bar again when hashing starts anew before the 2 s are over', async () => {
		const { wrapper, timers } = mountStrip(running(1))
		await wrapper.setProps({ progress: DONE })
		await wrapper.setProps({ progress: running(0, 4) })

		expect(timers[0]!.cancelled).toBe(true)
		expect(shown(wrapper).text()).toBe(`${MARK}Comparing photos 0/4`)
	})

	// spec: SERIES-003.19
	it('stays with how many photos were not compared, in the warning colour', async () => {
		const { wrapper, timers } = mountStrip(running(296, 300))
		await wrapper.setProps({ progress: { phase: 'failed', hashed: 297, failed: 3, total: 300 } })

		// The test catalogue marks a plural form twice, once as a form and once as the chosen text.
		expect(shown(wrapper).text()).toBe(`${MARK}${MARK}Similarity: 3 photos not compared`)
		expect(wrapper.find('.similarity-strip').classes()).toContain('similarity-strip--failed')
		expect(live(wrapper)).toBe(`${MARK}${MARK}Similarity: 3 photos not compared`)
		expect(timers).toEqual([])
	})

	// spec: SERIES-003.19
	it('says the hashes were not saved when only the save failed', () => {
		const { wrapper } = mountStrip({ phase: 'failed', hashed: 300, failed: 0, total: 300 })

		expect(shown(wrapper).text()).toBe(`${MARK}Similarity: not saved`)
	})

	it('stops its timer when it goes away', async () => {
		const { wrapper, timers } = mountStrip(running(1))
		await wrapper.setProps({ progress: DONE })
		wrapper.unmount()

		expect(timers[0]!.cancelled).toBe(true)
	})
})
