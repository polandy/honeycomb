// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createFolder } from './files.ts'

// spec: LISTING-003.14
test('keeps the status line quiet and every folder row one height', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const id = randomUUID().slice(0, 8)
	await createFolder(page, `Rows ${id} parent`)
	await createFolder(page, `Rows ${id} parent/Child`)
	await createFolder(page, `Rows ${id} leaf`)
	await page.reload()

	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	const status = picker.getByText('Tick one or more folders.')
	const muted = await status.evaluate((element) => {
		const probe = element.ownerDocument.createElement('span')
		probe.style.color = 'var(--color-text-maxcontrast)'
		element.append(probe)
		const colour = getComputedStyle(probe).color
		probe.remove()
		return colour
	})
	await expect(status).toHaveCSS('font-weight', '400')
	await expect(status).toHaveCSS('color', muted)

	const parent = (await picker.getByRole('option', { name: `Rows ${id} parent` }).boundingBox())!
	const leaf = (await picker.getByRole('option', { name: `Rows ${id} leaf` }).boundingBox())!
	expect(parent.height).toBe(leaf.height)
})
