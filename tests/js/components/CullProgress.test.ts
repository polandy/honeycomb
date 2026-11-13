// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CullProgress from '../../../src/components/CullProgress.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK

describe('CullProgress', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: GRID-002.7
	it('shows how many photos are decided as text and as a progress bar', () => {
		const wrapper = mount(CullProgress, { props: { decided: 1840, total: 2000, filtered: false } })
		const bar = wrapper.find('[role="progressbar"]')

		expect(wrapper.text()).toContain(`${MARK}1,840 / 2,000 decided`)
		expect(bar.attributes()).toMatchObject({ 'aria-label': `${MARK}Decided`, 'aria-valuemin': '0', 'aria-valuemax': '2000', 'aria-valuenow': '1840' })
		expect(bar.find('.cull-progress__done').attributes('style')).toContain('width: 92%')
	})

	// spec: GRID-002.7
	it('shows an empty progress bar for a cull without photos', () => {
		const wrapper = mount(CullProgress, { props: { decided: 0, total: 0, filtered: false } })

		expect(wrapper.find('.cull-progress__done').attributes('style')).toContain('width: 0%')
	})
})
