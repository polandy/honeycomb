// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { DecisionIntent } from '../../../src/logic/decision-change.ts'
import type { Decision } from '../../../src/logic/decision.ts'
import type { Settings } from '../../../src/logic/settings.ts'
import type { Toast } from '../../../src/toast.ts'
import type { PICTURES } from './mount-loupe.ts'

import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { pointer } from './loupe-pointer.ts'
import { button, indices, mountLoupe } from './mount-loupe.ts'

/** The loupe at `index` over decisions by file id that apply every flag it decides, as the cull does. */
async function mountDeciding(index: number, flags: Record<number, Decision['flag']> = {}, settings: Partial<Settings> = {}) {
	const decisions = reactive(new Map(Object.entries(flags).map(([fileId, flag]) => [Number(fileId), { ...UNDECIDED, flag }])))
	const decided: [DecisionIntent, string][] = []
	const mounted = await mountLoupe(index, {}, false, {
		settings: { ...DEFAULT_SETTINGS, ...settings },
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
		const { wrapper } = await mountDeciding(4)
		await button(wrapper, 'Flag buttons').trigger('click')

		expect(wrapper.find('.flag-buttons').exists()).toBe(false)
		expect(wrapper.emitted('updateSettings')).toEqual([[{ flagButtonsShown: false }]])
		const hidden = (wrapper.emitted('toast') as [Toast][])[0]![0]
		expect(hidden.message).toBe('Flag buttons hidden · swipe to decide, the flag at the top shows them')
		expect(hidden.action!.label).toBe('Show')

		hidden.action!.run()
		await wrapper.vm.$nextTick()
		expect(wrapper.find('.flag-buttons').exists()).toBe(true)
		expect(wrapper.emitted('updateSettings')!.at(-1)).toEqual([{ flagButtonsShown: true }])
	})

	it('says when the flag buttons are shown again and starts with them hidden when they were', async () => {
		const { wrapper } = await mountDeciding(4, {}, { flagButtonsShown: false })
		expect(wrapper.find('.flag-buttons').exists()).toBe(false)
		expect(button(wrapper, 'Flag buttons').attributes('aria-pressed')).toBe('false')

		await button(wrapper, 'Flag buttons').trigger('click')

		expect(wrapper.find('.flag-buttons').exists()).toBe(true)
		expect(wrapper.emitted('toast')).toEqual([[{ message: 'Flag buttons shown', action: null }]])
	})

	it('swipes as the settings say and stays on the photo with auto-advance off', async () => {
		const { wrapper, decided } = await mountDeciding(4, {}, { swipes: { up: null, down: 'picked' }, autoAdvance: false })
		const stage = wrapper.find('.loupe-stage')
		for (const [from, to, time] of [[400, 100, 0], [100, 400, 1000]] as const) {
			await pointer(stage, 'pointerdown', { x: 500, y: from, time })
			await pointer(stage, 'pointermove', { x: 500, y: to, time: time + 100 })
			await pointer(stage, 'pointerup', { x: 500, y: to, time: time + 100 })
		}
		await button(wrapper, 'Reject').trigger('click')

		expect(decided).toEqual([[{ kind: 'flag', flag: 'picked' }, 'IMG_5'], [{ kind: 'flag', flag: 'rejected' }, 'IMG_5']])
		expect(indices(wrapper)).toBeUndefined()
	})

	it('hides the flag buttons by B and names the key that shows them', async () => {
		const { wrapper, root } = await mountDeciding(4)
		await root.trigger('keydown', { key: 'b' })
		expect(wrapper.find('.flag-buttons').exists()).toBe(false)
		expect((wrapper.emitted('toast') as [Toast][])[0]![0].message).toBe('Flag buttons hidden · B shows them')
		await root.trigger('keydown', { key: 'b' })
		expect(wrapper.find('.flag-buttons').exists()).toBe(true)
	})

	it('hides its decision controls in chrome-free mode', async () => {
		const { wrapper, root } = await mountDeciding(4)
		await root.trigger('keydown', { key: 'Tab' })
		expect(wrapper.find('.action-bar').exists()).toBe(false)
	})
})

describe('PhotoLoupe: decision keys', () => {
	it('flags by P, X and U and moves on as a flag button does', async () => {
		const { wrapper, root, decided } = await mountDeciding(4)
		await root.trigger('keydown', { key: 'u' })
		await root.trigger('keydown', { key: 'x' })
		expect(decided).toEqual([[{ kind: 'flag', flag: 'unflagged' }, 'IMG_5'], [{ kind: 'flag', flag: 'rejected' }, 'IMG_5']])
		expect(indices(wrapper)).toEqual([5])
	})

	it('goes to the next photo after Shift and a flag only when the flag did not move already', async () => {
		const { wrapper, root, decided } = await mountDeciding(4, { 6: 'picked' })
		await root.trigger('keydown', { key: 'P', shiftKey: true })
		await root.trigger('keydown', { key: 'U', shiftKey: true })
		expect(decided).toEqual([[{ kind: 'flag', flag: 'picked' }, 'IMG_5'], [{ kind: 'flag', flag: 'unflagged' }, 'IMG_7']])
		expect(indices(wrapper)).toEqual([6, 7])
	})

	it('rates by a digit with Caps Lock on and goes to the next photo', async () => {
		const { wrapper, root, decided } = await mountDeciding(4)
		const event = new KeyboardEvent('keydown', { key: '3', bubbles: true, cancelable: true })
		event.getModifierState = (key: string) => key === 'CapsLock'
		root.element.dispatchEvent(event)
		expect(decided).toEqual([[{ kind: 'rating', rating: 3 }, 'IMG_5']])
		expect(indices(wrapper)).toEqual([5])
	})

	it('rates by Shift and a digit on the last photo and stays there', async () => {
		const { wrapper, root, decided } = await mountDeciding(9)
		await root.trigger('keydown', { key: '#', code: 'Digit3', shiftKey: true })
		expect(decided).toEqual([[{ kind: 'rating', rating: 3 }, 'IMG_10']])
		expect(indices(wrapper)).toBeUndefined()
	})

	it('steps the shown rating by ] and [', async () => {
		const decided: DecisionIntent[] = []
		const { root } = await mountLoupe(4, {}, false, {
			decisionOf: () => ({ ...UNDECIDED, rating: 2 }),
			onDecide: (intent: DecisionIntent) => decided.push(intent),
		})
		await root.trigger('keydown', { key: ']' })
		await root.trigger('keydown', { key: '[' })
		expect(decided).toEqual([{ kind: 'rating', rating: 3 }, { kind: 'rating', rating: 1 }])
	})
})
