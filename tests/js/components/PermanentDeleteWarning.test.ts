// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from '../../../src/components/ConfirmDialog.vue'
import DeleteDialogs from '../../../src/components/DeleteDialogs.vue'
import PermanentDeleteWarning from '../../../src/components/PermanentDeleteWarning.vue'
import { trashReport, unkeptFiles, wholePictures } from '../../../src/logic/trash-report.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { DialogStub } from './stubs.ts'

const [PAIR, SINGLE] = picturesOf([
	listingEntry(1, '/Trip/A/IMG_1.CR3', { mime: 'image/x-dcraw', size: 2048 }),
	listingEntry(2, '/Trip/A/IMG_1.JPG', { size: 1024 }),
	listingEntry(4, '/Trip/B/IMG_2.JPG', { size: 1024 }),
]) as Picture<ListingEntry>[]
const SET = { paths: ['/Trip'], subfolders: true }
const REPORT = trashReport(wholePictures([PAIR!, SINGLE!]), [[{ fileId: 2, result: 'skipped' }, { fileId: 1, result: 'tooLarge' }], [{ fileId: 4, result: 'noTrashBin' }]])
const FILES = unkeptFiles(REPORT)

function warning(props: Record<string, unknown> = {}) {
	return mount(PermanentDeleteWarning, { props: { files: FILES, folderSet: SET, busy: false, ...props }, global: { stubs: { NcDialog: DialogStub } } })
}

describe('PermanentDeleteWarning', () => {
	// spec: DELETE-002.20
	it('names how many files go for good, lists each with its reason, and asks with Cancel focused and a destructive confirm', () => {
		const wrapper = warning()
		const dialog = wrapper.findComponent(ConfirmDialog)

		expect(dialog.props()).toMatchObject({ title: '2 files will be deleted permanently', confirmLabel: 'Delete permanently', danger: true, cancel: true, focusCancel: true })
		expect(wrapper.findAll('.trash-files__row').map((row) => row.text())).toEqual([
			'CR3A/IMG_1.CR3Larger than the trash bin allows2 kB',
			'JPGB/IMG_2.JPGNo trash bin on this storage1 kB',
		])
		expect(wrapper.text()).toContain('The Nextcloud trash bin cannot keep these files. Deleted, they cannot be restored.')
	})

	// spec: DELETE-002.21, DELETE-002.22
	it('emits confirm and cancel, and holds the confirm button while it runs', async () => {
		const wrapper = warning()
		const dialog = wrapper.findComponent(ConfirmDialog)

		dialog.vm.$emit('confirm')
		dialog.vm.$emit('cancel')

		expect(wrapper.emitted('confirm')).toHaveLength(1)
		expect(wrapper.emitted('cancel')).toHaveLength(1)
		expect(warning({ busy: true }).findComponent(ConfirmDialog).props()).toMatchObject({ confirmDisabled: true, confirmLabel: 'Deleting permanently…' })
	})

	// spec: DELETE-002.20
	it('opens from the delete dialogs, which pass its confirm and cancel on', () => {
		const wrapper = mount(DeleteDialogs, {
			props: { dialog: { kind: 'permanent', files: FILES, report: REPORT, skipped: [], done: () => '' }, rejected: [], rawRemoval: null, folderSet: SET, folders: 2, busy: false },
			global: { stubs: { NcDialog: DialogStub } },
		})
		const shown = wrapper.findComponent(PermanentDeleteWarning)

		shown.vm.$emit('confirm')
		shown.vm.$emit('cancel')

		expect(shown.props('files')).toEqual(FILES)
		expect(wrapper.emitted('confirm')).toHaveLength(1)
		expect(wrapper.emitted('close')).toHaveLength(1)
	})
})
