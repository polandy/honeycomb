// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FileName } from './file-name.ts'

/** The extension of a sidecar, compared in lower case. */
export const SIDECAR_EXTENSION = 'xmp'

/** darktable names a duplicate's sidecar `IMG_0001_01.NEF.xmp` (`docs/06-xmp-interop.md`). */
const DARKTABLE_DUPLICATE = /^(.+)_\d+(\.[^.]+)$/

/** A picture as sidecars see it: its pairing folder, base name and member file names. */
export interface SidecarOwner {
	readonly folder: string
	readonly baseName: string
	readonly memberNames: readonly string[]
	readonly ambiguous: boolean
}

/**
 * Finds the owner of a sidecar by its name: a member's file name exactly, else ignoring case when
 * unique, else a darktable duplicate's member, else the shared base name of an unambiguous owner.
 */
export function sidecarOwnerFinder(owners: readonly SidecarOwner[]): (sidecar: FileName) => number | undefined {
	const exact = new Map<string, number>()
	const ignoringCase = new Map<string, number[]>()
	const shared = new Map<string, number>()
	owners.forEach((owner, index) => {
		for (const name of owner.memberNames) {
			exact.set(`${owner.folder}/${name}`, index)
			const key = `${owner.folder}/${name.toLowerCase()}`
			ignoringCase.set(key, [...(ignoringCase.get(key) ?? []), index])
		}
		if (!owner.ambiguous) {
			shared.set(`${owner.folder}/${owner.baseName.toLowerCase()}`, index)
		}
	})
	const byMemberName = (folder: string, name: string): number | undefined => {
		const matches = ignoringCase.get(`${folder}/${name.toLowerCase()}`) ?? []
		return exact.get(`${folder}/${name}`) ?? (matches.length === 1 ? matches[0] : undefined)
	}
	return ({ folder, baseName }) => {
		const duplicateOf = baseName.replace(DARKTABLE_DUPLICATE, '$1$2')
		return byMemberName(folder, baseName)
			?? byMemberName(folder, duplicateOf)
			?? shared.get(`${folder}/${baseName.toLowerCase()}`)
	}
}
