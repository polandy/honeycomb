// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppIcon from '../../../src/components/AppIcon.vue'
import SourceSwitcher from '../../../src/components/SourceSwitcher.vue'

describe('SourceSwitcher', () => {
	it('marks Nextcloud with a folder and Immich with a neutral server icon', async () => {
		const wrapper = mount(SourceSwitcher, { props: { source: 'nextcloud' } })
		const buttons = wrapper.findAll('button')

		expect(buttons.map((button) => button.text())).toEqual(['Nextcloud', 'Immich'])
		expect(buttons.map((button) => button.findComponent(AppIcon).props('name'))).toEqual(['folder', 'server'])
		await buttons[1]!.trigger('click')

		expect(wrapper.emitted('choose')).toEqual([['immich']])
	})
})
