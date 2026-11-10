// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ILogger } from '@nextcloud/logger'
import type { App as VueApp } from 'vue'

import { createApp } from 'vue'
import App from './App.vue'

/** Creates the honeycomb Vue app; an error that reaches Vue goes to the given logger. */
export function createHoneycombApp(logger: ILogger): VueApp {
	const app = createApp(App)
	app.config.errorHandler = (error, _instance, info) => {
		logger.error('Unhandled error in the honeycomb UI', { error, info })
	}
	return app
}
