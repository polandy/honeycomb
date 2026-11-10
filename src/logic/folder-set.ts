// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The ticked folders of one cull; every folder below them too with `subfolders`. */
export interface FolderSet {
	readonly paths: readonly string[]
	readonly subfolders: boolean
}

/** One step of the path from the root to a folder; the root's path and name are empty. */
export interface Breadcrumb {
	readonly name: string
	readonly path: string
}

/** The ticked paths with `path` ticked or unticked, sorted. */
export function toggleFolder(paths: readonly string[], path: string): string[] {
	return paths.includes(path) ? paths.filter((ticked) => ticked !== path) : [...paths, path].sort()
}

/** Whether the listing skips a folder of this name (ADR 0009). */
export function isHiddenFolder(name: string): boolean {
	return name.startsWith('.')
}

/** The root and every folder down to `path`, each path with a leading `/` (ADR 0011). */
export function breadcrumbs(path: string): Breadcrumb[] {
	const crumbs: Breadcrumb[] = [{ name: '', path: '' }]
	for (const name of path.split('/').filter((segment) => segment !== '')) {
		crumbs.push({ name, path: `${crumbs.at(-1)!.path}/${name}` })
	}
	return crumbs
}

/** A key that names the same folder set whatever the order of its paths. */
export function folderSetKey(set: FolderSet): string {
	return JSON.stringify([[...set.paths].sort(), set.subfolders])
}

/** How many pictures and distinct folders the picker reports for a folder set. */
export function summarise(pictures: readonly { readonly folder: string }[]): { pictures: number, folders: number } {
	return { pictures: pictures.length, folders: new Set(pictures.map((picture) => picture.folder)).size }
}
