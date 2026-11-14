// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredViewState, ViewState } from '../../../src/logic/view-state.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeViewState } from '../app-cull.ts'
import { mountLoupe, PICTURES } from './mount-loupe.ts'

enableAutoUnmount(afterEach)

const HINT = '[aria-label="Series hint"]'
const CHIP = '.loupe-title-row__series'
const PULSE = 'loupe-title-row__series--pulse'

type Mounted = Awaited<ReturnType<typeof mountWithHint>>

/** IMG_4 to IMG_6 as one series, each mapped to it. */
const SERIES = PICTURES.slice(3, 6)
const SERIES_OF = new Map(SERIES.map((picture) => [picture, SERIES] as const))

/** The loupe at `index` with the series above and the view state `stored`, by default the hint never dismissed. */
async function mountWithHint(index = 4, stored: Partial<StoredViewState> = { gestureGuideSeen: true, seriesHintSeen: null }) {
	const saved: Partial<ViewState>[] = []
	const mounted = await mountLoupe(index, {}, false, { seriesOf: SERIES_OF, viewState: fakeViewState(stored, saved) })
	await flushPromises()
	return { ...mounted, saved }
}

describe('PhotoLoupe: the first-series hint', () => {
	// spec: LOUPE-001.26
	it('shows under the chip at the first photo of a series, naming the series\' count and the keys, and the chip pulses', async () => {
		const { wrapper } = await mountWithHint()
		const hint = wrapper.find(HINT)

		expect(hint.exists()).toBe(true)
		expect(hint.text()).toContain('This photo is part of a series of 3.')
		expect(hint.text()).toContain('⧉ or N compares them; Shift+K picks this one and rejects the rest.')
		expect(hint.find('button').text()).toBe('Got it')
		expect(wrapper.find(CHIP).classes()).toContain(PULSE)
	})

	// spec: LOUPE-001.26
	it('hides outside a series without counting as seen, and shows again at the next series photo', async () => {
		const { wrapper, saved } = await mountWithHint(0)
		expect(wrapper.find(HINT).exists()).toBe(false)

		await wrapper.setProps({ index: 3 })
		expect(wrapper.find(HINT).exists()).toBe(true)
		await wrapper.setProps({ index: 7 })
		expect(wrapper.find(HINT).exists()).toBe(false)
		expect(saved).toEqual([])
	})

	// spec: LOUPE-001.26, LOUPE-003.6
	it('goes for good by Got it, gives the keys back to the loupe and stops the pulse', async () => {
		const { wrapper, root, saved } = await mountWithHint()

		await wrapper.find(HINT).find('button').trigger('click')

		expect(wrapper.find(HINT).exists()).toBe(false)
		expect(wrapper.find(CHIP).classes()).not.toContain(PULSE)
		expect(document.activeElement).toBe(root.element)
		expect(saved).toEqual([{ seriesHintSeen: true }])
		await wrapper.setProps({ index: 5 })
		expect(wrapper.find(HINT).exists()).toBe(false)
	})

	// spec: LOUPE-001.26
	it('goes by Esc without closing the loupe; the next Esc closes it', async () => {
		const { wrapper, root, saved } = await mountWithHint()

		await root.trigger('keydown', { key: 'Escape' })
		expect(wrapper.find(HINT).exists()).toBe(false)
		expect(wrapper.emitted('close')).toBeUndefined()
		expect(saved).toEqual([{ seriesHintSeen: true }])

		await root.trigger('keydown', { key: 'Escape' })
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	// spec: LOUPE-001.26
	it.each([
		['the chip', 'compareSeries', ({ wrapper }: Mounted) => wrapper.find(CHIP).trigger('click')],
		['N', 'compareSeries', ({ root }: Mounted) => root.trigger('keydown', { key: 'n' })],
		['the filmstrip frame\'s tab', 'compareSeries', ({ wrapper }: Mounted) => wrapper.find('.loupe-filmstrip__tab').trigger('click')],
		['Shift+K', 'pickRest', ({ root }: Mounted) => root.trigger('keydown', { key: 'K', shiftKey: true })],
	] as const)('goes for good when %s does what it tells', async (_name, event, act) => {
		const mounted = await mountWithHint()

		await act(mounted)

		expect(mounted.wrapper.emitted(event)).toHaveLength(1)
		expect(mounted.wrapper.find(HINT).exists()).toBe(false)
		expect(mounted.saved).toEqual([{ seriesHintSeen: true }])
	})

	// spec: LOUPE-001.26
	it('waits for the gesture guide, then shows', async () => {
		const { wrapper } = await mountWithHint(4, { gestureGuideSeen: null, seriesHintSeen: null })
		expect(wrapper.find(HINT).exists()).toBe(false)

		await wrapper.find('[aria-label="How to cull"]').find('button').trigger('click')
		expect(wrapper.find(HINT).exists()).toBe(true)
	})

	// spec: LOUPE-001.26
	it('never shows once dismissed', async () => {
		const { wrapper } = await mountWithHint(4, { gestureGuideSeen: true, seriesHintSeen: true })

		expect(wrapper.find(HINT).exists()).toBe(false)
		expect(wrapper.find(CHIP).classes()).not.toContain(PULSE)
	})
})
