// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TemplatePart, TemplateProblem } from './parse.ts'
import type { MemberFile, PictureFacts } from './render.ts'

import { collisionSuffixes } from './collisions.ts'
import { parseNameTemplate } from './parse.ts'
import { renderedPath, renderPicture } from './render.ts'

/** A made-up picture the settings preview the template on. */
export interface SamplePicture {
	readonly facts: PictureFacts
	readonly files: readonly MemberFile[]
}

/** A sample's new paths (null when `{number}` cannot name it), its collision suffix and which fallbacks it took. */
export interface PreviewRow {
	readonly sample: SamplePicture
	readonly paths: readonly string[] | null
	readonly suffix: number | null
	readonly fileTime: boolean
	readonly unknownCamera: boolean
}

/** The samples as one move would name them, or the template's first problem. */
export type TemplatePreview
	= | { readonly ok: true, readonly rows: readonly PreviewRow[], readonly collisions: number }
		| { readonly ok: false, readonly problem: TemplateProblem, readonly column: number }

const AT_14_32_05 = 1_794_234_725
const AT_09_15_00 = 1_794_215_700
const AT_18_02_41 = 1_794_247_361

/** A sample's facts; the capture time doubles as the file time. */
function sample(baseName: string, extensions: readonly string[], model: string | null, make: string | null, captureTime: number | null, mtime = captureTime!): SamplePicture {
	return {
		facts: { baseName, captureTime, mtime, mtimeOffsetMinutes: 0, make, model },
		files: extensions.map((extension) => ({ extension, subfolder: null })),
	}
}

/** Two cameras at the same second with the same original name, a phone, a sidecar, and a file without EXIF (2026-11-09). */
export const SAMPLE_PICTURES: readonly SamplePicture[] = [
	sample('DSCF1234', ['JPG', 'RAF'], 'X-T5', 'FUJIFILM', AT_14_32_05),
	sample('DSCF1234', ['JPG', 'RAF'], 'X-H2', 'FUJIFILM', AT_14_32_05),
	sample('IMG_0042', ['JPG', 'DNG'], 'iPhone 15 Pro', 'Apple', AT_14_32_05),
	sample('DSC_0815', ['NEF', 'NEF.xmp'], 'NIKON Z 6_2', 'NIKON CORPORATION', AT_09_15_00),
	sample('Übersicht März', ['jpg'], null, null, null, AT_18_02_41),
]

/** The template rendered on the samples in order, suffixed as one move would (`docs/plan.md` Moving pictures). */
export function templatePreview(text: string): TemplatePreview {
	const parsed = parseNameTemplate(text)
	if (!parsed.ok) {
		return parsed
	}
	const parts: TemplatePart[] = [...parsed.template.folders.flat(), ...parsed.template.name]
	const uses = (kind: TemplatePart['kind']) => parts.some((part) => part.kind === kind)
	const rendered = SAMPLE_PICTURES.map((each) => renderPicture(parsed.template, each.facts, each.files))
	const named = rendered.flatMap((each) => (each.ok ? [each.files] : []))
	const suffixes = collisionSuffixes(named)
	let next = 0
	const rows = SAMPLE_PICTURES.map((each, index): PreviewRow => {
		const picture = rendered[index]!
		const suffix = picture.ok ? suffixes[next++]! : null
		return {
			sample: each,
			paths: picture.ok ? picture.files.map((file) => renderedPath(file, suffix)) : null,
			suffix,
			fileTime: each.facts.captureTime === null && uses('date'),
			unknownCamera: (each.facts.model === null && uses('camera')) || (each.facts.make === null && uses('make')),
		}
	})
	return { ok: true, rows, collisions: suffixes.filter((suffix) => suffix !== null).length }
}
