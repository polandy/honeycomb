// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_SEAMS } from '../../src/app/app-seams.ts'

afterEach(() => {
	document.body.replaceChildren()
	vi.useRealTimers()
})

describe('APP_SEAMS', () => {
	it('groups each server call under the seam its feature takes', () => {
		expect(Object.keys(APP_SEAMS.flags())).toEqual(['save', 'takeOver', 'saveSidecarEtags'])
		expect(Object.keys(APP_SEAMS.viewState())).toEqual(['loadViewState', 'saveViewState'])
		expect(Object.keys(APP_SEAMS.positions())).toEqual(['loadPositions', 'savePosition'])
		expect(Object.keys(APP_SEAMS.library())).toEqual(['listLibraryFolders', 'checkLibraryRoot', 'scanLibrary', 'markFolderDone', 'reopenFolder', 'markFoldersDone', 'reopenFolders'])
		expect(Object.keys(APP_SEAMS.sidecars())).toEqual(['lookupSidecars', 'lookupEmbeddedXmp', 'saveSidecars', 'lookupXmpCache', 'saveXmpCache', 'now'])
		expect(Object.keys(APP_SEAMS.move())).toEqual(['probeTargets', 'movePictures'])
		expect(Object.keys(APP_SEAMS.tags())).toEqual(['loadTagList'])
		expect(Object.keys(APP_SEAMS.immich())).toEqual(['listConnections', 'status'])
		expect(Object.keys(APP_SEAMS.immichCull())).toEqual(['assets', 'counts', 'saveDecisions', 'imageUrl'])
	})

	it('reads the browser: its address, storage and clocks', () => {
		expect(APP_SEAMS.location()).toBeDefined()
		expect(APP_SEAMS.storage()).toBe(window.localStorage)
		expect(APP_SEAMS.clock()).toBeGreaterThanOrEqual(0)
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-11-24T12:00:00Z'))
		expect(APP_SEAMS.now()).toBe(Date.parse('2026-11-24T12:00:00Z') / 1000)
	})

	// spec: SETTINGS-001.27
	it('takes the admin flag from the element the server renders', () => {
		expect(APP_SEAMS.admin()).toBe(false)

		const root = document.createElement('div')
		root.id = 'honeycomb'
		root.dataset.admin = 'true'
		document.body.append(root)
		expect(APP_SEAMS.admin()).toBe(true)
	})
})
