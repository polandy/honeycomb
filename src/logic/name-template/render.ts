// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LetterCase, NameTemplate, TemplatePart } from './parse.ts'

import { sanitiseValue } from './sanitise.ts'

/** One set of values per picture; times are Unix seconds, the capture time as the camera's clock. */
export interface PictureFacts {
	readonly baseName: string
	readonly captureTime: number | null
	readonly mtime: number
	readonly mtimeOffsetMinutes: number
	readonly make: string | null
	readonly model: string | null
}

/** A file of the picture: its extension as written (`NEF.xmp`) and its subfolder in separate-subfolders mode. */
export interface MemberFile {
	readonly extension: string
	readonly subfolder: string | null
}

/** A file's new folder, name and extension, relative to the target folder. */
export interface RenderedFile {
	readonly folder: string
	readonly name: string
	readonly extension: string
}

/** The picture's files in input order, or why it cannot be named. */
export type RenderedPicture
	= | { readonly ok: true, readonly files: readonly RenderedFile[] }
		| { readonly ok: false, readonly problem: 'no-number' }

interface Values {
	readonly facts: PictureFacts
	readonly time: Date
	readonly number: string
	readonly extension: string
}

const UNKNOWN = 'unknown'
const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MS_PER_DAY = 86_400_000
const TRAILING_DIGITS = /\d+$/

/** Renders every file of a picture from the picture's one set of values (`docs/05-name-templates.md`). */
export function renderPicture(template: NameTemplate, facts: PictureFacts, files: readonly MemberFile[]): RenderedPicture {
	const number = TRAILING_DIGITS.exec(facts.baseName)?.[0] ?? null
	const parts = [...template.folders.flat(), ...template.name]
	if (number === null && parts.some((part) => part.kind === 'number')) {
		return { ok: false, problem: 'no-number' }
	}
	const seconds = facts.captureTime ?? facts.mtime + facts.mtimeOffsetMinutes * SECONDS_PER_MINUTE
	const time = new Date(seconds * MS_PER_SECOND)
	if (Number.isNaN(time.getTime())) {
		throw new RangeError(`the time ${seconds} of ${facts.baseName} is outside the range of a date`)
	}
	return {
		ok: true,
		files: files.map((file) => {
			const values = { facts, time, number: number ?? '', extension: file.extension }
			const folders = template.folders.map((folder) => renderParts(folder, values))
			return {
				folder: [...folders, ...(file.subfolder === null ? [] : [file.subfolder])].join('/'),
				name: renderParts(template.name, values),
				extension: cased(tokenValue(file.extension), template.extensionCase),
			}
		}),
	}
}

/** The file's path relative to the target folder, with the collision suffix before its extension. */
export function renderedPath(file: RenderedFile, suffix: number | null): string {
	const folder = file.folder === '' ? '' : `${file.folder}/`
	return `${folder}${file.name}${suffix === null ? '' : `-${suffix}`}.${file.extension}`
}

/** The parts rendered and joined. */
function renderParts(parts: readonly TemplatePart[], values: Values): string {
	return parts.map((part) => renderPart(part, values)).join('')
}

/** One part's text for one file. */
function renderPart(part: TemplatePart, { facts, time, number, extension }: Values): string {
	switch (part.kind) {
		case 'literal':
			return part.text
		case 'date':
			return formatDate(part.format, time)
		case 'number':
			return part.digits === null ? number : number.slice(-part.digits).padStart(part.digits, '0')
		case 'name':
			return cased(tokenValue(facts.baseName), part.letterCase)
		case 'ext':
			return cased(tokenValue(extension), part.letterCase)
		case 'camera':
			return cased(tokenValue(facts.model), part.letterCase)
		case 'make':
			return cased(tokenValue(facts.make), part.letterCase)
	}
}

/** The sanitised value, or `unknown` when nothing is left. */
function tokenValue(value: string | null): string {
	return sanitiseValue(value ?? '') || UNKNOWN
}

/** The value in the token's letter case. */
function cased(value: string, letterCase: LetterCase): string {
	switch (letterCase) {
		case 'lower':
			return value.toLowerCase()
		case 'upper':
			return value.toUpperCase()
		case 'as-is':
			return value
	}
}

/** The format with each code replaced by the time's field, read in UTC. */
function formatDate(format: string, time: Date): string {
	const year = time.getUTCFullYear()
	const codes: Readonly<Record<string, string>> = {
		Y: pad(year, 4),
		y: pad(year % 100, 2),
		m: pad(time.getUTCMonth() + 1, 2),
		d: pad(time.getUTCDate(), 2),
		j: pad((Date.UTC(year, time.getUTCMonth(), time.getUTCDate()) - Date.UTC(year, 0, 1)) / MS_PER_DAY + 1, 3),
		H: pad(time.getUTCHours(), 2),
		M: pad(time.getUTCMinutes(), 2),
		S: pad(time.getUTCSeconds(), 2),
	}
	return format.replace(/%(.)/g, (_match, code: string) => codes[code] ?? '')
}

/** The number zero-padded to the digits. */
function pad(value: number, digits: number): string {
	return String(value).padStart(digits, '0')
}
