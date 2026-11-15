// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ILogger } from '@nextcloud/logger'
import type { App as VueApp } from 'vue'

import { createApp } from 'vue'
import App from './App.vue'

/** Creates the honeycomb Vue app; an error that reaches Vue goes to the given logger. */
export function createHoneycombApp(logger: ILogger, versionsApp: boolean): VueApp {
	const app = createApp(App, { versionsApp })
	app.config.errorHandler = (error, _instance, info) => {
		logger.error('Unhandled error in the honeycomb UI', { error, info })
	}
	return app
}

/** Whether the page says the Versions app is enabled; on unless it says off, so the server rechecks every write. */
export function versionsAppOf(root: HTMLElement | null): boolean {
	return root?.dataset.versionsApp !== 'false'
}
