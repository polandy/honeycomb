// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ToastDetails from '../../../src/components/ToastDetails.vue'
import { DialogStub } from './stubs.ts'

const mountDetails = () => mount(ToastDetails, { props: { detailed: { message: 'Picked 7 photos; 3 photos not changed: read only', details: ['IMG_2: read only', 'IMG_3: read only'] } }, global: { stubs: { NcDialog: DialogStub } } })

describe('ToastDetails', () => {
	// spec: APP-001.14
	it('names the toast in its heading, lists each detail and offers only Close', async () => {
		const wrapper = mountDetails()

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Picked 7 photos; 3 photos not changed: read only')
		expect(wrapper.findAll('li').map((item) => item.text())).toEqual(['IMG_2: read only', 'IMG_3: read only'])
		expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['Close'])
		await wrapper.find('button').trigger('click')
		expect(wrapper.emitted('close')).toHaveLength(1)
	})
})
