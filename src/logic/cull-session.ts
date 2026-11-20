// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Flag } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PictureId } from './picture-id.ts'

import { sinceLastInput } from './active-time.ts'
import { filesOf } from './delete-summary.ts'

const MINUTE_MS = 60_000

/** What a picture is to *Cull finished*: decided by its flag, or undecided. */
export type SessionState = Flag | 'undecided'

/** The pictures of the folder set and their bytes, members and sidecars included. */
export interface SessionTotals {
	readonly pictures: number
	readonly bytes: number
}

/** One file a delete of the session took out, by the key of its picture. */
export interface SessionDelete {
	readonly picture: number
	readonly bytes: number
	readonly permanent: boolean
}

/** One sidecar the session saved, and whether that save created it. */
export interface SessionSave {
	readonly path: string
	readonly created: boolean
}

/** What a cull session did since its folder set opened; computed in the browser and never sent. */
export interface CullSession {
	readonly before: SessionTotals
	/** The state now of each picture a step of the user changed, by picture key. */
	readonly changed: ReadonlyMap<PictureId, SessionState>
	/** Each picture a delete took out, by key: whether a file of it was deleted for good. */
	readonly removed: ReadonlyMap<PictureId, boolean>
	readonly freedBytes: number
	/** Each sidecar saved, by path: whether a save created it. */
	readonly sidecars: ReadonlyMap<string, boolean>
	readonly activeMs: number
	readonly lastInput: number | null
}

/** The numbers *Cull finished* shows (STATS-001). */
export interface SessionNumbers {
	readonly decided: number
	readonly picked: number
	readonly unflagged: number
	readonly rejected: number
	readonly trashed: number
	readonly deleted: number
	readonly freedBytes: number
	readonly sidecarsCreated: number
	readonly sidecarsUpdated: number
	readonly before: SessionTotals
	readonly after: SessionTotals
	readonly activeMs: number
	/** Pictures decided per active minute; null below one active minute, where the rate is noise. */
	readonly perMinute: number | null
}

/** A session of a folder set that opened with `before`. */
export function startSession(before: SessionTotals): CullSession {
	return { before, changed: new Map(), removed: new Map(), freedBytes: 0, sidecars: new Map(), activeMs: 0, lastInput: null }
}

/** A picture's state from its flag and whether it counts as decided. */
export function sessionState(flag: Flag, decided: boolean): SessionState {
	return decided ? flag : 'undecided'
}

/** The bytes of a picture's members and sidecars. */
export function pictureBytes(picture: Picture<ListingEntry>): number {
	return filesOf(picture).reduce((sum, { entry }) => sum + entry.size, 0)
}

/** The pictures and their bytes. */
export function totalsOf(pictures: readonly Picture<ListingEntry>[]): SessionTotals {
	return { pictures: pictures.length, bytes: pictures.reduce((sum, picture) => sum + pictureBytes(picture), 0) }
}

/** The session with the pictures a step changed at their state after it; a picture the step took out keeps its last state. */
export function withStep(session: CullSession, before: ReadonlyMap<PictureId, SessionState>, after: ReadonlyMap<PictureId, SessionState>): CullSession {
	const changed = new Map(session.changed)
	after.forEach((state, key) => {
		if (before.get(key) !== state) {
			changed.set(key, state)
		}
	})
	return { ...session, changed }
}

/** Whether a step took the last undecided picture: some before, none after. */
export function finishesCull(before: ReadonlyMap<PictureId, SessionState>, after: ReadonlyMap<PictureId, SessionState>): boolean {
	return [...before.values()].includes('undecided') && ![...after.values()].includes('undecided')
}

/** The session with a delete's files; a picture with a file deleted for good counts as deleted for good. */
export function withDeleted(session: CullSession, files: readonly SessionDelete[]): CullSession {
	const removed = new Map(session.removed)
	files.forEach(({ picture, permanent }) => removed.set(picture, (removed.get(picture) ?? false) || permanent))
	return { ...session, removed, freedBytes: files.reduce((sum, { bytes }) => sum + bytes, session.freedBytes) }
}

/** The session with saved sidecars; a sidecar the session created stays created. */
export function withSaved(session: CullSession, saves: readonly SessionSave[]): CullSession {
	const sidecars = new Map(session.sidecars)
	saves.forEach(({ path, created }) => sidecars.set(path, (sidecars.get(path) ?? false) || created))
	return { ...session, sidecars }
}

/** The session with an input at `at` ms: the time since the last input counts, at most the idle limit. */
export function withInput(session: CullSession, at: number): CullSession {
	return { ...session, activeMs: session.activeMs + sinceLastInput(session.lastInput, at), lastInput: at }
}

/** The numbers of the session read at `at` ms, with the folder set's totals now. */
export function sessionNumbers(session: CullSession, after: SessionTotals, at: number): SessionNumbers {
	const states = [...session.changed.values()]
	const count = (state: SessionState) => states.filter((each) => each === state).length
	const decided = states.length - count('undecided')
	const deleted = [...session.removed.values()].filter(Boolean).length
	const created = [...session.sidecars.values()].filter(Boolean).length
	const activeMs = session.activeMs + sinceLastInput(session.lastInput, at)
	return {
		decided,
		picked: count('picked'),
		unflagged: count('unflagged'),
		rejected: count('rejected'),
		trashed: session.removed.size - deleted,
		deleted,
		freedBytes: session.freedBytes,
		sidecarsCreated: created,
		sidecarsUpdated: session.sidecars.size - created,
		before: session.before,
		after,
		activeMs,
		perMinute: activeMs < MINUTE_MS ? null : decided / (activeMs / MINUTE_MS),
	}
}
