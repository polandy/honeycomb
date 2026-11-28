// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Settings } from '../../../src/logic/settings.ts'

import { describe, expect, it } from 'vitest'
import { DEFAULT_SWIPES } from '../../../src/logic/loupe-gesture.ts'
import { DEFAULT_NAME_TEMPLATE } from '../../../src/logic/name-template/presets.ts'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../../src/logic/pairing.ts'
import { addExtension, DEFAULT_SETTINGS, DEFAULT_SUBFOLDERS, folderMode, pairingSettings, parseSettings, removeExtension, SETTINGS_VERSION, splitChange, storedSettings } from '../../../src/logic/settings.ts'

describe('DEFAULT_SETTINGS', () => {
	// spec: SETTINGS-001.6, GRID-004.1, STATS-001.2, IMMICH-001.22, SETTINGS-001.34, FOLDERS-009.5
	it('pairs as the pairing defaults and turns on all but the vi keys', () => {
		expect(pairingSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_PAIRING_SETTINGS)
		expect(DEFAULT_SETTINGS).toMatchObject({ showSingles: true, swipes: DEFAULT_SWIPES, autoAdvance: true, flagButtonsShown: true, filmstripPinned: false, ratingRowPinned: false, viKeys: false, showFileNames: false, keepStatistics: true, immichOnly: false, writeFlagsToXmp: true, foldersIncludeSubfolders: true })
		expect(DEFAULT_SUBFOLDERS).toEqual({ rawSubfolder: 'RAW', renderedSubfolder: 'JPG' })
	})
})

describe('parseSettings', () => {
	// spec: SETTINGS-001.6
	it('reads back what it was given', () => {
		const settings: Settings = {
			rawExtensions: ['nef'],
			renderedExtensions: ['jpg', 'tif'],
			folderMode: { kind: 'separate-subfolders', rawSubfolder: 'Raws', renderedSubfolder: 'Out' },
			showSingles: false,
			swipes: { up: null, down: 'picked' },
			autoAdvance: false,
			flagButtonsShown: false,
			filmstripPinned: true,
			ratingRowPinned: true,
			viKeys: true,
			showFileNames: true,
			keepStatistics: false,
			immichOnly: true,
			writeFlagsToXmp: false,
			foldersIncludeSubfolders: false,
			libraryRoots: ['/Photos', '/Archive'],
			moveFavourites: ['/Archive'],
			moveRecent: ['/Archive', '/Best'],
			moveTemplate: '{name:lower}.{ext}',
			moveJobCodes: ['Hochzeit Müller'],
		}

		expect(parseSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings)
	})

	// spec: SETTINGS-001.6
	it.each([null, undefined, [], 'settings', 3])('takes the defaults for %j', (value) => {
		expect(parseSettings(value)).toEqual(DEFAULT_SETTINGS)
	})

	// spec: SETTINGS-001.6, GRID-004.1, STATS-001.2, IMMICH-001.22, SETTINGS-001.34, FOLDERS-009.5
	it('takes the default of each missing or invalid field and keeps the rest', () => {
		expect(parseSettings({ showSingles: 'no', autoAdvance: false, viKeys: 1, showFileNames: 'yes', keepStatistics: 'no', immichOnly: 'yes', writeFlagsToXmp: 'no', foldersIncludeSubfolders: 0, swipes: { up: 'rejected', down: 'maybe' } })).toEqual({
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

	// spec: SETTINGS-001.6
	it('normalises the extensions and drops repeats', () => {
		expect(parseSettings({ renderedExtensions: ['.JPG', ' jpeg ', 'jpg'] }).renderedExtensions).toEqual(['jpg', 'jpeg'])
	})

	// spec: SETTINGS-001.6
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

	// spec: SETTINGS-001.6
	it('takes the default swipes when they are no object', () => {
		expect(parseSettings({ swipes: 'up' }).swipes).toEqual(DEFAULT_SWIPES)
	})
})

describe('the sidecar switch of earlier releases', () => {
	// spec: SETTINGS-001.28
	it('ignores a stored switch, hint and confirmed folders, so the next save drops them', () => {
		expect(parseSettings({ sidecarWrite: 'off', sidecarExistingHint: true, confirmedSharedFolders: [7] })).toEqual(DEFAULT_SETTINGS)
	})
})

describe('folderMode', () => {
	// spec: SETTINGS-001.9
	it('is the same folder or the subfolders with each empty name at its default', () => {
		expect(folderMode('same-folder', 'A', 'B')).toEqual({ kind: 'same-folder' })
		expect(folderMode('separate-subfolders', 'Raws', '')).toEqual({ kind: 'separate-subfolders', rawSubfolder: 'Raws', renderedSubfolder: 'JPG' })
	})
})

describe('addExtension', () => {
	// spec: SETTINGS-001.8
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
	// spec: SETTINGS-001.8
	it('removes the extension from the list', () => {
		expect(removeExtension(DEFAULT_SETTINGS, 'renderedExtensions', 'jpeg').renderedExtensions).toEqual(['jpg', 'heic', 'heif', 'hif'])
	})

	// spec: SETTINGS-001.8
	it('keeps the last extension of a list', () => {
		const one = { ...DEFAULT_SETTINGS, rawExtensions: ['nef'] }

		expect(removeExtension(one, 'rawExtensions', 'nef')).toBe(one)
	})
})

describe('move targets', () => {
	// spec: SETTINGS-001.15
	it('keeps paths in order without repeats and drops the rest', () => {
		const parsed = parseSettings({ moveFavourites: ['/A', 'B', 3, '/A', '/C'], moveRecent: [null, '/R', '/R'] })

		expect(parsed.moveFavourites).toEqual(['/A', '/C'])
		expect(parsed.moveRecent).toEqual(['/R'])
	})

	// spec: SETTINGS-001.15
	it.each([undefined, '/A', { 0: '/A' }])('reads %j as no targets', (value) => {
		expect(parseSettings({ moveFavourites: value, moveRecent: value })).toMatchObject({ moveFavourites: [], moveRecent: [] })
		expect(DEFAULT_SETTINGS).toMatchObject({ moveFavourites: [], moveRecent: [] })
	})
})

describe('name template', () => {
	// spec: SETTINGS-001.16
	it.each([undefined, 3, '{name}', '{name} .{ext}', ''])('reads %j as the default', (value) => {
		expect(parseSettings({ moveTemplate: value }).moveTemplate).toBe(DEFAULT_NAME_TEMPLATE)
		expect(DEFAULT_SETTINGS.moveTemplate).toBe(DEFAULT_NAME_TEMPLATE)
	})

	// spec: SETTINGS-001.16
	it('keeps a valid template', () => {
		expect(parseSettings({ moveTemplate: '{date:%Y}/{name}.{ext}' }).moveTemplate).toBe('{date:%Y}/{name}.{ext}')
	})
})

describe('libraryRoots', () => {
	// spec: SETTINGS-001.29
	it('defaults to none, also for anything but a list', () => {
		expect(DEFAULT_SETTINGS.libraryRoots).toEqual([])
		for (const value of [undefined, null, 'Photos', { 0: '/a' }, 7]) {
			expect(parseSettings({ libraryRoots: value }).libraryRoots).toEqual([])
		}
		expect(parseSettings(null).libraryRoots).toEqual([])
	})

	// spec: SETTINGS-001.29
	it('reads valid roots in order, normalised, and drops repeated, nested, empty and non-string ones', () => {
		const stored = ['Photos', '/Photos/2019', '/Archive/', '/Photos', '', 4, '/Archive/old', '/Docs']
		expect(parseSettings({ libraryRoots: stored }).libraryRoots).toEqual(['/Photos', '/Archive', '/Docs'])
	})
})

describe('settings version', () => {
	// spec: SETTINGS-001.33
	it('reads an object with version 1, without a version or with another value field by field', () => {
		for (const version of [1, undefined, 7, 'one']) {
			expect(parseSettings({ version, viKeys: true })).toEqual({ ...DEFAULT_SETTINGS, viKeys: true })
		}
	})
})

describe('recent job codes', () => {
	// spec: MOVE-005.8
	it('keeps the stored job codes in order, each once, 5 at most, dropping those empty after sanitising or over 40 characters', () => {
		const parsed = parseSettings({ moveJobCodes: ['Hochzeit Müller', 3, '', ' ? ', 'x'.repeat(41), 'Hochzeit Müller', 'B', 'C', 'D', 'E', 'F'] })

		expect(parsed.moveJobCodes).toEqual(['Hochzeit Müller', 'B', 'C', 'D', 'E'])
	})

	// spec: MOVE-005.8
	it.each([undefined, 'Shoot', { 0: 'Shoot' }])('reads %j as no job codes', (value) => {
		expect(parseSettings({ moveJobCodes: value }).moveJobCodes).toEqual([])
		expect(DEFAULT_SETTINGS.moveJobCodes).toEqual([])
	})
})

describe('storedSettings', () => {
	// spec: SETTINGS-001.11, SETTINGS-001.33
	it('is the object to save: version 1, without the lists that have their own keys', () => {
		const settings: Settings = { ...DEFAULT_SETTINGS, viKeys: true, moveRecent: ['/A'], moveFavourites: ['/B'], moveJobCodes: ['Shoot'], libraryRoots: ['/C'] }

		const stored = storedSettings(settings)

		expect(SETTINGS_VERSION).toBe(1)
		expect(stored).toMatchObject({ version: 1, viKeys: true })
		expect(['moveRecent', 'moveFavourites', 'moveJobCodes', 'libraryRoots'].filter((name) => name in stored)).toEqual([])
		expect(parseSettings(stored)).toEqual({ ...settings, moveRecent: [], moveFavourites: [], moveJobCodes: [], libraryRoots: [] })
	})
})

describe('splitChange', () => {
	// spec: SETTINGS-001.11, SETTINGS-001.31
	it('names the lists a change touches and whether it touches the object', () => {
		expect(splitChange({ viKeys: true })).toEqual({ object: true, lists: [] })
		expect(splitChange({ moveRecent: ['/A'], moveFavourites: [] })).toEqual({ object: false, lists: ['moveRecent', 'moveFavourites'] })
		expect(splitChange({ libraryRoots: ['/C'], autoAdvance: false })).toEqual({ object: true, lists: ['libraryRoots'] })
		expect(splitChange({ moveRecent: ['/A'], moveJobCodes: ['Shoot'] })).toEqual({ object: false, lists: ['moveRecent', 'moveJobCodes'] })
		expect(splitChange({})).toEqual({ object: false, lists: [] })
	})
})
