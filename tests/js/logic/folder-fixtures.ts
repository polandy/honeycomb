// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderRow } from '../../../src/logic/folder-row.ts'

import { PERMISSION_UPDATE } from '../../../src/logic/folder-row.ts'

const MB = 1024 * 1024

/** A folder row with 100 photos, 40 undecided, and the given overrides. */
export function row(overrides: Partial<FolderRow> = {}): FolderRow {
	return {
		fileId: 1,
		root: '/Photos',
		path: '/Photos/a',
		photos: 100,
		bytes: 100 * 5 * MB,
		rawBytes: 0,
		picked: 40,
		rejected: 20,
		undecided: 40,
		bursts: 0,
		oldest: Date.UTC(2020, 5, 1) / 1000,
		newest: Date.UTC(2020, 5, 2) / 1000,
		lastActivity: null,
		previews: [],
		permissions: PERMISSION_UPDATE,
		done: null,
		...overrides,
	}
}

/** A row of a folder that is done with `photosThen` photos. */
export function doneRow(overrides: Partial<FolderRow> = {}, photosThen = 100): FolderRow {
	return row({ undecided: 0, picked: 100, done: { by: 'Andy', at: Date.UTC(2026, 10, 2) / 1000, photos: photosThen }, ...overrides })
}
