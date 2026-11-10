// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RenderedFile } from '../../../../src/logic/name-template/render.ts'

import { describe, expect, it } from 'vitest'
import { collisionSuffixes } from '../../../../src/logic/name-template/collisions.ts'
import { renderedPath, renderPicture } from '../../../../src/logic/name-template/render.ts'
import { factsOf, filesOf, templateOf, vectors } from './vectors.ts'

describe('collisionSuffixes', () => {
	// spec: MOVE-001.14, MOVE-001.15
	it.each(vectors.collisions)('$name', (vector) => {
		const template = templateOf(vector.template)
		const pictures = vector.pictures.map(({ picture, files }) => {
			const rendered = renderPicture(template, factsOf(picture), filesOf(files))
			return rendered.ok ? rendered.files : []
		})

		const suffixes = collisionSuffixes(pictures, vector.existing)

		expect(pictures.map((files, index) => files.map((file) => renderedPath(file, suffixes[index] ?? null)))).toEqual(vector.paths)
	})

	it('gives no suffix when nothing collides', () => {
		const file = (name: string): RenderedFile => ({ folder: '', name, extension: 'RAF' })

		expect(collisionSuffixes([[file('A')], [file('B')]])).toEqual([null, null])
	})
})
