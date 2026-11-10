// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const LOGIC_FILE = 'src/logic/example.ts'
const COMPONENT_HELPER_FILE = 'src/components/example.ts'
const TEST_FILE = 'tests/js/example.test.ts'
const COMPONENT_FILE = 'src/components/ExampleView.vue'

const eslint = new ESLint()

async function ruleIds(code: string, filePath: string): Promise<string[]> {
	const [result] = await eslint.lintText(code, { filePath })
	return (result?.messages ?? []).map((message) => message.ruleId ?? message.message)
}

describe('eslint conventions', { timeout: 30_000 }, () => {
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

	it('accepts a translated template', async () => {
		const code = '<script setup lang="ts">\nimport { t } from \'@nextcloud/l10n\'\n</script>\n\n'
			+ '<template>\n\t<p :title="t(\'honeycomb\', \'Pictures\')">\n\t\t{{ t(\'honeycomb\', \'No folder chosen\') }}\n\t</p>\n</template>\n'

		expect(await ruleIds(code, COMPONENT_FILE)).toEqual([])
	})

	it('lints a component\'s script with type information', async () => {
		const code = '<script setup lang="ts">\ndeclare function save(): Promise<void>\nsave()\n</script>\n'

		expect(await ruleIds(code, COMPONENT_FILE)).toContain('@typescript-eslint/no-floating-promises')
	})

	it.each([
		['text', '<p>No folder chosen</p>'],
		['an aria-label', '<button aria-label="Close" />'],
	])('forbids a bare string as %s in a template', async (_name, element) => {
		const code = `<template>\n\t${element}\n</template>\n`

		expect(await ruleIds(code, COMPONENT_FILE)).toContain('vue/no-bare-strings-in-template')
	})

	it.each([
		['t() with an app id other than honeycomb', 't(\'files\', \'Pictures\')'],
		['t() with a string the extractor cannot read', 't(\'honeycomb\', _label)'],
		['n() with a plural the extractor cannot read', 'n(\'honeycomb\', \'%n picture\', _label, 2)'],
		['a literal message in a toast', 'showError(\'Could not save\')'],
	])('forbids %s', async (_name, call) => {
		const code = 'import { n, t } from \'@nextcloud/l10n\'\n\n'
			+ 'declare function showError(message: string): void\n'
			+ `/** Shows it. */\nexport function show(_label: string): unknown {\n\treturn [${call}, n, t, showError]\n}\n`

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toContain('no-restricted-syntax')
	})

	it('accepts a translated message in a toast', async () => {
		const code = 'import { n, t } from \'@nextcloud/l10n\'\n\n'
			+ 'declare function showError(message: string): void\n'
			+ '/** Shows it. */\nexport function show(count: number): void {\n'
			+ '\tshowError(t(\'honeycomb\', \'Could not save\'))\n'
			+ '\tshowError(n(\'honeycomb\', \'%n picture\', \'%n pictures\', count))\n}\n'

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toEqual([])
	})

	it.each([
		['its message', 'error.message'],
		['its message after a cast', '(error as Error).message'],
		['its stack', 'error.stack'],
		['its text', 'String(error)'],
		['its toString()', 'error.toString()'],
		['it in a template string', '`${error}`'],
		['it in a concatenation', '\'Failed: \' + error'],
	])('forbids reading %s from a caught error', async (_name, expression) => {
		const code = 'declare function show(text: unknown): void\n'
			+ `/** Tries it. */\nexport function attempt(run: () => void): void {\n\ttry {\n\t\trun()\n\t} catch (error) {\n\t\tshow(${expression})\n\t}\n}\n`

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toContain('honeycomb/no-raw-error-text')
	})

	it.each([
		['a .catch() handler', 'run().catch((reason: Error) => show(reason.message))'],
		['the rejection handler of .then()', 'run().then(() => undefined, (reason: Error) => show(reason.message))'],
		['a destructured message', 'run().catch(({ message }: Error) => show(message))'],
	])('forbids reading the text of a rejection in %s', async (_name, statement) => {
		const code = 'declare function show(text: unknown): void\ndeclare function run(): Promise<void>\n'
			+ `/** Tries it. */\nexport function attempt(): void {\n\tvoid ${statement}\n}\n`

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toContain('honeycomb/no-raw-error-text')
	})

	it('forbids reading the text of a caught error in a component', async () => {
		const code = '<script setup lang="ts">\ndeclare function show(text: unknown): void\n'
			+ 'try {\n\tshow(1)\n} catch (error) {\n\tshow((error as Error).message)\n}\n</script>\n'

		expect(await ruleIds(code, COMPONENT_FILE)).toContain('honeycomb/no-raw-error-text')
	})

	it('accepts logging, typing and rethrowing a caught error', async () => {
		const code = 'declare const logger: { error(message: string, context: object): void }\n'
			+ 'declare function show(text: string): void\ndeclare function textOf(error: unknown): string\n'
			+ '/** Tries it. */\nexport async function attempt(run: () => Promise<void>): Promise<void> {\n\ttry {\n\t\tawait run()\n\t} catch (error) {\n'
			+ '\t\tlogger.error(\'Could not run\', { error })\n\t\tif (error instanceof TypeError) {\n\t\t\tthrow error\n\t\t}\n\t\tshow(textOf(error))\n\t}\n'
			+ '\tawait run().catch((error: unknown) => logger.error(\'Could not run\', { error }))\n}\n'

		expect(await ruleIds(code, COMPONENT_HELPER_FILE)).toEqual([])
	})

	it('requires a doc comment on an exported function', async () => {
		const code = 'export function undocumented(): number {\n\treturn 1\n}\n'

		expect(await ruleIds(code, LOGIC_FILE)).toContain('jsdoc/require-jsdoc')
	})
})
