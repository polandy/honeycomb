// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** A path split into its folder, file name, base name and lower-case extension. */
export interface FileName {
	readonly folder: string
	readonly name: string
	readonly baseName: string
	readonly extension: string
}

/** Splits a `/`-separated path; the base name runs up to the last `.` of the file name. */
export function parseFileName(path: string): FileName {
	const slash = path.lastIndexOf('/')
	const name = path.slice(slash + 1)
	const dot = name.lastIndexOf('.')
	return {
		folder: slash < 0 ? '' : path.slice(0, slash),
		name,
		baseName: dot < 0 ? name : name.slice(0, dot),
		extension: dot < 0 ? '' : name.slice(dot + 1).toLowerCase(),
	}
}

/** Splits a folder path into its parent folder and its own name. */
export function splitFolder(folder: string): { readonly parent: string, readonly name: string } {
	const slash = folder.lastIndexOf('/')
	return { parent: slash < 0 ? '' : folder.slice(0, slash), name: folder.slice(slash + 1) }
}
