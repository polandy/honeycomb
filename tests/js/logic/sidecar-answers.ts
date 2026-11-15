// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarLookupAnswer } from '../../../src/logic/sidecar-sync.ts'

import { serializeXmp } from '../../../src/logic/xmp/serialize.ts'
import { CANONICAL_TIME, packetOf } from './xmp/xmp-builders.ts'

/** The bytes of a sidecar with the properties, each written as `prefix:Name`. */
export function xmp(properties: Record<string, string>): Uint8Array {
	return serializeXmp(packetOf(properties), CANONICAL_TIME)
}

/** A `read` lookup answer of the bytes at the mtime. */
export function read(bytes: Uint8Array, mtime = 100): SidecarLookupAnswer {
	return { result: 'read', bytes, etag: `etag-${mtime}`, size: bytes.length, mtime }
}
