// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Decision, Flag } from './decision.ts'
import type { EmbeddedXmpAnswer } from './embedded-xmp.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PictureId } from './picture-id.ts'
import type { Tag } from './tag.ts'
import type { SidecarValues } from './xmp/decision.ts'

import { sameDecision, UNDECIDED } from './decision.ts'
import { embeddedXmpSource } from './embedded-xmp.ts'
import { isPair, isRawSidecar } from './sidecar-sync.ts'
import { sortedTags, storableTags } from './tag.ts'
import { decisionOfValues, isNewer, sidecarValues } from './xmp/decision.ts'
import { XmpError } from './xmp/model.ts'
import { readXmp } from './xmp/parse.ts'
import { pictureTags } from './xmp/tags.ts'
import { sidecarTargets } from './xmp/targets.ts'

/** The version of the reading rules; a row read by another version is read again (ADR 0032). */
export const XMP_READER = 1

/** Whether a row holds a sidecar or a JPEG's embedded XMP. */
export type XmpCacheKind = 'sidecar' | 'embedded'

/** What the reader made of a source: read, refused, or no embedded XMP at all. */
export type XmpCacheState = 'read' | 'refused' | 'none'

/** One row of the XMP cache: what one source states, each value `null` where it states nothing (ADR 0032). */
export interface XmpCacheRow {
	readonly fileId: PictureId
	readonly kind: XmpCacheKind
	readonly etag: string
	readonly reader: number
	readonly state: XmpCacheState
	readonly reason: string | null
	readonly rating: number | null
	readonly flag: Flag | null
	readonly colourLabel: ColourLabel | null
	readonly keepRaw: boolean | null
	readonly tags: Tag[] | null
}

/** A listed file whose XMP the cull reads: a sidecar, or a JPEG with its embedded XMP. */
export interface XmpCacheSource {
	readonly kind: XmpCacheKind
	readonly entry: ListingEntry
}

/** What a picture shows from its rows: its decision, its tags and the sources to warn about. */
export interface PictureXmpState {
	readonly decision: Decision
	readonly tags: Tag[]
	readonly warnings: { readonly path: string, readonly reason: string }[]
}

type Rows = ReadonlyMap<number, XmpCacheRow>
type LeftOut = (tag: Tag) => void

const NOTHING_STATED: SidecarValues = { rating: null, flag: null, colourLabel: null, keepRaw: null }

/** Each listed sidecar of the pictures and each JPEG whose embedded XMP counts, once. */
export function xmpCacheSources(pictures: readonly Picture<ListingEntry>[]): XmpCacheSource[] {
	const sources = new Map<number, XmpCacheSource>()
	for (const picture of pictures) {
		const jpeg = embeddedXmpSource(picture)
		for (const source of [...sidecarTargets(picture).existing.map((entry) => ({ kind: 'sidecar' as const, entry })), ...(jpeg === null ? [] : [{ kind: 'embedded' as const, entry: jpeg }])]) {
			if (!sources.has(source.entry.fileId)) {
				sources.set(source.entry.fileId, source)
			}
		}
	}
	return [...sources.values()]
}

/** The sources without a valid row: none, another kind or ETag, or another reader. */
export function staleSources(sources: readonly XmpCacheSource[], rows: Rows): XmpCacheSource[] {
	return sources.filter(({ kind, entry }) => {
		const row = rows.get(entry.fileId)
		return row === undefined || row.kind !== kind || row.etag !== entry.etag || row.reader !== XMP_READER
	})
}

/** The row of a sidecar read with the ETag; each tag the cache cannot hold goes to `onLeftOut` (TAGS-002.5). */
export function sidecarRow(fileId: PictureId, etag: string, bytes: Uint8Array, onLeftOut?: LeftOut): XmpCacheRow {
	return rowOf(fileId, 'sidecar', etag, bytes, onLeftOut)
}

/** The row of the JPEG's embedded XMP under the JPEG's ETag, or `null` when it was not read. */
export function embeddedRow(jpeg: ListingEntry, answer: EmbeddedXmpAnswer, onLeftOut?: LeftOut): XmpCacheRow | null {
	if (answer.result === 'read') {
		return rowOf(jpeg.fileId, 'embedded', jpeg.etag, answer.bytes, onLeftOut)
	}
	return answer.result === 'none' ? { ...emptyRow(jpeg.fileId, 'embedded', jpeg.etag), state: 'none' } : null
}

/** The picture's decision from its newest read source, a tie going to the RAW member's, and the union of its tags; none while the embedded XMP has no row (TAGS-002.17). */
export function pictureState(picture: Picture<ListingEntry>, rows: Rows): PictureXmpState {
	const jpeg = embeddedXmpSource(picture)
	const sources = [...sidecarTargets(picture).existing.map((entry) => ({ entry, ofRaw: isRawSidecar(picture, entry.path) })), ...(jpeg === null ? [] : [{ entry: jpeg, ofRaw: false }])]
	const read: { readonly path: string, readonly mtime: number, readonly ofRaw: boolean, readonly row: XmpCacheRow }[] = []
	const warnings: { path: string, reason: string }[] = []
	for (const { entry, ofRaw } of sources) {
		const row = rows.get(entry.fileId)
		if (row?.state === 'read') {
			read.push({ path: entry.path, mtime: entry.mtime, ofRaw, row })
		} else if (row?.state === 'refused') {
			warnings.push({ path: entry.path, reason: row.reason ?? 'refused' })
		}
	}
	const pair = isPair(picture)
	const best = read.reduce<typeof read[number] | null>((winner, candidate) => (winner === null || isNewer(candidate, winner) ? candidate : winner), null)
	const decision = best === null ? UNDECIDED : decisionOfValues(best.row, pair)
	warnings.push(...read.filter(({ row }) => !sameDecision(decisionOfValues(row, pair), decision)).map(({ path }) => ({ path, reason: 'disagrees' })))
	const tags = jpeg !== null && !rows.has(jpeg.fileId) ? [] : sortedTags(read.flatMap(({ row }) => row.tags ?? []))
	return { decision, tags, warnings }
}

/** The row of a source's bytes: what it states, or refused with the reason. */
function rowOf(fileId: PictureId, kind: XmpCacheKind, etag: string, bytes: Uint8Array, onLeftOut?: LeftOut): XmpCacheRow {
	try {
		const packet = readXmp(bytes)
		const { kept, leftOut } = storableTags(pictureTags([packet]))
		leftOut.forEach((tag) => onLeftOut?.(tag))
		return { ...emptyRow(fileId, kind, etag), ...sidecarValues(packet), tags: kept.length === 0 ? null : kept }
	} catch (error) {
		if (!(error instanceof XmpError)) {
			throw error
		}
		return { ...emptyRow(fileId, kind, etag), state: 'refused', reason: error.reason }
	}
}

/** A read row that states nothing. */
function emptyRow(fileId: PictureId, kind: XmpCacheKind, etag: string): XmpCacheRow {
	return { fileId, kind, etag, reader: XMP_READER, state: 'read', reason: null, ...NOTHING_STATED, tags: null }
}
