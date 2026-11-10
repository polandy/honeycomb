// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NameTemplate } from '../../../../src/logic/name-template/parse.ts'
import type { MemberFile, PictureFacts } from '../../../../src/logic/name-template/render.ts'

import { parseNameTemplate } from '../../../../src/logic/name-template/parse.ts'
import vectors from '../../../fixtures/name-templates/vectors.json' with { type: 'json' }

export { vectors }

type VectorFile = string | { readonly extension: string, readonly subfolder: string }

/** The vectors' default facts with the case's overrides. */
export function factsOf(overrides: Partial<PictureFacts>): PictureFacts {
	return { ...vectors.defaults, ...overrides }
}

/** A vector's files: an extension alone stays in the rendered folders. */
export function filesOf(files: readonly VectorFile[]): MemberFile[] {
	return files.map((file) => typeof file === 'string' ? { extension: file, subfolder: null } : file)
}

/** The parsed template; fails the test when the vector's template is invalid. */
export function templateOf(text: string): NameTemplate {
	const parsed = parseNameTemplate(text)
	if (!parsed.ok) {
		throw new Error(`invalid vector template ${text}: ${parsed.problem} at ${parsed.column}`)
	}
	return parsed.template
}
