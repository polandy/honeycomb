// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../../src/logic/decision.ts'
import type { XmpPacket } from '../../../../src/logic/xmp/model.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../../src/logic/decision.ts'
import { sidecarDecision } from '../../../../src/logic/xmp/decision.ts'
import { writeSidecar } from '../../../../src/logic/xmp/merge.ts'
import { readXmp } from '../../../../src/logic/xmp/parse.ts'
import { CANONICAL_TIME, fixtureBytes, key } from './xmp-builders.ts'

/** Sidecars in the style of other programs' exports (`docs/dev/06-xmp-interop.md` Test vectors). */
const CORPUS = ['lightroom-classic', 'capture-one', 'on1', 'photo-mechanic', 'darktable-history'].map((name) => `corpus/${name}.xmp`)

/** The properties honeycomb writes, which a merge may change. */
const WRITTEN = new Set(['xmp:Rating', 'xmp:Label', 'xmp:MetadataDate', 'digiKam:PickLabel', 'digiKam:ColorLabel', 'xmpDM:pick', 'xmpDM:good', 'darktable:colorlabels', 'honeycomb:KeepRaw'].map(key))

const DECISIONS: readonly Decision[] = [
	{ ...UNDECIDED, rating: 5, flag: 'picked', colourLabel: 'green', keepRaw: true },
	{ ...UNDECIDED, flag: 'rejected', colourLabel: 'orange' },
	UNDECIDED,
]

/** Every property of the packet honeycomb does not write. */
function foreign(packet: XmpPacket): Map<string, unknown> {
	return new Map([...packet.properties].filter(([name]) => !WRITTEN.has(name)))
}

describe('the corpus of foreign sidecars', () => {
	// spec: XMP-001.22
	it.each(CORPUS)('keeps every foreign property of %s through each decision written in turn', (name) => {
		const original = fixtureBytes(name)
		let bytes = original
		for (const decision of DECISIONS) {
			bytes = writeSidecar(bytes, decision, true, CANONICAL_TIME)
			const written = readXmp(bytes)
			expect(sidecarDecision(written, true)).toEqual(decision)
			expect(foreign(written)).toEqual(foreign(readXmp(original)))
		}
	})
})
