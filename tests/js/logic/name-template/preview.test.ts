// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TemplatePreview } from '../../../../src/logic/name-template/preview.ts'

import { describe, expect, it } from 'vitest'
import { parseNameTemplate } from '../../../../src/logic/name-template/parse.ts'
import { DEFAULT_NAME_TEMPLATE, NAME_TEMPLATE_PRESETS, presetOf } from '../../../../src/logic/name-template/presets.ts'
import { SAMPLE_PICTURES, templatePreview } from '../../../../src/logic/name-template/preview.ts'

/** The rows of a valid preview, without their samples. */
function rows(preview: TemplatePreview) {
	if (!preview.ok) {
		throw new Error(`refused: ${preview.problem}`)
	}
	return preview.rows.map(({ sample: _sample, ...row }) => row)
}

const plain = { suffix: null, fileTime: false, unknownCamera: false }

describe('NAME_TEMPLATE_PRESETS', () => {
	// spec: SETTINGS-001.17
	it('offers the three presets of 05-name-templates.md, the default first, each valid', () => {
		expect(NAME_TEMPLATE_PRESETS).toEqual([
			{ preset: 'by-day', template: DEFAULT_NAME_TEMPLATE },
			{ preset: 'by-day-full-date', template: '{date:%Y}/{date:%Y-%m-%d}/{date:%Y%m%d-%H%M%S}_{camera}_{name}.{ext}' },
			{ preset: 'keep-names', template: '{name}.{ext}' },
		])
		expect(NAME_TEMPLATE_PRESETS.every(({ template }) => parseNameTemplate(template).ok)).toBe(true)
	})

	// spec: SETTINGS-001.17
	it('finds the preset of a template, none for the user\'s own', () => {
		expect(presetOf('{name}.{ext}')).toBe('keep-names')
		expect(presetOf(DEFAULT_NAME_TEMPLATE)).toBe('by-day')
		expect(presetOf('{name:lower}.{ext}')).toBeNull()
	})
})

describe('templatePreview', () => {
	// spec: SETTINGS-001.19
	it('renders the default on the 5 samples without a collision, marking file time and unknown camera', () => {
		const preview = templatePreview(DEFAULT_NAME_TEMPLATE)
		const day = '2026/2026-11-09'

		expect(SAMPLE_PICTURES).toHaveLength(5)
		expect(rows(preview)).toEqual([
			{ ...plain, paths: [`${day}/143205_X-T5_DSCF1234.JPG`, `${day}/143205_X-T5_DSCF1234.RAF`] },
			{ ...plain, paths: [`${day}/143205_X-H2_DSCF1234.JPG`, `${day}/143205_X-H2_DSCF1234.RAF`] },
			{ ...plain, paths: [`${day}/143205_iPhone-15-Pro_IMG_0042.JPG`, `${day}/143205_iPhone-15-Pro_IMG_0042.DNG`] },
			{ ...plain, paths: [`${day}/091500_NIKON-Z-6_2_DSC_0815.NEF`, `${day}/091500_NIKON-Z-6_2_DSC_0815.NEF.xmp`] },
			{ paths: [`${day}/180241_unknown_Uebersicht-Maerz.jpg`], suffix: null, fileTime: true, unknownCamera: true },
		])
		expect(preview).toMatchObject({ collisions: 0 })
	})

	// spec: SETTINGS-001.19
	it('suffixes a collision as one move would and counts it', () => {
		const preview = templatePreview('{name}.{ext}')

		expect(rows(preview)).toEqual([
			{ ...plain, paths: ['DSCF1234.JPG', 'DSCF1234.RAF'] },
			{ ...plain, paths: ['DSCF1234-2.JPG', 'DSCF1234-2.RAF'], suffix: 2 },
			{ ...plain, paths: ['IMG_0042.JPG', 'IMG_0042.DNG'] },
			{ ...plain, paths: ['DSC_0815.NEF', 'DSC_0815.NEF.xmp'] },
			{ ...plain, paths: ['Uebersicht-Maerz.jpg'] },
		])
		expect(preview).toMatchObject({ collisions: 1 })
	})

	// spec: SETTINGS-001.19
	it('marks a missing make as an unknown camera, and a sample {number} cannot name', () => {
		const preview = rows(templatePreview('{make}_{number}.{ext}'))

		expect(preview[0]).toEqual({ ...plain, paths: ['FUJIFILM_1234.JPG', 'FUJIFILM_1234.RAF'] })
		expect(preview[4]).toEqual({ paths: null, suffix: null, fileTime: false, unknownCamera: true })
	})

	// spec: SETTINGS-001.18
	it('refuses an invalid template with its problem and column', () => {
		expect(templatePreview('{name} .{ext}')).toEqual({ ok: false, problem: 'whitespace', column: 7 })
	})
})
