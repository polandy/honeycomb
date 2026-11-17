// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { listEntries } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

describe('listEntries with excluded folders', () => {
	// spec: LISTING-001.16
	it('names the excluded folders below the listed one', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [], truncated: false } })

		await listEntries('/Photos', true, ['/Photos/Raw', '/Photos/Old'])

		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/entries', { params: { path: '/Photos', subfolders: 1, excluded: ['/Photos/Raw', '/Photos/Old'] } })
	})

	// spec: LISTING-001.16
	it('leaves the parameter out when nothing is excluded', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [], truncated: false } })

		await listEntries('/Photos', true, [])

		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/entries', { params: { path: '/Photos', subfolders: 1 } })
	})
})
