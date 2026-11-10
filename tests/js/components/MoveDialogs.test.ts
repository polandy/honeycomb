// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Folder } from '../../../src/api.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from '../../../src/components/ConfirmDialog.vue'
import FolderList from '../../../src/components/FolderList.vue'
import MoveDialogs from '../../../src/components/MoveDialogs.vue'
import { allMoved, moveFlow } from '../move-fixtures.ts'
import { DialogStub } from './stubs.ts'

const SET = { paths: ['/Trip'], subfolders: false }
const FOLDERS: Folder[] = [{ name: 'Trip', path: '/Trip', hasSubfolders: false }, { name: 'Out', path: '/Out', hasSubfolders: false }]

/** The dialogs over a move flow from the fixtures, its dialog open on `chosen` of its pictures. */
function mountDialogs(options: Parameters<typeof moveFlow>[1] = {}, answer = allMoved()) {
	const fixture = moveFlow(answer, options)
	const wrapper = mount(MoveDialogs, {
		props: { flow: fixture.moving, folderSet: SET, listFolders: async () => FOLDERS },
		global: { stubs: { NcDialog: DialogStub } },
		attachTo: document.body,
	})
	return { wrapper, ...fixture }
}

const press = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
const confirmButton = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[role="dialog"] button').at(-1)!

describe('MoveDialogs: target', () => {
	// spec: MOVE-004.3
	it('counts the photos in the title, numbers the chips, favourites starred, and chooses one by its key', async () => {
		const { wrapper, moving, pair, single } = mountDialogs()
		moving.open([pair, single])
		await flushPromises()

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Move 2 photos')
		expect(wrapper.findAll('.move-dialog__chip').map((chip) => chip.text())).toEqual(['1★ Fav/', '2Old/'])

		press('2')
		await flushPromises()

		expect(moving.target.value).toBe('/Old')
		expect(wrapper.find('.move-dialog__target').text()).toContain('Moving to /Old')
		wrapper.unmount()
	})

	// spec: MOVE-004.4
	it('browses for one folder, the open folder set\'s blocked', async () => {
		const { wrapper, moving, pair } = mountDialogs()
		moving.open([pair])
		await flushPromises()

		await wrapper.find('.move-dialog__browse').trigger('click')
		await flushPromises()
		const list = wrapper.findComponent(FolderList)
		expect(list.props()).toMatchObject({ single: true, blocked: ['/Trip'] })
		expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()

		list.vm.$emit('toggle', '/Out')
		await flushPromises()
		await wrapper.findComponent(ConfirmDialog).vm.$emit('confirm')
		await flushPromises()

		expect(moving.target.value).toBe('/Out')
		wrapper.unmount()
	})

	// spec: MOVE-004.5
	it('adds the target to the favourites and removes it', async () => {
		const { wrapper, moving, pair, settings } = mountDialogs()
		moving.open([pair])
		moving.choose('/New')
		await flushPromises()

		const toggle = () => wrapper.find('.move-dialog__favourite')
		expect(toggle().text()).toBe('☆ Add to favourites')
		await toggle().trigger('click')
		expect(settings.value.moveFavourites).toEqual(['/Fav', '/New'])
		expect(toggle().text()).toBe('★ Favourite')
		await toggle().trigger('click')
		expect(settings.value.moveFavourites).toEqual(['/Fav'])
		wrapper.unmount()
	})
})

describe('MoveDialogs: summary', () => {
	// spec: MOVE-004.6, MOVE-004.8
	it('counts photos, files and conflicts, shows the template and every new path, and moves on Enter', async () => {
		const { wrapper, moving, pair, single, sent } = mountDialogs()
		moving.open([pair, single])
		expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()
		moving.choose('/Out')
		await flushPromises()

		expect(wrapper.find('.delete-stats').text()).toBe('2photos3files0conflicts')
		expect(wrapper.find('.move-summary__template').text()).toContain('{name}.{ext}')
		expect(wrapper.findAll('.move-summary__file').map((row) => row.text())).toEqual([
			'JPGTrip/IMG_1.JPG→ /Out/IMG_1.JPG1 kB',
			'CR3Trip/IMG_1.CR3→ /Out/IMG_1.CR32 kB',
			'JPGTrip/IMG_2.JPG→ /Out/IMG_2.JPG1 kB',
		])
		expect(confirmButton(wrapper).text()).toBe('Move 3 files')

		press('Enter')
		await flushPromises()

		expect(sent).toHaveLength(1)
		wrapper.unmount()
	})

	// spec: MOVE-004.7, MOVE-004.8
	it('sets one conflict and all, and says replaced files stay in the trash bin', async () => {
		const { wrapper, moving, pair, single } = mountDialogs({ held: ['IMG_1.JPG', 'IMG_2.JPG'] })
		moving.open([pair, single])
		moving.choose('/Out')
		await flushPromises()

		expect(wrapper.findAll('.move-summary__conflict').map((row) => row.find('.move-summary__clash').text())).toEqual([
			'IMG_1: a file with this name is already in Out',
			'IMG_2: a file with this name is already in Out',
		])
		const groups = () => wrapper.findAll('[role="radiogroup"]')
		expect(groups()).toHaveLength(3)
		expect(groups()[1]!.findAll('[role="radio"]').map((radio) => [radio.text(), radio.attributes('aria-checked')])).toEqual([['Add suffix', 'true'], ['Skip', 'false'], ['Replace', 'false']])

		await groups()[1]!.findAll('[role="radio"]')[1]!.trigger('click')
		expect(wrapper.findAll('.move-summary__file')[0]!.text()).toContain('skipped')
		expect(confirmButton(wrapper).text()).toBe('Move 1 file')

		await groups()[0]!.findAll('[role="radio"]')[2]!.trigger('click')
		expect(wrapper.findAll('.move-summary__note-tag').map((tag) => tag.text())).toEqual(['replaces the existing file', 'replaces the existing file'])
		expect(wrapper.find('.move-summary__note').text()).toContain('replaced files stay in the Nextcloud trash bin')

		await groups()[0]!.findAll('[role="radio"]')[1]!.trigger('click')
		expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()
		wrapper.unmount()
	})

	// spec: MOVE-004.7
	it('notes the suffix a conflict adds', async () => {
		const { wrapper, moving, single } = mountDialogs({ held: ['IMG_2.JPG'] })
		moving.open([single])
		moving.choose('/Out')
		await flushPromises()

		expect(wrapper.findAll('[role="radiogroup"]')).toHaveLength(1)
		expect(wrapper.find('.move-summary__note-tag').text()).toBe('-2 added')
		wrapper.unmount()
	})

	// spec: MOVE-004.15
	it('lists a picture it cannot name with the reason', async () => {
		const { wrapper, moving, pair, sunset } = mountDialogs({ template: '{number}.{ext}' })
		moving.open([pair, sunset])
		moving.choose('/Out')
		await flushPromises()

		expect(wrapper.find('.move-summary__unnamed').text()).toBe('sunset cannot be named: its file name does not end in digits for {number}')
		expect(confirmButton(wrapper).text()).toBe('Move 2 files')
		wrapper.unmount()
	})
})

describe('MoveDialogs: report', () => {
	// spec: MOVE-004.12
	it('lists each failed file with its reason and closes', async () => {
		const { wrapper, moving, single } = mountDialogs({}, async (request) => request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'locked', replaced: false }))))
		moving.open([single])
		moving.choose('/Out')
		await flushPromises()
		await moving.confirm()
		await flushPromises()

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Move finished with errors')
		expect(wrapper.find('.trash-files').text()).toContain('File is locked (another process is writing to it)')

		await wrapper.findComponent(ConfirmDialog).vm.$emit('confirm')
		expect(moving.report.value).toBeNull()
		wrapper.unmount()
	})
})
