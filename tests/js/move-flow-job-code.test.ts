// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { allMoved, moveFlow } from './move-fixtures.ts'

/** A flow over the `{job}` template, the recent job codes stored as `jobCodes`. */
function jobFlow(jobCodes: string[], template = '{job}_{name}.{ext}', answer = allMoved()) {
	const fixture = moveFlow(answer, { template })
	fixture.settings.value = { ...fixture.settings.value, moveJobCodes: jobCodes }
	return fixture
}

describe('useMoveFlow: the job code', () => {
	// spec: MOVE-005.5
	it('asks for the job code only when the template uses it, prefilled with the last one', () => {
		const { moving, pair } = jobFlow(['Last shoot', 'Older'])
		moving.open([pair])

		expect(moving.job.needed.value).toBe(true)
		expect(moving.job.code.value).toBe('Last shoot')
		expect(moving.job.recent.value).toEqual(['Last shoot', 'Older'])

		const plain = jobFlow(['Last shoot'], '{name}.{ext}')
		plain.moving.open([plain.pair])
		expect(plain.moving.job.needed.value).toBe(false)
		expect(plain.moving.job.ready.value).toBe(true)
	})

	// spec: MOVE-005.4
	it('renders the typed job code live in the summary', async () => {
		const { moving, pair } = jobFlow([])
		moving.open([pair])
		moving.job.type('Hochzeit Müller')
		moving.choose('/Out')
		await flushPromises()

		expect(moving.plan.value!.flatMap((picture) => picture.files.map(({ path }) => path))).toEqual(['/Out/Hochzeit-Mueller_IMG_1.JPG', '/Out/Hochzeit-Mueller_IMG_1.CR3'])
	})

	// spec: MOVE-005.6
	it('sends nothing while the job code is empty after sanitising', async () => {
		const { moving, pair, sent } = jobFlow([])
		moving.open([pair])
		moving.job.type(' ?! ')
		moving.choose('/Out')
		await flushPromises()

		expect(moving.job.ready.value).toBe(false)
		await moving.confirm()

		expect(sent).toEqual([])
		expect(moving.pictures.value).not.toBeNull()
	})

	// spec: MOVE-005.7
	it('keeps the first 40 characters typed', () => {
		const { moving, pair } = jobFlow([])
		moving.open([pair])
		moving.job.type('x'.repeat(45))

		expect(moving.job.code.value).toBe('x'.repeat(40))
	})

	// spec: MOVE-005.8
	it('remembers the job code first once a file moved, and offers it at the next open', async () => {
		const { moving, pair, single, settings } = jobFlow(['Older'])
		moving.open([pair])
		moving.job.type('New shoot')
		moving.choose('/Out')
		await flushPromises()
		await moving.confirm()

		expect(settings.value.moveJobCodes).toEqual(['New shoot', 'Older'])
		moving.open([single])
		expect(moving.job.code.value).toBe('New shoot')
	})

	// spec: MOVE-005.8
	it('keeps the recent job codes when nothing moved or the template does not use one', async () => {
		const failed = jobFlow(['Older'], '{job}_{name}.{ext}', async (request) => request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'not-found' as const }))))
		failed.moving.open([failed.pair])
		failed.moving.job.type('New shoot')
		failed.moving.choose('/Out')
		await flushPromises()
		await failed.moving.confirm()
		expect(failed.settings.value.moveJobCodes).toEqual(['Older'])

		const plain = jobFlow(['Older'], '{name}.{ext}')
		plain.moving.open([plain.pair])
		plain.moving.choose('/Out')
		await flushPromises()
		await plain.moving.confirm()
		expect(plain.settings.value.moveJobCodes).toEqual(['Older'])
		expect(plain.settings.value.moveRecent[0]).toBe('/Out')
	})
})
