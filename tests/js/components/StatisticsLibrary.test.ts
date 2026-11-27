// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderRow } from '../../../src/logic/folder-row.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatFileSize } from '../../../src/shared/l10n.ts'
import { doneRow, row } from '../logic/folder-fixtures.ts'
import { mountPage, ROOTS, ROWS } from './statistics-page-fixtures.ts'

vi.mock('../../../src/shared/logger.ts', () => ({ logger: { error: vi.fn() } }))

enableAutoUnmount(afterEach)

const GB = 1024 ** 3

/** The library card of the page on `rows`, November 2026 counted at 118 decided in 20 days. */
async function libraryOf(rows: readonly FolderRow[], settings: unknown = ROOTS, counters?: []) {
	const wrapper = mountPage(counters ? { counters } : {}, settings, vi.fn(async (root: string) => rows.filter((each) => each.root === root)))
	await flushPromises()
	return wrapper.find('.statistics-library')
}
/** Each fact of the card as its figure and its note. */
const facts = (card: Awaited<ReturnType<typeof libraryOf>>) => card.findAll('.statistics-library__fact').map((fact) => [fact.find('b').text(), fact.find('small').text()])

describe('StatisticsLibrary', () => {
	// spec: STATS-001.42
	it('rings the share of photos in done folders and lists the decided share, the folders and the undecided photos', async () => {
		const card = await libraryOf(ROWS)

		expect(card.find('.statistics-library__ring').attributes('aria-label')).toMatch(/^50\s?% of the photos are in folders marked done$/)
		expect(card.find('.statistics-library__ring').text()).toMatch(/^50\s?%\s*done$/)
		expect(card.find('.statistics-library__arc').attributes('stroke-dasharray')).toBe('50 100')
		expect(facts(card).slice(0, 3)).toEqual([
			[expect.stringMatching(/^90\s?%$/), 'of the photos decided'],
			['1 / 2', 'folders done · +1 this month'],
			['40', 'photos still undecided'],
		])
		expect(card.find('.statistics-library__fact [role="progressbar"]').attributes('aria-valuenow')).toBe('90')
		expect(card.find('h3').text()).toBe('Library progress')
		expect(card.find('a').text()).toBe('Open Folders')
		expect(card.find('a').attributes('href')).toMatch(/\/index\.php\/apps\/honeycomb\/$/)
		expect(card.findAll('.statistics-library__root')).toHaveLength(0)
	})

	// spec: STATS-001.42
	it('gives each of several roots a row with its photos done and a bar', async () => {
		const card = await libraryOf([...ROWS, row({ root: '/Archive', path: '/Archive/old' })], { libraryRoots: ['/Photos', '/Archive'] })

		expect(card.findAll('.statistics-library__root').map((each) => each.text())).toEqual([
			expect.stringMatching(/^\/Photos\s*100 of 200 photos done · 50\s?%$/),
			expect.stringMatching(/^\/Archive\s*0 of 100 photos done · 0\s?%$/),
		])
		expect(card.findAll('.statistics-library__root [role="progressbar"]').map((each) => each.attributes('aria-valuenow'))).toEqual(['100', '0'])
	})

	// spec: STATS-001.42, STATS-001.84
	it('fills the ring at 100 % done and says nothing of the rest', async () => {
		const card = await libraryOf([doneRow({ path: '/Photos/a' })])

		expect(card.find('.statistics-library__arc').attributes('stroke-dasharray')).toBe('100 100')
		expect(card.find('.statistics-library__ring').text()).toMatch(/^100\s?%\s*done$/)
		expect(card.find('.statistics-library__forecast').exists()).toBe(false)
	})

	// spec: STATS-001.84
	it('names the rest at the pace of the last 90 days', async () => {
		const card = await libraryOf(ROWS)

		expect(card.find('.statistics-library__forecast').text()).toMatch(/^About 7 days\s*at your pace \(last 90 days\)$/)
	})

	// spec: STATS-001.84
	it('says the backlog grows when more photos are added than decided', async () => {
		const card = await libraryOf([doneRow({ path: '/Photos/a' }), row({ path: '/Photos/b', shotDays: [{ day: '2026-11-10', photos: 500 }] })])

		expect(card.find('.statistics-library__forecast b').text()).toBe('At this pace the backlog grows')
	})

	// spec: STATS-001.84
	it('says nothing of the rest without a pace', async () => {
		const card = await libraryOf(ROWS, ROOTS, [])

		expect(facts(card)).toHaveLength(3)
		expect(card.find('.statistics-library__forecast').exists()).toBe(false)
	})

	// spec: STATS-001.85
	it('names the RAW space in done folders beside Open Folders, and leaves the line out without it', async () => {
		const card = await libraryOf([doneRow({ path: '/Photos/a', rawBytes: 3 * GB }), row({ path: '/Photos/b', rawBytes: 9 * GB })])

		expect(card.find('.statistics-library__raws').text()).toBe(`Up to ${formatFileSize(3 * GB)} of RAW files lie in folders marked done.`)
		expect(card.find('a').text()).toBe('Open Folders')
		const none = await libraryOf(ROWS)
		expect(none.find('.statistics-library__raws').exists()).toBe(false)
		expect(none.find('a').text()).toBe('Open Folders')
	})
})
