// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, DecisionDelta } from '../../src/logic/decision.ts'
import type { Tag } from '../../src/logic/tag.ts'
import type { ToolReading, WrittenKey } from './xmp-tools.ts'

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { writeSidecar } from '../../src/logic/xmp/merge.ts'
import { readXmp } from '../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { mergeTags } from '../../src/logic/xmp/tags.ts'
import { CANONICAL_TIME, fixtureBytes } from '../js/logic/xmp/xmp-builders.ts'
import { exiftool, exiv2, foreignFields, writtenFields } from './xmp-tools.ts'

/** digiKam's colour label number and `xmp:Label` text (`digikam_globals.h:88, 119`), kept apart from honeycomb's table on purpose. */
const DIGIKAM_COLOURS: Record<ColourLabel, readonly [string, string]> = {
	red: ['1', 'Red'],
	orange: ['2', 'Orange'],
	yellow: ['3', 'Yellow'],
	green: ['4', 'Green'],
	blue: ['5', 'Blue'],
	magenta: ['6', 'Purple'],
	gray: ['7', 'Gray'],
	black: ['8', 'Black'],
	white: ['9', 'White'],
}

const PICKED = { 'Xmp.digiKam.PickLabel': '3', 'Xmp.xmpDM.pick': '1', 'Xmp.xmpDM.good': 'True' } as const
const REJECTED = { 'Xmp.digiKam.PickLabel': '1', 'Xmp.xmpDM.pick': '-1', 'Xmp.xmpDM.good': 'False' } as const
const LISBON = { 'Xmp.digiKam.TagsList': 'Places/Lisbon', 'Xmp.lr.hierarchicalSubject': 'Places|Lisbon', 'Xmp.dc.subject': 'Lisbon' } as const

/** The sidecars with properties a decision write does not set; `prefixes.xmp` renames a clashing prefix on purpose. */
const FOREIGN = [
	'digikam.xmp',
	'darktable.xmp',
	'darktable-label-precedence.xmp',
	'lightroom.xmp',
	'unknown-fields.xmp',
	'corpus/lightroom-classic.xmp',
	'corpus/capture-one.xmp',
	'corpus/on1.xmp',
	'corpus/photo-mechanic.xmp',
	'corpus/darktable-history.xmp',
]

const work = mkdtempSync(join(tmpdir(), 'honeycomb-xmp-interop-'))
let written = 0

afterAll(() => {
	rmSync(work, { recursive: true })
})

/** Writes the delta, and the tags when given, into the fixture or a new sidecar, and returns the file. */
function write(fixture: string | null, delta: DecisionDelta, isPair = false, tags: readonly Tag[] = []): string {
	let bytes = writeSidecar(fixture === null ? null : fixtureBytes(fixture), delta, isPair, CANONICAL_TIME)
	if (tags.length > 0) {
		bytes = serializeXmp(mergeTags(readXmp(bytes), { tags, removed: [] }), CANONICAL_TIME)
	}
	written += 1
	const file = join(work, `${written}.xmp`)
	writeFileSync(file, bytes)
	return file
}

/** The fixture copied, unchanged, for the tools to read. */
function original(fixture: string): string {
	const file = join(work, `original-${fixture.replace('/', '-')}`)
	writeFileSync(file, fixtureBytes(fixture))
	return file
}

/** Each tool, how it reads a sidecar, and how it prints `xmp:MetadataDate` at `CANONICAL_TIME`. */
const TOOLS: readonly (readonly [string, (file: string) => ToolReading, string])[] = [
	['ExifTool', exiftool, '2026:11:08 14:03:12+01:00'],
	['Exiv2', exiv2, '2026-11-08T14:03:12+01:00'],
]

describe.each(TOOLS)('%s reads what honeycomb writes', (_tool, read, metadataDate) => {
	/** The written properties as the tool reads them. */
	const fields = (file: string): Partial<Record<WrittenKey, string>> => writtenFields(read(file))

	// spec: XMP-001.25
	it('reads a new picked sidecar of a pair with its stars, colour, Keep RAW and tags', () => {
		const file = write(null, { rating: 4, flag: 'picked', colourLabel: 'blue', keepRaw: true }, true, ['People/Ana', 'Places/Lisbon'])

		expect(fields(file)).toEqual({
			'Xmp.xmp.Rating': '4',
			'Xmp.xmp.MetadataDate': metadataDate,
			...PICKED,
			'Xmp.digiKam.ColorLabel': '5',
			'Xmp.xmp.Label': 'Blue',
			'Xmp.honeycomb.KeepRaw': 'True',
			'Xmp.digiKam.TagsList': 'People/Ana, Places/Lisbon',
			'Xmp.lr.hierarchicalSubject': 'People|Ana, Places|Lisbon',
			'Xmp.dc.subject': 'Ana, Lisbon',
		})
	})

	// spec: XMP-001.25
	it.each(Object.entries(DIGIKAM_COLOURS))('reads the colour label %s as digiKam\'s', (colour, [number, text]) => {
		const file = write(null, { colourLabel: colour as ColourLabel })

		expect(fields(file)).toMatchObject({ 'Xmp.digiKam.ColorLabel': number, 'Xmp.xmp.Label': text })
	})

	// spec: XMP-001.25
	it('reads no colour label as 0 and no xmp:Label', () => {
		const file = write('digikam.xmp', { colourLabel: null })

		expect(fields(file)).toMatchObject({ 'Xmp.digiKam.ColorLabel': '0' })
		expect(fields(file)).not.toHaveProperty(['Xmp.xmp.Label'])
	})

	// spec: XMP-001.25
	it('reads a rejected digiKam sidecar with its stars kept and its tags', () => {
		const file = write('digikam.xmp', { flag: 'rejected' })

		expect(fields(file)).toEqual({
			'Xmp.xmp.Rating': '3',
			'Xmp.xmp.MetadataDate': metadataDate,
			...REJECTED,
			'Xmp.digiKam.ColorLabel': '5',
			'Xmp.xmp.Label': 'Blue',
			...LISBON,
		})
	})

	// spec: XMP-001.25
	it('reads digiKam\'s pending label kept when a rating is written, magenta as Purple', () => {
		const file = write('digikam-pending.xmp', { rating: 4 })

		expect(fields(file)).toEqual({
			'Xmp.xmp.Rating': '4',
			'Xmp.xmp.MetadataDate': metadataDate,
			'Xmp.digiKam.PickLabel': '2',
			'Xmp.digiKam.ColorLabel': '6',
			'Xmp.xmp.Label': 'Purple',
		})
	})

	// spec: XMP-001.25
	it('reads darktable\'s reject as stars and digiKam\'s reject, and its one new colour label', () => {
		const file = write('darktable.xmp', { colourLabel: 'green' })

		expect(fields(file)).toEqual({
			'Xmp.xmp.Rating': '0',
			'Xmp.xmp.MetadataDate': metadataDate,
			...REJECTED,
			'Xmp.digiKam.ColorLabel': '4',
			'Xmp.darktable.colorlabels': '2',
			'Xmp.lr.hierarchicalSubject': 'Places|Lisbon',
			'Xmp.dc.subject': 'Lisbon',
		})
	})

	// spec: XMP-001.25
	it('reads an unflagged Lightroom sidecar without pick fields', () => {
		const file = write('lightroom.xmp', { flag: 'unflagged' })

		expect(fields(file)).toEqual({
			'Xmp.xmp.Rating': '4',
			'Xmp.xmp.MetadataDate': metadataDate,
			'Xmp.digiKam.ColorLabel': '3',
			'Xmp.xmp.Label': 'Yellow',
			'Xmp.lr.hierarchicalSubject': 'Places|Lisbon',
			'Xmp.dc.subject': 'Lisbon',
		})
	})

	// spec: XMP-001.26
	it.each(FOREIGN)('reads every foreign property of %s unchanged', (fixture) => {
		const before = foreignFields(read(original(fixture)))
		const after = foreignFields(read(write(fixture, { rating: 2, flag: 'picked' })))

		expect(before.size).toBeGreaterThan(0)
		expect(after).toEqual(before)
	})
})
