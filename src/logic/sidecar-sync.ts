// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { SidecarBytes } from './xmp/decision.ts'
import type { XmpRefusal, XmpTime } from './xmp/model.ts'

import { sameDecision, UNDECIDED } from './decision.ts'
import { parseFileName, splitFolder } from './file-name.ts'
import { isMemberSidecar } from './sidecars.ts'
import { pictureSidecarDecision, sidecarDecision } from './xmp/decision.ts'
import { mergeDecision } from './xmp/merge.ts'
import { EMPTY_PACKET, XmpError } from './xmp/model.ts'
import { readXmp } from './xmp/parse.ts'
import { serializeXmp } from './xmp/serialize.ts'
import { sidecarTargets } from './xmp/targets.ts'

/** What the lookup endpoint answers for a sidecar other than its bytes (XMP-002). */
export type SidecarLookupFailure = 'notFound' | 'tooLarge' | 'notPermitted' | 'locked' | 'failed'

/** What the save endpoint answers for a sidecar it did not save (XMP-002). */
export type SidecarSaveFailure = 'notFound' | 'changed' | 'notPermitted' | 'locked' | 'failed'

/** The lookup endpoint's answer for one sidecar. */
export type SidecarLookupAnswer
	= | { readonly result: 'read', readonly bytes: Uint8Array, readonly etag: string, readonly size: number, readonly mtime: number }
		| { readonly result: SidecarLookupFailure }

/** One sidecar to save: an existing one with the ETag and size read, or a new one by path. */
export type SidecarSaveItem
	= | { readonly fileId: number, readonly etag: string, readonly size: number, readonly bytes: Uint8Array }
		| { readonly path: string, readonly bytes: Uint8Array }

/** The save endpoint's answer for one sidecar. */
export type SidecarSaveAnswer
	= | { readonly result: 'saved', readonly fileId: number, readonly etag: string, readonly size: number, readonly mtime: number }
		| { readonly result: SidecarSaveFailure }

/** Why a sidecar was not read or written; `unreachable` when its request failed. */
export type SidecarFailureReason = XmpRefusal | SidecarLookupFailure | SidecarSaveFailure | 'unreachable'

/** A sidecar that could not be written, with its picture for a retry. */
export interface SidecarFailure {
	readonly path: string
	readonly picture: Picture<ListingEntry>
	readonly reason: SidecarFailureReason
}

/** A sidecar honeycomb knows by path: its file id and, while nobody else changed it, what honeycomb saved. */
export interface KnownSidecar {
	readonly fileId: number
	readonly saved: { readonly etag: string, readonly size: number, readonly bytes: Uint8Array } | null
}

/** A picture whose sidecars' decision is looked up, and those sidecars. */
export interface TakeOverLookup {
	readonly picture: Picture<ListingEntry>
	readonly sidecars: readonly ListingEntry[]
}

/** A sidecar save of a picture's write. */
export interface PlannedSave {
	readonly picture: Picture<ListingEntry>
	readonly path: string
	readonly item: SidecarSaveItem
}

type Answers = ReadonlyMap<number, SidecarLookupAnswer>
type Known = ReadonlyMap<string, KnownSidecar>

/** The pictures without a stored decision for any member that have sidecars to take one from. */
export function takeOverLookups(pictures: readonly Picture<ListingEntry>[], stored: ReadonlySet<number>): TakeOverLookup[] {
	return pictures
		.filter((picture) => !members(picture).some((member) => stored.has(member.fileId)))
		.map((picture) => ({ picture, sidecars: sidecarTargets(picture).existing }))
		.filter(({ sidecars }) => sidecars.length > 0)
}

/** The decision each picture takes over from its sidecars, other than undecided, and what to warn about. */
export function takeOverDecisions(lookups: readonly TakeOverLookup[], answers: Answers) {
	const decided: { readonly picture: Picture<ListingEntry>, readonly decision: Decision }[] = []
	const warnings: { readonly path: string, readonly reason: SidecarFailureReason | 'disagrees' }[] = []
	for (const { picture, sidecars } of lookups) {
		const rawName = picture.raw === null ? null : parseFileName(picture.raw.path).name
		const read: SidecarBytes[] = []
		for (const sidecar of sidecars) {
			const answer = answers.get(sidecar.fileId)
			if (answer?.result === 'read') {
				read.push({ name: sidecar.path, mtime: answer.mtime, ofRaw: rawName !== null && isMemberSidecar(parseFileName(sidecar.path), rawName), bytes: answer.bytes })
			} else {
				warnings.push({ path: sidecar.path, reason: answer?.result ?? 'unreachable' })
			}
		}
		const { winner, disagreeing, refused } = pictureSidecarDecision(read, isPair(picture))
		warnings.push(...refused.map(({ name, error }) => ({ path: name, reason: error.reason })), ...disagreeing.map((path) => ({ path, reason: 'disagrees' as const })))
		if (winner !== null && !sameDecision(winner.decision, UNDECIDED)) {
			decided.push({ picture, decision: winner.decision })
		}
	}
	return { decided, warnings }
}

/** The file ids of the picture's sidecars to read before a write: those honeycomb holds no bytes of. */
export function writeLookups(picture: Picture<ListingEntry>, known: Known, paths?: ReadonlySet<string>): number[] {
	return targetsOf(picture, known, paths).flatMap(({ fileId, saved }) => (saved === null && fileId !== null ? [fileId] : []))
}

/** The saves that write the decision to the picture's sidecars, and the sidecars that cannot be written. */
export function planSaves(picture: Picture<ListingEntry>, decision: Decision, known: Known, answers: Answers, time: XmpTime, paths?: ReadonlySet<string>) {
	const saves: PlannedSave[] = []
	const failed: SidecarFailure[] = []
	for (const { path, fileId, saved } of targetsOf(picture, known, paths)) {
		const answer = saved === null && fileId !== null ? answers.get(fileId) : undefined
		const source = saved ?? (answer?.result === 'read' ? answer : null)
		if (fileId !== null && source === null) {
			failed.push({ path, picture, reason: (answer?.result ?? 'unreachable') as SidecarFailureReason })
			continue
		}
		try {
			const bytes = merged(source?.bytes ?? null, decision, isPair(picture), time)
			saves.push({ picture, path, item: fileId === null || source === null ? { path, bytes } : { fileId, etag: source.etag, size: source.size, bytes } })
		} catch (error) {
			if (!(error instanceof XmpError)) {
				throw error
			}
			failed.push({ path, picture, reason: error.reason })
		}
	}
	return { saves, failed }
}

/** What the save answers mean: the sidecars now known, the failed ones, and the existing ones that changed meanwhile; `null` answers a failed request. */
export function applySaves(saves: readonly PlannedSave[], answers: readonly SidecarSaveAnswer[] | null, before: Known) {
	const known = new Map(before)
	const failed: SidecarFailure[] = []
	const changed: PlannedSave[] = []
	saves.forEach((save, index) => {
		const answer = answers?.[index]
		const fileId = 'fileId' in save.item ? save.item.fileId : null
		if (answer?.result === 'saved') {
			known.set(save.path, { fileId: answer.fileId, saved: { etag: answer.etag, size: answer.size, bytes: save.item.bytes } })
			return
		}
		if (fileId === null || answer?.result === 'notFound') {
			known.delete(save.path)
		} else {
			known.set(save.path, { fileId, saved: null })
		}
		if (answer?.result === 'changed' && fileId !== null) {
			changed.push(save)
		} else {
			failed.push({ path: save.path, picture: save.picture, reason: answer?.result ?? 'unreachable' })
		}
	})
	return { known, failed, changed }
}

/** Whether a member of the picture lies in one of the shared folders. */
export function inSharedFolder(picture: Picture<ListingEntry>, shared: ReadonlySet<string>): boolean {
	return members(picture).some((member) => {
		const folder = splitFolder(member.path).parent
		return shared.has(folder) || (folder === '' && shared.has('/'))
	})
}

/** The paths a write goes to, each with its file id when it exists and what honeycomb saved there. */
function targetsOf(picture: Picture<ListingEntry>, known: Known, paths?: ReadonlySet<string>) {
	const { existing, created } = sidecarTargets(picture)
	const targets = [...existing.map((entry) => ({ path: entry.path, fileId: entry.fileId as number | null })), ...created.map((path) => ({ path, fileId: null }))]
	return targets
		.filter(({ path }) => paths === undefined || paths.has(path))
		.map(({ path, fileId }) => {
			const own = known.get(path)
			return { path, fileId: own?.fileId ?? fileId, saved: own?.saved ?? null }
		})
}

/** The sidecar's bytes, or a new one's, with the decision merged in; a refused sidecar throws its `XmpError`. */
function merged(existing: Uint8Array | null, decision: Decision, pair: boolean, time: XmpTime): Uint8Array {
	const packet = existing === null ? EMPTY_PACKET : readXmp(existing)
	const colourLabelChanged = sidecarDecision(packet, pair).colourLabel !== decision.colourLabel
	return serializeXmp(mergeDecision(packet, decision, { isPair: pair, colourLabelChanged }), time)
}

/** The picture's members. */
function members(picture: Picture<ListingEntry>): ListingEntry[] {
	return [picture.raw, picture.rendered].filter((member) => member !== null)
}

/** Whether the picture is a pair. */
function isPair(picture: Picture<ListingEntry>): boolean {
	return picture.raw !== null && picture.rendered !== null
}
