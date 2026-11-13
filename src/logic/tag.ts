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
