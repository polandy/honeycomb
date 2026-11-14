// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'

/** A stored key: a file id and its mtime. */
const KEY_PATTERN = /^\d+:\d+$/

/** The key of a file version whose previews were warmed: a new mtime means new previews (ADR 0010). */
export function warmKey(member: ListingEntry): string {
	return `${member.fileId}:${member.mtime}`
}

/** The stored keys of the warmed file versions, oldest first; anything else starts empty. */
export function parseWarmCache(stored: string | null): Set<string> {
	let parsed: unknown
	try {
		parsed = JSON.parse(stored ?? '[]')
	} catch {
		return new Set()
	}
	if (!Array.isArray(parsed)) {
		return new Set()
	}
	return new Set(parsed.filter((key): key is string => typeof key === 'string' && KEY_PATTERN.test(key)))
}

/** The newest `limit` keys, in insertion order, for storage. */
export function serializeWarmCache(keys: ReadonlySet<string>, limit: number): string {
	return JSON.stringify([...keys].slice(-limit))
}
