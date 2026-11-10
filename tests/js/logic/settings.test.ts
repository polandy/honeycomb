// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Settings } from '../../../src/logic/settings.ts'

import { describe, expect, it } from 'vitest'
import { DEFAULT_SWIPES } from '../../../src/logic/loupe-gesture.ts'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../../src/logic/pairing.ts'
import { addExtension, DEFAULT_SETTINGS, DEFAULT_SUBFOLDERS, folderMode, pairingSettings, parseSettings, removeExtension } from '../../../src/logic/settings.ts'

describe('DEFAULT_SETTINGS', () => {
	it('pairs as the pairing defaults and turns on all but the vi keys', () => {
		expect(pairingSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_PAIRING_SETTINGS)
		expect(DEFAULT_SETTINGS).toMatchObject({ showSingles: true, swipes: DEFAULT_SWIPES, autoAdvance: true, flagButtonsShown: true, viKeys: false })
		expect(DEFAULT_SUBFOLDERS).toEqual({ rawSubfolder: 'RAW', renderedSubfolder: 'JPG' })
	})
})

describe('parseSettings', () => {
	it('reads back what it was given', () => {
		const settings: Settings = {
			rawExtensions: ['nef'],
			renderedExtensions: ['jpg', 'tif'],
			folderMode: { kind: 'separate-subfolders', rawSubfolder: 'Raws', renderedSubfolder: 'Out' },
			showSingles: false,
			swipes: { up: null, down: 'picked' },
			autoAdvance: false,
			flagButtonsShown: false,
			viKeys: true,
		}

		expect(parseSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
	})

	it.each([null, undefined, [], 'settings', 3])('takes the defaults for %j', (value) => {
		expect(parseSettings(value)).toEqual(DEFAULT_SETTINGS)
	})

	it('takes the default of each missing or invalid field and keeps the rest', () => {
		expect(parseSettings({ showSingles: 'no', autoAdvance: false, viKeys: 1, swipes: { up: 'rejected', down: 'maybe' } })).toEqual({
			...DEFAULT_SETTINGS,
			autoAdvance: false,
			swipes: { up: 'rejected', down: 'rejected' },
		})
	})

	it.each([
		['not a list', 'nef'],
		['an empty list', []],
		['a list with a number', ['nef', 3]],
		['a list with xmp', ['nef', 'xmp']],
		['a list with an empty extension', ['nef', '']],
	])('takes the default RAW extensions for %s', (_, rawExtensions) => {
		expect(parseSettings({ rawExtensions }).rawExtensions).toEqual(DEFAULT_SETTINGS.rawExtensions)
	})

	it('normalises the extensions and drops repeats', () => {
		expect(parseSettings({ renderedExtensions: ['.JPG', ' jpeg ', 'jpg'] }).renderedExtensions).toEqual(['jpg', 'jpeg'])
	})

	it('takes the default lists when an extension is in both, so pairing never fails', () => {
		const settings = parseSettings({ rawExtensions: ['nef', 'jpg'], renderedExtensions: ['jpg'] })

		expect(pairingSettings(settings)).toEqual(DEFAULT_PAIRING_SETTINGS)
		expect(pairPictures([{ path: '/a.nef' }, { path: '/a.jpg' }], pairingSettings(settings))).toHaveLength(1)
	})

	it.each([
		['an unknown kind', { kind: 'nested' }, { kind: 'same-folder' }],
		['no object', 'separate-subfolders', { kind: 'same-folder' }],
		['empty names', { kind: 'separate-subfolders', rawSubfolder: ' ', renderedSubfolder: 7 }, { kind: 'separate-subfolders', ...DEFAULT_SUBFOLDERS }],
		['names with spaces around', { kind: 'separate-subfolders', rawSubfolder: ' NEF ', renderedSubfolder: 'JPEG' }, { kind: 'separate-subfolders', rawSubfolder: 'NEF', renderedSubfolder: 'JPEG' }],
	])('reads a folder mode with %s', (_, value, expected) => {
		expect(parseSettings({ folderMode: value }).folderMode).toEqual(expected)
	})

	it('takes the default swipes when they are no object', () => {
		expect(parseSettings({ swipes: 'up' }).swipes).toEqual(DEFAULT_SWIPES)
	})
})

describe('folderMode', () => {
	it('is the same folder or the subfolders with each empty name at its default', () => {
		expect(folderMode('same-folder', 'A', 'B')).toEqual({ kind: 'same-folder' })
		expect(folderMode('separate-subfolders', 'Raws', '')).toEqual({ kind: 'separate-subfolders', rawSubfolder: 'Raws', renderedSubfolder: 'JPG' })
	})
})

describe('addExtension', () => {
	it('adds the normalised extension to the end of the list', () => {
		const result = addExtension(DEFAULT_SETTINGS, 'renderedExtensions', ' .TIF ')

		expect(result).toEqual({ settings: { ...DEFAULT_SETTINGS, renderedExtensions: [...DEFAULT_SETTINGS.renderedExtensions, 'tif'] } })
	})

	it.each([
		['', 'empty'],
		[' . ', 'empty'],
		['.XMP', 'sidecar'],
		['t f', 'invalid'],
		['tar.gz', 'invalid'],
		['NEF', 'in-this-list'],
		['.jpg', 'in-other-list'],
	])('refuses %j as %s', (input, reason) => {
		expect(addExtension(DEFAULT_SETTINGS, 'rawExtensions', input)).toEqual({ refused: reason })
	})
})

describe('removeExtension', () => {
	it('removes the extension from the list', () => {
		expect(removeExtension(DEFAULT_SETTINGS, 'renderedExtensions', 'jpeg').renderedExtensions).toEqual(['jpg', 'heic', 'heif', 'hif'])
	})

	it('keeps the last extension of a list', () => {
		const one = { ...DEFAULT_SETTINGS, rawExtensions: ['nef'] }

		expect(removeExtension(one, 'rawExtensions', 'nef')).toBe(one)
	})
})
