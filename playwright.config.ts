// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig, devices } from '@playwright/test'
import { ADMIN, ADMIN_STATE } from './tests/e2e/admin.ts'

const PORT = 8180
const BASE_URL = `http://localhost:${PORT}`
const NEXTCLOUD_INSTALL_TIMEOUT_MS = 300_000

export default defineConfig({
	testDir: 'tests/e2e',
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
	],
	webServer: {
		command: `scripts/e2e-server.sh ${PORT} ${ADMIN.username} ${ADMIN.password}`,
		url: `${BASE_URL}/status.php`,
		timeout: NEXTCLOUD_INSTALL_TIMEOUT_MS,
		reuseExistingServer: !process.env.CI,
		gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
	},
})
