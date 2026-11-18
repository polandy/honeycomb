// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { StoredTags, Tag, TagChange } from './logic/tag.ts'

import { computed, shallowRef } from 'vue'
import { logger } from './logger.ts'
import { pictureMembers } from './logic/pairing.ts'
import { withLevels } from './logic/tag-entry.ts'
import { changedTags, sortedTags, withTagRows } from './logic/tag.ts'

/** The tag endpoints (ADR 0022). */
export interface CullTagsApi {
	readonly lookupTags: (fileIds: readonly number[]) => Promise<StoredTags[]>
	readonly loadTagList: () => Promise<Tag[]>
}

type Pictures = readonly Picture<ListingEntry>[]

/** The tags of the open cull: the legacy rows, the sidecars' tags, and changes written through (TAGS-002); `current` names the open cull, answers for another are dropped. */
export function useCullTags(api: CullTagsApi, writeTags: (pictures: Pictures, change: TagChange) => Promise<unknown>, current: () => unknown, writable: (picture: Picture<ListingEntry>) => boolean) {
	const tags = shallowRef<ReadonlyMap<number, readonly Tag[]>>(new Map())
	const legacy = shallowRef<ReadonlyMap<number, readonly Tag[]>>(new Map())
	const list = shallowRef<readonly Tag[]>([])
	const known = computed(() => withLevels([...list.value, ...[...tags.value.values()].flat()]))

	/** Reads the user's tag list for the tag entry (TAGS-003.13). */
	function loadList() {
		api.loadTagList().then((read) => {
			list.value = read
		}, (error: unknown) => logger.error('Could not read the tag list; the entry offers the tags of this cull', { error }))
	}

	/** Forgets the tags of the cull before. */
	function reset() {
		tags.value = new Map()
		legacy.value = new Map()
	}

	/** The union of the tags of the picture's members, sorted. */
	function tagsOf(picture: Picture<ListingEntry>): Tag[] {
		return unionOf(picture, tags.value)
	}

	/** The union of the legacy tags of the picture's members, sorted (XMP-007.5). */
	function legacyTagsOf(picture: Picture<ListingEntry>): Tag[] {
		return unionOf(picture, legacy.value)
	}

	/** Reads the legacy tags of the files and shows them under those given meanwhile; a failure shows none (TAGS-002.6). */
	async function load(fileIds: readonly number[]): Promise<void> {
		const cull = current()
		try {
			const rows = await api.lookupTags(fileIds)
			if (current() === cull) {
				legacy.value = new Map([...withTagRows(new Map(), rows), ...legacy.value])
				tags.value = new Map([...withTagRows(new Map(), rows), ...tags.value])
			}
		} catch (error) {
			logger.error('Could not read the stored tags; the photos show their sidecars\' tags', { error })
		}
	}

	/** Shows the sidecars' tags of the pictures still untagged; nothing is stored or written (TAGS-002.2). */
	function fromSidecars(tagged: readonly { picture: Picture<ListingEntry>, tags: readonly Tag[] }[]) {
		const rows = tagged.filter(({ picture }) => tagsOf(picture).length === 0).flatMap(({ picture, tags: set }) => pictureMembers(picture).map(({ fileId }) => ({ fileId, tags: [...set] })))
		if (rows.length > 0) {
			tags.value = withTagRows(tags.value, rows)
		}
	}

	/** Applies the change to each chosen picture and writes it through where the picture is writable. */
	function change(chosen: Pictures, step: TagChange) {
		const rows = chosen.flatMap((picture) => {
			const next = changedTags(tagsOf(picture), step)
			return pictureMembers(picture).map(({ fileId }) => ({ fileId, tags: next }))
		})
		tags.value = withTagRows(tags.value, rows)
		const written = chosen.filter(writable)
		if (written.length > 0) {
			void writeTags(written, step)
		}
	}

	/** Forgets the legacy tags of the files once their sidecars hold them (XMP-008.11). */
	function forget(fileIds: ReadonlySet<number>) {
		legacy.value = new Map([...legacy.value].filter(([fileId]) => !fileIds.has(fileId)))
	}

	return { tags, known, reset, loadList, tagsOf, legacyTagsOf, load, fromSidecars, change, forget }
}

/** The union of the tags of the picture's members in the map, sorted. */
function unionOf(picture: Picture<ListingEntry>, byFileId: ReadonlyMap<number, readonly Tag[]>): Tag[] {
	return sortedTags(pictureMembers(picture).flatMap((member) => byFileId.get(member.fileId) ?? []))
}
