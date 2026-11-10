// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { KEYMAP } from '../../../src/logic/hotkeys.ts'

const DOC = readFileSync(new URL('../../../docs/user/keyboard-shortcuts.md', import.meta.url), 'utf8')

/** A key cap as Markdown code, the way the user doc writes it. */
const code = (cap: string) => (cap.includes('`') ? `\`\` ${cap} \`\`` : `\`${cap}\``)

describe('the user doc on keyboard shortcuts', () => {
	// spec: KEYS-001.1
	it.each(KEYMAP.flatMap((entry) => entry.caps.map((cap) => [entry.id, cap])))('lists %s by %s', (_id, cap) => {
		expect(DOC).toContain(code(cap))
	})
})
