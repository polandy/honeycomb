// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ResumePosition } from '../../src/logic/resume-position.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { mountApp, openCull, SET, shownNames } from './app-cull.ts'

/** The app over a server that holds `stored` and records each saved position. */
async function openApp(stored: unknown[]) {
	const saved: ResumePosition[] = []
	const { wrapper } = mountApp({
		positions: {
			loadPositions: async () => stored,
			savePosition: async (position: ResumePosition) => {
				saved.push(position)
			},
		},
	})
	await openCull(wrapper)
	return { wrapper, saved }
}

describe('App: the resume position', () => {
	// spec: DECISIONS-002.7
	it('offers to continue at the picture stored on another device, from the toast and the More menu', async () => {
		const { wrapper } = await openApp([{ folderSet: { paths: ['/Trip'], subfolders: true }, fileId: 4, decided: 0, total: 3, updatedAt: 1 }])
		const at = shownNames(wrapper).indexOf('IMG_9')

		expect(wrapper.findComponent(UndoToast).text()).toContain('Continue where you left off')
		expect(wrapper.findComponent(GridToolbar).props('resumeName')).toBe('IMG_9')
		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(at)

		wrapper.findComponent(PhotoLoupe).vm.$emit('close')
		await flushPromises()
		wrapper.findComponent(GridToolbar).vm.$emit('resume')
		await flushPromises()
		expect(wrapper.findComponent(PhotoLoupe).props('index')).toBe(at)
	})

	// spec: DECISIONS-002.7
	it('saves the picture the loupe shows with the progress of the cull', async () => {
		const { wrapper, saved } = await openApp([])
		expect(wrapper.findComponent(UndoToast).exists()).toBe(false)

		wrapper.findComponent(PhotoGrid).vm.$emit('open', shownNames(wrapper).indexOf('IMG_10'))
		await flushPromises()

		expect(saved).toEqual([{ folderSet: SET, fileId: 2, decided: 0, total: 3 }])
	})
})
