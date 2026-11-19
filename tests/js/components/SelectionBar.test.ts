// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CommonDecision } from '../../../src/logic/decision-change.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SelectionBar from '../../../src/components/SelectionBar.vue'

const MIXED: CommonDecision = { rating: undefined, colourLabel: undefined, flag: undefined, keepRaw: undefined, canKeepRaw: true }

describe('SelectionBar', () => {
	// spec: GRID-003.16
	it('keeps Move and Delete for a read-only selection while the decisions are greyed', () => {
		const wrapper = mount(SelectionBar, { props: { common: MIXED, selected: 2, readOnly: true, seriesOffer: { selected: [], touched: [], inSeries: [], loose: [] } }, global: { stubs: { SeriesMenu: true } } })
		const enabled = wrapper.findAll('button').filter((found) => found.attributes('disabled') === undefined).map((found) => found.text())

		expect(enabled).toEqual(['Move…', 'Delete…'])
		expect(wrapper.find('.action-bar__note').exists()).toBe(true)
	})
})
