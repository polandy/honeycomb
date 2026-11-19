// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SessionState } from '../../../src/logic/cull-session.ts'

import { describe, expect, it } from 'vitest'
import { finishesCull, IDLE_LIMIT_MS, pictureBytes, sessionNumbers, sessionState, startSession, totalsOf, withDeleted, withInput, withSaved, withStep } from '../../../src/logic/cull-session.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

const states = (entries: Record<number, SessionState>) => new Map(Object.entries(entries).map(([key, state]) => [Number(key), state]))
const SESSION = startSession({ pictures: 3, bytes: 30 })
const AFTER = { pictures: 3, bytes: 30 }

describe('sessionState', () => {
	it('names a decided picture by its flag and an unflagged one in a done series unflagged', () => {
		expect(sessionState('picked', true)).toBe('picked')
		expect(sessionState('rejected', true)).toBe('rejected')
		expect(sessionState('unflagged', true)).toBe('unflagged')
		expect(sessionState('unflagged', false)).toBe('undecided')
	})
})

describe('pictureBytes and totalsOf', () => {
	it('adds every member and sidecar of a picture, and the pictures of a folder set', () => {
		const [pair, single] = picturesOf([
			listingEntry(1, '/Trip/IMG_1.CR3', { mime: 'image/x-dcraw', size: 20 }),
			listingEntry(2, '/Trip/IMG_1.JPG', { size: 5 }),
			listingEntry(3, '/Trip/IMG_1.xmp', { mime: 'application/octet-stream', size: 1 }),
			listingEntry(4, '/Trip/IMG_2.JPG', { size: 7 }),
		])
		expect(pictureBytes(pair!)).toBe(26)
		expect(totalsOf([pair!, single!])).toEqual({ pictures: 2, bytes: 33 })
	})
})

describe('withStep', () => {
	// spec: STATS-001.32
	it('counts the pictures a step changed by their state now, net of an undo', () => {
		const before = states({ 1: 'undecided', 2: 'undecided', 3: 'undecided', 4: 'picked' })
		const decided = withStep(SESSION, before, states({ 1: 'picked', 2: 'picked', 3: 'rejected', 4: 'picked' }))
		const undone = withStep(decided, states({ 1: 'picked', 2: 'picked', 3: 'rejected', 4: 'picked' }), states({ 1: 'picked', 2: 'undecided', 3: 'rejected', 4: 'picked' }))
		expect(sessionNumbers(undone, AFTER, 0)).toMatchObject({ decided: 2, picked: 1, unflagged: 0, rejected: 1 })
	})

	// spec: STATS-001.32
	it('counts the unflagged pictures a series done decided as unflagged', () => {
		const session = withStep(SESSION, states({ 1: 'undecided', 2: 'picked' }), states({ 1: 'unflagged', 2: 'picked' }))
		expect(sessionNumbers(session, AFTER, 0)).toMatchObject({ decided: 1, picked: 0, unflagged: 1 })
	})

	it('keeps a picture a step took out of the listing at its last state', () => {
		const session = withStep(SESSION, states({ 1: 'undecided' }), states({ 1: 'rejected' }))
		expect(sessionNumbers(withStep(session, states({ 2: 'undecided' }), states({})), AFTER, 0)).toMatchObject({ decided: 1, rejected: 1 })
	})
})

describe('finishesCull', () => {
	// spec: STATS-001.19
	it('finishes when a step leaves no undecided picture of some before', () => {
		expect(finishesCull(states({ 1: 'undecided', 2: 'picked' }), states({ 1: 'rejected', 2: 'picked' }))).toBe(true)
	})

	// spec: STATS-001.19
	it('does not finish while one is undecided, nor when none was before', () => {
		expect(finishesCull(states({ 1: 'undecided', 2: 'undecided' }), states({ 1: 'picked', 2: 'undecided' }))).toBe(false)
		expect(finishesCull(states({ 1: 'picked' }), states({ 1: 'rejected' }))).toBe(false)
		expect(finishesCull(states({}), states({}))).toBe(false)
	})
})

describe('withDeleted', () => {
	// spec: STATS-001.33
	it('counts a picture moved to the trash bin once with the bytes of its files', () => {
		const session = withDeleted(SESSION, [{ picture: 1, bytes: 8, permanent: false }, { picture: 1, bytes: 2, permanent: false }])
		expect(sessionNumbers(session, { pictures: 2, bytes: 20 }, 0)).toMatchObject({ trashed: 1, deleted: 0, freedBytes: 10, before: { pictures: 3, bytes: 30 }, after: { pictures: 2, bytes: 20 } })
	})

	// spec: STATS-001.30
	it('counts a picture with a file deleted for good as deleted for good only, across two deletes', () => {
		const trashed = withDeleted(SESSION, [{ picture: 1, bytes: 8, permanent: false }, { picture: 2, bytes: 4, permanent: false }])
		const session = withDeleted(trashed, [{ picture: 1, bytes: 2, permanent: true }])
		expect(sessionNumbers(session, AFTER, 0)).toMatchObject({ trashed: 1, deleted: 1, freedBytes: 14 })
	})
})

describe('withSaved', () => {
	it('counts each sidecar once, a created one as created however often it is saved again', () => {
		const first = withSaved(SESSION, [{ path: '/a.xmp', created: true }, { path: '/b.xmp', created: false }])
		const session = withSaved(first, [{ path: '/a.xmp', created: false }, { path: '/b.xmp', created: false }, { path: '/c.xmp', created: false }])
		expect(sessionNumbers(session, AFTER, 0)).toMatchObject({ sidecarsCreated: 1, sidecarsUpdated: 2 })
	})
})

describe('withInput', () => {
	// spec: STATS-001.35
	it('adds the time between inputs, at most 2 minutes each, and the time since the last', () => {
		const session = [0, 30_000, 300_000].reduce(withInput, SESSION)
		expect(sessionNumbers(session, AFTER, 300_000).activeMs).toBe(150_000)
		expect(sessionNumbers(session, AFTER, 300_000 + 10_000).activeMs).toBe(160_000)
		expect(sessionNumbers(session, AFTER, 300_000 + 10 * IDLE_LIMIT_MS).activeMs).toBe(150_000 + IDLE_LIMIT_MS)
	})

	// spec: STATS-001.17
	it('counts nothing before the first input', () => {
		expect(sessionNumbers(SESSION, AFTER, 60_000).activeMs).toBe(0)
	})
})

describe('sessionNumbers perMinute', () => {
	it('divides the pictures decided by the active minutes, and has none without active time', () => {
		const decided = withStep(SESSION, states({ 1: 'undecided', 2: 'undecided', 3: 'undecided' }), states({ 1: 'picked', 2: 'picked', 3: 'rejected' }))
		const session = [0, 60_000, 120_000].reduce(withInput, decided)
		expect(sessionNumbers(session, AFTER, 120_000).perMinute).toBe(1.5)
		expect(sessionNumbers(decided, AFTER, 0).perMinute).toBeNull()
	})
})
