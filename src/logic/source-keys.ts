// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SourceCapabilities } from './opened-source.ts'

import { DECISIONS_ONLY } from './opened-source.ts'

/** The key map's entries each capability stands for. */
const KEYS_OF: Readonly<Partial<Record<keyof SourceCapabilities, readonly string[]>>> = {
	series: ['series-jump', 'compare', 'pick-rest'],
	tags: ['tag'],
	delete: ['delete', 'review-rejects'],
	move: ['move'],
	keepRaw: ['keep-raw'],
}

/** The keys of the folder grid's toolbar and filter bar, which the Immich screen does not have (IMMICH-003.25). */
const TOOLBAR_KEYS = ['header', 'filter-bar', 'filters-off', 'vi-filter']

/** The key map's entries of what the source does not offer, left out of the shortcut sheet (IMMICH-002.17). */
export function unofferedKeys(capabilities: SourceCapabilities): ReadonlySet<string> {
	return new Set(Object.entries(KEYS_OF).flatMap(([capability, keys]) => (capabilities[capability as keyof SourceCapabilities] ? [] : keys)))
}

/** The key map's entries the shortcut sheet leaves out on an Immich connection. */
export function immichHiddenKeys(): ReadonlySet<string> {
	return new Set([...unofferedKeys(DECISIONS_ONLY), ...TOOLBAR_KEYS])
}
