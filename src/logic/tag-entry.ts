// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Tag } from './tag.ts'

import { sortedTags, TAG_SEPARATOR, tagOf } from './tag.ts'

/** A tag of the tag entry's targets and how many of them have it. */
export interface TagChip {
	tag: Tag
	count: number
}

/** What the tag entry offers for the field's text. */
export interface TagMatches {
	matches: Tag[]
	create: Tag | null
}

/** The chips of the targets' tags, sorted, each counting the targets that have it. */
export function tagChips(targets: readonly (readonly Tag[])[]): TagChip[] {
	const counts = new Map<Tag, number>()
	for (const tags of targets) {
		for (const tag of new Set(tags)) {
			counts.set(tag, (counts.get(tag) ?? 0) + 1)
		}
	}
	return sortedTags([...counts.keys()]).map((tag) => ({ tag, count: counts.get(tag)! }))
}

/** The tags with every level of each, `Places/Italy` bringing `Places`, sorted. */
export function withLevels(tags: readonly Tag[]): Tag[] {
	return sortedTags(tags.flatMap((tag) => {
		const names = tag.split(TAG_SEPARATOR)
		return names.map((_, index) => names.slice(0, index + 1).join(TAG_SEPARATOR))
	}))
}

/** The tag typed text names, in the spelling of a known tag that differs only in case, or null when refused. */
export function typedTag(text: string, known: readonly Tag[]): Tag | null {
	const tag = tagOf(text)
	if (tag === null) {
		return null
	}
	return known.find((candidate) => candidate.toLowerCase() === tag.toLowerCase()) ?? tag
}

/** The known tags containing the text, ignoring case, but those every target has; and the typed tag to create when it is not known. */
export function tagMatches(text: string, known: readonly Tag[], chips: readonly TagChip[], targets: number): TagMatches {
	const query = text.trim().toLowerCase()
	const everywhere = new Set(chips.filter((chip) => chip.count === targets).map((chip) => chip.tag))
	const matches = known.filter((tag) => !everywhere.has(tag) && tag.toLowerCase().includes(query))
	const tag = query === '' ? null : typedTag(text, known)
	return { matches, create: tag === null || known.includes(tag) ? null : tag }
}

/** The match a step from `at` lands on, wrapping; -1 when there are none. */
export function cycleMatch(at: number, step: 1 | -1, count: number): number {
	if (count === 0) {
		return -1
	}
	if (at < 0) {
		return step === 1 ? 0 : count - 1
	}
	return (at + step + count) % count
}
