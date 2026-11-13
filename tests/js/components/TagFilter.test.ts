// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Tag } from '../../../src/logic/tag.ts'

import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import TagEntry from '../../../src/components/TagEntry.vue'
import TagFilter from '../../../src/components/TagFilter.vue'

enableAutoUnmount(afterEach)

const KNOWN = ['People', 'People/Anna', 'Places', 'Sunrise']

/** The tag filter with those tags chosen. */
function mountFilter(chosen: Tag[] = ['Sunrise', 'People']) {
	return mount(TagFilter, { props: { tags: new Set(chosen), known: KNOWN }, attachTo: document.body })
}

type Filter = ReturnType<typeof mountFilter>

const button = (wrapper: Filter, label: string) => wrapper.findAll('button').find((found) => found.attributes('aria-label') === label || found.text() === label)!
const emitted = (wrapper: Filter) => wrapper.emitted<[ReadonlySet<Tag>]>('update:tags')!.map(([tags]) => [...tags])

describe('TagFilter', () => {
	// spec: TAGS-004.5
	it('shows the chosen tags as chips, sorted, and × takes one out', async () => {
		const wrapper = mountFilter()

		expect(wrapper.findAll('.tag-filter__chip').map((chip) => chip.text())).toEqual(['People', 'Sunrise'])
		await button(wrapper, 'Remove People from the filter').trigger('click')

		expect(emitted(wrapper)).toEqual([['Sunrise']])
	})

	// spec: TAGS-004.3, TAGS-004.5
	it('opens the tag entry for the filter on Add tag, adds and removes through it, and closes', async () => {
		const wrapper = mountFilter()
		expect(wrapper.findComponent(TagEntry).exists()).toBe(false)

		await button(wrapper, 'Add tag').trigger('click')
		const entry = wrapper.findComponent(TagEntry)
		expect(entry.props()).toMatchObject({ targets: [['People', 'Sunrise']], known: KNOWN, filter: true })
		entry.vm.$emit('change', { added: ['People/Anna'], removed: [] })
		entry.vm.$emit('change', { added: [], removed: ['Sunrise'] })
		entry.vm.$emit('close')
		await wrapper.vm.$nextTick()

		expect(emitted(wrapper)).toEqual([['People', 'People/Anna', 'Sunrise'], ['People']])
		expect(wrapper.findComponent(TagEntry).exists()).toBe(false)
	})
})
