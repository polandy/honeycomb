// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Picture } from '../../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { sidecarTargets } from '../../../../src/logic/xmp/targets.ts'

interface Entry {
	readonly path: string
}

/** The pair `IMG_0001.NEF` + `IMG_0001.JPG` in `photos` with the given sidecars. */
function pair(...sidecars: readonly string[]): Picture<Entry> {
	return {
		raw: { path: 'photos/IMG_0001.NEF' },
		rendered: { path: 'photos/IMG_0001.JPG' },
		folder: 'photos',
		baseName: 'IMG_0001',
		sidecars: sidecars.map((name) => ({ path: `photos/${name}` })),
		ambiguous: false,
	}
}

/** The targets as paths. */
function targets(picture: Picture<Entry>) {
	const { existing, created } = sidecarTargets(picture)
	return { existing: existing.map((entry) => entry.path), created }
}

describe('sidecarTargets', () => {
	// spec: XMP-001.20
	it.each([
		['the RAW member\'s sidecar only', pair('IMG_0001.NEF.xmp'), ['photos/IMG_0001.NEF.xmp'], ['photos/IMG_0001.JPG.xmp']],
		['the shared sidecar only', pair('IMG_0001.xmp'), ['photos/IMG_0001.xmp'], []],
		['a darktable duplicate besides', pair('IMG_0001.NEF.xmp', 'IMG_0001_01.NEF.xmp'), ['photos/IMG_0001.NEF.xmp'], ['photos/IMG_0001.JPG.xmp']],
		['a darktable duplicate only', pair('IMG_0001_01.NEF.XMP'), [], ['photos/IMG_0001.NEF.xmp', 'photos/IMG_0001.JPG.xmp']],
		['both members\' sidecars in another case', pair('img_0001.nef.XMP', 'IMG_0001.JPG.xmp'), ['photos/img_0001.nef.XMP', 'photos/IMG_0001.JPG.xmp'], []],
	])('writes a pair with %s', (_, picture, existing, created) => {
		expect(targets(picture)).toEqual({ existing, created })
	})

	// spec: XMP-001.20
	it('creates the sidecar of a single without one', () => {
		const single: Picture<Entry> = { raw: null, rendered: { path: 'IMG_0002.JPG' }, folder: '', baseName: 'IMG_0002', sidecars: [], ambiguous: false }
		expect(targets(single)).toEqual({ existing: [], created: ['IMG_0002.JPG.xmp'] })
	})
})
