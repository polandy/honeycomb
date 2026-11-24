// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { APP_SEAMS } from '../../src/app-seams.ts'

afterEach(() => {
	document.body.innerHTML = ''
})

describe('APP_SEAMS', () => {
	it('groups each server call under the seam its feature takes', () => {
		expect(Object.keys(APP_SEAMS.flags())).toEqual(['save', 'takeOver', 'saveSidecarEtags'])
		expect(Object.keys(APP_SEAMS.viewState())).toEqual(['loadViewState', 'saveViewState'])
		expect(Object.keys(APP_SEAMS.positions())).toEqual(['loadPositions', 'savePosition'])
		expect(Object.keys(APP_SEAMS.library())).toEqual(['listLibraryFolders', 'scanLibrary', 'markFolderDone', 'reopenFolder'])
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
		expect(APP_SEAMS.now()).toBeCloseTo(Date.now() / 1000, -1)
	})

	// spec: SETTINGS-001.27
	it('takes the admin flag from the element the server renders', () => {
		expect(APP_SEAMS.admin()).toBe(false)

		document.body.innerHTML = '<div id="honeycomb" data-admin="true"></div>'
		expect(APP_SEAMS.admin()).toBe(true)
	})
})
