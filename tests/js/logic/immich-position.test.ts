// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { defaultImmichFilters } from '../../../src/logic/immich-filters.ts'
import { parseImmichPositions, recentConnections, resumeFilters, withImmichPosition } from '../../../src/logic/immich-position.ts'
import { NOW, UTC_CALENDAR } from './immich-fixtures.ts'

const ASSET = '00000000-0000-4000-8000-000000000600'
const position = { immich: 'andy-phone', assetId: ASSET, takenAt: NOW - 60, decided: 599, total: 1000, updatedAt: NOW }
const folderPosition = { folderSet: { paths: ['/Trip'], subfolders: true }, fileId: 4, decided: 1, total: 3, updatedAt: NOW }
const DAY = 86400
const defaults = defaultImmichFilters(NOW, UTC_CALENDAR)

describe('parseImmichPositions', () => {
	// spec: IMMICH-003.14
	it('keeps the positions of connections in their order and drops the folder sets\'', () => {
		const other = { ...position, immich: 'andy-camera' }

		expect(parseImmichPositions([position, folderPosition, other])).toEqual([
			{ connectionId: 'andy-phone', assetId: ASSET, takenAt: NOW - 60, decided: 599, total: 1000, updatedAt: NOW },
			{ connectionId: 'andy-camera', assetId: ASSET, takenAt: NOW - 60, decided: 599, total: 1000, updatedAt: NOW },
		])
	})

	it('drops malformed positions and answers nothing for an answer that is no list', () => {
		const malformed = [null, 'x', { ...position, immich: 1 }, { ...position, assetId: null }, { ...position, takenAt: '1' }, { ...position, decided: '1' }, { ...position, total: null }, { ...position, updatedAt: undefined }]

		expect(parseImmichPositions(malformed)).toEqual([])
		expect(parseImmichPositions({ positions: [position] })).toEqual([])
	})
})

describe('resumeFilters', () => {
	// spec: IMMICH-003.14
	it('keeps filters whose time covers the asset and that admit an undecided picture', () => {
		const filters = { ...defaults, flags: new Set(['unflagged', 'picked'] as const), devices: new Set(['Pixel 9 Pro']) }

		expect(resumeFilters(filters, NOW - 60, NOW, UTC_CALENDAR)).toBe(filters)
	})

	// spec: IMMICH-003.14
	it('puts every filter back with the whole time when the time leaves the asset out or no undecided picture passes', () => {
		const lastMonth = Date.UTC(2026, 9, 31, 23, 59, 59) / 1000
		const allTime = { ...defaults, time: { kind: 'all' } }

		expect(resumeFilters(defaults, lastMonth, NOW, UTC_CALENDAR)).toEqual(allTime)
		expect(resumeFilters({ ...defaults, time: { kind: 'last-7-days' } }, NOW - 7 * DAY - 1, NOW, UTC_CALENDAR)).toEqual(allTime)
		expect(resumeFilters({ ...defaults, time: { kind: 'last-7-days' } }, NOW - 7 * DAY, NOW, UTC_CALENDAR).time).toEqual({ kind: 'last-7-days' })
		expect(resumeFilters({ ...defaults, flags: new Set(['picked'] as const) }, NOW - 60, NOW, UTC_CALENDAR)).toEqual(allTime)
		expect(resumeFilters({ ...defaults, rating: 3 }, NOW - 60, NOW, UTC_CALENDAR)).toEqual(allTime)
	})

	// spec: IMMICH-003.14
	it('takes the month\'s end as outside it, its start as inside', () => {
		const november = Date.UTC(2026, 10, 1) / 1000
		const december = Date.UTC(2026, 11, 1) / 1000

		expect(resumeFilters(defaults, november, NOW, UTC_CALENDAR)).toBe(defaults)
		expect(resumeFilters(defaults, december, NOW, UTC_CALENDAR).time).toEqual({ kind: 'all' })
	})
})

describe('recentConnections', () => {
	const connections = [{ id: 'andy-phone', label: 'Andy’s phone', url: 'https://immich.example.org' }, { id: 'andy-camera', label: 'Camera', url: 'https://immich.example.org' }]

	// spec: IMMICH-003.15
	it('lists each position by its connection\'s label, newest first, and leaves out a connection the user no longer has', () => {
		const positions = parseImmichPositions([{ ...position, immich: 'andy-camera', decided: 2, total: 9 }, { ...position, immich: 'gone' }, position])

		expect(recentConnections(positions, connections)).toEqual([
			{ connectionId: 'andy-camera', label: 'Camera', decided: 2, total: 9 },
			{ connectionId: 'andy-phone', label: 'Andy’s phone', decided: 599, total: 1000 },
		])
		expect(recentConnections([], connections)).toEqual([])
	})
})

describe('withImmichPosition', () => {
	// spec: IMMICH-003.23
	it('puts a saved position first, in place of the one of the same connection', () => {
		const [phone, camera] = parseImmichPositions([position, { ...position, immich: 'andy-camera' }])
		const saved = { ...phone!, decided: 600, updatedAt: NOW + 5 }

		expect(withImmichPosition([phone!, camera!], { ...camera!, decided: 3 })).toEqual([{ ...camera!, decided: 3 }, phone!])
		expect(withImmichPosition([camera!, phone!], saved)).toEqual([saved, camera!])
		expect(withImmichPosition([], saved)).toEqual([saved])
	})
})
