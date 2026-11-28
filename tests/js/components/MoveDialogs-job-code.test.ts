// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { confirmButton, mountDialogs } from './mount-move-dialogs.ts'

/** The dialogs over the template, the recent job codes stored as `jobCodes`, open on the pair with `/Out` chosen. */
async function openOnPair(template: string, jobCodes: string[]) {
	const mounted = mountDialogs({ template })
	mounted.settings.value = { ...mounted.settings.value, moveJobCodes: jobCodes }
	mounted.moving.open([mounted.pair])
	mounted.moving.choose('/Out')
	await flushPromises()
	return mounted
}

const field = (wrapper: Awaited<ReturnType<typeof openOnPair>>['wrapper']) => wrapper.find<HTMLInputElement>('input[aria-label="Job code"]')

describe('MoveDialogs: job code', () => {
	// spec: MOVE-005.5
	it('shows the Job code field, prefilled with the last job code, and the recent ones as buttons', async () => {
		const { wrapper } = await openOnPair('{job}_{name}.{ext}', ['Last', 'Older'])

		expect(field(wrapper).element.value).toBe('Last')
		expect(field(wrapper).attributes('maxlength')).toBe('40')
		expect(wrapper.findAll('[aria-label="Recent job codes"] button').map((button) => [button.text(), button.attributes('aria-pressed')])).toEqual([['Last', 'true'], ['Older', 'false']])
		expect(wrapper.text()).toContain('→ /Out/Last_IMG_1.JPG')
		wrapper.unmount()
	})

	// spec: MOVE-005.5
	it('shows no Job code field for a template without {job}', async () => {
		const { wrapper } = await openOnPair('{name}.{ext}', ['Last'])

		expect(field(wrapper).exists()).toBe(false)
		expect(wrapper.find('[aria-label="Recent job codes"]').exists()).toBe(false)
		wrapper.unmount()
	})

	// spec: MOVE-005.4, MOVE-005.6
	it('renders what is typed live and blocks the move while it is empty after sanitising', async () => {
		const { wrapper } = await openOnPair('{job}_{name}.{ext}', [])
		expect(wrapper.text()).toContain('Enter a job code')
		expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()

		await field(wrapper).setValue('Hochzeit Müller')

		expect(wrapper.text()).toContain('→ /Out/Hochzeit-Mueller_IMG_1.JPG')
		expect(wrapper.text()).not.toContain('Enter a job code')
		expect(confirmButton(wrapper).attributes('disabled')).toBeUndefined()

		await field(wrapper).setValue(' ?! ')
		expect(wrapper.text()).toContain('Enter a job code')
		expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()
		wrapper.unmount()
	})

	// spec: MOVE-005.8
	it('puts a recent job code into the field when tapped', async () => {
		const { wrapper, moving } = await openOnPair('{job}_{name}.{ext}', ['Last', 'Older'])

		await wrapper.findAll('[aria-label="Recent job codes"] button')[1]!.trigger('click')

		expect(moving.job.code.value).toBe('Older')
		expect(field(wrapper).element.value).toBe('Older')
		wrapper.unmount()
	})

	// spec: MOVE-005.6
	it('does not move on Enter in the field while the job code is empty', async () => {
		const { wrapper, sent } = await openOnPair('{job}_{name}.{ext}', [])

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
		await flushPromises()

		expect(sent).toEqual([])
		wrapper.unmount()
	})
})
