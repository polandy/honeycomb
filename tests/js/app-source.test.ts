// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderSetOpeningCull } from '../../src/app/app-source.ts'
import type { LocationApi } from '../../src/cull/cull-location.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'

import { describe, expect, it } from 'vitest'
import { useFolderSetOpening } from '../../src/app/app-source.ts'
import { locationHash } from '../../src/logic/cull-location.ts'
import { NO_ACCESS } from '../../src/logic/writability.ts'

const TRIP: FolderSet = { paths: ['/Trip'], subfolders: false }

/** A folder set opening over fakes that record each step; `open` and `shown` are the starting state. */
function opening(open: FolderSet | null = null, shown: number | null = null, hash = '') {
	const steps: string[] = []
	const written: string[] = []
	const location: LocationApi = { read: () => hash, write: (next) => written.push(next) }
	const cull: FolderSetOpeningCull = {
		folderSet: () => open,
		shownFileId: () => shown,
		open: (set) => steps.push(`open ${set.paths.join(',')}`),
		list: async (set, openCull, opened) => {
			steps.push(`list ${set.paths.join(',')}`)
			openCull(set, [], NO_ACCESS)
			opened()
		},
		openPosition: async (position, opener) => {
			steps.push(`position ${position.fileId}`)
			opener.open(position.folderSet, [], NO_ACCESS)
			opener.resumeAt(position.fileId)
			opener.resumeOpen()
		},
		offer: () => steps.push('offer'),
		resumeAt: (fileId) => steps.push(`resume at ${fileId}`),
		resume: () => steps.push('resume'),
		leave: () => steps.push('leave'),
		choose: (target) => steps.push(`choose ${target}`),
	}
	return { steps, written, source: useFolderSetOpening(location, cull) }
}

describe('useFolderSetOpening', () => {
	it('opens a confirmed folder set and offers its resume position', () => {
		const { steps, source } = opening()

		source.openFolderSet(TRIP, [], NO_ACCESS)

		expect(steps).toEqual(['open /Trip', 'offer'])
	})

	it('opens a listed folder set with the resume offer when no picture is named', async () => {
		const { steps, source } = opening()

		await source.openAt(TRIP, null)

		expect(steps).toEqual(['list /Trip', 'open /Trip', 'offer'])
	})

	it('opens a listed folder set at the named picture, without the offer', async () => {
		const { steps, source } = opening()

		await source.openAt(TRIP, 7)

		expect(steps).toEqual(['list /Trip', 'open /Trip', 'resume at 7'])
	})

	it('reloads the open folder set at the picture the loupe shows', async () => {
		const { steps, source } = opening(TRIP, 4)

		source.reload()
		await Promise.resolve()

		expect(steps).toEqual(['list /Trip', 'open /Trip', 'resume at 4'])
	})

	it('reloads nothing while no folder set is open', () => {
		const { steps, source } = opening()

		source.reload()

		expect(steps).toEqual([])
	})

	it('opens a recent position, leaving the picker and the folders home before it resumes', async () => {
		const { steps, source } = opening()

		source.openRecent({ folderSet: TRIP, fileId: 3, decided: 1, total: 2 })
		await Promise.resolve()

		expect(steps).toEqual(['position 3', 'open /Trip', 'resume at 3', 'leave', 'resume'])
	})

	it('opens the cull the address names at its picture', async () => {
		const { steps } = opening(null, null, locationHash(TRIP, 9))
		await Promise.resolve()

		expect(steps).toEqual(['list /Trip', 'open /Trip', 'resume at 9'])
	})

	it('keeps the address on the open cull', () => {
		const { written } = opening(TRIP, 4)

		expect(written).toEqual([locationHash(TRIP, 4)])
	})
})
