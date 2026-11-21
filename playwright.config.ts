// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from '@playwright/test'
import { ADMIN, ADMIN_STATE } from './tests/e2e/admin.ts'
import { PORT, RESULTS_DIR } from './tests/e2e/server.ts'
import { IPAD_PORTRAIT, WEBKIT } from './tests/e2e/webkit.ts'

const BASE_URL = `http://localhost:${PORT}`
const NEXTCLOUD_INSTALL_TIMEOUT_MS = 300_000
// The device's own user agent names iOS 12, which Nextcloud redirects to its unsupported-browser page.
const IPAD_USER_AGENT = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
// WebKit needs system libraries not every host has, so CI and opted-in hosts add its project.
const WEBKIT_PROJECTS = process.env.HONEYCOMB_E2E_WEBKIT === '1'
	? [
			{ name: 'webkit', dependencies: ['login'], grep: new RegExp(WEBKIT), use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 }, storageState: ADMIN_STATE } },
			{ name: 'webkit-ipad', dependencies: ['login'], grep: new RegExp(WEBKIT), use: { ...devices['iPad Pro 11 landscape'], userAgent: IPAD_USER_AGENT, storageState: ADMIN_STATE } },
			{ name: 'webkit-ipad-portrait', dependencies: ['login'], grep: new RegExp(IPAD_PORTRAIT), use: { ...devices['iPad Pro 11'], userAgent: IPAD_USER_AGENT, storageState: ADMIN_STATE } },
		]
	: []

export default defineConfig({
	testDir: 'tests/e2e',
	outputDir: RESULTS_DIR,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: {
		baseURL: BASE_URL,
		reducedMotion: 'reduce',
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'login', testMatch: /\.setup\.ts$/ },
		{
			name: 'desktop',
			dependencies: ['login'],
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: ADMIN_STATE },
		},
		...WEBKIT_PROJECTS,
	],
	webServer: {
		command: `scripts/e2e-server.sh ${PORT} ${ADMIN.username} ${ADMIN.password}`,
		url: `${BASE_URL}/status.php`,
		timeout: NEXTCLOUD_INSTALL_TIMEOUT_MS,
		// A server already on the port may serve another worktree's checkout.
		reuseExistingServer: false,
		gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
	},
})
