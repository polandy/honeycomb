// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from '../../../src/components/ConfirmDialog.vue'
import DeleteDialogs from '../../../src/components/DeleteDialogs.vue'
import UncheckedDeleteWarning from '../../../src/components/UncheckedDeleteWarning.vue'
import { DialogStub } from './stubs.ts'

const SET = { paths: ['/Trip'], subfolders: true }

function warning(props: Record<string, unknown> = {}) {
	return mount(UncheckedDeleteWarning, { props: { count: 2, busy: false, ...props }, global: { stubs: { NcDialog: DialogStub } } })
}

describe('UncheckedDeleteWarning', () => {
	// spec: DELETE-002.25
	it('names how many photos go unchecked and asks Delete anyway or Cancel, with Cancel focused', () => {
		const dialog = warning().findComponent(ConfirmDialog)

		expect(dialog.props()).toMatchObject({ title: 'Fresh check not possible for 2 photos', confirmLabel: 'Delete anyway', danger: true, cancel: true, focusCancel: true })
		expect(warning({ count: 1 }).findComponent(ConfirmDialog).props('title')).toBe('Fresh check not possible for 1 photo')
	})

	// spec: DELETE-002.23, DELETE-002.25
	it('emits confirm and cancel, and holds the confirm button while it runs', () => {
		const wrapper = warning()
		const dialog = wrapper.findComponent(ConfirmDialog)

		dialog.vm.$emit('confirm')
		dialog.vm.$emit('cancel')

		expect(wrapper.emitted('confirm')).toHaveLength(1)
		expect(wrapper.emitted('cancel')).toHaveLength(1)
		expect(warning({ busy: true }).findComponent(ConfirmDialog).props()).toMatchObject({ confirmDisabled: true, confirmLabel: 'Moving to trash…' })
	})

	// spec: DELETE-002.25
	it('opens from the delete dialogs, which pass its confirm and cancel on', () => {
		const wrapper = mount(DeleteDialogs, {
			props: { dialog: { kind: 'unchecked', count: 3, batch: [], skipped: [], done: () => '' }, rejected: [], rawRemoval: null, folderSet: SET, folders: 1, busy: false },
			global: { stubs: { NcDialog: DialogStub } },
		})
		const shown = wrapper.findComponent(UncheckedDeleteWarning)

		shown.vm.$emit('confirm')
		shown.vm.$emit('cancel')

		expect(shown.props('count')).toBe(3)
		expect(wrapper.emitted('confirm')).toHaveLength(1)
		expect(wrapper.emitted('close')).toHaveLength(1)
	})
})
