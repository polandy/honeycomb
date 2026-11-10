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
		const rendered = renderPicture(templateOf(vector.template), factsOf(vector.picture), filesOf(vector.files))

		if ('fails' in vector) {
			expect(rendered).toEqual({ ok: false, problem: vector.fails })
		} else {
			expect(rendered.ok && rendered.files.map((file) => renderedPath(file, null))).toEqual(vector.paths)
		}
	})

	// spec: MOVE-001.13
	it('keeps the file name apart from the final extension, so a suffix can go between them', () => {
		const rendered = renderPicture(templateOf('{date:%Y}/{name}.{ext}'), factsOf({}), filesOf(['NEF.xmp']))

		expect(rendered).toEqual({ ok: true, files: [{ folder: '2026', name: 'DSCF1234', extension: 'NEF.xmp' }] })
	})

	it('renders every valid vector template for a picture with every fact', () => {
		for (const template of vectors.valid) {
			expect(renderPicture(templateOf(template), factsOf({}), filesOf(['RAF'])).ok).toBe(true)
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
