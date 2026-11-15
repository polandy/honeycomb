// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useCullContext } from '../../src/cull-context.ts'
import { fakeCullContext, mountInCullContext } from './cull-context-fake.ts'

/** A screen that shows how many pictures the cull of its context holds. */
const Screen = defineComponent({
	setup() {
		const { cull } = useCullContext()
		return () => h('p', String(cull.pictures.value.length))
	},
})

describe('the cull context', () => {
	it('reaches a screen below the parent that provides it', async () => {
		const { context } = await fakeCullContext()

		expect(mountInCullContext(Screen, context).text()).toBe('3')
	})

	it('fails loud when a screen is mounted without it', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		expect(() => mount(Screen)).toThrow('The cull context is missing')
	})
})
