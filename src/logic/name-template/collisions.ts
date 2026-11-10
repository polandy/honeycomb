// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RenderedFile } from './render.ts'

import { renderedPath } from './render.ts'

const FIRST_SUFFIX = 2

/** Per picture in view order, the lowest suffix (none, 2, 3, …) at which none of its paths is taken, case-insensitively. */
export function collisionSuffixes(pictures: readonly (readonly RenderedFile[])[], existing: readonly string[] = []): (number | null)[] {
	const taken = new Set(existing.map(pathKey))
	return pictures.map((files) => {
		const isFree = (suffix: number | null) => files.every((file) => !taken.has(pathKey(renderedPath(file, suffix))))
		let suffix: number | null = null
		while (!isFree(suffix)) {
			suffix = suffix === null ? FIRST_SUFFIX : suffix + 1
		}
		for (const file of files) {
			taken.add(pathKey(renderedPath(file, suffix)))
		}
		return suffix
	})
}

/** Paths compare case-insensitively (`docs/05-name-templates.md` Collisions). */
function pathKey(path: string): string {
	return path.toLowerCase()
}
