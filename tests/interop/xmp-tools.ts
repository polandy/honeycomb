// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'node:child_process'

/** What one tool reads from a sidecar: property key → value text. */
export type ToolReading = ReadonlyMap<string, string>

/** Exiv2's key of each property a decision write sets, beside ExifTool's (`docs/dev/06-xmp-interop.md` Writing). */
const DECISION_FIELDS = {
	'Xmp.xmp.Rating': 'XMP-xmp:Rating',
	'Xmp.xmp.Label': 'XMP-xmp:Label',
	'Xmp.xmp.MetadataDate': 'XMP-xmp:MetadataDate',
	'Xmp.digiKam.PickLabel': 'XMP-digiKam:PickLabel',
	'Xmp.digiKam.ColorLabel': 'XMP-digiKam:ColorLabel',
	'Xmp.xmpDM.pick': 'XMP-xmpDM:Pick',
	'Xmp.xmpDM.good': 'XMP-xmpDM:Good',
	'Xmp.darktable.colorlabels': 'XMP-darktable:Colorlabels',
	'Xmp.honeycomb.KeepRaw': 'XMP-honeycomb:KeepRaw',
} as const

/** The tag fields, which only a tag write sets (`docs/dev/07-tags.md` Writing). */
const TAG_FIELDS = {
	'Xmp.digiKam.TagsList': 'XMP-digiKam:TagsList',
	'Xmp.lr.hierarchicalSubject': 'XMP-lr:HierarchicalSubject',
	'Xmp.dc.subject': 'XMP-dc:Subject',
} as const

const WRITTEN = { ...DECISION_FIELDS, ...TAG_FIELDS }

/** A property honeycomb writes, by Exiv2's key. */
export type WrittenKey = keyof typeof WRITTEN

/** The toolkit name the canonical form drops (ARC-3), and ExifTool's name of the file. */
const DROPPED = new Set(['Xmp.x.xmptk', 'XMP-x:XMPToolkit', 'SourceFile'])
const EXIV2_LINE = /^(Xmp\.\S+)\s+\S+\s+\d+\s{0,2}(.*)$/

/** ExifTool's reading of the sidecar, its values as text the way Exiv2 prints them. */
export function exiftool(file: string): ToolReading {
	const [entry] = JSON.parse(execFileSync('exiftool', ['-j', '-G1', '-n', '-XMP:all', file], { encoding: 'utf8' })) as Record<string, unknown>[]
	return new Map(Object.entries(entry ?? {}).filter(([key]) => !DROPPED.has(key)).map(([key, value]) => [key, exiftoolText(value)]))
}

/** Exiv2's reading of the sidecar's XMP properties, as `exiv2 -pa` prints them. */
export function exiv2(file: string): ToolReading {
	const lines = execFileSync('exiv2', ['-pa', file], { encoding: 'utf8' }).split('\n')
	return new Map(lines.map((line) => EXIV2_LINE.exec(line)).filter((match) => match !== null)
		.map(([, key = '', value = '']) => [key, value] as const).filter(([key]) => !DROPPED.has(key)))
}

/** The written properties of a reading, by Exiv2's key; ExifTool's keys are mapped. */
export function writtenFields(reading: ToolReading): Partial<Record<WrittenKey, string>> {
	return Object.fromEntries(Object.entries(WRITTEN)
		.map(([exiv2Key, exiftoolKey]) => [exiv2Key, reading.get(exiv2Key) ?? reading.get(exiftoolKey)] as const)
		.filter(([, value]) => value !== undefined))
}

/** A reading without the properties a decision write sets. */
export function foreignFields(reading: ToolReading): ToolReading {
	const written = new Set<string>(Object.entries(DECISION_FIELDS).flat())
	return new Map([...reading].filter(([key]) => !written.has(key)))
}

/** A JSON value of ExifTool as Exiv2 prints it: `True`/`False`, list items joined by a comma. */
function exiftoolText(value: unknown): string {
	if (Array.isArray(value)) {
		return value.map(exiftoolText).join(', ')
	}
	if (typeof value === 'boolean') {
		return value ? 'True' : 'False'
	}
	return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
}
