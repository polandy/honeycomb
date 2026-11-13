// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** A path of names, `Places/Italy/Dolomites`, as `digiKam:TagsList` writes it (`docs/07-tags.md` Model). */
export type Tag = string

/** The stored tags of one file, sorted (ADR 0022). */
export interface StoredTags {
	fileId: number
	tags: Tag[]
}

/** Separates the names of a tag. */
export const TAG_SEPARATOR = '/'

/** Refused in a name because `lr:hierarchicalSubject` separates with it. */
export const HIERARCHY_SEPARATOR = '|'

/** The tag typed text names, each name trimmed, or null for an empty name or a `|`. */
export function tagOf(text: string): Tag | null {
	const names = text.split(TAG_SEPARATOR).map((name) => name.trim())
	return names.every((name) => name !== '' && !name.includes(HIERARCHY_SEPARATOR)) ? names.join(TAG_SEPARATOR) : null
}

/** The last name of a tag. */
export function leafOf(tag: Tag): string {
	return tag.slice(tag.lastIndexOf(TAG_SEPARATOR) + 1)
}

/** Whether the tags have each chosen tag or one beneath it (`docs/07-tags.md` D4, D5). */
export function hasEveryTag(tags: readonly Tag[], chosen: Iterable<Tag>): boolean {
	return [...chosen].every((wanted) => tags.some((tag) => tag === wanted || tag.startsWith(wanted + TAG_SEPARATOR)))
}

/** Tags added and removed in one step. */
export interface TagChange {
	readonly added: readonly Tag[]
	readonly removed: readonly Tag[]
}

/** The change that takes the change back. */
export function inverseChange(change: TagChange): TagChange {
	return { added: change.removed, removed: change.added }
}

/** The longest tag the storage holds (ADR 0022). */
const MAX_TAG_LENGTH = 255

/** The most tags the storage holds for one file (ADR 0022). */
const MAX_TAGS = 100

/** Each tag once, in code-unit order so a written list is stable. */
export function sortedTags(tags: readonly Tag[]): Tag[] {
	return [...new Set(tags)].sort()
}

/** The tags with the change applied, sorted. */
export function changedTags(tags: readonly Tag[], change: TagChange): Tag[] {
	const removed = new Set(change.removed)
	return sortedTags([...tags.filter((tag) => !removed.has(tag)), ...change.added])
}

/** The tags the storage can hold, sorted, and those it cannot: too long, or beyond the first `MAX_TAGS`. */
export function storableTags(tags: readonly Tag[]): { kept: Tag[], leftOut: Tag[] } {
	const sorted = sortedTags(tags)
	const fitting = sorted.filter((tag) => tag.length <= MAX_TAG_LENGTH)
	return {
		kept: fitting.slice(0, MAX_TAGS),
		leftOut: [...sorted.filter((tag) => tag.length > MAX_TAG_LENGTH), ...fitting.slice(MAX_TAGS)],
	}
}

/** The tags by file id with each row set; an empty row drops its file. */
export function withTagRows(tags: ReadonlyMap<number, readonly Tag[]>, rows: readonly StoredTags[]): Map<number, readonly Tag[]> {
	const next = new Map(tags)
	for (const { fileId, tags: set } of rows) {
		if (set.length === 0) {
			next.delete(fileId)
		} else {
			next.set(fileId, set)
		}
	}
	return next
}

/** The tags with each row that still stands set back to what it replaced in `before`. */
export function revertTagRows(tags: ReadonlyMap<number, readonly Tag[]>, rows: readonly StoredTags[], before: ReadonlyMap<number, readonly Tag[]>): Map<number, readonly Tag[]> {
	const stillStanding = rows.filter(({ fileId, tags: set }) => sameTags(tags.get(fileId) ?? [], set))
	return withTagRows(tags, stillStanding.map(({ fileId }) => ({ fileId, tags: [...(before.get(fileId) ?? [])] })))
}

/** Whether two sorted tag lists are the same. */
export function sameTags(left: readonly Tag[], right: readonly Tag[]): boolean {
	return left.length === right.length && left.every((tag, index) => tag === right[index])
}
