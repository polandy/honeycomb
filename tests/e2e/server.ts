// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page, Request } from '@playwright/test'

import { execFileSync } from 'node:child_process'

const DEFAULT_PORT = 8180

/** The port of the e2e Nextcloud on localhost. */
export const PORT = Number(process.env.HONEYCOMB_E2E_PORT ?? DEFAULT_PORT)

/** Where a run leaves its Playwright output; the default port keeps `test-results/` for CI. */
export const RESULTS_DIR = PORT === DEFAULT_PORT ? 'test-results' : `test-results-${PORT}`

/** The container `scripts/e2e-server.sh` names after the port. */
const CONTAINER = `honeycomb-e2e-${PORT}`

/** Runs `occ` in the e2e container as the web server user and returns its output. */
export function occ(args: string[], env: Record<string, string> = {}): string {
	const envArgs = Object.entries(env).flatMap(([name, value]) => ['-e', `${name}=${value}`])
	return execFileSync('docker', ['exec', ...envArgs, '-u', 'www-data', CONTAINER, 'php', 'occ', ...args], { encoding: 'utf8' })
}

/** How many preview files core has stored for each of the files, by the folder of its file id. */
export function previewFiles(fileIds: number[]): number {
	const paths = fileIds.flatMap((id) => ['-o', '-path', `*/preview/*/${id}/*`]).slice(1)
	const found = execFileSync('docker', ['exec', CONTAINER, 'sh', '-c', 'find /var/www/html/data/appdata_*/preview -type f \\( "$@" \\)', 'sh', ...paths], { encoding: 'utf8' })
	return found.split('\n').filter((line) => line !== '').length
}

/** Logs `user` in through the login form. */
export async function logIn(page: Page, user: { username: string, password: string }): Promise<void> {
	await page.goto('/index.php/login')
	await page.getByLabel('Account name or email').fill(user.username)
	await page.getByLabel('Password', { exact: true }).fill(user.password)
	await page.getByRole('button', { name: 'Log in', exact: true }).click()
	await page.waitForURL(/\/apps\//)
}

/** Tracks the page's requests; the returned function blocks new ones and resolves once every sent one is answered. */
export function trackRequests(page: Page): () => Promise<void> {
	const open = new Set<Request>()
	let drained = (): void => {}
	const settle = (request: Request): void => {
		open.delete(request)
		if (open.size === 0) {
			drained()
		}
	}
	page.on('request', (request) => open.add(request))
	page.on('requestfinished', settle)
	page.on('requestfailed', settle)
	return async () => {
		await page.route('**', (route) => route.abort())
		if (open.size > 0) {
			await new Promise<void>((resolve) => {
				drained = resolve
			})
		}
	}
}
