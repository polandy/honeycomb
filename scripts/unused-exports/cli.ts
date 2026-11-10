import type { SourceFile } from './analyse.ts'

// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Reads the repository and prints each unused export with what to do about it.
import { readdirSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { findUnusedExports } from './analyse.ts'

const SOURCE_PATTERN = /\.(ts|vue|js|mjs)$/
const CONFIG_PATTERN = /\.config\.(ts|js|mjs)$/
const ROOTS = ['src', 'tests', 'scripts']
const ACTIONS = {
	delete: 'unused anywhere: delete it (and any test of it)',
	unexport: 'used only inside its own module: drop the `export`',
}

/**
 *
 */
function walk(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = `${directory}/${entry.name}`
		if (entry.isDirectory()) {
			return walk(path)
		}
		return SOURCE_PATTERN.test(entry.name) ? [path] : []
	})
}

const paths = [...ROOTS.flatMap(walk), ...readdirSync('.').filter((entry) => CONFIG_PATTERN.test(entry))]
const files: SourceFile[] = paths.map((path) => ({ path, text: readFileSync(path, 'utf8') }))
// Judged: the app; tests, scripts and config only count as importers.
const findings = findUnusedExports(files, (path) => path.startsWith('src/') && path !== 'src/main.ts')
for (const finding of findings) {
	process.stdout.write(`FAIL ${finding.path}:${finding.line} ${finding.name}: ${ACTIONS[finding.action]}\n`)
}
process.exit(findings.length === 0 ? 0 : 1)
