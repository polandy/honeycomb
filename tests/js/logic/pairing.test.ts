// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PairingSettings, Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { DEFAULT_PAIRING_SETTINGS, PairingSettingsError, pairPictures } from '../../../src/logic/pairing.ts'
import vectors from '../../fixtures/pairing/vectors.json' with { type: 'json' }

interface Entry {
	readonly path: string
	readonly fileId: number
}

const VECTOR_DEFAULTS = vectors.defaults as PairingSettings

function entries(paths: readonly string[]): Entry[] {
	return paths.map((path, index) => ({ path, fileId: index + 1 }))
}

function asVector(picture: Picture<Entry>) {
	return {
		folder: picture.folder,
		raw: picture.raw?.path ?? null,
		rendered: picture.rendered?.path ?? null,
		sidecars: picture.sidecars.map((sidecar) => sidecar.path),
		ambiguous: picture.ambiguous,
	}
}

describe('pairPictures on the shared vectors', () => {
	it.each(vectors.cases)('$name', (vector) => {
		const settings = { ...VECTOR_DEFAULTS, ...('settings' in vector ? vector.settings : {}) } as PairingSettings

		expect(pairPictures(entries(vector.files), settings).map(asVector)).toEqual(vector.pictures)
	})
})

describe('pairPictures', () => {
	it('defaults to the RAW and rendered extensions of the requirements and the same folder mode', () => {
		expect(DEFAULT_PAIRING_SETTINGS).toEqual(VECTOR_DEFAULTS)
	})

	it('returns the caller\'s entries as members and sidecars', () => {
		const [raw, rendered, sidecar] = entries(['/P/A.NEF', '/P/A.JPG', '/P/A.xmp'])

		const [picture] = pairPictures([raw!, rendered!, sidecar!], DEFAULT_PAIRING_SETTINGS)

		expect(picture?.raw).toBe(raw)
		expect(picture?.rendered).toBe(rendered)
		expect(picture?.sidecars[0]).toBe(sidecar)
	})

	it.each([
		['the RAW member when there is one', ['/P/dsc_1.jpg', '/P/DSC_1.NEF'], 'DSC_1'],
		['the rendered member of a JPEG single', ['/P/2026.11.09.dsc_1.jpg'], '2026.11.09.dsc_1'],
	])('takes the base name as written from %s', (_member, paths, baseName) => {
		const [picture] = pairPictures(entries(paths), DEFAULT_PAIRING_SETTINGS)

		expect(picture?.baseName).toBe(baseName)
	})

	it('accepts extensions in any case and with a leading dot', () => {
		const settings = { ...DEFAULT_PAIRING_SETTINGS, rawExtensions: ['.NEF'], renderedExtensions: [' Jpg '] }

		const [picture] = pairPictures(entries(['/P/A.nef', '/P/A.JPG']), settings)

		expect(asVector(picture!)).toMatchObject({ raw: '/P/A.nef', rendered: '/P/A.JPG' })
	})

	it('returns no pictures for no entries', () => {
		expect(pairPictures([], DEFAULT_PAIRING_SETTINGS)).toEqual([])
	})

	it.each([
		['an extension in both lists', { rawExtensions: ['nef', 'tif'], renderedExtensions: ['jpg', 'TIF'] }, 'tif'],
		['the sidecar extension as a RAW extension', { rawExtensions: ['xmp'] }, 'xmp'],
		['the sidecar extension as a rendered extension', { renderedExtensions: ['.XMP'] }, 'xmp'],
		['an empty extension', { rawExtensions: ['nef', ' '] }, '""'],
	])('rejects settings with %s', (_case, override, named) => {
		const settings = { ...DEFAULT_PAIRING_SETTINGS, ...override }

		expect(() => pairPictures(entries(['/P/A.JPG']), settings)).toThrow(PairingSettingsError)
		expect(() => pairPictures(entries(['/P/A.JPG']), settings)).toThrow(named)
	})
})
