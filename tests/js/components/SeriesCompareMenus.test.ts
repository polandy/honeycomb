// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSeriesCompare as mountCompare, SERIES } from './mount-compare.ts'
import { ActionsStub, DialogStub } from './stubs.ts'

enableAutoUnmount(afterEach)

describe('SeriesCompare menus', () => {
	// spec: SERIES-005.10, SERIES-005.13
	it('keeps the dialog open while a menu is open, so Escape closes only the menu, through a new series object, until the menu goes away', async () => {
		const wrapper = mountCompare()
		const dialog = () => wrapper.findComponent(DialogStub)
		const [series, card] = wrapper.findAllComponents(ActionsStub)

		series!.vm.$emit('update:open', true)
		card!.vm.$emit('update:open', true)
		series!.vm.$emit('update:open', false)
		await flushPromises()
		expect(dialog().props('noClose')).toBe(true)
		card!.vm.$emit('update:open', false)
		await flushPromises()
		expect(dialog().props('noClose')).toBe(false)

		series!.vm.$emit('update:open', true)
		await wrapper.setProps({ series: { key: 1, members: [...SERIES] } })
		series!.vm.$emit('update:open', false)
		card!.vm.$emit('update:open', true)
		await wrapper.setProps({ series: { key: 2, members: SERIES } })
		expect(dialog().props('noClose')).toBe(true)
		await wrapper.setProps({ series: { key: 2, members: SERIES.slice(1) } })
		expect(dialog().props('noClose')).toBe(false)
	})
})
