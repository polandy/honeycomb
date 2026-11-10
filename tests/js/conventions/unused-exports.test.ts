// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import type { Finding } from '../../../scripts/unused-exports/analyse.ts'
import { findUnusedExports } from '../../../scripts/unused-exports/analyse.ts'

const everything = () => true
const onlySrc = (path: string) => path.startsWith('src/')

function run(sources: Record<string, string>, isJudged: (path: string) => boolean = everything): Finding[] {
	const files = Object.entries(sources).map(([path, text]) => ({ path, text }))
	return findUnusedExports(files, isJudged)
}

const names = (findings: Finding[]) => findings.map((finding) => `${finding.name}:${finding.action}`)

describe('findUnusedExports', () => {
	it.each([
		{
			title: 'an export nobody imports is to be deleted',
			sources: { 'src/a.ts': 'export const a = 1\nexport function b() {}' },
			expected: ['a:delete', 'b:delete'],
		},
		{
			title: 'an imported export is used, an unimported sibling is not',
			sources: {
				'src/a.ts': 'export const a = 1\nexport const b = 2',
				'src/c.ts': 'import { a } from \'./a\'\nexport const c = a',
			},
			expected: ['b:delete', 'c:delete'],
		},
		{
			title: 'an export used only inside its own module loses the export',
			sources: { 'src/a.ts': 'export const a = 1\nfoo(a)' },
			expected: ['a:unexport'],
		},
		{
			title: 'an export used by a test is used',
			sources: {
				'src/a.ts': 'export function a() {}',
				'tests/js/a.test.ts': 'import { a } from \'../../src/a.ts\'\na()',
			},
			expected: [],
		},
		{
			title: 'an import under a local alias counts for the original name',
			sources: {
				'src/a.ts': 'export const a = 1',
				'src/c.ts': 'import { a as renamed } from \'./a.ts\'\nrenamed',
			},
			expected: [],
		},
		{
			title: 'a namespace import uses everything',
			sources: {
				'src/a.ts': 'export const a = 1\nexport const b = 2',
				'src/c.ts': 'import * as all from \'./a\'\nall',
			},
			expected: [],
		},
		{
			title: 'a dynamic import uses everything',
			sources: {
				'src/a.ts': 'export const a = 1',
				'src/c.ts': 'const m = await import(\'./a\')\nm',
			},
			expected: [],
		},
		{
			title: 'a re-export uses the original',
			sources: {
				'src/a.ts': 'export const a = 1',
				'src/index.ts': 'export { a } from \'./a\'',
			},
			expected: [],
		},
		{
			title: 'an import from a directory resolves to its index',
			sources: {
				'src/dir/index.ts': 'export const a = 1',
				'src/c.ts': 'import { a } from \'./dir\'\na',
			},
			expected: [],
		},
		{
			title: 'the imports of a component\'s script blocks count as uses',
			sources: {
				'src/a.ts': 'export const a = 1\nexport const b = 2',
				'src/V.vue': '<script lang="ts">\nimport { a } from \'./a\'\n</script>\n<script setup lang="ts">\nimport { b } from \'./a\'\n</script>\n<template>{{ a }}</template>',
			},
			expected: [],
		},
		{
			title: 'a component\'s own exports are not judged',
			sources: { 'src/V.vue': '<script lang="ts">\nexport const a = 1\n</script>' },
			expected: [],
		},
		{
			title: 'types, interfaces, classes and export lists are all exports',
			sources: { 'src/a.ts': 'export type T = 1\nexport interface I {}\nexport class K {}\nconst z = 1\nexport { z }' },
			expected: ['T:delete', 'I:delete', 'K:delete', 'z:delete'],
		},
		{
			title: 'a value that only a typeof query reads stays exported',
			sources: { 'src/a.ts': 'export const KEYS = [\'a\'] as const\nexport type Key = (typeof KEYS)[number]\nfoo(null as Key | null)' },
			expected: [],
		},
		{
			title: 'a type used inside its own module stays exported, it may appear in signatures',
			sources: { 'src/a.ts': 'export interface Options {}\nexport type Id = string\nfoo(null as Options | Id)' },
			expected: [],
		},
		{
			title: 'a default export is not judged',
			sources: { 'src/a.ts': 'export default 1' },
			expected: [],
		},
		{
			title: 'files outside the judged set may use exports but are not reported',
			sources: {
				'src/a.ts': 'export const a = 1',
				'tests/js/x.ts': 'import { a } from \'../../src/a\'\nexport const unused = a',
			},
			expected: [],
			isJudged: onlySrc,
		},
	])('$title', ({ sources, expected, isJudged }) => {
		expect(names(run(sources, isJudged))).toEqual(expected)
	})

	it('reports the line of the declaration', () => {
		const [finding] = run({ 'src/a.ts': '\n\nexport const a = 1' })

		expect(finding).toEqual({ path: 'src/a.ts', line: 3, name: 'a', action: 'delete' })
	})
})
