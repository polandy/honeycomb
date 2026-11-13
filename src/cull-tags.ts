// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { StoredTags, Tag, TagChange } from './logic/tag.ts'

import { computed, shallowRef } from 'vue'
import { logger } from './logger.ts'
import { memberIds, pictureMembers } from './logic/pairing.ts'
import { withLevels } from './logic/tag-entry.ts'
import { changedTags, revertTagRows, sortedTags, withTagRows } from './logic/tag.ts'

/** The tag endpoints (ADR 0022). */
export interface CullTagsApi {
	readonly lookupTags: (fileIds: readonly number[]) => Promise<StoredTags[]>
	readonly saveTags: (rows: readonly StoredTags[]) => Promise<void>
	readonly loadTagList: () => Promise<Tag[]>
}

type Pictures = readonly Picture<ListingEntry>[]

/** The tags of the open cull: read, taken over from the sidecars, changed and written through (TAGS-002); `current` names the open cull, answers for another are dropped. */
export function useCullTags(api: CullTagsApi, writeTags: (pictures: Pictures, change: TagChange) => Promise<unknown>, current: () => unknown, writable: (picture: Picture<ListingEntry>) => boolean) {
	const tags = shallowRef<ReadonlyMap<number, readonly Tag[]>>(new Map())
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
	}

	/** The union of the tags of the picture's members, sorted. */
	function tagsOf(picture: Picture<ListingEntry>): Tag[] {
		return sortedTags(pictureMembers(picture).flatMap((member) => tags.value.get(member.fileId) ?? []))
	}

	/** Reads the stored tags of every member under those given meanwhile; the file ids with stored tags, or null when they are unknown. */
	async function load(opened: Pictures): Promise<Set<number> | null> {
		const cull = current()
		try {
			const rows = await api.lookupTags(opened.flatMap(memberIds))
			if (current() !== cull) {
				return null
			}
			tags.value = new Map([...withTagRows(new Map(), rows), ...tags.value])
			return new Set(rows.map(({ fileId }) => fileId))
		} catch (error) {
			logger.error('Could not read the tags; every photo shows as untagged', { error })
			return null
		}
	}

	/** Shows and stores the sidecars' tags of the pictures still untagged; no write back (TAGS-002.2, .4). */
	function takeOver(cull: unknown, tagged: readonly { picture: Picture<ListingEntry>, tags: readonly Tag[] }[]) {
		const rows = current() === cull
			? tagged.filter(({ picture }) => tagsOf(picture).length === 0).flatMap(({ picture, tags: set }) => pictureMembers(picture).map(({ fileId }) => ({ fileId, tags: [...set] })))
			: []
		if (rows.length > 0) {
			tags.value = withTagRows(tags.value, rows)
			api.saveTags(rows).catch((error: unknown) => logger.error('Could not save the tags taken over from the sidecars', { error }))
		}
	}

	/** Applies the change to each chosen picture, stores it for every member and writes it through; false when the save failed and was put back. */
	async function change(chosen: Pictures, step: TagChange): Promise<boolean> {
		const before = tags.value
		const rows = chosen.flatMap((picture) => {
			const next = changedTags(tagsOf(picture), step)
			return pictureMembers(picture).map(({ fileId }) => ({ fileId, tags: next }))
		})
		tags.value = withTagRows(before, rows)
		const cull = current()
		try {
			await api.saveTags(rows)
		} catch (error) {
			if (current() === cull) {
				tags.value = revertTagRows(tags.value, rows, before)
			}
			logger.error('Could not save the tags', { error })
			return false
		}
		const written = chosen.filter(writable)
		if (current() === cull && written.length > 0) {
			void writeTags(written, step)
		}
		return true
	}

	/** Reads the stored tags of files put back that it holds none of. */
	function restore(fileIds: readonly number[]) {
		const unknown = fileIds.filter((fileId) => !tags.value.has(fileId))
		const cull = current()
		if (unknown.length > 0) {
			api.lookupTags(unknown).then((rows) => {
				if (current() === cull) {
					tags.value = new Map([...withTagRows(new Map(), rows), ...tags.value])
				}
			}).catch((error: unknown) => logger.error('Could not read the tags of the photos moved back', { error }))
		}
	}

	return { tags, known, reset, loadList, tagsOf, writable, load, takeOver, change, restore }
}
