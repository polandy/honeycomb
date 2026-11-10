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

/** Finds a sidecar's owner by member file name, darktable duplicate or shared base name (`docs/decisions.md`). */
export function sidecarOwnerFinder(owners: readonly SidecarOwner[]): (sidecar: FileName) => number | undefined {
	const exact = new Map<string, number[]>()
	const ignoringCase = new Map<string, number[]>()
	const shared = new Map<string, number>()
	owners.forEach((owner, index) => {
		for (const name of owner.memberNames) {
			append(exact, `${owner.folder}/${name}`, index)
			append(ignoringCase, `${owner.folder}/${name.toLowerCase()}`, index)
		}
		if (!owner.ambiguous) {
			shared.set(`${owner.folder}/${owner.baseName.toLowerCase()}`, index)
		}
	})
	const byMemberName = (folder: string, name: string): number | undefined => {
		return only(exact.get(`${folder}/${name}`)) ?? only(ignoringCase.get(`${folder}/${name.toLowerCase()}`))
	}
	return ({ folder, baseName }) => {
		const duplicateOf = baseName.replace(DARKTABLE_DUPLICATE, '$1$2')
		return byMemberName(folder, baseName)
			?? byMemberName(folder, duplicateOf)
			?? shared.get(`${folder}/${baseName.toLowerCase()}`)
	}
}

/** Whether the sidecar is the member's own, `<member>.xmp` or a darktable duplicate's, ignoring case. */
export function isOwnSidecar(sidecar: FileName, memberName: string): boolean {
	return isMemberSidecar(sidecar, memberName) || isDuplicateSidecar(sidecar, memberName)
}

/** Whether the sidecar is `<member>.xmp`, ignoring case. */
export function isMemberSidecar(sidecar: FileName, memberName: string): boolean {
	return sidecar.baseName.toLowerCase() === memberName.toLowerCase()
}

/** Whether the sidecar is a darktable duplicate's of the member, `IMG_0001_01.NEF.xmp`, ignoring case. */
export function isDuplicateSidecar(sidecar: FileName, memberName: string): boolean {
	return !isMemberSidecar(sidecar, memberName) && sidecar.baseName.replace(DARKTABLE_DUPLICATE, '$1$2').toLowerCase() === memberName.toLowerCase()
}

/** Adds an owner index under a key. */
function append(index: Map<string, number[]>, key: string, owner: number): void {
	index.set(key, [...(index.get(key) ?? []), owner])
}

/** The single owner of a match, or none when there are several. */
function only(owners: readonly number[] | undefined): number | undefined {
	return owners?.length === 1 ? owners[0] : undefined
}
