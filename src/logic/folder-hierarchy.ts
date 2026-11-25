// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderRow } from './folder-row.ts'

import { isRateable, newCount } from './folder-row.ts'

/** A level of the hierarchy: a root or a folder below it with photos in its subtree (ADR 0060). */
export interface FolderNode {
	readonly name: string
	readonly path: string
	readonly root: string
	/** The folder's own summary, null for a level without photos of its own. */
	readonly row: FolderRow | null
	/** The subfolders with photos in their subtree, in natural order. */
	readonly children: readonly FolderNode[]
}

/** The sums of a scope; `rateable` and `done` count rateable folders with photos (n and k of FOLDERS-009). */
export interface FolderSums {
	readonly photos: number
	readonly picked: number
	readonly rejected: number
	readonly undecided: number
	readonly bytes: number
	readonly folders: number
	readonly rateable: number
	readonly done: number
	/** The *n new* of the done folders in the scope. */
	readonly fresh: number
}

/** The derived state of a scope: no photos, no folder that can be marked, all done, nothing undecided, or open. */
export type SubtreeState = 'empty' | 'read-only' | 'done' | 'complete' | 'open'

/** A row of a level: a subfolder, or a chain of them ending at `node`, labelled with their names. */
export interface LevelRow {
	readonly label: string
	readonly node: FolderNode
}

/** A level the breadcrumb names. */
export interface Level {
	readonly name: string
	readonly path: string
}

/** One crumb: a level, or the gap "…" standing for the levels between. */
export type Crumb
	= | ({ readonly kind: 'level' } & Level)
		| { readonly kind: 'gap', readonly levels: readonly Level[] }

const CHAIN_SEPARATOR = ' / '
const BREADCRUMB_MAX = 4
const BREADCRUMB_TAIL = 2
const NAMES = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

interface MutableNode {
	readonly name: string
	readonly path: string
	row: FolderRow | null
	readonly children: Map<string, MutableNode>
}

/** The tree of every root, in the roots' order, also a root without photos; rows outside their root are left out. */
export function buildHierarchy(roots: readonly string[], rows: readonly FolderRow[]): FolderNode[] {
	const tops = new Map(roots.map((root) => [root, mutableNode(lastSegment(root), root)]))
	for (const folder of rows) {
		const top = tops.get(folder.root)
		const segments = segmentsBelow(folder.root, folder.path)
		if (top !== undefined && segments !== null && folder.photos > 0) {
			insert(top, segments, folder)
		}
	}
	return roots.map((root) => freeze(tops.get(root)!, root))
}

/** The level at `path`, null when the tree holds none. */
export function findLevel(tree: readonly FolderNode[], path: string): FolderNode | null {
	const top = tree.find((node) => segmentsBelow(node.path, path) !== null)
	let node: FolderNode | undefined = top
	for (const name of top === undefined ? [] : segmentsBelow(top.path, path)!) {
		node = node?.children.find((child) => child.name === name)
	}
	return node ?? null
}

/** The level *Folders* opens on: the only root, or null for the *Library*. */
export function startLevel(tree: readonly FolderNode[]): string | null {
	return tree.length === 1 ? tree[0]!.path : null
}

/** The rows of the level and of every folder below it, the level first, then depth first. */
export function subtreeRows(node: FolderNode): FolderRow[] {
	return [...(node.row === null ? [] : [node.row]), ...node.children.flatMap(subtreeRows)]
}

/** The sums of the whole subtree, or of the folder's own photos only. */
export function scopeSums(node: FolderNode, includeSubfolders: boolean): FolderSums {
	const rows = includeSubfolders ? subtreeRows(node) : node.row === null ? [] : [node.row]
	const sum = (value: (row: FolderRow) => number) => rows.reduce((total, row) => total + value(row), 0)
	const rateable = rows.filter(isRateable)
	return {
		photos: sum((row) => row.photos),
		picked: sum((row) => row.picked),
		rejected: sum((row) => row.rejected),
		undecided: sum((row) => row.undecided),
		bytes: sum((row) => row.bytes),
		folders: rows.length,
		rateable: rateable.length,
		done: rateable.filter((row) => row.done !== null).length,
		fresh: sum(newCount),
	}
}

/** The derived state of the sums: done when every rateable folder is, complete when nothing is undecided. */
export function subtreeState(sums: FolderSums): SubtreeState {
	if (sums.photos === 0) {
		return 'empty'
	}
	if (sums.rateable === 0) {
		return 'read-only'
	}
	if (sums.done === sums.rateable) {
		return 'done'
	}
	return sums.undecided === 0 ? 'complete' : 'open'
}

/** The rows of a level, a chain of folders without photos of their own and one subfolder each as one row. */
export function levelRows(level: FolderNode): LevelRow[] {
	return level.children.map((child) => {
		const names = [child.name]
		let node = child
		while (node.row === null && node.children.length === 1) {
			node = node.children[0]!
			names.push(node.name)
		}
		return { label: names.join(CHAIN_SEPARATOR), node }
	})
}

/** The crumbs from the root to `path`: above 4 levels the first, a gap and the last two; empty outside the root. */
export function breadcrumb(root: string, path: string): Crumb[] {
	const segments = segmentsBelow(root, path)
	if (segments === null) {
		return []
	}
	const levels = [root, ...segments.map((_, index) => `${root}/${segments.slice(0, index + 1).join('/')}`)]
		.map((levelPath) => ({ name: lastSegment(levelPath), path: levelPath }))
	const crumbs: Crumb[] = levels.map((level) => ({ kind: 'level', ...level }))
	if (levels.length <= BREADCRUMB_MAX) {
		return crumbs
	}
	return [crumbs[0]!, { kind: 'gap', levels: levels.slice(1, -BREADCRUMB_TAIL) }, ...crumbs.slice(-BREADCRUMB_TAIL)]
}

/** The path's segments below the root, empty for the root itself, null for a path outside it. */
function segmentsBelow(root: string, path: string): string[] | null {
	if (path === root) {
		return []
	}
	return path.startsWith(`${root}/`) ? path.slice(root.length + 1).split('/') : null
}

/** The name of the path's last folder. */
function lastSegment(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1)
}

/** A node without photos or children yet. */
function mutableNode(name: string, path: string): MutableNode {
	return { name, path, row: null, children: new Map() }
}

/** Puts the row at the end of `segments`, adding the levels on the way. */
function insert(top: MutableNode, segments: readonly string[], row: FolderRow): void {
	let node = top
	for (const name of segments) {
		const child = node.children.get(name) ?? mutableNode(name, `${node.path}/${name}`)
		node.children.set(name, child)
		node = child
	}
	node.row = row
}

/** The read-only node with its children in natural order, the code point order breaking case-only ties. */
function freeze(node: MutableNode, root: string): FolderNode {
	const children = [...node.children.values()]
		.sort((a, b) => NAMES.compare(a.name, b.name) || (a.name < b.name ? -1 : 1))
		.map((child) => freeze(child, root))
	return { name: node.name, path: node.path, root, row: node.row, children }
}
