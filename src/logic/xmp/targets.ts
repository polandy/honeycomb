// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PairingEntry, Picture } from '../pairing.ts'

import { parseFileName } from '../file-name.ts'
import { pictureMembers } from '../pairing.ts'
import { isDuplicateSidecar, isMemberSidecar, SIDECAR_EXTENSION } from '../sidecars.ts'

/** The sidecars a decision is written to: the existing ones, and the paths of those to create. */
export interface SidecarTargets<T> {
	readonly existing: readonly T[]
	readonly created: readonly string[]
}

/** Every sidecar of the picture but darktable's duplicates; `<member file>.xmp` for each member without one, unless a shared one exists (`docs/06-xmp-interop.md` Sidecar names). */
export function sidecarTargets<T extends PairingEntry>(picture: Picture<T>): SidecarTargets<T> {
	const members = pictureMembers(picture)
	const names = members.map((member) => parseFileName(member.path).name)
	const sidecars = picture.sidecars.map((entry) => ({ entry, file: parseFileName(entry.path) }))
	const existing = sidecars.filter(({ file }) => !names.some((name) => isDuplicateSidecar(file, name)) || names.some((name) => isMemberSidecar(file, name)))
	const shared = existing.some(({ file }) => file.baseName.toLowerCase() === picture.baseName.toLowerCase())
	const created = shared
		? []
		: members.filter((_, index) => !existing.some(({ file }) => isMemberSidecar(file, names[index] as string)))
				.map((member) => `${member.path}.${SIDECAR_EXTENSION}`)
	return { existing: existing.map(({ entry }) => entry), created }
}
