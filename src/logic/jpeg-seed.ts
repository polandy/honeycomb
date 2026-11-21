// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarFailureReason, SidecarLookupAnswer } from './sidecar-sync.ts'
import type { XmpTime } from './xmp/model.ts'

import { PROPERTY } from './xmp/fields.ts'
import { XmpError } from './xmp/model.ts'
import { readXmp } from './xmp/parse.ts'
import { serializeXmp } from './xmp/serialize.ts'

/** The fields the JPEG sidecar does not take over: *Keep RAW* lives in the rows, digiKam's pick fields stay (DELETE-003.12). */
const NOT_SEEDED: readonly string[] = [PROPERTY.keepRaw]

/** The JPEG sidecar seeded from the RAW sidecar read again: every field but Keep RAW, `null` when none is left, or why it cannot be seeded. */
export function seededSidecar(answer: SidecarLookupAnswer | undefined, time: XmpTime): { readonly bytes: Uint8Array } | { readonly reason: SidecarFailureReason } | null {
	if (answer === undefined) {
		return { reason: 'unreachable' }
	}
	if (answer.result !== 'read') {
		return { reason: answer.result }
	}
	try {
		const packet = readXmp(answer.bytes)
		const properties = new Map([...packet.properties].filter(([key]) => !NOT_SEEDED.includes(key)))
		const holdsFields = [...properties.keys()].some((key) => key !== PROPERTY.metadataDate)
		return holdsFields ? { bytes: serializeXmp({ properties, prefixes: packet.prefixes }, time) } : null
	} catch (error) {
		if (!(error instanceof XmpError)) {
			throw error
		}
		return { reason: error.reason }
	}
}
