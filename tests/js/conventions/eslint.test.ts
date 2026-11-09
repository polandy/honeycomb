// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const LOGIC_FILE = 'src/logic/example.ts'
const COMPONENT_HELPER_FILE = 'src/components/example.ts'
const TEST_FILE = 'tests/js/example.test.ts'

const eslint = new ESLint()

async function ruleIds(code: string, filePath: string): Promise<string[]> {
	const [result] = await eslint.lintText(code, { filePath })
	return (result?.messages ?? []).map((message) => message.ruleId ?? message.message)
}

describe('eslint conventions', () => {
	it('accepts a documented pure logic module', async () => {
		const code = '/** Counts the pictures that are decided. */\n'
			+ 'export function countDecided(flags: readonly string[]): number {\n'
			+ '\treturn flags.filter((flag) => flag !== \'\').length\n}\n'

		expect(await ruleIds(code, LOGIC_FILE)).toEqual([])
	})

	it.each([
		['the wall clock', 'Date.now()'],
		['the current date', 'new Date()'],
		['randomness', 'Math.random()'],
	])('forbids %s in a logic module', async (_name, expression) => {
		const code = `/** Reads it. */\nexport function read(): unknown {\n\treturn ${expression}\n}\n`

		expect(await ruleIds(code, LOGIC_FILE)).toContain('no-restricted-syntax')
	})

	it.each([
		['vue', 'import { ref } from \'vue\''],
		['a Nextcloud package', 'import axios from \'@nextcloud/axios\''],
	])('forbids importing %s in a logic module', async (_name, statement) => {
		const code = `${statement}\n\n/** Uses it. */\nexport const used = [${statement.includes('ref') ? 'ref' : 'axios'}]\n`

		expect(await ruleIds(code, LOGIC_FILE)).toContain('no-restricted-imports')
	})

	it.each([
		['setTimeout', 'setTimeout(() => {}, 10)'],
		['the wall clock', 'Date.now()'],
		['a Playwright timeout wait', 'page.waitForTimeout(10)'],
	])('forbids %s in a test', async (_name, statement) => {
		const code = `declare const page: { waitForTimeout(ms: number): Promise<void> }\nexport async function run(): Promise<void> {\n\tawait Promise.resolve(${statement})\n}\n`

		expect(await ruleIds(code, TEST_FILE)).toEqual(expect.arrayContaining([expect.stringMatching(/^no-restricted-(syntax|properties)$/)]))
	})

	it('forbids writing HTML into the DOM', async () => {
		const code = '/** Renders it. */\nexport function render(element: { innerHTML: string }): void {\n\telement.innerHTML = \'<b>x</b>\'\n}\n'

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toContain('no-restricted-properties')
	})

	it('forbids any', async () => {
		const code = '/** Echoes it. */\nexport function echo(value: any): unknown {\n\treturn value\n}\n'

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toContain('@typescript-eslint/no-explicit-any')
	})

	it('forbids a dropped promise', async () => {
		const code = '/** Saves it. */\nexport function save(write: () => Promise<void>): void {\n\twrite()\n}\n'

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toContain('@typescript-eslint/no-floating-promises')
	})

	it('forbids swallowing an error', async () => {
		const code = '/** Tries it. */\nexport function attempt(run: () => void): void {\n\ttry {\n\t\trun()\n\t} catch {\n\t}\n}\n'

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toContain('no-empty')
	})

	it('requires a doc comment on an exported function', async () => {
		const code = 'export function undocumented(): number {\n\treturn 1\n}\n'

		expect(await ruleIds(code, LOGIC_FILE)).toContain('jsdoc/require-jsdoc')
	})
})
