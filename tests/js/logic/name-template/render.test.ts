// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { renderedPath, renderPicture } from '../../../../src/logic/name-template/render.ts'
import { sanitiseValue } from '../../../../src/logic/name-template/sanitise.ts'
import { factsOf, filesOf, templateOf, vectors } from './vectors.ts'

describe('sanitiseValue', () => {
	// spec: MOVE-001.11
	it.each(vectors.sanitise)('turns "$value" into "$sanitised"', ({ value, sanitised }) => {
		expect(sanitiseValue(value)).toBe(sanitised)
	})
})

describe('renderPicture', () => {
	// spec: MOVE-001.7, MOVE-001.8, MOVE-001.9, MOVE-001.10, MOVE-001.12, MOVE-001.13
	it.each(vectors.render)('renders $name', (vector) => {
		const rendered = renderPicture(templateOf(vector.template), factsOf(vector.picture), filesOf(vector.files), '')

		if ('fails' in vector) {
			expect(rendered).toEqual({ ok: false, problem: vector.fails })
		} else {
			expect(rendered.ok && rendered.files.map((file) => renderedPath(file, null))).toEqual(vector.paths)
		}
	})

	// spec: MOVE-001.13
	it('keeps the file name apart from the final extension, so a suffix can go between them', () => {
		const rendered = renderPicture(templateOf('{date:%Y}/{name}.{ext}'), factsOf({}), filesOf(['NEF.xmp']), '')

		expect(rendered).toEqual({ ok: true, files: [{ folder: '2026', name: 'DSCF1234', extension: 'NEF.xmp' }] })
	})

	// spec: MOVE-005.4
	it.each([
		['{job}', 'Hochzeit-Mueller'],
		['{job:lower}', 'hochzeit-mueller'],
		['{job:upper}', 'HOCHZEIT-MUELLER'],
	])('renders %s on every file of the picture as %s, sanitised', (token, value) => {
		const rendered = renderPicture(templateOf(`${token}/${token}_{name}.{ext}`), factsOf({}), filesOf(['JPG', 'RAF', 'RAF.xmp']), ' Hochzeit Müller ')

		expect(rendered.ok && rendered.files.map((file) => renderedPath(file, null))).toEqual(['JPG', 'RAF', 'RAF.xmp'].map((extension) => `${value}/${value}_DSCF1234.${extension}`))
	})

	// spec: MOVE-001.16
	it('puts a darktable duplicate\'s number after the new name and its collision suffix', () => {
		const rendered = renderPicture(templateOf('R{number}.{ext}'), factsOf({}), [{ extension: 'NEF', subfolder: null }, { extension: 'NEF.xmp', subfolder: null, duplicate: '_01' }], '')

		expect(rendered.ok && rendered.files.map((file) => renderedPath(file, null))).toEqual(['R1234.NEF', 'R1234_01.NEF.xmp'])
		expect(rendered.ok && rendered.files.map((file) => renderedPath(file, 2))).toEqual(['R1234-2.NEF', 'R1234-2_01.NEF.xmp'])
	})

	it('refuses a time outside the range of a date instead of rendering NaN', () => {
		expect(() => renderPicture(templateOf('{date:%Y}/{name}.{ext}'), factsOf({ captureTime: 1e16 }), filesOf(['RAF']), '')).toThrow(RangeError)
	})

	it('renders every valid vector template for a picture with every fact', () => {
		for (const template of vectors.valid) {
			expect(renderPicture(templateOf(template), factsOf({}), filesOf(['RAF']), '').ok).toBe(true)
		}
	})
})

describe('renderedPath', () => {
	// spec: MOVE-001.14
	it.each([
		[null, '2026/DSCF1234.NEF.xmp'],
		[2, '2026/DSCF1234-2.NEF.xmp'],
	])('puts suffix %s before the final extension', (suffix, path) => {
		expect(renderedPath({ folder: '2026', name: 'DSCF1234', extension: 'NEF.xmp' }, suffix)).toBe(path)
	})

	it('leaves out the folder at the target folder itself', () => {
		expect(renderedPath({ folder: '', name: 'DSCF1234', extension: 'RAF' }, null)).toBe('DSCF1234.RAF')
	})
})
