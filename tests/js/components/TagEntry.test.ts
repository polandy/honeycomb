// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Tag } from '../../../src/logic/tag.ts'

import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import TagEntry from '../../../src/components/TagEntry.vue'

enableAutoUnmount(afterEach)

const KNOWN = ['Natur', 'Natur/Berg', 'People', 'People/Anna', 'Places', 'Places/Italy', 'Sunrise']

/** The entry for targets with those tags, attached so the field can take the focus. */
function mountEntry(targets: Tag[][] = [[]], known: Tag[] = KNOWN) {
	return mount(TagEntry, { props: { targets, known }, attachTo: document.body })
}

type Entry = ReturnType<typeof mountEntry>

const field = (wrapper: Entry) => wrapper.find<HTMLInputElement>('input')
const rows = (wrapper: Entry) => wrapper.findAll('[role="option"]').map((row) => row.text())
const chips = (wrapper: Entry) => wrapper.findAll('.tag-entry__chip').map((chip) => ({ text: chip.text().replace('×', '').trim(), partial: chip.classes('tag-entry__chip--partial') }))

/** Types the text into the field. */
async function type(wrapper: Entry, text: string) {
	await field(wrapper).setValue(text)
}

/** Presses a key in the field. */
async function press(wrapper: Entry, key: string, shiftKey = false) {
	await field(wrapper).trigger('keydown', { key, shiftKey })
}

describe('TagEntry', () => {
	// spec: TAGS-003.1
	it('focuses its field', () => {
		const wrapper = mountEntry()

		expect(document.activeElement).toBe(field(wrapper).element)
	})

	// spec: TAGS-003.3
	it('shows the targets\' tags as chips, a tag only some have dashed with its count', () => {
		expect(chips(mountEntry([['Sunrise'], ['Sunrise', 'People/Anna'], ['Sunrise']]))).toEqual([
			{ text: 'People/Anna 1/3', partial: true },
			{ text: 'Sunrise', partial: false },
		])
	})

	// spec: TAGS-003.4, TAGS-003.5
	it('offers the known tags containing the text, then the tag to create', async () => {
		const wrapper = mountEntry([['Natur/Berg'], []])

		await type(wrapper, 'BERG')

		expect(rows(wrapper)).toEqual(['Natur/Berg 1/2', 'Create tag "BERG"'])
	})

	// spec: TAGS-003.6
	it('cycles the matches into the field with Tab, Shift+Tab and the arrows', async () => {
		const wrapper = mountEntry([[]], ['Berg', 'Bergsee', 'Natur/Berg'])
		await type(wrapper, 'berg')
		const seen: string[] = []
		for (const [key, shift] of [['Tab', false], ['Tab', false], ['Tab', false], ['Tab', false], ['Tab', true], ['ArrowDown', false], ['ArrowUp', false]] as const) {
			await press(wrapper, key, shift)
			seen.push(field(wrapper).element.value)
		}

		expect(seen).toEqual(['Berg', 'Bergsee', 'Natur/Berg', 'Berg', 'Natur/Berg', 'Berg', 'Natur/Berg'])
	})

	// spec: TAGS-003.7
	it('assigns exactly the field on Enter, empties it and stays open', async () => {
		const wrapper = mountEntry()

		await type(wrapper, ' places / italy ')
		await press(wrapper, 'Enter')
		await type(wrapper, 'Places/Italy/Bolzano')
		await press(wrapper, 'Enter')

		expect(wrapper.emitted('change')).toEqual([[{ added: ['Places/Italy'], removed: [] }], [{ added: ['Places/Italy/Bolzano'], removed: [] }]])
		expect(field(wrapper).element.value).toBe('')
		expect(wrapper.emitted('close')).toBeUndefined()
	})

	// spec: TAGS-003.4
	it('assigns a match that is tapped', async () => {
		const wrapper = mountEntry()
		await type(wrapper, 'anna')

		await wrapper.find('[role="option"]').trigger('click')

		expect(wrapper.emitted('change')).toEqual([[{ added: ['People/Anna'], removed: [] }]])
	})

	// spec: TAGS-003.8
	it.each(['Places//Rome', 'A|B'])('refuses %j and says why', async (typed) => {
		const wrapper = mountEntry()

		await type(wrapper, typed)
		await press(wrapper, 'Enter')

		expect(wrapper.emitted('change')).toBeUndefined()
		expect(wrapper.find('[role="alert"]').text()).toBe('A tag needs names, separated by "/", without "|"')
	})

	// spec: TAGS-003.8
	it('does nothing on Enter in an empty field', async () => {
		const wrapper = mountEntry()

		await press(wrapper, 'Enter')

		expect(wrapper.emitted('change')).toBeUndefined()
		expect(wrapper.find('[role="alert"]').exists()).toBe(false)
	})

	// spec: TAGS-003.9
	it('removes a chip\'s tag with its × and the last chip\'s with Backspace in an empty field', async () => {
		const wrapper = mountEntry([['People/Anna', 'Sunrise']])

		await wrapper.find('[aria-label="Remove People/Anna"]').trigger('click')
		await press(wrapper, 'Backspace')
		await type(wrapper, 'x')
		await press(wrapper, 'Backspace')

		expect(wrapper.emitted('change')).toEqual([[{ added: [], removed: ['People/Anna'] }], [{ added: [], removed: ['Sunrise'] }]])
	})

	// spec: TAGS-003.12
	it('closes on Esc without the key reaching the app, and on Done', async () => {
		const wrapper = mountEntry()
		const reached: string[] = []
		const listener = (event: KeyboardEvent) => reached.push(event.key)
		window.addEventListener('keydown', listener)

		await press(wrapper, 'Escape')
		await wrapper.findAll('button').find((button) => button.text() === 'Done')!.trigger('click')
		window.removeEventListener('keydown', listener)

		expect(wrapper.emitted('close')).toEqual([[], []])
		expect(reached).toEqual([])
	})

	it('leaves other keys to the field', async () => {
		const wrapper = mountEntry()

		await press(wrapper, 'a')

		expect(wrapper.emitted('change')).toBeUndefined()
		expect(wrapper.emitted('close')).toBeUndefined()
	})

	describe('for the filter', () => {
		/** The filter's entry with those tags chosen. */
		const mountFilter = (chosen: Tag[] = ['Sunrise']) => mount(TagEntry, { props: { targets: [chosen], known: KNOWN, filter: true }, attachTo: document.body })

		// spec: TAGS-004.3
		it('offers known tags but those chosen, never one to create, and takes a known tag in any case', async () => {
			const wrapper = mountFilter()

			await type(wrapper, 's')
			expect(rows(wrapper)).toEqual(['People', 'People/Anna', 'Places', 'Places/Italy'])
			await type(wrapper, 'natur/berg')
			await press(wrapper, 'Enter')

			expect(wrapper.emitted('change')).toEqual([[{ added: ['Natur/Berg'], removed: [] }]])
			expect(wrapper.find('[role="dialog"]').attributes('aria-label')).toBe('Tag filter')
		})

		// spec: TAGS-004.4
		it('refuses a tag that is not known', async () => {
			const wrapper = mountFilter()

			await type(wrapper, 'Rome')
			expect(rows(wrapper)).toEqual([])
			await press(wrapper, 'Enter')

			expect(wrapper.emitted('change')).toBeUndefined()
			expect(wrapper.find('[role="alert"]').text()).toBe('Pick a known tag')
		})
	})
})
