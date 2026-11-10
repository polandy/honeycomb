// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { DecisionIntent } from '../../../src/logic/decision-change.ts'
import type { Decision } from '../../../src/logic/decision.ts'
import type { Toast } from '../../../src/toast.ts'
import type { PICTURES } from './mount-loupe.ts'

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { FLAG_BUTTONS_SHOWN_KEY } from '../../../src/loupe-panels.ts'
import { pointer } from './loupe-pointer.ts'
import { button, indices, mountLoupe } from './mount-loupe.ts'

/** The loupe at `index` over decisions by file id that apply every flag it decides, as the cull does. */
async function mountDeciding(index: number, flags: Record<number, Decision['flag']> = {}, stored: Record<string, string> = {}) {
	const decisions = reactive(new Map(Object.entries(flags).map(([fileId, flag]) => [Number(fileId), { ...UNDECIDED, flag }])))
	const decided: [DecisionIntent, string][] = []
	const mounted = await mountLoupe(index, stored, false, {
		decisionOf: (picture: (typeof PICTURES)[number]) => decisions.get(picture.rendered!.fileId) ?? UNDECIDED,
		onDecide: (intent: DecisionIntent, picture: (typeof PICTURES)[number]) => {
			decided.push([intent, picture.baseName])
			if (intent.kind === 'flag') {
				decisions.set(picture.rendered!.fileId, { ...UNDECIDED, flag: intent.flag })
			}
		},
	})
	return { ...mounted, decided }
}

enableAutoUnmount(afterEach)

describe('PhotoLoupe: decisions', () => {
	it('decides the shown picture by its flag buttons and moves on to the next undecided picture', async () => {
		const { wrapper, decided } = await mountDeciding(4, { 6: 'picked' })
		expect(button(wrapper, 'Unflag').attributes('aria-pressed')).toBe('true')

		await button(wrapper, 'Reject').trigger('click')

		expect(decided).toEqual([[{ kind: 'flag', flag: 'rejected' }, 'IMG_5']])
		expect(indices(wrapper)).toEqual([6])
	})

	it('stays on the picture after a rating, a label, Keep RAW or Unflag', async () => {
		const { wrapper, decided } = await mountDeciding(4, { 5: 'picked' })
		expect(button(wrapper, 'Pick').attributes('aria-pressed')).toBe('true')

		await button(wrapper, 'Rate 3 stars').trigger('click')
		await button(wrapper, 'Unflag').trigger('click')

		expect(decided.map(([intent]) => intent.kind)).toEqual(['rating', 'flag'])
		expect(indices(wrapper)).toBeUndefined()
	})

	it('stays when no undecided picture follows', async () => {
		const { wrapper } = await mountDeciding(8, { 10: 'rejected' })
		await button(wrapper, 'Pick').trigger('click')
		expect(indices(wrapper)).toBeUndefined()
	})

	it('picks by a swipe up and rejects by a swipe down', async () => {
		const { wrapper, decided } = await mountDeciding(4)
		const stage = wrapper.find('.loupe-stage')
		for (const [from, to, time] of [[100, 400, 0], [400, 100, 1000]] as const) {
			await pointer(stage, 'pointerdown', { x: 500, y: from, time })
			await pointer(stage, 'pointermove', { x: 500, y: to, time: time + 100 })
			await pointer(stage, 'pointerup', { x: 500, y: to, time: time + 100 })
		}
		expect(decided).toEqual([[{ kind: 'flag', flag: 'rejected' }, 'IMG_5'], [{ kind: 'flag', flag: 'picked' }, 'IMG_6']])
		expect(indices(wrapper)).toEqual([5, 6])
	})

	it('hides the flag buttons by their toggle, keeps the choice and says how to decide and to show them again', async () => {
		const { wrapper, stored } = await mountDeciding(4)
		await button(wrapper, 'Flag buttons').trigger('click')

		expect(wrapper.find('.flag-buttons').exists()).toBe(false)
		expect(stored[FLAG_BUTTONS_SHOWN_KEY]).toBe('false')
		const hidden = (wrapper.emitted('toast') as [Toast][])[0]![0]
		expect(hidden.message).toBe('Flag buttons hidden · swipe to decide, the flag at the top shows them')
		expect(hidden.action!.label).toBe('Show')

		hidden.action!.run()
		await wrapper.vm.$nextTick()
		expect(wrapper.find('.flag-buttons').exists()).toBe(true)
		expect(stored[FLAG_BUTTONS_SHOWN_KEY]).toBe('true')
	})

	it('says when the flag buttons are shown again and starts with them hidden when they were', async () => {
		const { wrapper } = await mountDeciding(4, {}, { [FLAG_BUTTONS_SHOWN_KEY]: 'false' })
		expect(wrapper.find('.flag-buttons').exists()).toBe(false)
		expect(button(wrapper, 'Flag buttons').attributes('aria-pressed')).toBe('false')

		await button(wrapper, 'Flag buttons').trigger('click')

		expect(wrapper.find('.flag-buttons').exists()).toBe(true)
		expect(wrapper.emitted('toast')).toEqual([[{ message: 'Flag buttons shown', action: null }]])
	})

	it('hides its decision controls in chrome-free mode', async () => {
		const { wrapper, root } = await mountDeciding(4)
		await root.trigger('keydown', { key: 'Tab' })
		expect(wrapper.find('.action-bar').exists()).toBe(false)
	})
})
