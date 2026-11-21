// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LOG_CALL = /\blogger\.(?:debug|info|warn|error)\(/g
const PATH_WORD = /\b(?:path|paths|folder|folders|folderSet|name|filename|file|keyFile)\b/
const STRING = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g

/** The text of every `logger.x(...)` call in `code`, strings blanked out. */
function logCalls(code: string): string[] {
	const calls: string[] = []
	for (const start of code.matchAll(LOG_CALL)) {
		const from = start.index + start[0].length
		let depth = 1
		let end = from
		const blanked = code.slice(from).replace(STRING, (text) => `''${' '.repeat(text.length - 2)}`)
		while (depth > 0 && end - from < blanked.length) {
			depth += blanked[end - from] === '(' ? 1 : blanked[end - from] === ')' ? -1 : 0
			end++
		}
		calls.push(blanked.slice(0, end - from))
	}
	return calls
}

const pathCalls = (code: string): string[] => logCalls(code).filter((call) => PATH_WORD.test(call))

function sources(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		return entry.isDirectory() ? sources(path) : /\.(ts|vue)$/.test(entry.name) ? [path] : []
	})
}

describe('a log call never holds a path or a file name', () => {
	it('holds in src/', () => {
		const files = sources('src')
		const violations = files.filter((file) => pathCalls(readFileSync(file, 'utf8')).length > 0)

		expect(files.length).toBeGreaterThan(0)
		expect(violations).toEqual([])
	})

	it.each([
		['a path shorthand', 'logger.error(\'Could not count\', { paths, error })'],
		['a folder key', 'logger.warn(\'Could not load\', { error, folder: current, cursor })'],
		['a name on two lines', 'logger.info(\'Opened\', {\n\tname: file.name,\n})'],
	])('finds an inserted line with %s', (_name, line) => {
		expect(pathCalls(line)).toHaveLength(1)
	})

	it.each([
		'logger.warn(\'Could not load the folder of a path\', { error, fileId: member.fileId })',
		'logger.error(job.failures.save, { error: result.error, count: batch.length })',
	])('accepts an id-only line', (line) => {
		expect(pathCalls(line)).toEqual([])
	})
})
