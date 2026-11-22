// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Why a root is refused; `other` names the listed root it clashes with. */
export type LibraryRootRefusal
	= | { readonly reason: 'empty' | 'invalid', readonly path: string }
		| { readonly reason: 'duplicate' | 'inside' | 'contains', readonly path: string, readonly other: string }

const DOT_SEGMENTS = new Set(['.', '..'])

/** A path as every folder path of the app: a leading `/`, no repeated or trailing `/`. */
export function normalizeRoot(input: string): string {
	return `/${input.trim().split('/').filter((segment) => segment.trim() !== '').join('/')}`
}

/** The roots with the input added at the end, or why it is not added. */
export function addLibraryRoot(roots: readonly string[], input: string): { roots: string[] } | { refused: LibraryRootRefusal } {
	const refused = rootRefusal(roots, input)
	return refused === null ? { roots: [...roots, normalizeRoot(input)] } : { refused }
}

/** The roots without `root`. */
export function removeLibraryRoot(roots: readonly string[], root: string): string[] {
	return roots.filter((listed) => listed !== root)
}

/** The first refusal of a list of roots, null when it is valid; an empty list is valid. */
export function validateLibraryRoots(roots: readonly string[]): LibraryRootRefusal | null {
	const accepted: string[] = []
	for (const input of roots) {
		const refused = rootRefusal(accepted, input)
		if (refused !== null) {
			return refused
		}
		accepted.push(normalizeRoot(input))
	}
	return null
}

/** Why the input cannot join the roots, null when it can. */
function rootRefusal(roots: readonly string[], input: string): LibraryRootRefusal | null {
	const path = normalizeRoot(input)
	if (path === '/') {
		return { reason: 'empty', path: '' }
	}
	if (input.includes('\\') || path.split('/').some((segment) => DOT_SEGMENTS.has(segment))) {
		return { reason: 'invalid', path }
	}
	const duplicate = roots.find((listed) => listed === path)
	const inside = roots.find((listed) => path.startsWith(`${listed}/`))
	const contains = roots.find((listed) => listed.startsWith(`${path}/`))
	if (duplicate !== undefined) {
		return { reason: 'duplicate', path, other: duplicate }
	}
	if (inside !== undefined) {
		return { reason: 'inside', path, other: inside }
	}
	return contains === undefined ? null : { reason: 'contains', path, other: contains }
}
