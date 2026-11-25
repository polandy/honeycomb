// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LibraryScanning } from '../../src/api/index.ts'
import type { FolderList } from '../../src/folders/folders.ts'
import type { FolderRow } from '../../src/logic/folder-row.ts'

import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import FoldersScreen from '../../src/components/FoldersScreen.vue'
import { TRANSLATED_MARK } from './l10n/marked-catalogue.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

/** A plural form is marked twice: the library translates the chosen form again. */
export const MARK = TRANSLATED_MARK
/** Noon UTC on 20 November 2026, in Unix seconds. */
export const NOW = Date.UTC(2026, 10, 20, 12) / 1000

export const OPEN = row({ fileId: 1, path: '/Photos/2019/Trip', undecided: 63, picked: 30, rejected: 7, bursts: 18, oldest: Date.UTC(2019, 3, 1) / 1000 })
export const COMPLETE = row({ fileId: 2, path: '/Photos/Done soon', undecided: 0, picked: 80 })
export const DONE = doneRow({ fileId: 3, path: '/Photos/Old', photos: 104, bytes: 6e8 }, 100)
export const READ_ONLY = row({ fileId: 4, path: '/Photos/Shared copy', permissions: 1 })
export const PHONE = row({ fileId: 5, root: '/Phone', path: '/Phone/Camera' })

export function fakeList(rows: readonly FolderRow[], state: FolderList['state']['value'] = 'ready', updating: LibraryScanning | null = null) {
	return { rows: shallowRef(rows), state: ref(state), updating: ref(updating), shown: ref(true), refresh: vi.fn(async () => undefined) } satisfies FolderList
}

export function mountScreen(list: FolderList, roots: readonly string[] = ['/Photos'], focusRow: { fileId: number } | null = null, includeSubfolders = true) {
	return mount(FoldersScreen, { props: { folders: list, roots, now: () => NOW, focusRow, includeSubfolders }, attachTo: document.body })
}

export type Screen = ReturnType<typeof mountScreen>

/** The folder names of the rows, in order. */
export function names(wrapper: Screen): string[] {
	return wrapper.findAll('.folder-row__name').map((each) => each.text())
}

export function row_(wrapper: Screen, name: string) {
	return wrapper.findAll('.folder-row').find((each) => each.find('.folder-row__name').text() === name)!
}

/** Shows the filter *All*: the level's rows. */
export async function showAll(wrapper: Screen): Promise<void> {
	await chip(wrapper, 'Filter', 'All').trigger('click')
}

/** The breadcrumb's crumbs by their text, the current level last. */
export function crumbs(wrapper: Screen): string[] {
	return wrapper.find('.folder-breadcrumb').findAll('.folder-breadcrumb__crumb').map((each) => each.text())
}

export function chip(wrapper: Screen, group: string, label: string) {
	return wrapper.find(`[role="group"][aria-label="${MARK}${group}"]`).findAll('button').find((each) => each.text().startsWith(label) || each.text().startsWith(`${MARK}${label}`))!
}

/** The open dialog's buttons by their text. */
export function dialogButton(label: string): HTMLButtonElement | undefined {
	return [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((each) => each.textContent?.trim() === `${MARK}${label}`)
}
