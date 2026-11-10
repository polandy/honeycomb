// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { execFileSync } from 'node:child_process'

const DEFAULT_PORT = 8180

/** The port of the e2e Nextcloud on localhost. */
export const PORT = Number(process.env.HONEYCOMB_E2E_PORT ?? DEFAULT_PORT)

/** The container `scripts/e2e-server.sh` names after the port. */
const CONTAINER = `honeycomb-e2e-${PORT}`

/** Runs `occ` in the e2e container as the web server user and returns its output. */
export function occ(args: string[], env: Record<string, string> = {}): string {
	const envArgs = Object.entries(env).flatMap(([name, value]) => ['-e', `${name}=${value}`])
	return execFileSync('docker', ['exec', ...envArgs, '-u', 'www-data', CONTAINER, 'php', 'occ', ...args], { encoding: 'utf8' })
}

/** Logs `user` in through the login form. */
export async function logIn(page: Page, user: { username: string, password: string }): Promise<void> {
	await page.goto('/index.php/login')
	await page.getByLabel('Account name or email').fill(user.username)
	await page.getByLabel('Password', { exact: true }).fill(user.password)
	await page.getByRole('button', { name: 'Log in', exact: true }).click()
	await page.waitForURL(/\/apps\//)
}
