// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from './folder-set.ts'
import type { PictureId } from './picture-id.ts'

/** The hash parameter that carries the open cull. */
const PARAMETER = '#cull='

/** The format version of the hash; bump it when the format changes, older and newer links are then ignored. */
const VERSION = 1

/** Where a cull stands: its folder set and the picture of the open loupe, null in the grid. */
export interface CullLocation {
	readonly folderSet: FolderSet
	readonly fileId: PictureId | null
}

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')

/** The address hash of the cull; empty without a folder set. */
export function locationHash(folderSet: FolderSet | null, fileId: PictureId | null): string {
	if (folderSet === null) {
		return ''
	}
	return PARAMETER + encodeURIComponent(JSON.stringify({ v: VERSION, ...folderSet, ...(fileId === null ? {} : { fileId }) }))
}

/** The cull an address hash names; null when it names none or is malformed or of another version. */
export function parseLocation(hash: string): CullLocation | null {
	if (!hash.startsWith(PARAMETER)) {
		return null
	}
	let value: unknown
	try {
		value = JSON.parse(decodeURIComponent(hash.slice(PARAMETER.length)))
	} catch {
		return null
	}
	const { v, paths, subfolders, excluded, fileId } = (value ?? {}) as Record<string, unknown>
	if (v !== VERSION || !isStrings(paths) || paths.length === 0 || typeof subfolders !== 'boolean' || (excluded !== undefined && !isStrings(excluded)) || (fileId !== undefined && typeof fileId !== 'number')) {
		return null
	}
	return { folderSet: { paths, subfolders, ...(excluded === undefined ? {} : { excluded }) }, fileId: fileId ?? null }
}
