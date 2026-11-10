// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from '../../../src/components/ConfirmDialog.vue'
import DeleteReport from '../../../src/components/DeleteReport.vue'
import DeleteSummary from '../../../src/components/DeleteSummary.vue'
import RejectReview from '../../../src/components/RejectReview.vue'
import { trashReport, wholePictures } from '../../../src/logic/trash-report.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { DialogStub } from './stubs.ts'

const [PAIR, SINGLE] = picturesOf([
	listingEntry(1, '/Trip/A/IMG_1.CR3', { mime: 'image/x-dcraw', size: 2048 }),
	listingEntry(2, '/Trip/A/IMG_1.JPG', { size: 1024 }),
	listingEntry(3, '/Trip/A/IMG_1.xmp', { size: 1024 }),
	listingEntry(4, '/Trip/B/IMG_2.JPG', { size: 1024 }),
]) as Picture<ListingEntry>[]
const SET = { paths: ['/Trip'], subfolders: true }
const global = { stubs: { NcDialog: DialogStub } }
const buttons = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[role="dialog"] > button, [role="dialog"] button').map((button) => button.text())

describe('RejectReview', () => {
	const review = (pictures: Picture<ListingEntry>[]) => mount(RejectReview, {
		props: { pictures, folderSet: SET, folders: 2, imageUrl: (fileId: number) => `/image/${fileId}` },
		global,
	})

	it('sums the rejects up, shows a tile per reject with its folder and files, and rescues the one tapped', async () => {
		const wrapper = review([PAIR!, SINGLE!])

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Review rejects')
		expect(wrapper.find('.delete-stats').text()).toBe('2photos4files5 kBto free')
		const tiles = wrapper.findAll('.reject-review__tile')
		expect(tiles.map((tile) => tile.attributes('aria-label'))).toEqual(['Rescue IMG_1', 'Rescue IMG_2'])
		expect(tiles[0]!.text()).toBe('IMG_1A · JPG + CR3 + XMPRescue')
		expect(tiles[0]!.find('img').attributes('src')).toBe('/image/2')

		await tiles[1]!.trigger('click')
		await wrapper.findAllComponents(ConfirmDialog)[0]!.vm.$emit('confirm')

		expect(wrapper.emitted('rescue')).toEqual([[SINGLE]])
		expect(wrapper.emitted('confirm')).toHaveLength(1)
		expect(buttons(wrapper).at(-1)).toBe('Continue: delete 2')
	})

	it('says nothing is left to delete and cannot continue', () => {
		const wrapper = review([])

		expect(wrapper.text()).toContain('No rejected photos')
		expect(wrapper.text()).toContain('Nothing to delete.')
		expect(wrapper.findComponent(ConfirmDialog).props('confirmDisabled')).toBe(true)
	})
})

describe('DeleteSummary', () => {
	const summary = (props: Record<string, unknown>) => mount(DeleteSummary, { props: { pictures: [PAIR!, SINGLE!], folderSet: SET, folders: 2, busy: false, fromReview: false, ...props }, global })

	it('shows photos, files, bytes, pairs and singles, the folders, every file and the trash-bin note', () => {
		const wrapper = summary({})

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Delete 2 photos')
		expect(wrapper.find('.delete-stats').text()).toBe('2photos4files5 kBfreed')
		expect(wrapper.text()).toContain('1 pair · 1 single. Every photo goes with all of its files, sidecars included. From A (1), B (1).')
		expect(wrapper.findAll('.trash-files__row').map((row) => row.text())).toEqual([
			'JPGA/IMG_1.JPG1 kB',
			'CR3A/IMG_1.CR32 kB',
			'XMPA/IMG_1.xmp1 kB',
			'JPGB/IMG_2.JPG1 kB',
		])
		expect(wrapper.text()).toContain('Files move to the Nextcloud trash bin and can be restored from there.')
		expect(buttons(wrapper)).toEqual(['Cancel', 'Move 4 files to trash'])
	})

	it('goes back to the review when it came from there, and holds the confirm button while a delete runs', async () => {
		const wrapper = summary({ fromReview: true, busy: true })

		expect(buttons(wrapper)).toEqual(['Back to review', 'Cancel', 'Move 4 files to trash'])
		expect(wrapper.findComponent(ConfirmDialog).props('confirmDisabled')).toBe(true)
		await wrapper.findAll('button')[0]!.trigger('click')
		expect(wrapper.emitted('back')).toHaveLength(1)
	})
})

describe('DeleteReport', () => {
	it('lists the failed files with their reasons and offers Close and Retry failed files', async () => {
		const report = trashReport(wholePictures([PAIR!]), [[{ fileId: 2, result: 'trashed' }, { fileId: 1, result: 'locked' }, { fileId: 3, result: 'skipped' }]])
		const wrapper = mount(DeleteReport, { props: { report, folderSet: SET, busy: false }, global })

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Deletion finished with errors')
		expect(wrapper.find('.delete-stats').text()).toBe('1file moved to trash2failed')
		expect(wrapper.findAll('.trash-files__row').map((row) => row.text())).toEqual([
			'CR3A/IMG_1.CR3File is locked (another process is writing to it)2 kB',
			'XMPA/IMG_1.xmpNot tried, because another file of this photo failed1 kB',
		])
		expect(buttons(wrapper)).toEqual(['Close', 'Retry failed files'])
		await wrapper.findAll('button')[1]!.trigger('click')
		await wrapper.findAll('button')[0]!.trigger('click')
		expect(wrapper.emitted('retry')).toHaveLength(1)
		expect(wrapper.emitted('close')).toHaveLength(1)
	})
})
