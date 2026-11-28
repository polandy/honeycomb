// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Folder } from '../../../src/api/index.ts'

import { mount } from '@vue/test-utils'
import MoveDialogs from '../../../src/components/MoveDialogs.vue'
import { allMoved, moveFlow } from '../move-fixtures.ts'
import { DialogStub } from './stubs.ts'

const SET = { paths: ['/Trip'], subfolders: false }
const FOLDERS: Folder[] = [{ name: 'Trip', path: '/Trip', hasSubfolders: false, pictures: 0, picturesBelow: 0, picturesBelowApproximate: false, orphanedSidecars: 0, orphanedSidecarsBelow: 0 }, { name: 'Out', path: '/Out', hasSubfolders: false, pictures: 0, picturesBelow: 0, picturesBelowApproximate: false, orphanedSidecars: 0, orphanedSidecarsBelow: 0 }]

/** The dialogs over a move flow from the fixtures, its dialog open on `chosen` of its pictures. */
export function mountDialogs(options: Parameters<typeof moveFlow>[1] = {}, answer = allMoved()) {
	const fixture = moveFlow(answer, options)
	const wrapper = mount(MoveDialogs, {
		props: { flow: fixture.moving, folderSet: SET, listFolders: async () => FOLDERS },
		global: { stubs: { NcDialog: DialogStub } },
		attachTo: document.body,
	})
	return { wrapper, ...fixture }
}

/** The dialog's confirm button, the last of its buttons. */
export const confirmButton = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[role="dialog"] button').at(-1)!
