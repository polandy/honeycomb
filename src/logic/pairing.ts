// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FileName } from './file-name.ts'
import type { SidecarOwner } from './sidecars.ts'

import { parseFileName, splitFolder } from './file-name.ts'
import { SIDECAR_EXTENSION, sidecarOwnerFinder } from './sidecars.ts'

/** Where a picture's RAW and rendered members sit (Q16). */
export type FolderMode
	= | { readonly kind: 'same-folder' }
		| { readonly kind: 'separate-subfolders', readonly rawSubfolder: string, readonly renderedSubfolder: string }

/** The per-user settings pairing depends on (Q15, Q16). */
export interface PairingSettings {
	readonly rawExtensions: readonly string[]
	readonly renderedExtensions: readonly string[]
	readonly folderMode: FolderMode
}

/** The requirements' RAW list, Q15's rendered list and the same folder mode. */
export const DEFAULT_PAIRING_SETTINGS: PairingSettings = {
	rawExtensions: ['nef', 'cr2', 'cr3', 'arw', 'raf', 'orf', 'rw2', 'dng', 'pef', 'srw'],
	renderedExtensions: ['jpg', 'jpeg', 'heic', 'heif', 'hif'],
	folderMode: { kind: 'same-folder' },
}

/** Any listing entry; pairing reads only its path. */
export interface PairingEntry {
	readonly path: string
}

type Members<T>
	= | { readonly raw: T, readonly rendered: T }
		| { readonly raw: T, readonly rendered: null }
		| { readonly raw: null, readonly rendered: T }

/** One pair or one single with its sidecars; `ambiguous` singles share a base name (Q14). */
export type Picture<T> = Members<T> & {
	readonly folder: string
	readonly baseName: string
	readonly sidecars: readonly T[]
	readonly ambiguous: boolean
}

/** Thrown when the extension lists make a file's role undefined. */
export class PairingSettingsError extends Error {}

type Role = 'raw' | 'rendered'

interface Member<T> {
	readonly entry: T
	readonly file: FileName
	readonly role: Role
}

interface Draft<T> {
	readonly members: readonly Member<T>[]
	readonly ambiguous: boolean
}

/** Groups listing entries into pictures, in the order of each picture's first member. */
export function pairPictures<T extends PairingEntry>(entries: readonly T[], settings: PairingSettings): Picture<T>[] {
	const roles = roleByExtension(settings)
	const groups = new Map<string, Member<T>[]>()
	const sidecars: { readonly entry: T, readonly file: FileName }[] = []
	for (const entry of entries) {
		const file = pairingFile(entry.path, settings.folderMode)
		const role = roles.get(file.extension)
		if (file.baseName === '') {
			continue
		} else if (role !== undefined) {
			const key = `${file.folder}/${file.baseName.toLowerCase()}`
			groups.set(key, [...(groups.get(key) ?? []), { entry, file, role }])
		} else if (file.extension === SIDECAR_EXTENSION) {
			sidecars.push({ entry, file })
		}
	}
	const drafts = [...groups.values()].flatMap(draftsOf)
	const sidecarsOf: T[][] = drafts.map(() => [])
	const ownerOf = sidecarOwnerFinder(drafts.map(asSidecarOwner))
	for (const sidecar of sidecars) {
		const owner = ownerOf(sidecar.file)
		if (owner !== undefined) {
			sidecarsOf[owner]!.push(sidecar.entry)
		}
	}
	return drafts.map((draft, index) => picture(draft, sidecarsOf[index]!))
}

/** One draft for a pair or a single; every member alone when a role has more than one (Q14). */
function draftsOf<T>(members: readonly Member<T>[]): Draft<T>[] {
	const count = (role: Role) => members.filter((member) => member.role === role).length
	return count('raw') > 1 || count('rendered') > 1
		? members.map((member) => ({ members: [member], ambiguous: true }))
		: [{ members, ambiguous: false }]
}

/** The draft as the sidecar lookup sees it. */
function asSidecarOwner<T>({ members, ambiguous }: Draft<T>): SidecarOwner {
	const [first] = members
	return {
		folder: first!.file.folder,
		baseName: first!.file.baseName,
		memberNames: members.map((member) => member.file.name),
		ambiguous,
	}
}

/** The picture of a draft, named after its RAW member when it has one. */
function picture<T>({ members, ambiguous }: Draft<T>, sidecars: readonly T[]): Picture<T> {
	const raw = members.find((member) => member.role === 'raw')
	const rendered = members.find((member) => member.role === 'rendered')
	const named = raw ?? rendered!
	const common = { folder: named.file.folder, baseName: named.file.baseName, sidecars, ambiguous }
	if (raw === undefined) {
		return { ...common, raw: null, rendered: rendered!.entry }
	}
	return rendered === undefined
		? { ...common, raw: raw.entry, rendered: null }
		: { ...common, raw: raw.entry, rendered: rendered.entry }
}

/** The file with its folder replaced by the folder it pairs in. */
function pairingFile(path: string, mode: FolderMode): FileName {
	const file = parseFileName(path)
	if (mode.kind === 'same-folder') {
		return file
	}
	const { parent, name } = splitFolder(file.folder)
	const subfolders = [mode.rawSubfolder, mode.renderedSubfolder].map((subfolder) => subfolder.toLowerCase())
	return subfolders.includes(name.toLowerCase()) ? { ...file, folder: parent } : file
}

/** Each listed extension's role; an extension in both lists is an error. */
function roleByExtension(settings: PairingSettings): Map<string, Role> {
	const roles = new Map<string, Role>()
	const lists: [Role, readonly string[]][] = [['raw', settings.rawExtensions], ['rendered', settings.renderedExtensions]]
	for (const [role, extensions] of lists) {
		for (const extension of extensions.map(normalizeExtension)) {
			if (roles.has(extension) && roles.get(extension) !== role) {
				throw new PairingSettingsError(`The extension "${extension}" is in both the RAW and the rendered list; keep it in one.`)
			}
			roles.set(extension, role)
		}
	}
	return roles
}

/** The extension in lower case without a leading dot; refuses an empty one and `xmp`. */
function normalizeExtension(extension: string): string {
	const normalized = extension.trim().replace(/^\./, '').toLowerCase()
	if (normalized === '' || normalized === SIDECAR_EXTENSION) {
		throw new PairingSettingsError(`The extension "${normalized}" cannot mark a RAW or rendered file; remove it from the list.`)
	}
	return normalized
}
