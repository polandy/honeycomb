// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderNode, LevelRow } from './folder-hierarchy.ts'
import type { FolderRow } from './folder-row.ts'
import type { FolderSet } from './folder-set.ts'

import { findLevel, levelRows, startLevel, subtreeRows } from './folder-hierarchy.ts'

/** The level *Folders* shows: the chosen one while the tree holds it, else the start; null for the *Library*. */
export function shownLevel(tree: readonly FolderNode[], chosen: string | null): FolderNode | null {
	const level = chosen === null ? null : findLevel(tree, chosen)
	if (level !== null) {
		return level
	}
	const start = startLevel(tree)
	return start === null ? null : findLevel(tree, start)
}

/** The rows of *All*: the roots with photos at the *Library*, labelled with their paths, else the level's rows. */
export function allRows(tree: readonly FolderNode[], level: FolderNode | null): LevelRow[] {
	if (level !== null) {
		return levelRows(level)
	}
	return tree.filter((root) => root.row !== null || root.children.length > 0).map((root) => ({ label: root.path, node: root }))
}

/** Whether the row opens a level: it has subfolders with photos, or stands for a chain or a root. */
export function opensLevel(entry: LevelRow): boolean {
	return entry.node.children.length > 0 || entry.label !== entry.node.name
}

/** The row *Photos directly in* of a level with photos of its own and subfolders, else null (FOLDERS-009.8). */
export function ownRow(level: FolderNode | null): FolderRow | null {
	return level !== null && level.children.length > 0 ? level.row : null
}

/** The row a node shows as one folder: its own when the switch is off or it has no subfolders, else null. */
export function singleRow(node: FolderNode, includeSubfolders: boolean): FolderRow | null {
	return includeSubfolders && node.children.length > 0 ? null : node.row
}

/** The rows every filter and its count work on: every folder below the level, or of the tree at the Library. */
export function flatRows(tree: readonly FolderNode[], level: FolderNode | null): readonly FolderRow[] {
	return (level === null ? tree : [level]).flatMap((node) => subtreeRows(node))
}

/** The folder set *Cull* opens: with subfolders only when the switch is on and the node has some (FOLDERS-009.6). */
export function cullSet(node: FolderNode, includeSubfolders: boolean): FolderSet {
	return { paths: [node.path], subfolders: includeSubfolders && node.children.length > 0 }
}

/** The path of the folder's parent below the level, empty for the level and a folder directly in it. */
export function parentBelow(level: FolderNode, path: string): string {
	if (!path.startsWith(`${level.path}/`)) {
		return ''
	}
	const below = path.slice(level.path.length + 1)
	const slash = below.lastIndexOf('/')
	return slash < 0 ? '' : below.slice(0, slash)
}
