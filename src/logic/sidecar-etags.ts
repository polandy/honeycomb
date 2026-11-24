// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PictureId } from './picture-id.ts'
import type { XmpCacheRow } from './xmp-cache.ts'

import { parseFileName } from './file-name.ts'
import { pictureMembers } from './pairing.ts'
import { isMemberSidecar } from './sidecars.ts'

/** A sidecar ETag to record on a member's row (ADR 0056). */
export interface SidecarEtagItem {
	readonly fileId: PictureId
	readonly sidecarEtag: string | null
}

/** A sidecar a save wrote, with the picture, its file id and its new ETag. */
export interface SavedEtag {
	readonly picture: Picture<ListingEntry>
	readonly path: string
	readonly fileId: PictureId
	readonly etag: string
}

/** The member's sidecar among the paths: `<member file>.xmp`, else the picture's shared `<base>.xmp` (ADR 0056). */
function memberSidecar(picture: Picture<ListingEntry>, member: ListingEntry, paths: readonly string[]): string | undefined {
	const memberName = parseFileName(member.path).name
	const files = paths.map((path) => ({ path, file: parseFileName(path) }))
	return (files.find(({ file }) => isMemberSidecar(file, memberName)) ?? files.find(({ file }) => isMemberSidecar(file, picture.baseName)))?.path
}

/** The ETag each member's sidecar got from the saves, in one list (XMP-003.45). */
export function savedEtags<S extends SavedEtag>(saved: readonly S[]): SidecarEtagItem[] {
	const pictures = [...new Set(saved.map(({ picture }) => picture))]
	return pictures.flatMap((picture) => {
		const ofPicture = saved.filter((each) => each.picture === picture)
		const paths = [...picture.sidecars.map(({ path }) => path), ...ofPicture.map(({ path }) => path)]
		return pictureMembers(picture).flatMap((member) => {
			const path = memberSidecar(picture, member, paths)?.toLowerCase()
			const save = ofPicture.find((each) => each.path.toLowerCase() === path)
			return save === undefined ? [] : [{ fileId: member.fileId, sidecarEtag: save.etag }]
		})
	})
}

/** The listed ETag of each member's sidecar that the cache read in that version, by member file id (DECISIONS-001.41). */
export function readEtags(picture: Picture<ListingEntry>, rows: ReadonlyMap<number, XmpCacheRow>): Map<PictureId, string> {
	const etags = new Map<PictureId, string>()
	for (const member of pictureMembers(picture)) {
		const entry = memberSidecarEntry(picture, member)
		if (entry !== undefined && isReadNow(entry, rows)) {
			etags.set(member.fileId, entry.etag)
		}
	}
	return etags
}

/** Whether the cache read the sidecar in its listed version. */
export function isReadNow(entry: ListingEntry, rows: ReadonlyMap<number, XmpCacheRow>): boolean {
	const row = rows.get(entry.fileId)
	return row?.state === 'read' && row.etag === entry.etag
}

/** The listed sidecar of the member, if it has one. */
export function memberSidecarEntry(picture: Picture<ListingEntry>, member: ListingEntry): ListingEntry | undefined {
	const path = memberSidecar(picture, member, picture.sidecars.map((entry) => entry.path))
	return picture.sidecars.find((entry) => entry.path === path)
}
