// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { Tag, TagChange } from './logic/tag.ts'

import { computed, shallowRef } from 'vue'
import { logger } from './logger.ts'
import { pictureMembers } from './logic/pairing.ts'
import { withLevels } from './logic/tag-entry.ts'
import { changedTags, sortedTags, withTagRows } from './logic/tag.ts'

/** The tag list endpoint (ADR 0022). */
export interface CullTagsApi {
	readonly loadTagList: () => Promise<Tag[]>
}

type Pictures = readonly Picture<ListingEntry>[]

/** The tags of the open cull: the sidecars' tags and changes written through (TAGS-002). */
export function useCullTags(api: CullTagsApi, writeTags: (pictures: Pictures, change: TagChange) => Promise<unknown>, writable: (picture: Picture<ListingEntry>) => boolean) {
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
		return unionOf(picture, tags.value)
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

	return { tags, known, reset, loadList, tagsOf, fromSidecars, change }
}

/** The union of the tags of the picture's members in the map, sorted. */
function unionOf(picture: Picture<ListingEntry>, byFileId: ReadonlyMap<number, readonly Tag[]>): Tag[] {
	return sortedTags(pictureMembers(picture).flatMap((member) => byFileId.get(member.fileId) ?? []))
}
