// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PictureFile } from './delete-summary.ts'
import type { RenderedFile } from './name-template/render.ts'
import type { PictureId } from './picture-id.ts'

import { collisionSuffixes } from './name-template/collisions.ts'
import { renderedPath } from './name-template/render.ts'

/** A picture to move: its files and, in the same order, where the name template puts them. */
export interface MoveCandidate {
	readonly files: readonly PictureFile[]
	readonly rendered: readonly RenderedFile[]
}

/** A child of a target folder, as the probe answers it (ADR 0018). */
export interface TargetChild {
	readonly name: string
	readonly fileId: PictureId
	readonly etag: string
}

/** A folder and where its storage is mounted in the user's files, `/` for the user's own (MOVE-002.12). */
export interface FolderStorage {
	readonly path: string
	readonly storage: string
}

/** A target folder with what it holds. */
export interface TargetFolder extends FolderStorage {
	readonly children: readonly TargetChild[]
}

/** The probe's answer: the target folders and the folders the pictures are in. */
export interface Probe {
	readonly folders: readonly TargetFolder[]
	readonly sources: readonly FolderStorage[]
}

/** A file or folder at a path a move may want. */
export interface ExistingFile {
	readonly path: string
	readonly fileId: PictureId
	readonly etag: string
}

/** How the user resolves a picture's conflict (`docs/dev/plan.md` Moving pictures item 4). */
export type ConflictChoice = 'suffix' | 'skip' | 'replace'

/** A file's new path, the existing file its unsuffixed path hits, and the file it replaces. */
export interface PlannedFile {
	readonly file: PictureFile
	readonly path: string
	readonly conflict: ExistingFile | null
	readonly replace: ExistingFile | null
}

/** A picture of the plan; a skipped one is shown but not sent. */
export interface PlannedPicture {
	readonly files: readonly PlannedFile[]
	readonly inConflict: boolean
	readonly sent: boolean
}

/** One file of the move request (ADR 0018). */
export interface MoveRequestFile {
	readonly fileId: PictureId
	readonly etag: string
	readonly path: string
	readonly replace?: { readonly fileId: PictureId, readonly etag: string, readonly permanent?: true }
}

const FIRST_SUFFIX = 2

/** The distinct folders the move writes into, in order of first use. */
export function probeFolders(target: string, candidates: readonly MoveCandidate[]): string[] {
	return [...new Set(candidates.flatMap(({ rendered }) => rendered.map((file) => joinPath(target, file.folder))))]
}

/** The distinct folders the candidates' files are in, in order of first use. */
export function sourceFolders(candidates: readonly MoveCandidate[]): string[] {
	return [...new Set(candidates.flatMap(({ files }) => files.map((file) => folderOf(file.entry.path))))]
}

/** Whether each candidate has a file whose target folder is on another storage than its folder, which the server refuses (MOVE-002.11). */
export function leavesStorage(target: string, candidates: readonly MoveCandidate[], probe: Probe): boolean[] {
	const storageOf = (folders: readonly FolderStorage[]) => new Map(folders.map((folder) => [folder.path, folder.storage]))
	const targets = storageOf(probe.folders)
	const sources = storageOf(probe.sources)
	return candidates.map(({ files, rendered }) => files.some((file, at) => {
		const from = sources.get(folderOf(file.entry.path))
		const to = targets.get(joinPath(target, rendered[at]!.folder))
		return from !== undefined && to !== undefined && from !== to
	}))
}

/** The paths the probed folders hold. */
export function existingFiles(folders: readonly TargetFolder[]): ExistingFile[] {
	return folders.flatMap((folder) => folder.children.map(({ name, fileId, etag }) => ({ path: joinPath(folder.path, name), fileId, etag })))
}

/** Every picture's new paths, its conflicts and what its choice makes of them (MOVE-003). */
export function planMove(target: string, candidates: readonly MoveCandidate[], existing: readonly ExistingFile[], choiceOf: (index: number) => ConflictChoice = () => 'suffix'): PlannedPicture[] {
	const occupant = new Map(existing.map((file) => [pathKey(file.path), file]))
	const moving = new Set(candidates.flatMap(({ files }) => files.map((file) => file.entry.fileId)))
	const conflictOf = (file: PictureFile, path: string) => {
		const found = occupant.get(pathKey(path))
		return found === undefined || found.fileId === file.entry.fileId ? null : found
	}
	const pathsAt = (index: number, suffix: number | null) => candidates[index]!.rendered.map((file) => joinPath(target, renderedPath(file, suffix)))
	const suffixes = collisionSuffixes(candidates.map(({ rendered }) => rendered))
	const conflicts = candidates.map(({ files }, index) => pathsAt(index, suffixes[index] ?? null).map((path, at) => conflictOf(files[at]!, path)))
	const choices = conflicts.map((found, index): ConflictChoice | null => {
		if (found.every((file) => file === null)) {
			return null
		}
		const choice = choiceOf(index)
		return choice === 'replace' && found.some((file) => file !== null && moving.has(file.fileId)) ? 'suffix' : choice
	})
	const taken = new Map<string, number | null>(existing.map((file) => [pathKey(file.path), file.fileId]))
	choices.forEach((choice, index) => {
		if (choice === null || choice === 'replace') {
			pathsAt(index, suffixes[index] ?? null).forEach((path) => taken.set(pathKey(path), null))
		}
	})
	const finalSuffixes = choices.map((choice, index) => (choice === 'suffix' ? freeSuffix(candidates[index]!, (suffix) => pathsAt(index, suffix), taken) : suffixes[index] ?? null))
	return candidates.map(({ files }, index) => {
		const paths = pathsAt(index, finalSuffixes[index] ?? null)
		return {
			inConflict: choices[index] !== null,
			sent: choices[index] !== 'skip',
			files: files.map((file, at) => {
				const conflict = conflicts[index]![at] ?? null
				return { file, path: paths[at]!, conflict, replace: choices[index] === 'replace' ? conflict : null }
			}),
		}
	})
}

/** The sent pictures as the move request's body; a file in `permanent` replaces for good (ADR 0048). */
export function moveRequest(plan: readonly PlannedPicture[], permanent: ReadonlySet<number> = new Set()): MoveRequestFile[][] {
	return plan.filter((picture) => picture.sent).map((picture) => picture.files.map(({ file, path, replace }) => ({
		fileId: file.entry.fileId,
		etag: file.entry.etag,
		path,
		...(replace === null ? {} : { replace: { fileId: replace.fileId, etag: replace.etag, ...(permanent.has(file.entry.fileId) ? { permanent: true as const } : {}) } }),
	})))
}

/** The lowest suffix at which every path of the picture is free or its own file's, which it then takes. */
function freeSuffix(candidate: MoveCandidate, pathsAt: (suffix: number | null) => string[], taken: Map<string, number | null>): number | null {
	const isFree = (suffix: number | null) => pathsAt(suffix).every((path, at) => {
		const key = pathKey(path)
		return !taken.has(key) || taken.get(key) === candidate.files[at]!.entry.fileId
	})
	let suffix: number | null = null
	while (!isFree(suffix)) {
		suffix = suffix === null ? FIRST_SUFFIX : suffix + 1
	}
	pathsAt(suffix).forEach((path) => taken.set(pathKey(path), null))
	return suffix
}

/** A path below a folder of the user's files; the root is `/`. */
function joinPath(folder: string, relative: string): string {
	const base = folder.replace(/\/+$/, '')
	return relative === '' ? base || '/' : `${base}/${relative}`
}

/** The folder of a path of the user's files; the root is `/`. */
function folderOf(path: string): string {
	return path.slice(0, path.lastIndexOf('/')) || '/'
}

/** Paths compare case-insensitively (`docs/dev/05-name-templates.md` Collisions). */
function pathKey(path: string): string {
	return path.toLowerCase()
}
