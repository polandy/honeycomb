import { expect, test } from '@playwright/test'
import { closeByEscape } from './cull.ts'

const OUT = '/tmp/claude-1026/-home-andy-dev-honeycomb/639e6224-e30e-4806-a65c-7da7c7bfe55d/scratchpad/shots'
const LANDSCAPE = { width: 1133, height: 744 }
const PORTRAIT = { width: 744, height: 1133 }

async function open(page, scheme: 'light' | 'dark', size) {
	await page.emulateMedia({ colorScheme: scheme })
	await page.setViewportSize(size)
	await page.route('**/api/v1/immich/connections', (route) => route.fulfill({ json: { connections: [
		{ id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example' },
		{ id: 'kids', label: 'Kids', url: 'https://kids.immich.example' },
	] } }))
	await page.route('**/api/v1/immich/andy-phone/status', (route) => route.fulfill({ json: { state: 'ok', account: 'andy', version: '2.3.1', total: 3660 } }))
	await page.route('**/api/v1/immich/kids/status', (route) => route.fulfill({ json: { state: 'unreachable', account: null, version: null, total: null } }))
	await page.goto('/index.php/apps/honeycomb/')
	await closeByEscape(page, page.getByRole('dialog', { name: 'Choose folders' }))
	await page.getByRole('group', { name: 'Source' }).getByRole('button', { name: 'Immich' }).click()
	await expect(page.getByText('Connected as andy').first()).toBeVisible()
}

test('shot landscape light', async ({ page }) => {
	await open(page, 'light', LANDSCAPE)
	await page.screenshot({ path: `${OUT}/immich-connected-landscape.png` })
	await page.getByText('Kids', { exact: true }).click()
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
	await page.screenshot({ path: `${OUT}/immich-unreachable-landscape.png` })
})

test('shot portrait dark', async ({ page }) => {
	await open(page, 'dark', PORTRAIT)
	await page.getByRole('button', { name: 'Connection details' }).first().click()
	await expect(page.getByRole('dialog', { name: 'Immich connection' })).toBeVisible()
	await page.waitForTimeout(500)
	await page.screenshot({ path: `${OUT}/immich-dialog-portrait-dark.png` })
})
