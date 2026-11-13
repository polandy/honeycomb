// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { KnownSidecar, SidecarLookupFailure } from './sidecar-sync.ts'
import type { XmpPacket } from './xmp/model.ts'

import { SIDECAR_EXTENSION } from './sidecars.ts'
import { readableXmp } from './xmp/parse.ts'
import { sidecarTargets } from './xmp/targets.ts'

const JPEG_MIME = 'image/jpeg'

/** What the embedded XMP endpoint answers for a JPEG other than its packet (XMP-005). */
export type EmbeddedXmpFailure = Exclude<SidecarLookupFailure, 'tooLarge'>

/** The embedded XMP endpoint's answer for one JPEG. */
export type EmbeddedXmpAnswer
	= | { readonly result: 'read', readonly bytes: Uint8Array }
		| { readonly result: 'none' | EmbeddedXmpFailure }

/** The packet an embedded XMP adds to a picture's tags (`null` for none or a refused one), or why it was not read. */
export type EmbeddedSource = { readonly packet: XmpPacket | null } | { readonly failure: EmbeddedXmpFailure | 'unreachable' }

/** The JPEG whose embedded XMP counts for the picture's tags: while it has no sidecar of its own nor a shared one, also none honeycomb created (TAGS-002). */
export function embeddedXmpSource(picture: Picture<ListingEntry>, known: ReadonlyMap<string, KnownSidecar> = new Map()): ListingEntry | null {
	const jpeg = picture.rendered
	if (jpeg?.mime !== JPEG_MIME) {
		return null
	}
	const path = embeddedSidecarPath(jpeg)
	return sidecarTargets(picture).created.includes(path) && !known.has(path) ? jpeg : null
}

/** The path of the sidecar that replaces the JPEG's embedded XMP once it exists. */
export function embeddedSidecarPath(jpeg: ListingEntry): string {
	return `${jpeg.path}.${SIDECAR_EXTENSION}`
}

/** What an answer of the embedded XMP endpoint adds to a picture's tags; no answer means its request failed. */
export function embeddedSourceOf(answer: EmbeddedXmpAnswer | undefined): EmbeddedSource {
	if (answer === undefined) {
		return { failure: 'unreachable' }
	}
	if (answer.result === 'read') {
		return { packet: readableXmp(answer.bytes) }
	}
	return answer.result === 'none' ? { packet: null } : { failure: answer.result }
}
