// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Picture } from './pairing.ts'

/** A base name that several files of one folder share, so none of them pairs. */
export interface AmbiguousName {
	readonly folder: string
	readonly baseName: string
	/** The singles of that base name among the given pictures. */
	readonly count: number
}

/** The ambiguous base names among `pictures`, once per folder, in the order of their first single. */
export function ambiguousNames(pictures: readonly Pick<Picture<unknown>, 'folder' | 'baseName' | 'ambiguous'>[]): AmbiguousName[] {
	const names = new Map<string, AmbiguousName>()
	for (const { folder, baseName, ambiguous } of pictures) {
		if (ambiguous) {
			const key = `${folder}/${baseName.toLowerCase()}`
			const known = names.get(key)
			names.set(key, { folder, baseName: known?.baseName ?? baseName, count: (known?.count ?? 0) + 1 })
		}
	}
	return [...names.values()]
}
