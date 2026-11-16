// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { breadcrumbs } from './folder-set.ts'

/** The path of the user's home folder, the tree's root. */
export const ROOT = ''

/** A folder as the tree shows it. */
export interface TreeFolder {
	readonly name: string
	readonly path: string
	readonly hasSubfolders: boolean
}

/** What the tree knows of one folder's child folders. */
export type Branch
	= | { readonly state: 'loading' }
		| { readonly state: 'failed' }
		| { readonly state: 'loaded', readonly folders: readonly TreeFolder[] }

/** Why a note row stands in for the children of an expanded folder. */
export type TreeNote = 'loading' | 'failed' | 'empty'

/** One shown row: a folder, or a note under an expanded folder; the root's rows are level 1. */
export type TreeRow
	= | { readonly kind: 'folder', readonly folder: TreeFolder, readonly level: number, readonly expanded: boolean, readonly parent: string }
		| { readonly kind: 'note', readonly note: TreeNote, readonly level: number, readonly parent: string }

/** Where a key moves the focus, or what it expands or collapses; null when it does nothing. */
export type TreeMove = { readonly focus: string } | { readonly expand: string } | { readonly collapse: string } | null

/** The rows shown, depth first: each expanded folder's children, or a note, right below it. */
export function visibleRows(branches: ReadonlyMap<string, Branch>, expanded: ReadonlySet<string>): TreeRow[] {
	const rows: TreeRow[] = []
	const addBranch = (parent: string, level: number) => {
		const branch = branches.get(parent) ?? { state: 'loading' }
		if (branch.state !== 'loaded' || branch.folders.length === 0) {
			rows.push({ kind: 'note', note: branch.state === 'loaded' ? 'empty' : branch.state, level, parent })
			return
		}
		for (const folder of branch.folders) {
			const open = folder.hasSubfolders && expanded.has(folder.path)
			rows.push({ kind: 'folder', folder, level, expanded: open, parent })
			if (open) {
				addBranch(folder.path, level + 1)
			}
		}
	}
	addBranch(ROOT, 1)
	return rows
}

/** What `key` does on the folder row of `path`, after the WAI-ARIA tree pattern. */
export function treeKey(rows: readonly TreeRow[], path: string, key: string): TreeMove {
	const folders = rows.filter((row) => row.kind === 'folder')
	const index = folders.findIndex((row) => row.folder.path === path)
	const row = folders[index]
	if (row === undefined) {
		return null
	}
	const focus = (target: (typeof folders)[number] | undefined) => (target === undefined ? null : { focus: target.folder.path })
	switch (key) {
		case 'ArrowDown':
			return focus(folders[index + 1])
		case 'ArrowUp':
			return focus(folders[index - 1])
		case 'Home':
			return focus(folders[0])
		case 'End':
			return focus(folders.at(-1))
		case 'ArrowRight':
			if (!row.expanded) {
				return row.folder.hasSubfolders ? { expand: path } : null
			}
			return folders[index + 1]?.parent === path ? focus(folders[index + 1]) : null
		case 'ArrowLeft':
			if (row.expanded) {
				return { collapse: path }
			}
			return row.parent === ROOT ? null : { focus: row.parent }
		default:
			return null
	}
}

/** The folders to expand so that every one of `paths` shows, outermost first. */
export function foldersToExpand(paths: readonly string[]): string[] {
	const above = paths.flatMap((path) => breadcrumbs(path).slice(1, -1).map((crumb) => crumb.path))
	return [...new Set(above)].sort((a, b) => a.split('/').length - b.split('/').length)
}

/** How many of the ticked folders lie at any depth below `path`. */
export function tickedBelow(ticked: readonly string[], path: string): number {
	return ticked.filter((each) => each.startsWith(`${path}/`)).length
}
