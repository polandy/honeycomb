// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PlannedSave, SidecarSaveAnswer } from './sidecar-sync.ts'

import { pictureMembers } from './pairing.ts'
import { SIDECAR_EXTENSION } from './sidecars.ts'

/** A sidecar as honeycomb last saved it. */
interface SavedState {
	readonly fileId: number
	readonly etag: string
	readonly size: number
	readonly mtime: number
}

/** honeycomb's own sidecar saves: each by the file id and ETag it replaced, each new sidecar by its path. */
export interface OwnSaves {
	readonly replaced: ReadonlyMap<string, SavedState>
	readonly created: ReadonlyMap<string, SavedState>
}

/** No save yet. */
export const NO_OWN_SAVES: OwnSaves = { replaced: new Map(), created: new Map() }

/** Nextcloud's mime type for an extension it does not know, as the listing reports a sidecar. */
const SIDECAR_MIME = 'application/octet-stream'

const keyOf = (fileId: number, etag: string) => `${fileId}:${etag}`

/** The own saves with the saved answers added; a failed save or request adds nothing. */
export function recordSaves(own: OwnSaves, saves: readonly PlannedSave[], answers: readonly SidecarSaveAnswer[] | null): OwnSaves {
	const replaced = new Map(own.replaced)
	const created = new Map(own.created)
	saves.forEach(({ path, item }, index) => {
		const answer = answers?.[index]
		if (answer?.result !== 'saved') {
			return
		}
		const state = { fileId: answer.fileId, etag: answer.etag, size: answer.size, mtime: answer.mtime }
		if ('fileId' in item) {
			replaced.set(keyOf(item.fileId, item.etag), state)
		} else {
			created.set(path, state)
		}
	})
	return { replaced, created }
}

/** The picture with each sidecar at honeycomb's last save since the listing, and the sidecars honeycomb created for its members; another program's change keeps the listed state (DELETE-002.17, .18). */
export function withOwnSaves(picture: Picture<ListingEntry>, own: OwnSaves): Picture<ListingEntry> {
	const listed = new Set(picture.sidecars.map((entry) => entry.path))
	const made = pictureMembers(picture).flatMap((member) => {
		const path = `${member.path}.${SIDECAR_EXTENSION}`
		const state = listed.has(path) ? undefined : own.created.get(path)
		return state === undefined ? [] : [newEntry(path, state)]
	})
	const sidecars = [...picture.sidecars, ...made].map((entry) => lastSaved(entry, own))
	return made.length === 0 && sidecars.every((entry, index) => entry === picture.sidecars[index]) ? picture : { ...picture, sidecars }
}

/** The entry at the end of honeycomb's saves that started from it; a chain has at most one step per save. */
function lastSaved(entry: ListingEntry, own: OwnSaves): ListingEntry {
	let last = entry
	for (let step = 0; step < own.replaced.size; step++) {
		const state = own.replaced.get(keyOf(last.fileId, last.etag))
		if (state === undefined) {
			break
		}
		last = { ...last, etag: state.etag, size: state.size, mtime: state.mtime }
	}
	return last
}

/** A listing entry for a sidecar honeycomb created. */
function newEntry(path: string, { fileId, etag, size, mtime }: SavedState): ListingEntry {
	return { fileId, path, size, mtime, etag, mime: SIDECAR_MIME, captureTime: null, orientation: null, width: null, height: null, camera: null, visualHash: null, flag: null, keepRaw: null, flagUpdated: null }
}
