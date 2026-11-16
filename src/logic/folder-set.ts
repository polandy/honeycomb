// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The ticked folders of one cull; every folder below them too with `subfolders`, but the excluded ones (ADR 0035). */
export interface FolderSet {
	readonly paths: readonly string[]
	readonly subfolders: boolean
	/** Folders *Include subfolders* leaves out, each with everything below it but the ticked folders there. */
	readonly excluded?: readonly string[]
}

/** One listing of a folder set: a ticked folder and the excluded folders below it. */
export interface FolderListing {
	readonly path: string
	readonly excluded: readonly string[]
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

/** The folder set with the folder at `path` tapped: an included one is excluded, an excluded one included again, any other ticked or unticked. */
export function tapFolder(set: FolderSet, path: string): FolderSet {
	const excluded = set.excluded ?? []
	if (set.subfolders && excluded.includes(path)) {
		return withExcluded(set, excluded.filter((each) => each !== path))
	}
	if (set.subfolders && !set.paths.includes(path) && tickAbove(set, path) !== null) {
		return withExcluded(set, [...excluded, path].sort())
	}
	const paths = toggleFolder(set.paths, path)
	return withExcluded({ ...set, paths }, excluded.filter((each) => each !== path && ancestors(each).some((above) => paths.includes(above))))
}

/** The nearest ticked folder above `path` with no excluded folder between them; null when none. */
export function tickAbove(set: Pick<FolderSet, 'paths' | 'excluded'>, path: string): string | null {
	for (const above of ancestors(path)) {
		if (set.paths.includes(above)) {
			return above
		}
		if (set.excluded?.includes(above)) {
			return null
		}
	}
	return null
}

/** The excluded folders that leave something out: each below a ticked folder, none inside another, sorted. */
export function effectiveExclusions(set: FolderSet): string[] {
	const excluded = set.subfolders ? set.excluded ?? [] : []
	return [...new Set(excluded)].filter((path) => !set.paths.includes(path) && tickAbove(set, path) !== null).sort()
}

/** Each ticked folder with the excluded folders below it, to list one by one. */
export function folderListings(set: FolderSet): FolderListing[] {
	const excluded = effectiveExclusions(set)
	return set.paths.map((path) => ({ path, excluded: excluded.filter((each) => each.startsWith(`${path}/`)) }))
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

/** A key that names the same folder set whatever the order of its paths and, with subfolders, its covered ticks and idle exclusions (ADR 0034, 0035). */
export function folderSetKey(set: FolderSet): string {
	const paths = set.subfolders ? set.paths.filter((path) => tickAbove(set, path) === null) : set.paths
	const excluded = effectiveExclusions(set)
	return JSON.stringify(excluded.length === 0 ? [[...paths].sort(), set.subfolders] : [[...paths].sort(), set.subfolders, excluded])
}

/** How many pictures and distinct folders the picker reports for a folder set. */
export function summarise(pictures: readonly { readonly folder: string }[]): { pictures: number, folders: number } {
	return { pictures: pictures.length, folders: new Set(pictures.map((picture) => picture.folder)).size }
}

/** The folders above `path`, nearest first, cut at each `/` as `FolderSet::key()` does; the root's path is empty. */
function ancestors(path: string): string[] {
	const above: string[] = []
	for (let cut = path.lastIndexOf('/'); cut >= 0; cut = cut === 0 ? -1 : path.lastIndexOf('/', cut - 1)) {
		above.push(path.slice(0, cut))
	}
	return above
}

/** The folder set with these excluded folders, left out when none. */
function withExcluded({ paths, subfolders }: FolderSet, excluded: readonly string[]): FolderSet {
	return excluded.length === 0 ? { paths, subfolders } : { paths, subfolders, excluded }
}
