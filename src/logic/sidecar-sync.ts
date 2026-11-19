// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, DecisionDelta, DecisionField } from './decision.ts'
import type { EmbeddedXmpAnswer } from './embedded-xmp.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PictureId } from './picture-id.ts'
import type { TagChange } from './tag.ts'
import type { SidecarBytes } from './xmp/decision.ts'
import type { XmpPacket, XmpRefusal, XmpTime } from './xmp/model.ts'

import { UNDECIDED } from './decision.ts'
import { embeddedSidecarPath, embeddedSourceOf, embeddedXmpSource } from './embedded-xmp.ts'
import { parseFileName } from './file-name.ts'
import { isMemberSidecar } from './sidecars.ts'
import { pictureSidecarDecision, sidecarDecision } from './xmp/decision.ts'
import { mergeDelta } from './xmp/merge.ts'
import { EMPTY_PACKET, XmpError } from './xmp/model.ts'
import { readableXmp, readXmp } from './xmp/parse.ts'
import { serializeXmp } from './xmp/serialize.ts'
import { mergeTags, pictureTags, tagWrite } from './xmp/tags.ts'
import { sidecarTargets } from './xmp/targets.ts'

/** What the lookup endpoint answers for a sidecar other than its bytes (XMP-002). */
export type SidecarLookupFailure = 'notFound' | 'tooLarge' | 'notPermitted' | 'locked' | 'failed'

/** What the save endpoint answers for a sidecar it did not save (XMP-002). */
export type SidecarSaveFailure = 'notFound' | 'changed' | 'noSpace' | 'notPermitted' | 'locked' | 'failed'

/** The lookup endpoint's answer for one sidecar. */
export type SidecarLookupAnswer
	= | { readonly result: 'read', readonly bytes: Uint8Array, readonly etag: string, readonly size: number, readonly mtime: number }
		| { readonly result: SidecarLookupFailure }

/** One sidecar to save: an existing one with the ETag and size read, or a new one by path. */
export type SidecarSaveItem
	= | { readonly fileId: PictureId, readonly etag: string, readonly size: number, readonly bytes: Uint8Array }
		| { readonly path: string, readonly bytes: Uint8Array }

/** The save endpoint's answer for one sidecar. */
export type SidecarSaveAnswer
	= | { readonly result: 'saved', readonly fileId: PictureId, readonly etag: string, readonly size: number, readonly mtime: number }
		| { readonly result: SidecarSaveFailure }

/** Why a sidecar was not read or written; `unreachable` when its request failed. */
export type SidecarFailureReason = XmpRefusal | SidecarLookupFailure | SidecarSaveFailure | 'unreachable'

/** A sidecar that could not be written, with its picture for a retry. */
export interface SidecarFailure {
	readonly path: string
	readonly picture: Picture<ListingEntry>
	readonly reason: SidecarFailureReason
	readonly tags?: TagChange
	readonly fields?: readonly DecisionField[]
}

/** What a write changes in a picture's sidecars: a decision delta, the tag fields by a change, or both. */
export type SidecarEdit = { readonly decision: DecisionDelta, readonly tags?: TagChange } | { readonly decision?: DecisionDelta, readonly tags: TagChange }

/** A sidecar honeycomb knows by path: its file id and, while nobody else changed it, what honeycomb saved. */
export interface KnownSidecar {
	readonly fileId: PictureId
	readonly saved: { readonly etag: string, readonly size: number, readonly mtime: number, readonly bytes: Uint8Array } | null
}

/** A sidecar save of a picture's write. */
export interface PlannedSave {
	readonly picture: Picture<ListingEntry>
	readonly path: string
	readonly item: SidecarSaveItem
}

type Answers = ReadonlyMap<number, SidecarLookupAnswer>
type Embedded = ReadonlyMap<number, EmbeddedXmpAnswer>
type Known = ReadonlyMap<string, KnownSidecar>

/** The file ids of the picture's sidecars to read before a write: those honeycomb holds no bytes of. */
export function writeLookups(picture: Picture<ListingEntry>, known: Known, paths?: ReadonlySet<string>): number[] {
	return targetsOf(picture, known, paths).flatMap(({ fileId, saved }) => (saved === null && fileId !== null ? [fileId] : []))
}

/** The saves that write the edit to the picture's sidecars (to `paths` only, when given), and the sidecars that cannot be written; it needs the answer of the JPEG's embedded XMP while that counts. */
export function planSaves(picture: Picture<ListingEntry>, edit: SidecarEdit, known: Known, answers: Answers, time: XmpTime, paths?: ReadonlySet<string>, embedded: Embedded = new Map()) {
	const saves: PlannedSave[] = []
	const failed: SidecarFailure[] = []
	const targets = targetsOf(picture, known).map((target) => {
		const answer = target.saved === null && target.fileId !== null ? answers.get(target.fileId) : undefined
		return { ...target, answer, source: target.saved ?? (answer?.result === 'read' ? answer : null) }
	})
	const jpeg = embeddedXmpSource(picture, known)
	const inJpeg = jpeg === null ? undefined : embedded.get(jpeg.fileId)
	const inEmbedded = jpeg === null ? { packet: null } : embeddedSourceOf(inJpeg)
	const written = targets.filter((target) => paths === undefined || paths.has(target.path))
	if ('failure' in inEmbedded) {
		return { saves, failed: written.map(({ path }) => ({ path, picture, reason: inEmbedded.failure })) }
	}
	const embeddedPackets = inEmbedded.packet === null ? [] : [inEmbedded.packet]
	const sources = targets.flatMap(({ path, source }) => (source === null ? [] : [sidecarBytes(picture, path, source)]))
	const stated = pictureSidecarDecision(jpeg !== null && inJpeg?.result === 'read' ? [...sources, embeddedBytes(jpeg, inJpeg.bytes)] : sources, isPair(picture)).winner?.decision ?? UNDECIDED
	const { change, creates } = editorOf(edit, isPair(picture), [...targets.flatMap(({ source }) => (source === null ? [] : readableXmp(source.bytes) ?? [])), ...embeddedPackets])
	const embeddedPath = jpeg === null ? null : embeddedSidecarPath(jpeg)
	// A JPEG sidecar without tags keeps removed embedded tags removed (TAGS-002.19).
	const replacesEmbedded = pictureTags(embeddedPackets).length > 0 ? embeddedPath : null
	const baseOf = (path: string) => (path === embeddedPath && inEmbedded.packet !== null ? sidecarDecision(inEmbedded.packet, isPair(picture)) : stated)
	for (const { path, fileId, answer, source } of written) {
		if (fileId !== null && source === null) {
			failed.push({ path, picture, reason: (answer?.result ?? 'unreachable') as SidecarFailureReason })
			continue
		}
		if (fileId === null && !creates && path !== replacesEmbedded) {
			continue
		}
		try {
			const packet = source === null ? EMPTY_PACKET : readXmp(source.bytes)
			const bytes = serializeXmp(change(packet, source === null ? baseOf(path) : null), time)
			if (source !== null && sameBytes(bytes, serializeXmp(packet, time))) {
				continue
			}
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
			known.set(save.path, { fileId: answer.fileId, saved: { etag: answer.etag, size: answer.size, mtime: answer.mtime, bytes: save.item.bytes } })
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

/** How the edit changes a sidecar, a new one (with a `base`) starting from that decision, and whether it creates missing ones: a decision always does; a tag change applies to the union of the sources read, and creates them only while tags are left. */
function editorOf(edit: SidecarEdit, pair: boolean, sources: readonly XmpPacket[]): { change: (packet: XmpPacket, base: Decision | null) => XmpPacket, creates: boolean } {
	const { decision, tags } = edit
	const write = tags === undefined ? null : tagWrite(sources, tags)
	const decide = (packet: XmpPacket, base: Decision | null) => (base !== null ? mergeDelta(packet, decision ?? {}, pair, base) : (decision === undefined ? packet : mergeDelta(packet, decision, pair)))
	return {
		change: (packet, base) => (write === null ? decide(packet, base) : mergeTags(decide(packet, base), write)),
		creates: decision !== undefined || (write !== null && write.tags.length > 0),
	}
}

/** A sidecar of the picture as the reading rules take it. */
function sidecarBytes(picture: Picture<ListingEntry>, path: string, { mtime, bytes }: { readonly mtime: number, readonly bytes: Uint8Array }): SidecarBytes {
	return { name: path, mtime, ofRaw: isRawSidecar(picture, path), bytes }
}

/** Whether the sidecar at the path is the picture's RAW member's, which wins a tie. */
export function isRawSidecar(picture: Picture<ListingEntry>, path: string): boolean {
	const rawName = picture.raw === null ? null : parseFileName(picture.raw.path).name
	return rawName !== null && isMemberSidecar(parseFileName(path), rawName)
}

/** The JPEG's embedded XMP as the reading rules take it: the JPEG's own sidecar, at the JPEG's modification time. */
function embeddedBytes(jpeg: ListingEntry, bytes: Uint8Array): SidecarBytes {
	return { name: jpeg.path, mtime: jpeg.mtime, ofRaw: false, bytes }
}

/** Whether the two byte arrays hold the same bytes. */
function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	return left.length === right.length && left.every((byte, index) => byte === right[index])
}

/** Whether the picture is a pair. */
export function isPair(picture: Picture<ListingEntry>): boolean {
	return picture.raw !== null && picture.rendered !== null
}
