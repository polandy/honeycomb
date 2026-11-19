// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { mountApp, openCull, stored, toolbarProps } from './app-cull.ts'

enableAutoUnmount(afterEach)

describe('App: Write picks/rejects to XMP', () => {
	// spec: XMP-003.39, XMP-003.41, GRID-001.21
	it('counts the sidecars to write, writes them on the menu entry, says so and falls to none', async () => {
		const { wrapper, sidecarSaves } = mountApp({}, [stored(1, 'picked'), stored(4, 'rejected')])
		await openCull(wrapper)
		const before = toolbarProps(wrapper).xmpToWrite
		expect(before).toBeGreaterThan(0)

		wrapper.findComponent(GridToolbar).vm.$emit('writeXmp')
		await flushPromises()

		expect(sidecarSaves.flat()).toHaveLength(before)
		expect(wrapper.findComponent(UndoToast).props('toast').message).toBe(`${before} XMP files written`)
		expect(toolbarProps(wrapper).xmpToWrite).toBe(0)
	})
})
