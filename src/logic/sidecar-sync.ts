// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { EmbeddedXmpAnswer } from './embedded-xmp.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { TagChange } from './tag.ts'
import type { SidecarBytes } from './xmp/decision.ts'
import type { XmpPacket, XmpRefusal, XmpTime } from './xmp/model.ts'

import { sameDecision, UNDECIDED } from './decision.ts'
import { embeddedSidecarPath, embeddedSourceOf, embeddedXmpSource } from './embedded-xmp.ts'
import { parseFileName, splitFolder } from './file-name.ts'
import { pictureMembers } from './pairing.ts'
import { isMemberSidecar } from './sidecars.ts'
import { pictureSidecarDecision, sidecarDecision } from './xmp/decision.ts'
import { mergeDecision } from './xmp/merge.ts'
import { EMPTY_PACKET, XmpError } from './xmp/model.ts'
import { readableXmp, readXmp } from './xmp/parse.ts'
import { serializeXmp } from './xmp/serialize.ts'
import { mergeTags, pictureTags, tagWrite } from './xmp/tags.ts'
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
	readonly tags?: TagChange
}

/** What a write changes in a picture's sidecars: the decision fields, or the tag fields by a change. */
export type SidecarEdit = { readonly decision: Decision } | { readonly tags: TagChange }

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

/** The pictures without a stored decision for any member that have sidecars or an embedded XMP to take one or tags from. */
export function takeOverLookups(pictures: readonly Picture<ListingEntry>[], stored: ReadonlySet<number>): TakeOverLookup[] {
	return pictures
		.filter((picture) => !pictureMembers(picture).some((member) => stored.has(member.fileId)))
		.map((picture) => ({ picture, sidecars: sidecarTargets(picture).existing }))
		.filter(({ picture, sidecars }) => sidecars.length > 0 || embeddedXmpSource(picture) !== null)
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

/** The saves that write the edit to the picture's sidecars (to `paths` only, when given), and the sidecars that cannot be written; a tag edit needs the embedded XMP's answers. */
export function planSaves(picture: Picture<ListingEntry>, edit: SidecarEdit, known: Known, answers: Answers, time: XmpTime, paths?: ReadonlySet<string>, embedded: ReadonlyMap<number, EmbeddedXmpAnswer> = new Map()) {
	const saves: PlannedSave[] = []
	const failed: SidecarFailure[] = []
	const targets = targetsOf(picture, known).map((target) => {
		const answer = target.saved === null && target.fileId !== null ? answers.get(target.fileId) : undefined
		return { ...target, answer, source: target.saved ?? (answer?.result === 'read' ? answer : null) }
	})
	const jpeg = 'tags' in edit ? embeddedXmpSource(picture, known) : null
	const inEmbedded = jpeg === null ? { packet: null } : embeddedSourceOf(embedded.get(jpeg.fileId))
	const written = targets.filter((target) => paths === undefined || paths.has(target.path))
	if ('failure' in inEmbedded) {
		return { saves, failed: written.map(({ path }) => ({ path, picture, reason: inEmbedded.failure })) }
	}
	const embeddedPackets = inEmbedded.packet === null ? [] : [inEmbedded.packet]
	const { change, creates } = editorOf(edit, isPair(picture), [...targets.flatMap(({ source }) => (source === null ? [] : readableXmp(source.bytes) ?? [])), ...embeddedPackets])
	// A JPEG sidecar without tags keeps removed embedded tags removed (TAGS-002.19).
	const replacesEmbedded = jpeg !== null && pictureTags(embeddedPackets).length > 0 ? embeddedSidecarPath(jpeg) : null
	for (const { path, fileId, answer, source } of written) {
		if (fileId !== null && source === null) {
			failed.push({ path, picture, reason: (answer?.result ?? 'unreachable') as SidecarFailureReason })
			continue
		}
		if (fileId === null && !creates && path !== replacesEmbedded) {
			continue
		}
		try {
			const bytes = serializeXmp(change(source === null ? EMPTY_PACKET : readXmp(source.bytes)), time)
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
	return pictureMembers(picture).some((member) => {
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

/** How the edit changes a sidecar, and whether it creates missing ones: a tag change applies to the union of the sidecars read, and creates them only while tags are left. */
function editorOf(edit: SidecarEdit, pair: boolean, sources: readonly XmpPacket[]): { change: (packet: XmpPacket) => XmpPacket, creates: boolean } {
	if ('decision' in edit) {
		const { decision } = edit
		return {
			change: (packet) => mergeDecision(packet, decision, { isPair: pair, colourLabelChanged: sidecarDecision(packet, pair).colourLabel !== decision.colourLabel }),
			creates: true,
		}
	}
	const write = tagWrite(sources, edit.tags)
	return { change: (packet) => mergeTags(packet, write), creates: write.tags.length > 0 }
}

/** Whether the picture is a pair. */
function isPair(picture: Picture<ListingEntry>): boolean {
	return picture.raw !== null && picture.rendered !== null
}
